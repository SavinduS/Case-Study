import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportsPage from '../src/features/reports/pages/ReportsPage.jsx';

const response = (body) => ({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)), blob: () => Promise.resolve(new Blob()) });

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    if (url.includes('/saved')) return Promise.resolve(response([]));
    if (url.includes('/zones/')) return Promise.resolve(response({ incidents: [], patrols: [] }));
    return Promise.resolve(response({
      reportId: 'AN-2026-000001',
      summary: { incidentCount: 9, patrolCount: 2 },
      incidentDensity: { NORTHBOUNDARY: 9 },
      patrolCoverage: { NORTHBOUNDARY: { actualHours: 8, requiredHours: 10, coveragePercent: 80 } },
      weeklyTrends: { '2026-W01': 9 }
    }));
  });
});

describe('reports workspace', () => {
  it('renders criteria and analytics result cards', async () => {
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /reports workspace/i })).toBeInTheDocument();
    expect(screen.getByLabelText('From date')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Incidents recorded')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /generate report/i }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/analytics/generate', expect.objectContaining({ method: 'POST' })));
    await waitFor(() => expect(screen.getByText('Incidents recorded')).toBeInTheDocument());
  });

  it('opens a zone drill-down with incident and patrol tabs', async () => {
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /generate report/i }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /North Boundary/i }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('button', { name: /North Boundary/i })[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Patrol activity' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Patrol activity' }));
    await waitFor(() => expect(screen.getByText(/no patrol records/i)).toBeInTheDocument());
  });

  it('renders API-provided comparison, partial status, and recommendations', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/reports')) return Promise.resolve(response([]));
      return Promise.resolve(response({
        reportId: 'AN-2026-000002',
        status: 'partial',
        partialReasons: ['Patrol records are incomplete'],
        recommendations: ['Increase patrol coverage in North Boundary'],
        comparison: { incidents: { change: '-20%' } },
        categoryDistribution: { elephant: 3, snare: 1 },
        incidentDensity: { NORTHBOUNDARY: 3 },
        patrolCoverage: { NORTHBOUNDARY: { actualHours: 4, requiredHours: 10, coveragePercent: 40 } },
        weeklyTrends: { '2026-W01': 3 }
      }));
    });
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /generate report/i }));
    await waitFor(() => expect(screen.getByText(/partial report/i)).toBeInTheDocument());
    expect(screen.queryByText('-20%')).not.toBeInTheDocument();
    expect(screen.getByText(/increase patrol coverage/i)).toBeInTheDocument();
    expect(screen.queryByText('+12%')).not.toBeInTheDocument();
  });

  it('uses distinct terrain layout and blocks empty-zone reports', async () => {
    render(<MemoryRouter><ReportsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('radio', { name: /terrain trend/i }));
    const zoneChecks = screen.getAllByRole('checkbox').slice(0, 4);
    zoneChecks.forEach((checkbox) => fireEvent.click(checkbox));
    fireEvent.click(screen.getByRole('button', { name: /generate report/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/at least one terrain zone/i);
  });
});
