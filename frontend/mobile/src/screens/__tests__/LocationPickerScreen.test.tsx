import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import LocationPickerScreen from '../LocationPickerScreen';
import { getCurrentFix, requestLocationPermission } from '../../services/location';
import type { GpsFix } from '../../services/location';

jest.mock('../../services/location', () => ({
  requestLocationPermission: jest.fn(),
  getCurrentFix: jest.fn()
}));

const permissionMock = requestLocationPermission as jest.MockedFunction<
  typeof requestLocationPermission
>;
const fixMock = getCurrentFix as jest.MockedFunction<typeof getCurrentFix>;

const initialFix: GpsFix = { coordinates: [81.42, 6.62], accuracyMeters: 10 };

describe('LocationPickerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the map panel, header and confirm button', async () => {
    const { getByText, getByTestId } = await render(
      <LocationPickerScreen
        initialFix={initialFix}
        initialManual={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(getByText('Incident location')).toBeTruthy();
    expect(getByTestId('webview')).toBeTruthy();
    expect(getByText('Use This Location')).toBeTruthy();
  });

  it('shows the initial fix coordinates and confirms them', async () => {
    const onConfirm = jest.fn();
    const { getByText } = await render(
      <LocationPickerScreen
        initialFix={initialFix}
        initialManual={false}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );
    expect(getByText('6.62000, 81.42000')).toBeTruthy();
    await fireEvent.press(getByText('Use This Location'));
    expect(onConfirm).toHaveBeenCalledWith({ coordinates: [81.42, 6.62] });
  });

  it('falls back to the Yala default when there is no initial fix', async () => {
    const onConfirm = jest.fn();
    const { getByText } = await render(
      <LocationPickerScreen
        initialFix={null}
        initialManual={false}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );
    expect(getByText('6.48000, 81.40000')).toBeTruthy();
    await fireEvent.press(getByText('Use This Location'));
    expect(onConfirm).toHaveBeenCalledWith({ coordinates: [81.4, 6.48] });
  });

  it('updates the pin from a map message and marks it manual', async () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = await render(
      <LocationPickerScreen
        initialFix={initialFix}
        initialManual={false}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );
    await act(async () => {
      getByTestId('webview').props.onMessage({
        nativeEvent: { data: JSON.stringify({ lat: 6.5, lng: 81.5 }) }
      });
    });
    expect(getByText('6.50000, 81.50000')).toBeTruthy();
    await fireEvent.press(getByText('Use This Location'));
    expect(onConfirm).toHaveBeenCalledWith({ coordinates: [81.5, 6.5] });
  });

  it('ignores malformed map messages', async () => {
    const { getByTestId, getByText } = await render(
      <LocationPickerScreen
        initialFix={initialFix}
        initialManual={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    await act(async () => {
      getByTestId('webview').props.onMessage({
        nativeEvent: { data: 'not json' }
      });
      getByTestId('webview').props.onMessage({
        nativeEvent: { data: JSON.stringify({ lat: 'x', lng: 'y' }) }
      });
    });
    expect(getByText('6.62000, 81.42000')).toBeTruthy();
  });

  it('goes back through onCancel', async () => {
    const onCancel = jest.fn();
    const { getByLabelText } = await render(
      <LocationPickerScreen
        initialFix={initialFix}
        initialManual={false}
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />
    );
    await fireEvent.press(getByLabelText('Back to report form'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('uses the GPS fix when detection succeeds', async () => {
    permissionMock.mockResolvedValueOnce(true);
    fixMock.mockResolvedValueOnce({ coordinates: [81.55, 6.44], accuracyMeters: 8 });
    const { getByLabelText, getByText } = await render(
      <LocationPickerScreen
        initialFix={initialFix}
        initialManual={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    await act(async () => {
      await fireEvent.press(getByLabelText('Use my current location'));
    });
    await waitFor(() => expect(getByText('6.44000, 81.55000')).toBeTruthy());
  });

  it('shows an error when permission is denied', async () => {
    permissionMock.mockResolvedValueOnce(false);
    const { getByLabelText, getByText } = await render(
      <LocationPickerScreen
        initialFix={initialFix}
        initialManual={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    await act(async () => {
      await fireEvent.press(getByLabelText('Use my current location'));
    });
    expect(getByText('Location permission was denied.')).toBeTruthy();
  });

  it('shows an error when the GPS fix fails', async () => {
    permissionMock.mockResolvedValueOnce(true);
    fixMock.mockRejectedValueOnce(new Error('gps off'));
    const { getByLabelText, getByText } = await render(
      <LocationPickerScreen
        initialFix={initialFix}
        initialManual={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    await act(async () => {
      await fireEvent.press(getByLabelText('Use my current location'));
    });
    expect(getByText('GPS could not determine your position.')).toBeTruthy();
  });
});
