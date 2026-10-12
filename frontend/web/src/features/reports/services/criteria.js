export const ZONES = ['NORTHBOUNDARY', 'EASTBOUNDARY', 'SOUTHBOUNDARY', 'WESTBOUNDARY'];
export const ZONE_LABELS = {
  NORTHBOUNDARY: 'North Boundary',
  EASTBOUNDARY: 'East Boundary',
  SOUTHBOUNDARY: 'South Boundary',
  WESTBOUNDARY: 'West Boundary'
};
export const CATEGORIES = ['elephant', 'crop', 'poacher', 'snare'];
export const CATEGORY_LABELS = {
  elephant: 'Elephant conflict',
  crop: 'Crop damage',
  poacher: 'Poaching',
  snare: 'Snare / trap'
};

const STORAGE_KEY = 'analyticsCriteria:v1';

function isoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

// Dynamic default: last 90 days ending today, so the workspace always
// queries live database records instead of a fixed mock period.
export function defaultCriteria() {
  const end = new Date();
  const start = new Date(end.getTime() - 90 * 86400000);
  return {
    reportType: 'incident',
    startDate: isoDate(start),
    endDate: isoDate(end),
    zones: [...ZONES],
    categories: [...CATEGORIES],
    baseline: 'previous-period'
  };
}

function isValidCriteria(value) {
  return value && typeof value === 'object'
    && typeof value.startDate === 'string' && typeof value.endDate === 'string'
    && Array.isArray(value.zones) && value.zones.length > 0
    && Array.isArray(value.categories)
    && typeof value.baseline === 'string';
}

// Last criteria the manager generated in the workspace, so the Comparison
// page continues from the same real selection instead of hardcoded dates.
export function loadCriteria() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidCriteria(parsed)) return null;
    return {
      reportType: parsed.reportType || 'incident',
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      zones: parsed.zones.filter((z) => ZONES.includes(z)),
      categories: parsed.categories.filter((c) => CATEGORIES.includes(c)),
      baseline: parsed.baseline
    };
  } catch {
    return null;
  }
}

export function saveCriteria(criteria) {
  try {
    if (!isValidCriteria(criteria)) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(criteria));
  } catch {
    // Private mode etc. - workspace still works, just not remembered.
  }
}
