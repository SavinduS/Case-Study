import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { ApiError, createReport, NetworkError, uploadPhoto } from './src/api/client';
import LocationPickerScreen from './src/screens/LocationPickerScreen';
import ReportSuccessScreen from './src/screens/ReportSuccessScreen';
import SubmitReportScreen, { SubmitData } from './src/screens/SubmitReportScreen';
import {
  getCurrentFix,
  GpsState,
  requestLocationPermission
} from './src/services/location';
import { colors } from './src/theme';
import type { ConflictReportConfirmation } from './src/types';

type View = 'form' | 'success' | 'pickLocation';

const INITIAL_GPS: GpsState = { status: 'detecting', fix: null, manual: false };

export default function App() {
  const [view, setView] = useState<View>('form');
  const [gps, setGps] = useState<GpsState>(INITIAL_GPS);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null);
  const [confirmation, setConfirmation] = useState<ConflictReportConfirmation | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

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

  useEffect(() => {
    detectLocation();
  }, [detectLocation]);

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
          setServerError(
            'Your report has not reached the system yet. Check your connection and try again.'
          );
          setSubmitting(false);
          return;
        }
        setPhotoError('Photo could not be uploaded. Try again, or remove the photo.');
        setSubmitting(false);
        return;
      }
    }

    try {
      const result = await createReport({ ...data, photoUrl });
      setConfirmation(result);
      setView('success');
    } catch (e) {
      if (e instanceof ApiError) {
        const errors = (e.payload.errors ?? null) as Record<string, string> | null;
        if (e.status === 400 && errors) {
          setFieldErrors(errors);
        } else {
          setServerError(e.message);
        }
      } else if (e instanceof NetworkError) {
        setServerError(
          'Your report has not reached the system yet. Check your connection and try again.'
        );
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleDone() {
    setConfirmation(null);
    setFieldErrors(null);
    setServerError(null);
    setPhotoUri(null);
    setPhotoError(null);
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
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {view === 'success' && confirmation ? (
        <ReportSuccessScreen confirmation={confirmation} onDone={handleDone} />
      ) : view === 'pickLocation' ? (
        <LocationPickerScreen
          initialFix={gps.fix}
          initialManual={gps.manual}
          onConfirm={handleLocationPicked}
          onCancel={() => setView('form')}
        />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg
  }
});
