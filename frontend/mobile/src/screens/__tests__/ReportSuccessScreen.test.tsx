import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import ReportSuccessScreen from '../ReportSuccessScreen';
import type { ConflictReportConfirmation } from '../../types';

const confirmation: ConflictReportConfirmation = {
  reportId: 'CR-2026-001',
  status: 'RECEIVED',
  submissionMethod: 'app',
  incidentType: 'elephant_sighting',
  locationText: 'North Boundary',
  createdAt: '2026-01-02T10:30:00.000Z'
};

describe('ReportSuccessScreen', () => {
  it('shows the report id, status and confirmation message', async () => {
    const { getByText } = await render(
      <ReportSuccessScreen confirmation={confirmation} onDone={jest.fn()} />
    );
    expect(getByText('Report Submitted Successfully')).toBeTruthy();
    expect(getByText('CR-2026-001')).toBeTruthy();
    expect(getByText('RECEIVED')).toBeTruthy();
    expect(getByText(/Wildlife officers have been notified/)).toBeTruthy();
  });

  it('calls onDone when Done is pressed', async () => {
    const onDone = jest.fn();
    const { getByText } = await render(
      <ReportSuccessScreen confirmation={confirmation} onDone={onDone} />
    );
    await fireEvent.press(getByText('Done'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('hides the duplicate notice for a normal report', async () => {
    const { queryByText } = await render(
      <ReportSuccessScreen confirmation={confirmation} onDone={jest.fn()} />
    );
    expect(queryByText('Possible duplicate')).toBeNull();
  });

  it('links the duplicate report when the server flagged one', async () => {
    const { getByText } = await render(
      <ReportSuccessScreen
        confirmation={{
          ...confirmation,
          isPossibleDuplicate: true,
          duplicateOfReportId: 'CR-2025-999'
        }}
        onDone={jest.fn()}
      />
    );
    expect(getByText('Possible duplicate')).toBeTruthy();
    expect(getByText(/linked to CR-2025-999/)).toBeTruthy();
  });
});
