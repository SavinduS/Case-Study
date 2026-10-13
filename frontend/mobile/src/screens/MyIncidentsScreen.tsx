import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import OfflineBadge from '../components/OfflineBadge';
import PrimaryButton from '../components/PrimaryButton';
import RangerIcon from '../components/RangerIcon';
import StatTile from '../components/StatTile';
import StatusBanner from '../components/StatusBanner';
import StatusChip from '../components/StatusChip';
import {
  FIELD_INCIDENT_LABELS,
  FIELD_INCIDENT_TYPE_ORDER
} from '../constants/fieldIncident';
import type { FieldIncidentType } from '../fieldIncidentTypes';
import type { StoredFieldIncident } from '../services/incidentStorage';
import { colors, font, radius, spacing } from '../theme';

export type { StoredFieldIncident };

interface Props {
  incidents: StoredFieldIncident[];
  syncing: boolean;
  onSyncNow: () => void;
  onNewReport: () => void;
  /** Batch sync warning (rejections/offline) shown above the list. */
  syncError?: string | null;
  /** True while stored reports are being loaded from the device. */
  loading?: boolean;
}

type StatusFilter = 'all' | StoredFieldIncident['status'];
type TypeFilter = 'all' | FieldIncidentType;
type DateFilter = 'all' | 'last7' | 'last30';

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'synced', label: 'Synchronized' },
  { id: 'failed', label: 'Failed' }
];

const DATE_OPTIONS: { id: DateFilter; label: string; days: number | null }[] = [
  { id: 'all', label: 'All dates', days: null },
  { id: 'last7', label: 'Last 7 days', days: 7 },
  { id: 'last30', label: 'Last 30 days', days: 30 }
];

function shortId(item: StoredFieldIncident): string {
  const raw = item.reportId || item.id;
  return raw.length > 13 ? `${raw.slice(0, 8)}…` : raw;
}

function detailLabel(item: StoredFieldIncident): string {
  return item.displayId ?? shortId(item);
}

// Incident Reports — default Ranger landing page. Renders only real stored
// reports (no sample data) with status summary tiles, search/status/type/
// date filters, detailed report cards with an inline detail view, and entry
// points to capture or sync.
export default function MyIncidentsScreen({
  incidents,
  syncing,
  onSyncNow,
  onNewReport,
  syncError,
  loading = false
}: Props) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const total = incidents.length;
  const pending = incidents.filter((i) => i.status === 'pending').length;
  const synced = incidents.filter((i) => i.status === 'synced').length;
  const failed = incidents.filter((i) => i.status === 'failed').length;

  const filtersActive =
    query.trim() !== '' || statusFilter !== 'all' || typeFilter !== 'all' || dateFilter !== 'all';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dateDays = DATE_OPTIONS.find((d) => d.id === dateFilter)?.days ?? null;
    const cutoff = dateDays !== null ? Date.now() - dateDays * 24 * 60 * 60 * 1000 : null;
    return incidents.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (typeFilter !== 'all' && item.incident.incidentType !== typeFilter) return false;
      if (cutoff !== null && new Date(item.incident.capturedAt).getTime() < cutoff) return false;
      if (q) {
        const haystack = [
          item.reportId,
          item.displayId ?? '',
          item.incident.description,
          FIELD_INCIDENT_LABELS[item.incident.incidentType]
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [incidents, query, statusFilter, typeFilter, dateFilter]);

  function clearFilters() {
    setQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
    setDateFilter('all');
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Incident Reports</Text>
          <Text style={styles.subtitle}>Field reports stored on this device, newest first.</Text>
        </View>
        <OfflineBadge />
      </View>

      <View style={styles.summaryRow}>
        <StatTile label="Total Incidents" value={total} icon="clipboard-text-outline" tone="total" />
        <StatTile label="Pending" value={pending} icon="clock-outline" tone="pending" />
        <StatTile label="Synchronized" value={synced} icon="check-circle-outline" tone="synced" />
        <StatTile label="Failed" value={failed} icon="alert-circle-outline" tone="failed" />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="+ Add New Incident"
        onPress={onNewReport}
        style={({ pressed }) => [styles.addButton, pressed && styles.addPressed]}
      >
        <RangerIcon name="plus-circle-outline" size={20} color={colors.white} />
        <Text style={styles.addText}>+ Add New Incident</Text>
      </Pressable>

      <PrimaryButton
        label={syncing ? 'Syncing…' : 'Sync Now'}
        onPress={onSyncNow}
        disabled={syncing || incidents.length === 0}
        loading={syncing}
      />

      {syncError ? (
        <StatusBanner tone="error" title="Sync needs attention" message={syncError} />
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading reports…</Text>
        </View>
      ) : incidents.length === 0 ? (
        <StatusBanner
          tone="offline"
          title="No incidents yet"
          message="Use Report Incident to capture one. It stays on this device while offline."
        />
      ) : (
        <View style={styles.listSection}>
          <View style={styles.searchRow}>
            <View style={styles.searchIcon}>
              <RangerIcon name="magnify" size={18} color={colors.textMuted} />
            </View>
            <TextInput
              accessibilityRole="search"
              accessibilityLabel="Search by report ID or description"
              placeholder="Search by report ID or description"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
            />
          </View>

          <Text style={styles.filterHeading}>Status</Text>
          <View style={styles.chipRow}>
            {STATUS_OPTIONS.map((opt) => {
              const selected = statusFilter === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Status filter: ${opt.label}`}
                  accessibilityState={{ selected }}
                  onPress={() => setStatusFilter(opt.id)}
                  style={({ pressed }) => [
                    styles.chip,
                    selected && styles.chipSelected,
                    pressed && styles.chipPressed
                  ]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.filterHeading}>Incident type</Text>
          <View style={styles.chipRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Type filter: All types"
              accessibilityState={{ selected: typeFilter === 'all' }}
              onPress={() => setTypeFilter('all')}
              style={({ pressed }) => [
                styles.chip,
                typeFilter === 'all' && styles.chipSelected,
                pressed && styles.chipPressed
              ]}
            >
              <Text style={[styles.chipText, typeFilter === 'all' && styles.chipTextSelected]}>
                All types
              </Text>
            </Pressable>
            {FIELD_INCIDENT_TYPE_ORDER.map((type) => {
              const selected = typeFilter === type;
              return (
                <Pressable
                  key={type}
                  accessibilityRole="button"
                  accessibilityLabel={`Type filter: ${FIELD_INCIDENT_LABELS[type]}`}
                  accessibilityState={{ selected }}
                  onPress={() => setTypeFilter(type)}
                  style={({ pressed }) => [
                    styles.chip,
                    selected && styles.chipSelected,
                    pressed && styles.chipPressed
                  ]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {FIELD_INCIDENT_LABELS[type]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.filterHeading}>Date</Text>
          <View style={styles.chipRow}>
            {DATE_OPTIONS.map((opt) => {
              const selected = dateFilter === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Date filter: ${opt.label}`}
                  accessibilityState={{ selected }}
                  onPress={() => setDateFilter(opt.id)}
                  style={({ pressed }) => [
                    styles.chip,
                    selected && styles.chipSelected,
                    pressed && styles.chipPressed
                  ]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.resultRow}>
            <Text style={styles.resultCount}>
              Showing {filtered.length} of {total}
            </Text>
            {filtersActive ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear filters"
                onPress={clearFilters}
                style={({ pressed }) => [styles.clearButton, pressed && styles.chipPressed]}
              >
                <RangerIcon name="close-circle-outline" size={16} color={colors.primaryDark} />
                <Text style={styles.clearText}>Clear filters</Text>
              </Pressable>
            ) : null}
          </View>

          {filtered.length === 0 ? (
            <StatusBanner
              tone="offline"
              title="No matching reports"
              message="Try a different search or clear the filters to see everything."
            />
          ) : (
            filtered.map((item) => {
              const [lon, lat] = item.incident.location.coordinates;
              const expanded = expandedId === item.id;
              return (
                <View key={item.id} style={styles.card}>
                  <Text style={styles.cardValue}>
                    {FIELD_INCIDENT_LABELS[item.incident.incidentType]}
                  </Text>
                  {item.displayId ? <Text style={styles.cardRef}>{item.displayId}</Text> : null}
                  <Text style={styles.cardMeta}>Report ID: {shortId(item)}</Text>
                  <Text style={styles.cardMeta}>
                    {new Date(item.incident.capturedAt).toLocaleString()} · {lat.toFixed(5)},{' '}
                    {lon.toFixed(5)}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={expanded ? undefined : 2}>
                    {item.incident.description}
                  </Text>
                  <StatusChip status={item.status} />
                  {item.status === 'failed' && item.lastError ? (
                    <Text style={styles.cardError}>{item.lastError}</Text>
                  ) : null}

                  {expanded ? (
                    <View style={styles.details}>
                      <Text style={styles.cardMeta}>Full report ID: {item.reportId}</Text>
                      <Text style={styles.cardMeta}>
                        Location: {item.incident.location.manual ? 'Manual pin' : 'GPS'}
                        {typeof item.incident.location.accuracyMeters === 'number'
                          ? ` · Accuracy ${item.incident.location.accuracyMeters} m`
                          : ''}
                      </Text>
                      {item.incident.photoUri ? (
                        <View style={styles.photoRow}>
                          <Image
                            source={{ uri: item.incident.photoUri }}
                            style={styles.thumbnail}
                            resizeMode="cover"
                            accessibilityRole="image"
                            accessibilityLabel="Attached photo evidence"
                          />
                          <Text style={styles.cardMeta}>Photo evidence attached</Text>
                        </View>
                      ) : (
                        <Text style={styles.cardMeta}>Photo: None</Text>
                      )}
                      {item.incident.patrolId ? (
                        <Text style={styles.cardMeta}>Patrol Session: {item.incident.patrolId}</Text>
                      ) : null}
                      <Text style={styles.cardMeta}>Sync attempts: {item.retryCount}</Text>
                    </View>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      expanded
                        ? `Hide details for ${detailLabel(item)}`
                        : `View details for ${detailLabel(item)}`
                    }
                    onPress={() => setExpandedId(expanded ? null : item.id)}
                    style={({ pressed }) => [styles.detailsButton, pressed && styles.detailsPressed]}
                  >
                    <RangerIcon
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.detailsText}>{expanded ? 'Hide details' : 'View details'}</Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs
  },
  titleWrap: {
    flex: 1
  },
  title: {
    color: colors.text,
    fontSize: font.title,
    fontWeight: '800'
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: font.small,
    marginTop: 2
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  addButton: {
    flexDirection: 'row',
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg
  },
  addPressed: {
    backgroundColor: colors.primaryDark
  },
  addText: {
    color: colors.white,
    fontSize: font.section,
    fontWeight: '800'
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: font.body
  },
  listSection: {
    gap: spacing.sm
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    minHeight: 48
  },
  searchIcon: {
    marginRight: spacing.xs
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: font.body,
    paddingVertical: spacing.sm
  },
  filterHeading: {
    color: colors.textMuted,
    fontSize: font.tiny,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xs
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 36,
    justifyContent: 'center'
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  chipPressed: {
    opacity: 0.6
  },
  chipText: {
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: '600'
  },
  chipTextSelected: {
    color: colors.primaryDark,
    fontWeight: '800'
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  resultCount: {
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: '600'
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm
  },
  clearText: {
    color: colors.primaryDark,
    fontSize: font.small,
    fontWeight: '700'
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1
  },
  cardValue: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '700'
  },
  cardRef: {
    color: colors.primaryDark,
    fontSize: font.small,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: font.small
  },
  cardError: {
    color: colors.danger,
    fontSize: font.small
  },
  details: {
    marginTop: spacing.xs,
    gap: 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.offlineSoft
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    justifyContent: 'flex-start'
  },
  detailsPressed: {
    opacity: 0.6
  },
  detailsText: {
    color: colors.primary,
    fontSize: font.body,
    fontWeight: '700'
  },
  buttonRow: {
    marginTop: spacing.sm
  }
});
