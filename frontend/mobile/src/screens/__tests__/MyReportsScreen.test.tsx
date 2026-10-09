import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import MyReportsScreen from '../MyReportsScreen';
import { ApiError, getReport, pingServer } from '../../api/client';
import { listReports } from '../../services/offlineQueue';
import type { QueuedReport } from '../../types';

jest.mock('../../api/client', () => {
  const actual = jest.requireActual('../../api/client');
  return {
    ...actual,
    getReport: jest.fn(),
    pingServer: jest.fn()
  };
});

jest.mock('../../services/offlineQueue', () => ({
  listReports: jest.fn()
}));

const getReportMock = getReport as jest.MockedFunction<typeof getReport>;
const pingServerMock = pingServer as jest.MockedFunction<typeof pingServer>;
const listReportsMock = listReports as jest.MockedFunction<typeof listReports>;

const pendingItem: QueuedReport = {
  clientRefId: 'local-1-abc',
  payload: {
    incidentType: 'elephant_sighting',
    location: { coordinates: [81.42, 6.62] },
    locationText: 'North Boundary'
  },
  photoUri: 'file:///p.jpg',
  status: 'PENDING_UPLOAD',
  createdAt: '2026-01-02T10:00:00.000Z',
  lastError: 'Photo upload interrupted — waiting for a connection'
};

const receivedItem: QueuedReport = {
  clientRefId: 'local-2-def',
  payload: {
    incidentType: 'crop_damage',
    location: { coordinates: [81.4, 6.35] }
  },
  status: 'RECEIVED',
  reportId: 'CR-100',
  createdAt: '2026-01-01T09:00:00.000Z'
};

beforeEach(() => {
  jest.clearAllMocks();
  listReportsMock.mockResolvedValue([]);
  pingServerMock.mockResolvedValue({ reachable: true, base: 'http://api.test' });
});

describe('MyReportsScreen', () => {
  it('shows the empty state once the list loads', async () => {
    const { getByText } = await render(<MyReportsScreen onRefreshReports={jest.fn()} />);
    await waitFor(() =>
      expect(getByText('No reports submitted from this device yet.')).toBeTruthy()
    );
  });

  it('shows a server-up banner after a successful ping', async () => {
    const { getByText } = await render(<MyReportsScreen onRefreshReports={jest.fn()} />);
    await waitFor(() => expect(getByText('Server reachable')).toBeTruthy());
  });

  it('shows the offline banner with guidance when the server is down', async () => {
    pingServerMock.mockResolvedValue({ reachable: false, base: 'http://api.test' });
    const { getByText } = await render(<MyReportsScreen onRefreshReports={jest.fn()} />);
    await waitFor(() => expect(getByText('Server NOT reachable')).toBeTruthy());
    expect(getByText(/Windows firewall allows Node.js/)).toBeTruthy();
  });

  it('renders a pending row with retry button and the stored error', async () => {
    listReportsMock.mockResolvedValue([pendingItem]);
    const { getByText } = await render(<MyReportsScreen onRefreshReports={jest.fn()} />);
    await waitFor(() => expect(getByText('PENDING UPLOAD')).toBeTruthy());
    expect(getByText('local-1-abc')).toBeTruthy();
    expect(getByText('Photo waiting to upload')).toBeTruthy();
    expect(getByText(/Photo upload interrupted/)).toBeTruthy();
    expect(getByText('Retry upload now')).toBeTruthy();
  });

  it('runs the refresh flow when Retry is pressed', async () => {
    listReportsMock.mockResolvedValue([pendingItem]);
    const onRefreshReports = jest.fn(async () => undefined);
    const { getByText } = await render(<MyReportsScreen onRefreshReports={onRefreshReports} />);
    await waitFor(() => expect(getByText('Retry upload now')).toBeTruthy());
    await fireEvent.press(getByText('Retry upload now'));
    await waitFor(() => expect(onRefreshReports).toHaveBeenCalled());
  });

  it('checks live status for a received report and shows it', async () => {
    listReportsMock.mockResolvedValue([receivedItem]);
    getReportMock.mockResolvedValueOnce({
      reportId: 'CR-100',
      status: 'UNDER_REVIEW',
      submissionMethod: 'app',
      incidentType: 'crop_damage',
      createdAt: receivedItem.createdAt
    });
    const { getByText, getByLabelText } = await render(<MyReportsScreen onRefreshReports={jest.fn()} />);
    await waitFor(() => expect(getByText('CR-100')).toBeTruthy());
    await waitFor(() => expect(getByText('Tap to check live status')).toBeTruthy());
    await fireEvent.press(getByLabelText('Check live status on the server'));
    await waitFor(() =>
      expect(getByText('Server status now: UNDER_REVIEW')).toBeTruthy()
    );
  });

  it('reports a missing report when the server answers 404', async () => {
    listReportsMock.mockResolvedValue([receivedItem]);
    getReportMock.mockRejectedValueOnce(
      new ApiError(404, { message: 'Not found' })
    );
    const { getByText, getByLabelText } = await render(<MyReportsScreen onRefreshReports={jest.fn()} />);
    await waitFor(() => expect(getByText('CR-100')).toBeTruthy());
    await fireEvent.press(getByLabelText('Check live status on the server'));
    await waitFor(() => expect(getByText('Not found on the server')).toBeTruthy());
  });

  it('shows a generic live error for other failures', async () => {
    listReportsMock.mockResolvedValue([receivedItem]);
    getReportMock.mockRejectedValueOnce(new Error('boom'));
    const { getByText, getByLabelText } = await render(<MyReportsScreen onRefreshReports={jest.fn()} />);
    await waitFor(() => expect(getByText('CR-100')).toBeTruthy());
    await fireEvent.press(getByLabelText('Check live status on the server'));
    await waitFor(() => expect(getByText('Could not reach the server')).toBeTruthy());
  });

  it('the header Refresh button triggers the refresh flow', async () => {
    const onRefreshReports = jest.fn(async () => undefined);
    const { getByLabelText } = await render(<MyReportsScreen onRefreshReports={onRefreshReports} />);
    await fireEvent.press(getByLabelText('Refresh reports'));
    await waitFor(() => expect(onRefreshReports).toHaveBeenCalled());
  });
});
