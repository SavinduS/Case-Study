import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets
} from 'react-native-safe-area-context';
import { fetchMe, login as apiLogin, NetworkError, registerVillager } from './src/api/client';
import { destinationForRole } from './src/auth/roles';
import { clearSession, loadSession, saveSession } from './src/auth/session';
import type { AuthSession } from './src/auth/types';
import TabBar, { RANGER_TABS } from './src/components/TabBar';
import LocationPickerScreen from './src/screens/LocationPickerScreen';
import LoginScreen from './src/screens/LoginScreen';
import MyIncidentsScreen, { StoredFieldIncident } from './src/screens/MyIncidentsScreen';
import NewFieldIncidentScreen from './src/screens/NewFieldIncidentScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ReviewIncidentScreen from './src/screens/ReviewIncidentScreen';
import SubmitResultScreen from './src/screens/SubmitResultScreen';
import VillagerShell from './src/screens/VillagerShell';
import WebDashboardScreen from './src/screens/WebDashboardScreen';
import type { FieldIncidentDraft } from './src/fieldIncidentTypes';
import type { GpsFix } from './src/services/location';
import { colors, font, spacing } from './src/theme';
import type { ValidatedFieldIncident } from './src/fieldIncidentTypes';

// Log Field Incident Offline flow only:
// report (F1) -> review (F2) -> result (F2) -> myIncidents (F3).
// pickLocation is a modal overlay from report/review when GPS fails.
// Ranger sign-in lands in this flow; Villager gets the conflict-report flow
// (VillagerShell) and Manager/Officer are handed to the web dashboard.
type AppView = 'report' | 'review' | 'result' | 'myIncidents' | 'pickLocation';

// Startup: the stored session is revalidated against the server before the
// app trusts the role inside it.
type BootState = 'checking' | 'signedOut' | 'signedIn';

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

// One place for the notches, so every signed-in screen starts at the same edge.
function SafeFrame({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
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
      {children}
    </View>
  );
}

function AppContent() {
  const [boot, setBoot] = useState<BootState>('checking');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  // Restore the previous session. An expired token or a removed account drops
  // back to the login screen instead of opening a UI the user may not have
  // access to any more. A network failure keeps the stored session: the user
  // stays signed in and the app degrades to offline behaviour.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadSession();
      if (cancelled) return;
      if (!stored) {
        setBoot('signedOut');
        return;
      }
      try {
        const user = await fetchMe(stored.token);
        if (cancelled) return;
        const refreshed: AuthSession = {
          ...stored,
          id: user.id,
          name: user.name,
          role: user.role,
          phone: user.phone,
          email: user.email
        };
        await saveSession(refreshed);
        setSession(refreshed);
        setBoot('signedIn');
      } catch (e) {
        if (cancelled) return;
        if (e instanceof NetworkError) {
          setSession(stored);
          setBoot('signedIn');
          return;
        }
        // ApiError(401) and anything unexpected: the token cannot be trusted.
        await clearSession();
        setBoot('signedOut');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = useCallback(async (identifier: string, password: string) => {
    const user = await apiLogin(identifier, password);
    await saveSession(user);
    setSession(user);
    setBoot('signedIn');
    return user;
  }, []);

  // Villager self sign-up: the server always creates a villager, so the
  // response goes through the same save-and-route path as signing in.
  const handleRegister = useCallback(
    async (input: { name: string; phone: string; password: string; email?: string }) => {
      const user = await registerVillager(input);
      await saveSession(user);
      setSession(user);
      setBoot('signedIn');
      return user;
    },
    []
  );

  const handleSignOut = useCallback(async () => {
    await clearSession();
    setSession(null);
    setBoot('signedOut');
  }, []);

  if (boot === 'checking') {
    return (
      <View style={styles.boot}>
        <StatusBar style="dark" />
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.bootText}>Checking your sign-in…</Text>
      </View>
    );
  }

  if (boot === 'signedOut' || !session) {
    return (
      <SafeFrame>
        {authView === 'register' ? (
          <RegisterScreen
            onSubmit={handleRegister}
            onBackToSignIn={() => setAuthView('login')}
          />
        ) : (
          <LoginScreen
            onSubmit={handleLogin}
            onRegister={() => setAuthView('register')}
          />
        )}
      </SafeFrame>
    );
  }

  // Manager and Officer work from the Operations Dashboard; Villager and
  // Ranger stay in the field app.
  if (destinationForRole(session.role) === 'webDashboard') {
    return (
      <SafeFrame>
        <WebDashboardScreen session={session} onSignOut={() => void handleSignOut()} />
      </SafeFrame>
    );
  }

  if (session.role === 'villager') {
    return (
      <SafeFrame>
        <VillagerShell user={session} onSignOut={() => void handleSignOut()} />
      </SafeFrame>
    );
  }

  return (
    <SafeFrame>
      <RangerShell onSignOut={() => void handleSignOut()} />
    </SafeFrame>
  );
}

// Ranger home after sign-in: the offline field-incident flow.
function RangerShell({ onSignOut }: { onSignOut: () => void }) {
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

  function handleTabSelect(tabId: string) {
    if (tabId === 'report') setView('report');
    else if (tabId === 'myIncidents') setView('myIncidents');
  }

  const tabActive = view === 'myIncidents' ? 'myIncidents' : 'report';

  return (
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
      {view === 'pickLocation' ? null : (
        <TabBar
          tabs={RANGER_TABS}
          active={tabActive}
          onSelect={handleTabSelect}
          onSignOut={onSignOut}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg
  },
  content: {
    flex: 1,
    backgroundColor: colors.bg
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    gap: spacing.md
  },
  bootText: {
    color: colors.textMuted,
    fontSize: font.body
  }
});