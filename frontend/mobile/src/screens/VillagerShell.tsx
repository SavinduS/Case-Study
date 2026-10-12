import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ApiError, createReport, NetworkError } from '../api/client';
import TabBar, { VILLAGER_TABS } from '../components/TabBar';
import { enqueue, flushQueue, recordOnlineSuccess } from '../services/offlineQueue';
import { useFieldIncidentLocation } from '../hooks/useFieldIncidentLocation';
import { colors } from '../theme';
import type { GpsFix } from '../services/location';
import type { ConflictReportConfirmation, ReportSubmission } from '../types';
import LocationPickerScreen from './LocationPickerScreen';
import MyReportsScreen from './MyReportsScreen';
import ReportPendingScreen from './ReportPendingScreen';
import ReportSuccessScreen from './ReportSuccessScreen';
import SmsGuideScreen from './SmsGuideScreen';
import SubmitReportScreen, { type SubmitData } from './SubmitReportScreen';

interface Props {
  onSignOut: () => void;
}

type VillagerView = 'submit' | 'myReports' | 'smsGuide' | 'pending' | 'success' | 'picker';

/**
 * Villager home after sign-in: the conflict-report flow.
 *
 * submit -> (accepted online) success -> submit
 *        -> (no connection)     pending -> my reports
 * my reports lists everything this device knows about and retries uploads.
 */
export default function VillagerShell({ onSignOut }: Props) {
  const [view, setView] = useState<VillagerView>('submit');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [manualFix, setManualFix] = useState<GpsFix | null>(null);
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConflictReportConfirmation | null>(null);

  const { gps } = useFieldIncidentLocation({ externalFix: manualFix });

  const refreshReports = useCallback(async () => {
    await flushQueue();
  }, []);

  async function handleSubmit(data: SubmitData) {
    setSubmitting(true);
    setServerError(null);
    setFieldErrors(null);
    setPhotoError(null);

    const payload: ReportSubmission = {
      incidentType: data.incidentType,
      location: { coordinates: data.location.coordinates },
      description: data.description,
      accuracyMeters: data.accuracyMeters,
      locationText: data.locationText
    };

    try {
      const accepted = await createReport(payload);
      // Keep it in the on-device history so My Reports still shows the CR- id.
      await recordOnlineSuccess(accepted, payload);
      setConfirmation(accepted);
      setPhotoUri(null);
      setView('success');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      if (e instanceof NetworkError) {
        // No connection: store on the device and say so in words.
        const entry = await enqueue(payload, photoUri ?? undefined);
        setPendingRef(entry.clientRefId);
        setPhotoUri(null);
        setView('pending');
      } else if (e instanceof ApiError) {
        // A rejection is about this report, so show the named fields when the
        // server sent them and a plain banner when it did not.
        const detail = e.payload.errors;
        if (detail && Object.keys(detail).length > 0) {
          setFieldErrors(detail as Record<string, string>);
        }
        if (e.status === 413 || e.status === 415) {
          // The photo, not the report, is the problem — say which and what to do.
          setPhotoError(
            'The attached photo was rejected (too large, or an unsupported file). Remove it and submit again.'
          );
        }
        setServerError(e.message);
      } else {
        setServerError('The report could not be sent. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (view === 'picker') {
    return (
      <LocationPickerScreen
        initialFix={manualFix}
        initialManual={manualFix !== null}
        onConfirm={(fix) => {
          setManualFix(fix);
          setView('submit');
        }}
        onCancel={() => setView('submit')}
      />
    );
  }

  if (view === 'pending' && pendingRef) {
    return <ReportPendingScreen localRef={pendingRef} onDone={() => setView('myReports')} />;
  }

  if (view === 'success' && confirmation) {
    return (
      <ReportSuccessScreen
        confirmation={confirmation}
        onDone={() => {
          setConfirmation(null);
          setView('submit');
        }}
      />
    );
  }

  const screen =
    view === 'myReports' ? (
      <MyReportsScreen onRefreshReports={refreshReports} onSignOut={onSignOut} />
    ) : view === 'smsGuide' ? (
      <SmsGuideScreen onSignOut={onSignOut} />
    ) : (
      <SubmitReportScreen
        gps={gps}
        submitting={submitting}
        serverError={serverError}
        fieldErrors={fieldErrors}
        photoUri={photoUri}
        photoError={photoError}
        onSubmit={(data) => void handleSubmit(data)}
        onOpenPicker={() => setView('picker')}
        onSignOut={onSignOut}
        onPhotoChange={(uri) => {
          setPhotoUri(uri);
          // Clearing or re-picking a photo clears the "rejected photo" note.
          setPhotoError(null);
        }}
      />
    );

  return (
    <View style={styles.container}>
      {screen}
      <TabBar
        tabs={VILLAGER_TABS}
        active={view === 'myReports' || view === 'smsGuide' ? view : 'submit'}
        onSelect={(id) =>
          setView(id === 'myReports' ? 'myReports' : id === 'smsGuide' ? 'smsGuide' : 'submit')
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  }
});