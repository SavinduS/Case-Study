import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, SafeAreaView, StyleSheet } from 'react-native';
import { ApiError, createReport, NetworkError } from './src/api/client';
import ReportSuccessScreen from './src/screens/ReportSuccessScreen';
import SubmitReportScreen, { SubmitData } from './src/screens/SubmitReportScreen';
import {
  getCurrentFix,
  GpsState,
  requestLocationPermission
} from './src/services/location';
import { colors } from './src/theme';
import type { ConflictReportConfirmation } from './src/types';

type View = 'form' | 'success';

const INITIAL_GPS: GpsState = { status: 'detecting', fix: null, manual: false };

export default function App() {
  const [view, setView] = useState<View>('form');
  const [gps, setGps] = useState<GpsState>(INITIAL_GPS);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null);
  const [confirmation, setConfirmation] = useState<ConflictReportConfirmation | null>(null);
  const [formKey, setFormKey] = useState(0);

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
    try {
      const result = await createReport(data);
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
    setFormKey((k) => k + 1);
    setView('form');
  }

  function openLocationPicker() {
    // Map-based manual picker arrives in the next commit
    Alert.alert('Change location', 'The map location picker is not available yet.');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {view === 'success' && confirmation ? (
        <ReportSuccessScreen confirmation={confirmation} onDone={handleDone} />
      ) : (
        <SubmitReportScreen
          key={formKey}
          gps={gps}
          submitting={submitting}
          serverError={serverError}
          fieldErrors={fieldErrors}
          onSubmit={handleSubmit}
          onOpenPicker={openLocationPicker}
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
