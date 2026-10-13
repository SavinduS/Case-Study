import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets
} from 'react-native-safe-area-context';
import { fetchMe, login as apiLogin, NetworkError, registerVillager } from './src/api/client';
import { destinationForRole } from './src/auth/roles';
import { clearSession, loadSession, saveSession } from './src/auth/session';
import type { AuthSession } from './src/auth/types';
import RangerIcon from './src/components/RangerIcon';
import RangerSidebar, { type RangerNavId } from './src/components/RangerSidebar';
import LocationPickerScreen from './src/screens/LocationPickerScreen';
import LoginScreen from './src/screens/LoginScreen';
import MyIncidentsScreen from './src/screens/MyIncidentsScreen';
import NewFieldIncidentScreen from './src/screens/NewFieldIncidentScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ReviewIncidentScreen from './src/screens/ReviewIncidentScreen';
import SubmitResultScreen from './src/screens/SubmitResultScreen';
import VillagerShell from './src/screens/VillagerShell';
import WebDashboardScreen from './src/screens/WebDashboardScreen';
import type { FieldIncidentDraft } from './src/fieldIncidentTypes';
import { useRangerIncidents } from './src/hooks/useRangerIncidents';
import type { StoredFieldIncident } from './src/services/incidentStorage';
import type { GpsFix } from './src/services/location';
import { colors, font, spacing } from './src/theme';
import type { ValidatedFieldIncident } from './src/fieldIncidentTypes';

// Log Field Incident Offline flow only:
// myIncidents (F3, default) -> report (F1) -> review (F2) -> result (F2).
// profile shows the signed-in ranger; pickLocation is a modal overlay from
// report/review when GPS fails.
// Ranger sign-in lands in this flow; Villager gets the conflict-report flow
// (VillagerShell) and Manager/Officer are handed to the web dashboard.
type AppView = 'report' | 'review' | 'result' | 'myIncidents' | 'profile' | 'pickLocation';

// Startup: the stored session is revalidated against the server before the
// app trusts the role inside it.
type BootState = 'checking' | 'signedOut' | 'signedIn';

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
      <RangerShell onSignOut={() => void handleSignOut()} token={session.token} user={session} />
    </SafeFrame>
  );
}

// Ranger home after sign-in: the offline field-incident flow.
// Incident Reports is the default landing page. All persistence goes
// through incidentStorage via useRangerIncidents; there is no seed data and
// no simulated sync, and no automatic connectivity sync. Navigation is the
// left sidebar (fixed on wide screens, drawer on phones); the bottom tab bar
// is villager-only and never rendered here.
function RangerShell({ onSignOut, token, user }: { onSignOut: () => void; token: string; user: AuthSession }) {
  const {
    incidents: saved,
    loading: incidentsLoading,
    syncing,
    submitting,
    submitError,
    syncError,
    submitReport,
    syncNow,
    clearSubmitError
  } = useRangerIncidents(token);
  const [view, setView] = useState<AppView>('myIncidents');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [manualFix, setManualFix] = useState<GpsFix | null>(null);
  const [reviewed, setReviewed] = useState<ValidatedFieldIncident | null>(null);
  // Stable UUID of the report being edited (null for a brand-new report), so
  // Edit Report never mints a new unique ID.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<StoredFieldIncident | null>(null);
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
  // A fresh review starts a new report unless it came from Edit (editingId).
  function handleReview(incident: ValidatedFieldIncident) {
    setReviewed(incident);
    setView('review');
  }

  // F2 -> F1: Edit Report navigates back with current values preserved,
  // including the stable reportId so resubmission never duplicates.
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
    clearSubmitError();
    setView('report');
  }

  // F2 -> result: offline-first submit. Offline (or network failure) keeps
  // the report pending and shows the pending confirmation; a reachable server
  // takes it directly (Alt Flow 3) and the result shows Synchronized. A
  // permanent rejection stays on review with the error for correction, and a
  // full device store keeps the draft (reviewed) intact for retry.
  async function handleSubmit() {
    if (!reviewed || submitting) return;
    const outcome = await submitReport(reviewed, editingId);
    if ('error' in outcome) {
      if (!outcome.stored) return;
      // Validation rejection or storage failure: stay on review so the ranger
      // can correct and resubmit; the draft and reportId are preserved.
      return;
    }
    setLastResult(outcome.stored);
    setEditingId(null);
    setView('result');
  }

  function handleNewReport() {
    setReviewed(null);
    setEditingId(null);
    setLastResult(null);
    setEditDraft(undefined);
    setManualFix(null);
    clearSubmitError();
    setFormKey((k) => k + 1);
    setView('report');
  }

  // F3 sync: push pending rows; per-item failures stay on their rows.
  function handleSyncNow() {
    void syncNow();
  }

  // Sidebar: Incident Reports first, Add New Incident second, Sync Reports
  // triggers the real manual sync below, Ranger Profile shows the signed-in
  // user, Logout reuses existing auth sign-out.
  function handleSidebarSelect(id: RangerNavId) {
    setDrawerOpen(false);
    if (id === 'incidents') setView('myIncidents');
    else if (id === 'report') handleNewReport();
    else if (id === 'profile') setView('profile');
    else if (id === 'sync') {
      setView('myIncidents');
      handleSyncNow();
    }
  }

  const sidebarActive =
    view === 'myIncidents' ? 'incidents' : view === 'profile' ? 'profile' : 'report';
  const pendingCount = saved.filter((i) => i.status === 'pending').length;

  if (view === 'pickLocation') {
    return (
      <View style={styles.content}>
        <LocationPickerScreen
          initialFix={manualFix}
          initialManual={manualFix !== null}
          onConfirm={(fix) => {
            setManualFix(fix);
            setView(pickReturnTo === 'pickLocation' ? 'report' : pickReturnTo);
          }}
          onCancel={() => setView(pickReturnTo === 'pickLocation' ? 'report' : pickReturnTo)}
        />
      </View>
    );
  }

  const body = (
    <View style={styles.body}>
      {view === 'review' && reviewed ? (
        <ReviewIncidentScreen
          incident={reviewed}
          onEdit={handleEdit}
          onSubmit={() => void handleSubmit()}
          onChangeLocation={() => openPicker('review')}
          submitError={submitError}
          submitting={submitting}
        />
      ) : view === 'result' && lastResult ? (
        <SubmitResultScreen
          incident={lastResult.incident}
          status={lastResult.status === 'synced' ? 'synced' : 'pending'}
          displayId={lastResult.displayId ?? null}
          onGoToMyIncidents={() => setView('myIncidents')}
          onNewReport={handleNewReport}
        />
      ) : view === 'myIncidents' ? (
        <MyIncidentsScreen
          incidents={saved}
          syncing={syncing}
          syncError={syncError}
          loading={incidentsLoading}
          onSyncNow={handleSyncNow}
          onNewReport={handleNewReport}
        />
      ) : view === 'profile' ? (
        <ProfileScreen user={user} onSignOut={onSignOut} />
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
  );

  // Desktop/tablet landscape: fixed left sidebar, no bottom bar.
  if (isWide) {
    return (
      <View style={styles.wideRow}>
        <RangerSidebar
          active={sidebarActive}
          syncing={syncing}
          pendingCount={pendingCount}
          user={user}
          onSelect={handleSidebarSelect}
          onSignOut={onSignOut}
        />
        {body}
      </View>
    );
  }

  // Phone: compact top bar with a drawer; the bottom tab bar stays
  // villager-only and is never rendered in the Ranger layout.
  return (
    <View style={styles.content}>
      <View style={styles.compactBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open navigation menu"
          onPress={() => setDrawerOpen(true)}
          style={({ pressed }) => [styles.menuButton, pressed && styles.menuPressed]}
        >
          <RangerIcon name="menu" size={24} color={colors.white} />
        </Pressable>
        <Text style={styles.compactTitle}>Ranger Dashboard</Text>
        <View style={styles.compactSpacer} />
      </View>
      {body}
      {drawerOpen ? (
        <View style={styles.drawerOverlay}>
          <View style={styles.drawerPanel}>
            <RangerSidebar
              active={sidebarActive}
              syncing={syncing}
              pendingCount={pendingCount}
              user={user}
              onSelect={handleSidebarSelect}
              onSignOut={onSignOut}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close navigation menu"
            onPress={() => setDrawerOpen(false)}
            style={styles.drawerScrim}
          />
        </View>
      ) : null}
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
  body: {
    flex: 1,
    backgroundColor: colors.bg
  },
  wideRow: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.bg
  },
  compactBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 52
  },
  menuButton: {
    minWidth: 48,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8
  },
  menuPressed: {
    backgroundColor: 'rgba(255,255,255,0.15)'
  },
  compactTitle: {
    color: colors.white,
    fontSize: font.section,
    fontWeight: '800',
    marginLeft: 4
  },
  compactSpacer: {
    flex: 1
  },
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row'
  },
  drawerScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)'
  },
  drawerPanel: {
    width: 248,
    backgroundColor: colors.primaryDark
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