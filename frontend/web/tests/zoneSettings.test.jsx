import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ZoneSettingsPage from '../src/features/reports/pages/ZoneSettingsPage.jsx';

const response = (body) => ({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)), blob: () => Promise.resolve(new Blob()) });

const settings = [
  { code: 'NORTHBOUNDARY', name: 'North Boundary', requiredHours: 8, saved: true },
  { code: 'EASTBOUNDARY', name: 'East Boundary', requiredHours: 8, saved: true },
  { code: 'SOUTHBOUNDARY', name: 'South Boundary', requiredHours: 8, saved: true },
  { code: 'WESTBOUNDARY', name: 'West Boundary', requiredHours: 8, saved: true }
];

beforeEach(() => {
  global.fetch = vi.fn((url, options) => {
    if (options?.method === 'PUT') return Promise.resolve(response({ updated: 4 }));
    return Promise.resolve(response(settings));
  });
});

describe('zone settings', () => {
  it('loads required hours from the database and saves edits', async () => {
    render(<MemoryRouter><ZoneSettingsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByLabelText(/required hours for north boundary/i)).toBeInTheDocument());
    const input = screen.getByLabelText(/required hours for north boundary/i);
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /save zone settings/i }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/saved/i));
    expect(global.fetch).toHaveBeenCalledWith('/api/analytics/zone-settings', expect.objectContaining({ method: 'PUT' }));
  });

  it('blocks invalid required hours before calling the api', async () => {
    render(<MemoryRouter><ZoneSettingsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByLabelText(/required hours for north boundary/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/required hours for north boundary/i), { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: /save zone settings/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/between 0 and 10000/i));
  });
});
