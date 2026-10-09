import { ApiError } from '../../../services/api.js';

const BASE = '/api';
const ZONE_LABELS = {
  NORTHBOUNDARY: 'North Boundary',
  EASTBOUNDARY: 'East Boundary',
  SOUTHBOUNDARY: 'South Boundary',
  WESTBOUNDARY: 'West Boundary'
};

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: options.body && JSON.stringify(options.body)
    });
  } catch {
    throw new ApiError('Cannot reach the analytics API.', 0);
  }
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  if (!response.ok) throw new ApiError(payload?.message || `Request failed (${response.status})`, response.status);
  return payload;
}

function normalizeReport(report) {
  const summary = report?.summary || {};
  const density = report?.incidentDensity || {};
  const coverageMap = report?.patrolCoverage || {};
  const trendMap = report?.weeklyTrends || {};
  const zoneCodes = [...new Set([...Object.keys(coverageMap), ...Object.keys(density)])];
  const zones = zoneCodes.map((code) => {
    const coverage = coverageMap[code] || {};
    const incidents = Number(density[code] || 0);
    const coveragePercent = coverage.coveragePercent == null ? 0 : Number(coverage.coveragePercent);
    return {
      code,
      name: ZONE_LABELS[code] || code,
      incidents,
      patrols: Number(coverage.actualHours || 0),
      risk: incidents >= 10 || coveragePercent < 50 ? 'High' : incidents >= 5 || coveragePercent < 80 ? 'Medium' : 'Low',
      value: coveragePercent
    };
  });
  const trend = Object.entries(trendMap).map(([label, value]) => ({ label, value: Number(value) }));
  const categoryTrends = report?.categoryTrends || {};
  const categoryDistribution = Object.entries(categoryTrends).map(([label, periods]) => ({
    label,
    value: Object.values(periods).reduce((sum, value) => sum + Number(value), 0)
  }));
  const required = zones.reduce((sum, zone) => sum + Number(coverageMap[zone.code]?.requiredHours || 0), 0);
  const actual = zones.reduce((sum, zone) => sum + Number(coverageMap[zone.code]?.actualHours || 0), 0);
  return {
    ...report,
    reportType: report?.criteria?.reportType || report?.reportType || 'incident',
    status: report?.status || 'complete',
    partialReasons: report?.partialReasons || [],
    recommendations: report?.recommendations || [],
    comparison: report?.comparison || report?.baselineComparison || report?.comparisonData || {},
    categoryDistribution: report?.categoryDistribution || summary.categoryDistribution || categoryDistribution,
    categoryTrend: report?.categoryTrend || categoryTrends,
    terrainHotspots: report?.terrainHotspots || report?.hotspotsByTerrain || [],
    trendDirection: report?.trendDirection || summary.trendDirection || report?.terrainTrend?.direction || null,
    kpis: {
      incidents: Number(summary.incidentCount || 0),
      patrolCoverage: required ? Number(((actual / required) * 100).toFixed(1)) : 0,
      hotspots: zones.filter((zone) => zone.risk === 'High').length,
      responseTime: null
    },
    trend,
    coverage: zones,
    zones
  };
}

const REPORT_TYPE_API = {
  incident: 'incidentSummary',
  patrol: 'patrolCoverage',
  terrain: 'terrainTrend',
  comparison: 'overview'
};

export const getReport = async (criteria) => {
  const payload = {
    ...criteria,
    baseline: criteria.baseline === 'none' ? null : criteria.baseline,
    reportType: REPORT_TYPE_API[criteria.reportType] || criteria.reportType || 'overview'
  };
  return {
    ...normalizeReport(await request('/analytics/generate', { method: 'POST', body: payload })),
    reportType: criteria.reportType || 'incident'
  };
};
export const getSavedReports = () => request('/analytics/reports');
export const getZoneRecords = (code, startDate, endDate) =>
  request(`/analytics/zones/${encodeURIComponent(code)}/records?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
// Generation persists a report on the API; this alias keeps the feature API
// explicit without inventing a client-only save endpoint.
export const saveReport = (criteria) => getReport(criteria);
export async function exportReport(reportId, format) {
  let response;
  try {
    response = await fetch(`${BASE}/analytics/reports/${encodeURIComponent(reportId)}/export?format=${format}`);
  } catch {
    throw new ApiError('Cannot reach the analytics API.', 0);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(payload?.message || `Export failed (${response.status})`, response.status);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${reportId}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
export { request as reportsRequest };
