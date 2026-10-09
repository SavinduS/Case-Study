import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LocationCard from '../LocationCard';
import type { GpsState } from '../../services/location';

const detecting: GpsState = { status: 'detecting', fix: null, manual: false };

function located(manual: boolean, accuracyMeters?: number): GpsState {
  return {
    status: 'located',
    manual,
    fix: {
      coordinates: [81.42, 6.62],
      ...(accuracyMeters !== undefined ? { accuracyMeters } : {})
    }
  };
}

describe('LocationCard', () => {
  it('shows the detecting state with a spinner text', async () => {
    const { getByText } = await render(<LocationCard gps={detecting} onOpenPicker={jest.fn()} />);
    expect(getByText('Detecting your location…')).toBeTruthy();
  });

  it('shows the GPS error message when provided', async () => {
    const gps: GpsState = {
      status: 'error',
      fix: null,
      manual: false,
      error: 'Location permission was denied. Set the incident location on the map.'
    };
    const { getByText } = await render(<LocationCard gps={gps} onOpenPicker={jest.fn()} />);
    expect(getByText('Current location could not be detected.')).toBeTruthy();
    expect(
      getByText('Location permission was denied. Set the incident location on the map.')
    ).toBeTruthy();
  });

  it('falls back to the default hint when there is no GPS error text', async () => {
    const gps: GpsState = { status: 'error', fix: null, manual: false };
    const { getByText } = await render(<LocationCard gps={gps} onOpenPicker={jest.fn()} />);
    expect(getByText('Use Change incident location to set where the incident happened.')).toBeTruthy();
  });

  it('shows the sector name, accuracy and coordinates for a detected fix', async () => {
    const { getByText } = await render(<LocationCard gps={located(false, 12)} onOpenPicker={jest.fn()} />);
    expect(getByText('North Boundary')).toBeTruthy();
    expect(getByText('GPS detected · Accuracy 12 m')).toBeTruthy();
    expect(getByText('6.62000, 81.42000')).toBeTruthy();
  });

  it('omits the accuracy text when the fix has no accuracy', async () => {
    const { getByText } = await render(<LocationCard gps={located(false)} onOpenPicker={jest.fn()} />);
    expect(getByText('GPS detected')).toBeTruthy();
  });

  it('labels a manually picked point', async () => {
    const { getByText } = await render(<LocationCard gps={located(true)} onOpenPicker={jest.fn()} />);
    expect(getByText('Manually selected point')).toBeTruthy();
    expect(getByText('This is where you said the wildlife was seen.')).toBeTruthy();
  });

  it('falls back to "Selected location" outside every sector', async () => {
    const gps: GpsState = {
      status: 'located',
      manual: true,
      fix: { coordinates: [10, 10] }
    };
    const { getByText } = await render(<LocationCard gps={gps} onOpenPicker={jest.fn()} />);
    expect(getByText('Selected location')).toBeTruthy();
  });

  it('shows the validation error when given', async () => {
    const { getByText } = await render(
      <LocationCard gps={detecting} error="Location is required." onOpenPicker={jest.fn()} />
    );
    expect(getByText('Location is required.')).toBeTruthy();
  });

  it('opens the location picker when the change button is pressed', async () => {
    const onOpenPicker = jest.fn();
    const { getByLabelText } = await render(<LocationCard gps={detecting} onOpenPicker={onOpenPicker} />);
    await fireEvent.press(getByLabelText('Change incident location'));
    expect(onOpenPicker).toHaveBeenCalledTimes(1);
  });
});
