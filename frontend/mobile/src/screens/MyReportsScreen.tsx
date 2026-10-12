import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { ApiError, getReport, pingServer } from '../api/client';
import { INCIDENT_ICONS, INCIDENT_LABELS } from '../constants/incidentTypes';
import { listReports } from '../services/offlineQueue';
import StatusBanner from '../components/StatusBanner';
import ScreenHeader from '../components/ScreenHeader';
import SignOutButton from '../components/SignOutButton';
import { colors, font, radius, spacing } from '../theme';
import type { QueuedReport } from '../types';

interface Props {
  onRefreshReports: () => Promise<void>;
  onSignOut?: () => void;
}

type ServerState = 'checking' | 'up' | 'down';

interface ServerStatus {
  state: ServerState;
}

type LiveState =
  | { state: 'loading' }
  | { state: 'ok'; status: string }
  | { state: 'missing' }
  | { state: 'error' };

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function MyReportsScreen({ onRefreshReports, onSignOut }: Props) {
  const [entries, setEntries] = useState<QueuedReport[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [server, setServer] = useState<ServerStatus>({
    state: 'checking'
  });
  const [live, setLive] = useState<Record<string, LiveState>>({});

  const reload = useCallback(async () => {
    const list = await listReports();
    setEntries(list);
    setLoadingList(false);
  }, []);

  const checkServer = useCallback(async () => {
    setServer((s) => ({ ...s, state: 'checking' }));
    const result = await pingServer();
    setServer({ state: result.reachable ? 'up' : 'down' });
  }, []);

  useEffect(() => {
    void reload();
    void checkServer();
  }, [reload, checkServer]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefreshReports();
    } finally {
      setRefreshing(false);
    }
    await Promise.all([reload(), checkServer()]);
  }, [onRefreshReports, reload, checkServer]);

  async function checkStatus(item: QueuedReport) {
    const reportId = item.reportId;
    if (!reportId) return;
    setLive((prev) => ({ ...prev, [reportId]: { state: 'loading' } }));
    try {
      const result = await getReport(reportId);
      setLive((prev) => ({ ...prev, [reportId]: { state: 'ok', status: result.status } }));
    } catch (e) {
      const missing = e instanceof ApiError && e.status === 404;
      setLive((prev) => ({
        ...prev,
        [reportId]: { state: missing ? 'missing' : 'error' }
      }));
    }
  }

  function renderLiveLine(reportId: string | undefined) {
    if (!reportId) return null;
    const state = live[reportId];
    if (!state) return <Text style={styles.tapHint}>Tap to check live status</Text>;
    if (state.state === 'loading') return <Text style={styles.tapHint}>Checking server status…</Text>;
    if (state.state === 'ok') return <Text style={styles.liveOk}>Server status now: {state.status}</Text>;
    if (state.state === 'missing') return <Text style={styles.liveError}>Not found on the server</Text>;
    return <Text style={styles.liveError}>Could not reach the server</Text>;
  }

  function renderItem({ item }: { item: QueuedReport }) {
    const pending = item.status === 'PENDING_UPLOAD';
    const label =
      INCIDENT_LABELS[item.payload.incidentType] ?? item.payload.incidentType;
    const icon = INCIDENT_ICONS[item.payload.incidentType] ?? '❗';
    const meta = [item.payload.locationText, relativeTime(item.createdAt)]
      .filter(Boolean)
      .join('  ·  ');

    return (
      <View style={styles.row}>
        <View style={styles.rowHeader}>
          <Text style={styles.typeIcon}>{icon}</Text>
          <Text style={styles.type}>{label}</Text>
          <View style={[styles.badge, pending ? styles.badgePending : styles.badgeReceived]}>
            <Text style={pending ? styles.badgePendingText : styles.badgeReceivedText}>
              {pending ? 'PENDING UPLOAD' : 'RECEIVED'}
            </Text>
          </View>
        </View>

        <Text style={styles.id}>{pending ? item.clientRefId : item.reportId}</Text>
        <Text style={styles.meta}>{meta}</Text>

        {pending && item.photoUri ? (
          <Text style={styles.pendingNote}>Photo waiting to upload</Text>
        ) : null}
        {pending && item.lastError ? (
          <Text style={styles.liveError}>Last attempt failed: {item.lastError}</Text>
        ) : null}

        <View style={styles.rowFooter}>
          {pending ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry upload now"
              onPress={handleRefresh}
              disabled={refreshing}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <Text style={styles.retryText}>
                {refreshing ? 'Retrying…' : 'Retry upload now'}
              </Text>
            </Pressable>
          ) : (
            renderLiveLine(item.reportId)
          )}
        </View>
      </View>
    );
  }

  const pendingCount = entries.filter(
    (e) => e.status === 'PENDING_UPLOAD'
  ).length;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="My Reports"
        right={onSignOut ? <SignOutButton onPress={onSignOut} /> : undefined}
      />

      {pendingCount > 0 ? (
        <View style={styles.summaryWrap}>
          <Text style={styles.summaryText}>
            {pendingCount} report{pendingCount === 1 ? '' : 's'} waiting to upload
          </Text>
        </View>
      ) : null}

      <View style={styles.bannerWrap}>
        {server.state === 'checking' ? (
          <StatusBanner tone="offline" title="Checking server connection…" />
        ) : server.state === 'up' ? (
          <StatusBanner tone="success" title="Server reachable" />
        ) : (
          <StatusBanner
            tone="error"
            title="Server NOT reachable"
            message="Check that the backend is running and the Windows firewall allows Node.js. Reports stay on this device until the server is reachable."
          />
        )}
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => `${item.clientRefId}-${item.reportId ?? 'pending'}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          loadingList ? (
            <ActivityIndicator style={styles.emptySpinner} color={colors.primary} />
          ) : (
            <View>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.empty}>
                Reports you send from this phone will appear here.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  summaryWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md
  },
  summaryText: {
    color: colors.offlineText,
    fontSize: font.small,
    fontWeight: '600'
  },
  bannerWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.sm
  },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm
  },
  typeIcon: {
    fontSize: font.section,
    marginRight: spacing.xs
  },
  type: {
    flex: 1,
    color: colors.text,
    fontSize: font.section,
    fontWeight: '700'
  },
  badge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1
  },
  badgePending: {
    backgroundColor: colors.offlineSoft,
    borderColor: colors.offlineText
  },
  badgeReceived: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary
  },
  badgePendingText: {
    color: colors.offlineText,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  badgeReceivedText: {
    color: colors.primaryDark,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  id: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '700',
    marginTop: spacing.xs
  },
  meta: {
    color: colors.textMuted,
    fontSize: font.small,
    marginTop: 2
  },
  pendingNote: {
    color: colors.offlineText,
    fontSize: font.small,
    marginTop: spacing.xs
  },
  liveOk: {
    color: colors.primaryDark,
    fontSize: font.small,
    fontWeight: '600'
  },
  liveError: {
    color: colors.danger,
    fontSize: font.small,
    marginTop: spacing.xs
  },
  tapHint: {
    color: colors.textMuted,
    fontSize: font.small
  },
  rowFooter: {
    marginTop: spacing.sm
  },
  retryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  pressed: {
    opacity: 0.7
  },
  retryText: {
    color: colors.primaryDark,
    fontSize: font.small,
    fontWeight: '700'
  },
  emptyIcon: {
    fontSize: 40,
    textAlign: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.sm
  },
  empty: {
    color: colors.textMuted,
    fontSize: font.body,
    textAlign: 'center'
  },
  emptySpinner: {
    marginTop: spacing.xl
  }
});
