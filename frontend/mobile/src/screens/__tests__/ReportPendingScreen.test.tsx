import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import ReportPendingScreen from '../ReportPendingScreen';

describe('ReportPendingScreen', () => {
  it('shows the local reference and the offline explanation', async () => {
    const { getByText } = await render(
      <ReportPendingScreen localRef="local-17-abc123" onDone={jest.fn()} />
    );
    expect(getByText('Report saved on this device')).toBeTruthy();
    expect(getByText('local-17-abc123')).toBeTruthy();
    expect(getByText('PENDING UPLOAD')).toBeTruthy();
    expect(getByText(/officers have NOT been notified yet/i)).toBeTruthy();
    expect(getByText(/waiting to send/)).toBeTruthy();
  });

  it('calls onDone when Done is pressed', async () => {
    const onDone = jest.fn();
    const { getByText } = await render(
      <ReportPendingScreen localRef="local-9-zzz" onDone={onDone} />
    );
    await fireEvent.press(getByText('Done'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
