import React, { useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import PrimaryButton from '../components/PrimaryButton';
import StatusBanner from '../components/StatusBanner';
import { dashboardPathForRole, roleLabel } from '../auth/roles';
import type { AuthSession } from '../auth/types';
import { webUiUrl } from '../config';
import { colors, font, spacing } from '../theme';

interface Props {
  session: AuthSession;
  onSignOut: () => void;
}

/** Where the dashboard looks for the mobile session. */
export const WEB_SESSION_KEY = '@wildlife-alert/web-session';

// Writes the session into the dashboard's own localStorage. JSON.stringify is
// applied twice on purpose: once to make a JSON document, once to make that
// document a safe JavaScript string literal.
export function sessionScript(session: AuthSession): string {
  return `window.localStorage.setItem(${JSON.stringify(WEB_SESSION_KEY)}, ${JSON.stringify(
    JSON.stringify({
      id: session.id,
      name: session.name,
      role: session.role,
      token: session.token
    })
  )}); true;`;
}

// Base address plus the role's starting path ("/analytics/type", "/").
function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`;
}

/**
 * Manager and Officer sign-in lands here: the part of the Operations Dashboard
 * that their role uses, loaded inside the app so they do not have to leave the
 * phone and sign in again. The Park Manager goes to the analytics workspace,
 * the Operations Officer to the collar alert dashboard.
 *
 * The session is handed over through the WebView's localStorage rather than
 * the URL, so the token never ends up in a bookmark, a history entry or a
 * server access log.
 */
export default function WebDashboardScreen({ session, onSignOut }: Props) {
  const url = useMemo(
    () => joinUrl(webUiUrl(), dashboardPathForRole(session.role)),
    [session.role]
  );
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped by "Try again" to remount the WebView (a reload request alone is
  // ignored by the WebView when the failure was in loading the page at all).
  const [reloadKey, setReloadKey] = useState(0);

  function retry() {
    setError(null);
    setReloadKey((k) => k + 1);
  }

  // Injected before the dashboard's own scripts, so the session is in place
  // the moment the app boots.
  const injectedJavaScript = useMemo(
    () => sessionScript(session),
    [session]
  );

  function openInBrowser() {
    void Linking.openURL(url);
  }

  // The dashboard's own Sign out button (Topbar) clears the session there and
  // posts this message, so signing out inside the page returns the phone to
  // the login screen instead of leaving a session-less dashboard on screen.
  // It also asks for the session when the page came up without one.
  function handleMessage(event: { nativeEvent: { data: string } }) {
    let message: { type?: string };
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return; // Not one of ours.
    }
    if (message.type === 'signedOut') {
      onSignOut();
    } else if (message.type === 'requestSession') {
      webRef.current?.injectJavaScript(sessionScript(session));
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        <View style={styles.titles}>
          <Text style={styles.title}>Operations Dashboard</Text>
          <Text style={styles.subtitle}>
            {roleLabel(session.role)} · {session.name}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={onSignOut}
          style={({ pressed }) => [styles.barButton, pressed && styles.pressed]}
        >
          <Text style={styles.barButtonText}>Sign out</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.bannerWrap}>
          <StatusBanner
            tone="error"
            title="Dashboard could not load"
            message={`${error} The dashboard is served from ${url}.`}
          />
          <View style={styles.bannerActions}>
            <View style={styles.actionButton}>
              <PrimaryButton label="Try again" onPress={retry} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open the dashboard in your browser"
              onPress={openInBrowser}
              style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
            >
              <Text style={styles.linkButtonText}>Open in browser</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.webWrap}>
        <WebView
          ref={webRef}
          // Remount when the session changes so the injected token is fresh.
          key={`${session.id}-${session.token}-${reloadKey}`}
          source={{ uri: url }}
          injectedJavaScript={injectedJavaScript}
          injectedJavaScriptBeforeContentLoaded={injectedJavaScript}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(
              'No response from the dashboard address. Check that the web portal is running and reachable from this device.'
            );
          }}
          onHttpError={(event) => {
            // A 5xx still renders the app shell in some cases; only 5xx is
            // treated as a real failure here, 4xx pages are shown as they are.
            if (event.nativeEvent.statusCode >= 500) {
              setError(`The dashboard replied with error ${event.nativeEvent.statusCode}.`);
            }
          }}
          onMessage={handleMessage}
          style={styles.web}
        />
        {loading && !error ? (
          <View pointerEvents="none" style={styles.loadingOverlay} accessibilityRole="progressbar">
            <Text style={styles.loadingText}>Loading the dashboard…</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  titles: {
    flex: 1
  },
  title: {
    color: colors.text,
    fontSize: font.section,
    fontWeight: '700'
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: font.tiny,
    marginTop: 2
  },
  barButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm
  },
  barButtonText: {
    color: colors.primary,
    fontSize: font.body,
    fontWeight: '700'
  },
  pressed: {
    opacity: 0.6
  },
  bannerWrap: {
    padding: spacing.md,
    paddingBottom: 0
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  actionButton: {
    flex: 1
  },
  linkButton: {
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm
  },
  linkButtonText: {
    color: colors.primary,
    fontSize: font.body,
    fontWeight: '700'
  },
  webWrap: {
    flex: 1
  },
  web: {
    flex: 1,
    backgroundColor: colors.surface
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: font.body
  }
});