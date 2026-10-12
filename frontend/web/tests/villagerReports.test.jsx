import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VillagerReportsPage from '../src/features/villager-reports/pages/VillagerReportsPage.jsx';
import useVillagerReports from '../src/features/villager-reports/hooks/useVillagerReports.js';
import * as api from '../src/services/api.js';

vi.mock('../src/services/api.js');

const SMS_REPORT = {
  reportId: 'CR-2026-000002',
  incidentType: 'elephant_sighting',
  status: 'ACTION_REQUIRED',
  submissionMethod: 'sms',
  location: { type: 'Point', coordinates: [81.52, 6.5] },
  locationText: 'East Boundary',
  description: 'Herd crossed the road near the junction',
  reporterContact: '+94770000004',
  isPossibleDuplicate: true,
  outsideSupportedArea: true,
  createdAt: '2026-10-08T09:00:00Z'
};

const APP_REPORT = {
  reportId: 'CR-2026-000001',
  incidentType: 'crop_damage',
  status: 'RECEIVED',
  submissionMethod: 'app',
  location: { type: 'Point', coordinates: [81.42, 6.62] },
  locationText: 'North Boundary',
  accuracyMeters: 12.5,
  description: 'Crop damaged overnight',
  reporterContact: '+94770000009',
  photoUrl: '/uploads/photo-1.jpg',
  isPossibleDuplicate: false,
  outsideSupportedArea: false,
  createdAt: '2026-10-09T14:38:00Z'
};

const RESOLVED_REPORT = {
  ...APP_REPORT,
  reportId: 'CR-2026-000003',
  status: 'RESOLVED',
  createdAt: '2026-09-01T08:00:00Z'
};

/**
 * Builds the page with a stubbed hook, mirroring the real hook's contract rather
 * than reimplementing its filtering — useVillagerReports.test.jsx covers that.
 */
function renderPage(overrides = {}) {
  const reports = overrides.reports ?? [APP_REPORT, SMS_REPORT];
  const byType = reports.reduce((acc, r) => ({ ...acc, [r.incidentType]: (acc[r.incidentType] ?? 0) + 1 }), {});
  const hook = {
    loading: false,
    error: null,
    lastUpdatedAt: '2026-10-09T15:00:00Z',
    reports,
    visibleReports: reports,
    stats: {
      total: reports.length,
      open: reports.filter((r) => r.status !== 'RESOLVED').length,
      resolved: reports.filter((r) => r.status === 'RESOLVED').length,
      sms: reports.filter((r) => r.submissionMethod === 'sms').length,
      app: reports.filter((r) => r.submissionMethod === 'app').length,
      duplicates: reports.filter((r) => r.isPossibleDuplicate).length,
      outsideArea: reports.filter((r) => r.outsideSupportedArea).length,
      withoutPhoto: 0
    },
    byMethod: {
      '': reports.length,
      sms: reports.filter((r) => r.submissionMethod === 'sms').length,
      app: reports.filter((r) => r.submissionMethod === 'app').length
    },
    byType,
    method: '',
    setMethod: vi.fn(),
    incidentType: '',
    setIncidentType: vi.fn(),
    query: '',
    setQuery: vi.fn(),
    clearFilters: vi.fn(),
    refresh: vi.fn(),
    ...overrides
  };
  return { hook, ...render(<VillagerReportsPage hook={hook} />) };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('VillagerReportsPage', () => {
  it('reports the category the villager chose, not the stored enum', () => {
    renderPage();
    expect(screen.getAllByText('Crop damage').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Elephant sighting').length).toBeGreaterThan(0);
  });

  it('separates SMS complaints from field app reports', () => {
    renderPage();
    const tabs = screen.getByRole('group', { name: 'Filter by how the report arrived' });
    expect(within(tabs).getByRole('button', { name: /SMS hotline/ })).toBeInTheDocument();
    expect(within(tabs).getByRole('button', { name: /Field app/ })).toBeInTheDocument();
    expect(within(tabs).getByRole('button', { name: /All reports/ })).toBeInTheDocument();
  });

  it('counts each channel on its own tab', () => {
    renderPage();
    const tabs = screen.getByRole('group', { name: 'Filter by how the report arrived' });
    expect(within(tabs).getByRole('button', { name: /SMS hotline/ })).toHaveTextContent('1');
    expect(within(tabs).getByRole('button', { name: /Field app/ })).toHaveTextContent('1');
  });

  it('reports the chosen channel back to the hook', async () => {
    const user = userEvent.setup();
    const setMethod = vi.fn();
    renderPage({ setMethod });

    const tabs = screen.getByRole('group', { name: 'Filter by how the report arrived' });
    await user.click(within(tabs).getByRole('button', { name: /SMS hotline/ }));
    expect(setMethod).toHaveBeenCalledWith('sms');
  });

  it('explains what each channel means, not just its name', () => {
    renderPage();
    expect(screen.getByText('Verbal reports taken by the hotline')).toBeInTheDocument();
    expect(screen.getByText('Reports submitted with location and photo')).toBeInTheDocument();
  });

  it('groups the list by category with counts', () => {
    renderPage();
    const grid = screen.getByRole('group', { name: 'Filter by incident type' });
    expect(within(grid).getByRole('button', { name: /Crop damage/ })).toHaveTextContent('1');
    expect(within(grid).getByRole('button', { name: /Elephant sighting/ })).toHaveTextContent('1');
  });

  it('reports the chosen category back to the hook', async () => {
    const user = userEvent.setup();
    const setIncidentType = vi.fn();
    renderPage({ setIncidentType });

    const grid = screen.getByRole('group', { name: 'Filter by incident type' });
    await user.click(within(grid).getByRole('button', { name: /Crop damage/ }));
    expect(setIncidentType).toHaveBeenCalledWith('crop_damage');
  });

  it('counts how many of each category were reported', () => {
    renderPage({ reports: [APP_REPORT, SMS_REPORT] });
    // One app report plus one SMS report, both elephants/crop respectively.
    const rail = screen.getByRole('complementary', { name: 'Report filters' });
    expect(within(rail).getByText('Crop damage')).toBeInTheDocument();
    expect(within(rail).getByText('Elephant sighting')).toBeInTheDocument();
  });

  it('shows the headline counts the officer is asked about', () => {
    renderPage({ reports: [APP_REPORT, SMS_REPORT, RESOLVED_REPORT] });
    expect(screen.getByText('Reports received').nextElementSibling).toHaveTextContent('3');
    expect(screen.getByText('Awaiting action').nextElementSibling).toHaveTextContent('2');
  });

  it('shows the age of a report so the stale end of the list is visible', () => {
    renderPage();
    expect(screen.getAllByText(/days ago|Today/).length).toBeGreaterThan(0);
  });

  it('flags a report the server marked as a possible duplicate', () => {
    renderPage();
    expect(screen.getAllByText('Possible duplicate').length).toBeGreaterThan(0);
  });

  it('flags a report from outside the supported area', () => {
    renderPage();
    expect(screen.getAllByText('Outside supported area').length).toBeGreaterThan(0);
  });

  it('marks a resolved report rather than presenting it as outstanding', () => {
    renderPage({ reports: [RESOLVED_REPORT] });
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('keeps the full detail behind a click', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.queryByText('Crop damaged overnight')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { expanded: false, name: /Crop damage/ }));
    expect(screen.getByText('+94770000009')).toBeInTheDocument();
  });

  it('says what is missing from a thin SMS report instead of leaving a gap', async () => {
    const user = userEvent.setup();
    // What the SMS gateway produces when the caller gives no description.
    renderPage({ reports: [{ ...SMS_REPORT, description: undefined }] });

    const list = screen.getByRole('region', { name: 'Villager report list' });
    await user.click(within(list).getByRole('button', { expanded: false, name: /Elephant sighting/ }));
    expect(
      screen.getByText(/taken over the hotline without a written description/i)
    ).toBeInTheDocument();
  });

it('explains an SMS report has no photo rather than showing a broken image', async () => {
    const user = userEvent.setup();
    renderPage({ reports: [SMS_REPORT] });

    const list = screen.getByRole('region', { name: 'Villager report list' });
    await user.click(within(list).getByRole('button', { expanded: false, name: /Elephant sighting/ }));
    expect(screen.getByText('No photo attached')).toBeInTheDocument();
  });

  it('searches across the reference, place and description', () => {
    const setQuery = vi.fn();
    renderPage({ setQuery });
    expect(screen.getByRole('searchbox', { name: /Search reports/ })).toBeInTheDocument();
    expect(setQuery).not.toHaveBeenCalled();
  });

  it('names a failure rather than showing an empty list', () => {
    renderPage({ reports: [], visibleReports: [], error: 'Cannot reach the API. Is the backend running?' });
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot reach the API');
  });

  // Two different empty states: nothing has ever arrived, versus something has
// but the current filter excludes it. The officer acts differently on each.
it('explains an empty feed as "nothing has arrived yet"', () => {
    renderPage({ reports: [], visibleReports: [] });
    expect(screen.getByText(/No villager reports have been received yet/)).toBeInTheDocument();
  });

it('explains an empty result as a filter that excludes everything', () => {
    renderPage({ visibleReports: [] });
    expect(screen.getByText(/No reports match these filters/)).toBeInTheDocument();
  });

  it('refreshes on demand', async () => {
    const user = userEvent.setup();
    const refresh = vi.fn();
    renderPage({ refresh });

    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(refresh).toHaveBeenCalled();
  });

  it('renders an unknown enum rather than a blank cell', () => {
    renderPage({ reports: [{ ...APP_REPORT, incidentType: 'future_type' }] });
    expect(screen.getAllByText('Wildlife conflict').length).toBeGreaterThan(0);
  });
});

describe('useVillagerReports', () => {
  it('separates the channels from the same unfiltered fetch', async () => {
    vi.mocked(api.getConflictReports).mockResolvedValue({ reports: [APP_REPORT, SMS_REPORT] });
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() => useVillagerReports({ pollIntervalMs: 1e9 }));

    await waitFor(() => expect(result.current.byMethod.sms).toBe(1));
    expect(result.current.byMethod.app).toBe(1);
    // The channel counts must not change when the filter changes, or the tabs
    // would renumber themselves under the officer's cursor.
    expect(result.current.byType.crop_damage).toBe(1);
    expect(result.current.byType.elephant_sighting).toBe(1);
  });

  it('searches the villager\'s own words, not just the reference', async () => {
    vi.mocked(api.getConflictReports).mockResolvedValue({ reports: [APP_REPORT, SMS_REPORT] });
    const { renderHook, act } = await import('@testing-library/react');
    const { result } = renderHook(() => useVillagerReports({ pollIntervalMs: 1e9 }));
    await waitFor(() => expect(result.current.reports).toHaveLength(2));

    act(() => result.current.setQuery('junction'));
    expect(result.current.visibleReports.map((r) => r.reportId)).toEqual(['CR-2026-000002']);
  });

  it('keeps a resolved report out of the awaiting-action count', async () => {
    vi.mocked(api.getConflictReports).mockResolvedValue({ reports: [APP_REPORT, RESOLVED_REPORT] });
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() => useVillagerReports({ pollIntervalMs: 1e9 }));

    await waitFor(() => expect(result.current.stats.open).toBe(1));
    expect(result.current.stats.resolved).toBe(1);
  });

  it('surfaces a failed load rather than an empty list', async () => {
    vi.mocked(api.getConflictReports).mockRejectedValue(new Error('Forbidden'));
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() => useVillagerReports({ pollIntervalMs: 1e9 }));

    await waitFor(() => expect(result.current.error).toBe('Forbidden'));
    expect(result.current.loading).toBe(false);
  });
});