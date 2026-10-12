import type { IncidentType } from '../types';

// Single source of truth for incident type display names
export const INCIDENT_LABELS: Record<IncidentType, string> = {
  elephant_sighting: 'Elephant Sighting',
  crop_damage: 'Crop Damage',
  wildlife_near_home: 'Wildlife Near Home',
  wildlife_blocking_road: 'Wildlife Blocking Road',
  other_wildlife_conflict: 'Other Wildlife Conflict'
};

/** Emoji per type — used by the form picker and My Reports rows. */
export const INCIDENT_ICONS: Record<IncidentType, string> = {
  elephant_sighting: '🐘',
  crop_damage: '💥',
  wildlife_near_home: '🏘️',
  wildlife_blocking_road: '🛣️',
  other_wildlife_conflict: '❓'
};

export const INCIDENT_TYPE_ORDER = Object.keys(INCIDENT_LABELS) as IncidentType[];
