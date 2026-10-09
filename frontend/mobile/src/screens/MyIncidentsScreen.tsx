import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import OfflineBadge from '../components/OfflineBadge';
import PrimaryButton from '../components/PrimaryButton';
import StatusBanner from '../components/StatusBanner';
import { FIELD_INCIDENT_LABELS } from '../constants/fieldIncident';
import type { ValidatedFieldIncident } from '../fieldIncidentTypes';
import { colors, font, radius, spacing } from '../theme';

export type IncidentSyncStatus = 'pending' | 'synced';

export interface StoredFieldIncident {
  id: string;
  incident: ValidatedFieldIncident;
  status: IncidentSyncStatus;
}

interface Props {
  incidents: StoredFieldIncident[];
  syncing: boolean;
  onSyncNow: () => void;
  onNewReport: () => void;
}

function statusChip(status: IncidentSyncStatus): { label: string; pending: boolean } {
  return status === 'pending'
    ? { label: 'PENDING SYNCHRONIZATION', pending: true }
    : { label: 'SYNCHRONIZED', pending: false };
}

// F3: My Incidents — offline-first list wired to the bottom tab.
// UI-only: Sync Now flips pending -> synchronized with sample data.
export default function MyIncidentsScreen({
  incidents,
  syncing,
  onSyncNow,
  onNewReport
}: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>My Incidents</Text>
        <OfflineBadge />
      </View>

      <PrimaryButton
        label={syncing ? 'Syncing…' : 'Sync Now'}
        onPress={onSyncNow}
        disabled={syncing || incidents.length === 0}
        loading={syncing}
      />

      {incidents.length === 0 ? (
        <StatusBanner
          tone="offline"
          title="No incidents yet"
          message="Use Report Incident to capture one. It stays on this device while offline."
        />
      ) : (
        incidents.map((item) => {
          const [lon, lat] = item.incident.location.coordinates;
          const chip = statusChip(item.status);
          return (
            <View key={item.id} style={styles.card}>
              <Text style={styles.cardValue}>
                {FIELD_INCIDENT_LABELS[item.incident.incidentType]}
              </Text>
              <Text style={styles.cardMeta}>
                {new Date(item.incident.capturedAt).toLocaleString()} · {lat.toFixed(5)},{' '}
                {lon.toFixed(5)}
              </Text>
              <Text style={styles.cardMeta} numberOfLines={2}>
                {item.incident.description}
              </Text>
              <View style={[styles.badge, chip.pending ? styles.badgePending : styles.badgeSynced]}>
                <Text style={chip.pending ? styles.badgePendingText : styles.badgeSyncedText}>
                  {chip.label}
                </Text>
              </View>
            </View>
          );
        })
      )}

      <View style={styles.buttonRow}>
        <PrimaryButton label="New incident report" onPress={onNewReport} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.bg
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: font.section,
    fontWeight: '700'
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4
  },
  cardValue: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '600'
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: font.small
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1
  },
  badgePending: {
    borderColor: colors.offlineText,
    backgroundColor: colors.offlineSoft
  },
  badgeSynced: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  badgePendingText: {
    color: colors.offlineText,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  badgeSyncedText: {
    color: colors.primaryDark,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  buttonRow: {
    marginTop: spacing.sm
  }
});
