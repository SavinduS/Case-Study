import NetInfo from '@react-native-community/netinfo';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  ApiError,
  createReport,
  getReport,
  NetworkError,
  pingServer,
  uploadPhoto
} from './src/api/client';
import TabBar from './src/components/TabBar';
import LocationPickerScreen from './src/screens/LocationPickerScreen';
import MyReportsScreen from './src/screens/MyReportsScreen';
import ReportPendingScreen from './src/screens/ReportPendingScreen';
import ReportSuccessScreen from './src/screens/ReportSuccessScreen';
import SmsGuideScreen from './src/screens/SmsGuideScreen';
import SubmitReportScreen, { SubmitData } from './src/screens/SubmitReportScreen';
import {
  getCurrentFix,
  GpsState,
  requestLocationPermission
} from './src/services/location';
import { enqueue, flushQueue, recordOnlineSuccess } from './src/services/offlineQueue';
import { colors } from './src/theme';
import type { ConflictReportConfirmation } from './src/types';

type AppView = 'form' | 'success' | 'pickLocation' | 'pending' | 'myReports' | 'smsGuide';

const INITIAL_GPS: GpsState = { status: 'detecting', fix: null, manual: false };

export default function App() {
  const [view, setViewState] = useState<AppView>('form');
  const viewRef = useRef<AppView>('form');
  const setView = useCallback((next: AppView) => {
    viewRef.current = next;
    setViewState(next);
  }, []);
  const [gps, setGps] = useState<GpsState>(INITIAL_GPS);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null);
  const [confirmation, setConfirmation] = useState<ConflictReportConfirmation | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [pendingLocalRef, setPendingLocalRef] = useState<string | null>(null);

  const pendingRef = useRef<string | null>(null);
  const flushingRef = useRef(false);

  function setPendingRef(ref: string | null) {
    pendingRef.current = ref;
    setPendingLocalRef(ref);
  }

  const detectLocation = useCallback(async () => {
    setGps({ status: 'detecting', fix: null, manual: false });
    const granted = await requestLocationPermission();
    if (!granted) {
      setGps({
        status: 'error',
        fix: null,
        manual: false,
        error: 'Location permission was denied. Set the incident location on the map.'
      });
      return;
    }
    try {
      const fix = await getCurrentFix();
      setGps({ status: 'located', fix, manual: false });
    } catch {
      setGps({
        status: 'error',
        fix: null,
        manual: false,
        error: 'GPS could not determine your position. Set the location on the map.'
      });
    }
  }, []);

  // FR-14: flush locally saved reports on launch and whenever connectivity returns
  const flushSavedReports = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const result = await flushQueue();
      const ref = pendingRef.current;
      if (!ref) return;
      const item = result.synced.find((i) => i.clientRefId === ref);
      if (!item?.reportId) return;
      // Only the pending screen auto-replaces itself with the confirmation
      if (viewRef.current !== 'pending') return;

      let confirmationData: ConflictReportConfirmation;
      try {
        confirmationData = await getReport(item.reportId);
      } catch {
        confirmationData = {
          reportId: item.reportId,
          status: 'RECEIVED',
          submissionMethod: 'app',
          incidentType: item.payload.incidentType,
          locationText: item.payload.locationText,
          createdAt: item.createdAt
        };
      }
      setPendingRef(null);
      setConfirmation(confirmationData);
      setView('success');
    } finally {
      flushingRef.current = false;
    }
  }, []);

  useEffect(() => {
    detectLocation();
    void flushSavedReports();
    void pingServer(); // warm up base-URL discovery in the background
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false && state.isInternetReachable !== false;
      if (online) void flushSavedReports();
    });
    return unsubscribe;
  }, [detectLocation, flushSavedReports]);

  // The reconnect event can fire before the network actually works — keep
  // retrying while the app is open so pending rows never wait for a manual tap
  useEffect(() => {
    const interval = setInterval(() => {
      void flushSavedReports();
    }, 30_000);
    return () => clearInterval(interval);
  }, [flushSavedReports]);

  // FR-13: server unreachable → keep the report on the device
  async function saveOffline(data: SubmitData, uploadedPhotoUrl?: string) {
    try {
      const entry = await enqueue(
        { ...data, ...(uploadedPhotoUrl ? { photoUrl: uploadedPhotoUrl } : {}) },
        uploadedPhotoUrl ? undefined : (photoUri ?? undefined)
      );
      setPendingRef(entry.clientRefId);
      setView('pending');
    } catch {
      setServerError('Could not save the report on this device. Free some storage and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(data: SubmitData) {
    setSubmitting(true);
    setServerError(null);
    setFieldErrors(null);
    setPhotoError(null);

    let photoUrl: string | undefined;
    if (photoUri) {
      try {
        photoUrl = await uploadPhoto(photoUri);
      } catch (e) {
        if (e instanceof ApiError) {
          // E5: villager informed, can retry or remove the photo and submit without it
          setPhotoError(
            `Photo could not be uploaded: ${e.message}. Try again, or remove the photo to submit without it.`
          );
          setSubmitting(false);
          return;
        }
        if (e instanceof NetworkError) {
          await saveOffline(data);
          return;
        }
        setPhotoError('Photo could not be uploaded. Try again, or remove the photo.');
        setSubmitting(false);
        return;
      }
    }

    try {
      const result = await createReport({ ...data, photoUrl });
      const storedPayload = { ...data, ...(photoUrl ? { photoUrl } : {}) };
      try {
        await recordOnlineSuccess(result, storedPayload);
      } catch {
        // local history is best-effort; the confirmation screen still shows the id
      }
      setConfirmation(result);
      setSubmitting(false);
      setView('success');
    } catch (e) {
      if (e instanceof ApiError) {
        const errors = (e.payload.errors ?? null) as Record<string, string> | null;
        if (e.status === 400 && errors) {
          setFieldErrors(errors);
        } else {
          setServerError(e.message);
        }
        setSubmitting(false);
      } else if (e instanceof NetworkError) {
        // E3: server unreachable → queue locally, inform that it has not arrived yet
        await saveOffline(data, photoUrl);
      } else {
        setServerError('Something went wrong. Please try again.');
        setSubmitting(false);
      }
    }
  }

  function handleDone() {
    setConfirmation(null);
    setFieldErrors(null);
    setServerError(null);
    setPhotoUri(null);
    setPhotoError(null);
    setPendingRef(null);
    setFormKey((k) => k + 1);
    setView('form');
  }

  function handlePhotoChange(uri: string | null) {
    setPhotoUri(uri);
    setPhotoError(null);
  }

  function openLocationPicker() {
    setView('pickLocation');
  }

  function handleLocationPicked(fix: { coordinates: [number, number]; accuracyMeters?: number }) {
    setGps({ status: 'located', fix, manual: true });
    setView('form');
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.content}>
          {view === 'success' && confirmation ? (
            <ReportSuccessScreen confirmation={confirmation} onDone={handleDone} />
          ) : view === 'pending' && pendingLocalRef ? (
            <ReportPendingScreen localRef={pendingLocalRef} onDone={handleDone} />
          ) : view === 'pickLocation' ? (
            <LocationPickerScreen
              initialFix={gps.fix}
              initialManual={gps.manual}
              onConfirm={handleLocationPicked}
              onCancel={() => setView('form')}
            />
          ) : view === 'myReports' ? (
            <MyReportsScreen onRefreshReports={flushSavedReports} />
          ) : view === 'smsGuide' ? (
            <SmsGuideScreen />
          ) : (
            <SubmitReportScreen
              key={formKey}
              gps={gps}
              submitting={submitting}
              serverError={serverError}
              fieldErrors={fieldErrors}
              photoUri={photoUri}
              photoError={photoError}
              onSubmit={handleSubmit}
              onOpenPicker={openLocationPicker}
              onPhotoChange={handlePhotoChange}
            />
          )}
        </View>
        {view === 'success' || view === 'pending' || view === 'pickLocation' ? null : (
          <TabBar active={view} onSelect={setView} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg
  },
  content: {
    flex: 1
  }
});
