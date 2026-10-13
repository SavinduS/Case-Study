import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import ReportsPage from '../src/features/reports/pages/ReportsPage.jsx';
import ComparisonPage from '../src/features/reports/pages/ComparisonPage.jsx';
import SavedReportsPage from '../src/features/reports/pages/SavedReportsPage.jsx';
import ManagerShell from '../src/features/reports/components/ManagerShell.jsx';

/**
 * Page-level cases for the three workspaces in the reports feature. The API is
 * stubbed at the fetch boundary so each case can drive one server outcome -
 * partial, no-data, refused criteria - and assert the manager sees it.
 */

const jsonResponse = (body) => ({
  ok: true,
  status: 200,
  text: () => Promise.resolve(JSON.stringify(body)),
  blob: () => Promise.resolve(new Blob([]))
});

const errorResponse = (status, message) => ({
  ok: false,
  status,
  text: () => Promise.resolve(JSON.stringify({ message }))
});

const reportPayload = {
  reportId: 'AN-2026-000001',
  status: 'complete',
  summary: { incidentCount: 4, patrolCount: 2 },
  incidentDensity: { NORTHBOUNDARY: 4 },
  patrolCoverage: { NORTHBOUNDARY: { requiredHours: 10, actualHours: 5, coveragePercent: 50 } },
  weeklyTrends: { '2026-W10': 1, '2026-W11': 3 }
};

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn((url) => {
    if (url.includes('/analytics/reports')) return Promise.resolve(jsonResponse([]));
    if (url.includes('/zones/')) return Promise.resolve(jsonResponse({ incidents: [], patrols: [] }));
    return Promise.resolve(jsonResponse(reportPayload));
  });
  global.fetch = fetchMock;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ReportsPage error and partial states', () => {
  it('shows a banner when the API rejects the criteria', async () => {
    fetchMock.mockImplementation((url) => {
      if (url.includes('/analytics/reports')) return Promise.resolve(jsonResponse([]));
      return Promise.resolve(errorResponse(400, 'zones must contain configured sector codes'));
    });

    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /generate report/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/configured sector codes/i));
  });

  it('surfaces a no-data rejection instead of rendering an empty report', async () => {
    fetchMock.mockImplementation((url) => {
      if (url.includes('/analytics/reports')) return Promise.resolve(jsonResponse([]));
      return Promise.resolve(errorResponse(422, 'No incident or patrol data exists for the selected period'));
    });

    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /generate report/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/No incident or patrol data/i));
  });

  it('lists the reasons a partial report was produced', async () => {
    fetchMock.mockImplementation((url) => {
      if (url.includes('/analytics/reports')) return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse({
        ...reportPayload,
        status: 'partial',
        partialReasons: ['No patrol records were available for the selected period', 'NORTHBOUNDARY: 3 day(s)']
      }));
    });

    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /generate report/i }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Partial report/i));
    expect(screen.getByRole('status')).toHaveTextContent(/NORTHBOUNDARY: 3 day\(s\)/);
  });

  it('renders the recommendations the server derived', async () => {
    fetchMock.mockImplementation((url) => {
      if (url.includes('/analytics/reports')) return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse({
        ...reportPayload,
        recommendations: ['Increase patrol coverage in NORTHBOUNDARY to meet the configured 10 hour requirement']
      }));
    });

    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /generate report/i }));

    await waitFor(() => expect(screen.getByText(/Increase patrol coverage in NORTHBOUNDARY/)).toBeInTheDocument());
  });

  it('refuses to export when the loaded report has no reference', async () => {
    // The page generates on mount, but a report without a reportId cannot be
    // exported, which is the case this guard covers.
    fetchMock.mockImplementation((url) => {
      if (url.includes('/analytics/reports')) return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse({ ...reportPayload, reportId: undefined }));
    });

    render(<MemoryRouter><ReportsPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/generate the report before exporting/i));
  });

  it('confirms a successful export', async () => {
    global.URL.createObjectURL = vi.fn(() => 'blob:fake');
    global.URL.revokeObjectURL = vi.fn();
    fetchMock.mockImplementation((url) => {
      if (url.includes('/analytics/reports')) return Promise.resolve(jsonResponse([]));
      if (url.includes('/export')) return Promise.resolve({ ok: true, status: 200, blob: () => Promise.resolve(new Blob(['a'])) });
      return Promise.resolve(jsonResponse(reportPayload));
    });

    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Incidents recorded')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/CSV export downloaded successfully/i));
  });

  it('saves the generated report and lists it', async () => {
    const saved = { reportId: 'AN-2026-000002', name: 'Incident summary report', criteria: { startDate: '2026-03-01', endDate: '2026-03-31' } };
    fetchMock.mockImplementation((url) => {
      if (url.includes('/analytics/reports') && !url.includes('/export')) return Promise.resolve(jsonResponse([saved]));
      return Promise.resolve(jsonResponse(reportPayload));
    });

    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/generated and saved/i));
  });

  it('changes the rendered sections when the terrain report type is selected', async () => {
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);

    // Let the mount-time generation settle before switching type, otherwise
    // the generate click races the initial request and the assertion below can
    // observe the first report rather than the terrain one.
    await waitFor(() => expect(screen.getByText('Incidents recorded')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('radio', { name: /terrain trend/i }));
    fireEvent.click(screen.getByRole('button', { name: /generate report/i }));

    // The category panels belong to the incident summary only. Match the
    // rendered panel headings rather than any text, since the criteria card
    // also mentions categories.
    await waitFor(() => expect(screen.queryByRole('heading', { name: /category distribution/i })).not.toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: /category-by-period trend/i })).not.toBeInTheDocument();
    // The terrain panel takes their place, and the shared panels stay.
    expect(screen.getByRole('heading', { name: /terrain hotspots/i })).toBeInTheDocument();
    expect(screen.getByText('Incidents recorded')).toBeInTheDocument();
  });
});

describe('ComparisonPage', () => {
  const renderPage = () => render(<MemoryRouter><ComparisonPage /></MemoryRouter>);

  it('shows a loading state before the comparison arrives', async () => {
    // Hold the response open so the loading branch stays on screen.
    let release;
    fetchMock.mockImplementation(() => new Promise((resolve) => { release = () => resolve(jsonResponse(reportPayload)); }));

    const { container } = renderPage();

    expect(screen.getByText(/Loading baseline comparison/i)).toBeInTheDocument();

    release();
    // The loading copy is replaced once the report resolves.
    await waitFor(() => expect(screen.queryByText(/Loading baseline comparison/i)).not.toBeInTheDocument());
    expect(container.textContent).toContain('Comparison with baseline');
  });

  it('renders each baseline metric with current and baseline figures', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({
        ...reportPayload,
        comparison: {
          incidentCount: { current: 12, baseline: 8, variance: 4, variancePercent: 50 },
          patrolCount: { current: 5, baseline: 5, variance: 0, variancePercent: 0 }
        }
      }))
    );

    renderPage();

    await waitFor(() => expect(screen.getByText(/Incident count/i)).toBeInTheDocument());
    expect(screen.getByText(/Patrol records/i)).toBeInTheDocument();
    // The variance and its percentage render as sibling text nodes, so match
    // against the combined content of the comparison card.
    const card = screen.getByText(/Incident count/i).closest('div.bg-sand-100');
    expect(card).toHaveTextContent('12');
    expect(card).toHaveTextContent('8');
    expect(card).toHaveTextContent('+50%');
  });

  it('explains that no percentage is available when the baseline was zero', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({
        ...reportPayload,
        comparison: { incidentCount: { current: 12, baseline: 0, variance: 12, variancePercent: null } }
      }))
    );

    renderPage();

    await waitFor(() => expect(screen.getByText(/No baseline records were available/i)).toBeInTheDocument());
  });

  it('says so when the API returned no comparison at all', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ ...reportPayload, comparison: {} })));

    renderPage();

    await waitFor(() => expect(screen.getByText(/No baseline comparison data was returned/i)).toBeInTheDocument());
  });

  it('renders a per-zone breakdown of the compared metrics', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({
        ...reportPayload,
        comparison: {
          incidentDensity: {
            NORTHBOUNDARY: { current: 9, baseline: 4, variance: 5, variancePercent: 125 },
            EASTBOUNDARY: { current: 2, baseline: 2, variance: 0, variancePercent: 0 }
          }
        }
      }))
    );

    renderPage();

    await waitFor(() => expect(screen.getByText(/Incident density by zone/i)).toBeInTheDocument());
    expect(screen.getByText(/North Boundary/)).toBeInTheDocument();
    expect(screen.getByText(/East Boundary/)).toBeInTheDocument();
  });

  it('shows the failure reason when the comparison cannot be built', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(errorResponse(422, 'No incident or patrol data exists for the selected period')));

    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/No incident or patrol data/i));
  });
});

describe('SavedReportsPage', () => {
  const renderPage = () => render(<MemoryRouter><SavedReportsPage /></MemoryRouter>);

  it('prompts the manager to generate a report when none are saved', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText(/No saved reports yet/i)).toBeInTheDocument());
    expect(screen.getByText(/Generate a report and select Save/i)).toBeInTheDocument();
  });

  it('lists a saved report using the name the server stored', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse([{ reportId: 'AN-2026-000001', name: 'Patrol coverage report · 2026-03-01 to 2026-03-31' }]))
    );

    renderPage();

    await waitFor(() => expect(screen.getByRole('heading', { name: /Patrol coverage report/i })).toBeInTheDocument());
  });

  it('derives a name from the criteria when the report has none', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse([
        { reportId: 'AN-2026-000002', reportType: 'terrainTrend', criteria: { startDate: '2026-03-01', endDate: '2026-03-31' } }
      ]))
    );

    renderPage();

    await waitFor(() => expect(screen.getByRole('heading', { name: /Terrain trend report/i })).toBeInTheDocument());
  });

  it('falls back to a generic name when neither name nor dates are present', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([{ reportId: 'AN-2026-000003', reportType: 'unknown' }])));

    renderPage();

    await waitFor(() => expect(screen.getByRole('heading', { name: /Park analytics report/i })).toBeInTheDocument());
  });

  it('shows the failure reason when saved reports cannot be loaded', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(errorResponse(500, 'Analytics service unavailable')));

    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Analytics service unavailable/i));
  });

  it('offers a link into the workspace for every saved report', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([{ reportId: 'AN-2026-000001', name: 'Incident summary report' }])));

    renderPage();

    await waitFor(() => expect(screen.getByRole('link', { name: /open in workspace/i })).toBeInTheDocument());
  });
});
describe('ManagerShell', () => {
  const renderShell = (route = '/analytics/type') =>
    render(
      <MemoryRouter initialEntries={[route]}>
        <ManagerShell>
          <p>Workspace content</p>
        </ManagerShell>
      </MemoryRouter>
    );

  it('renders the page content inside the manager frame', () => {
    renderShell();
    expect(screen.getByText('Workspace content')).toBeInTheDocument();
    expect(screen.getByText('Park Manager')).toBeInTheDocument();
  });

  it('links to each analytics workspace', () => {
    renderShell();
    expect(screen.getByRole('link', { name: 'Analytics' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Comparison' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Saved reports' })).toBeInTheDocument();
  });

  it('marks the current workspace as active', () => {
    renderShell('/analytics/comparison');
    const current = screen.getByRole('link', { name: 'Comparison' });
    expect(current).toHaveClass('border-moss-500');
    expect(screen.getByRole('link', { name: 'Analytics' })).toHaveClass('border-transparent');
  });
});
