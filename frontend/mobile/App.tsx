import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import TabBar, { TabId } from './src/components/TabBar';
import LocationPickerScreen from './src/screens/LocationPickerScreen';
import MyIncidentsScreen, { StoredFieldIncident } from './src/screens/MyIncidentsScreen';
import NewFieldIncidentScreen from './src/screens/NewFieldIncidentScreen';
import ReviewIncidentScreen from './src/screens/ReviewIncidentScreen';
import SubmitResultScreen from './src/screens/SubmitResultScreen';
import type { FieldIncidentDraft } from './src/fieldIncidentTypes';
import type { GpsFix } from './src/services/location';
import { colors } from './src/theme';
import type { ValidatedFieldIncident } from './src/fieldIncidentTypes';

// Log Field Incident Offline flow only:
// report (F1) -> review (F2) -> result (F2) -> myIncidents (F3).
// pickLocation is a modal overlay from report/review when GPS fails.
type AppView = 'report' | 'review' | 'result' | 'myIncidents' | 'pickLocation';

function seedInitialIncidents(): StoredFieldIncident[] {
  const now = Date.now();
  return [
    {
      id: 'pending-1',
      status: 'pending',
      incident: {
        capturedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        incidentType: 'elephant',
        description: 'Elephant herd near the north boundary fence.',
        location: { coordinates: [81.41, 6.47], manual: false },
        photoUri: null
      }
    },
    {
      id: 'synced-1',
      status: 'synced',
      incident: {
        capturedAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        incidentType: 'snare',
        description: 'Snare wire found on the patrol trail.',
        location: { coordinates: [81.38, 6.5], manual: true },
        photoUri: null
      }
    }
  ];
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<AppView>('report');
  const [manualFix, setManualFix] = useState<GpsFix | null>(null);
  const [reviewed, setReviewed] = useState<ValidatedFieldIncident | null>(null);
  const [lastResult, setLastResult] = useState<StoredFieldIncident | null>(null);
  const [saved, setSaved] = useState<StoredFieldIncident[]>(seedInitialIncidents);
  const [syncing, setSyncing] = useState(false);
  const [pickReturnTo, setPickReturnTo] = useState<AppView>('report');
  // Bump to remount the form so "Edit Report" restores values cleanly.
  const [formKey, setFormKey] = useState(0);
  const [editDraft, setEditDraft] = useState<Partial<FieldIncidentDraft> | undefined>(
    undefined
  );

  function openPicker(from: AppView) {
    setPickReturnTo(from);
    setView('pickLocation');
  }

  // F1 -> F2: Review Incident button passes validated form data.
  function handleReview(incident: ValidatedFieldIncident) {
    setReviewed(incident);
    setView('review');
  }

  // F2 -> F1: Edit Report navigates back with current values preserved.
  function handleEdit() {
    if (reviewed) {
      setEditDraft({
        capturedAt: reviewed.capturedAt,
        incidentType: reviewed.incidentType,
        description: reviewed.description,
        photoUri: reviewed.photoUri
      });
      setManualFix({ coordinates: reviewed.location.coordinates });
      setFormKey((k) => k + 1);
    }
    setView('report');
  }

  // F2 -> F2 result: Submit Report saves offline and shows confirmation.
  function handleSubmit() {
    if (!reviewed) return;
    const entry: StoredFieldIncident = {
      id: `local-${Date.now()}`,
      incident: reviewed,
      status: 'pending'
    };
    setSaved((prev) => [entry, ...prev]);
    setLastResult(entry);
    setView('result');
  }

  function handleNewReport() {
    setReviewed(null);
    setLastResult(null);
    setEditDraft(undefined);
    setManualFix(null);
    setFormKey((k) => k + 1);
    setView('report');
  }

  // F3 sync: flip all pending -> synchronized after a short delay.
  function handleSyncNow() {
    if (syncing) return;
    setSyncing(true);
    setTimeout(() => {
      setSaved((prev) => prev.map((item) => ({ ...item, status: 'synced' as const })));
      setSyncing(false);
    }, 1200);
  }

  function handleTabSelect(tab: TabId) {
    if (tab === 'report') setView('report');
    else setView('myIncidents');
  }

  const tabActive: TabId = view === 'myIncidents' ? 'myIncidents' : 'report';

  return (
    <View
      style={[
        styles.safe,
        {
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right
        }
      ]}
    >
      <StatusBar style="dark" />
      <View style={styles.content}>
        {view === 'pickLocation' ? (
          <LocationPickerScreen
            initialFix={manualFix}
            initialManual={manualFix !== null}
            onConfirm={(fix) => {
              setManualFix(fix);
              setView(pickReturnTo === 'pickLocation' ? 'report' : pickReturnTo);
            }}
            onCancel={() => setView(pickReturnTo === 'pickLocation' ? 'report' : pickReturnTo)}
          />
        ) : view === 'review' && reviewed ? (
          <ReviewIncidentScreen
            incident={reviewed}
            onEdit={handleEdit}
            onSubmit={handleSubmit}
            onChangeLocation={() => openPicker('review')}
          />
        ) : view === 'result' && lastResult ? (
          <SubmitResultScreen
            incident={lastResult.incident}
            onGoToMyIncidents={() => setView('myIncidents')}
            onNewReport={handleNewReport}
          />
        ) : view === 'myIncidents' ? (
          <MyIncidentsScreen
            incidents={saved}
            syncing={syncing}
            onSyncNow={handleSyncNow}
            onNewReport={handleNewReport}
          />
        ) : (
          <NewFieldIncidentScreen
            key={formKey}
            initialDraft={editDraft}
            manualFix={manualFix}
            onReview={handleReview}
            onOpenManualLocation={() => openPicker('report')}
          />
        )}
      </View>
      {view === 'pickLocation' ? null : <TabBar active={tabActive} onSelect={handleTabSelect} />}
    </View>
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
