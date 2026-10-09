import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import SubmitReportScreen, { SubmitData } from '../SubmitReportScreen';
import type { GpsState } from '../../services/location';

const located: GpsState = {
  status: 'located',
  fix: { coordinates: [81.42, 6.62], accuracyMeters: 12 },
  manual: false
};

const detecting: GpsState = { status: 'detecting', fix: null, manual: false };

function defaultProps(overrides: Partial<React.ComponentProps<typeof SubmitReportScreen>> = {}) {
  return {
    gps: located,
    submitting: false,
    serverError: null,
    fieldErrors: null,
    photoUri: null,
    photoError: null,
    onSubmit: jest.fn(),
    onOpenPicker: jest.fn(),
    onPhotoChange: jest.fn(),
    ...overrides
  };
}

describe('SubmitReportScreen', () => {
  it('renders the form with the pinned header and footnote', async () => {
    const { getByText } = await render(<SubmitReportScreen {...defaultProps()} />);
    expect(getByText('Submit Conflict Report')).toBeTruthy();
    expect(getByText(/Your report will be confirmed/)).toBeTruthy();
  });

  it('shows the server error banner when submission fails', async () => {
    const { getByText } = await render(
      <SubmitReportScreen {...defaultProps({ serverError: 'Validation failed' })} />
    );
    expect(getByText('Report not sent')).toBeTruthy();
    expect(getByText('Validation failed')).toBeTruthy();
  });

  it('blocks submit and shows errors when type and location are missing', async () => {
    const onSubmit = jest.fn();
    const { getByText } = await render(
      <SubmitReportScreen {...defaultProps({ gps: detecting, onSubmit })} />
    );
    await fireEvent.press(getByText('Submit Report'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(getByText('Select the type of incident.')).toBeTruthy();
    expect(getByText(/Location is required/)).toBeTruthy();
  });

  it('merges server-side field errors into the displayed errors', async () => {
    const { getByText } = await render(
      <SubmitReportScreen
        {...defaultProps({ fieldErrors: { incidentType: 'Server says pick another type' } })}
      />
    );
    await fireEvent.press(getByText('Submit Report'));
    expect(getByText('Server says pick another type')).toBeTruthy();
  });

  it('submits with trimmed description, sector label and GPS accuracy', async () => {
    const onSubmit = jest.fn();
    const { getByText, getByLabelText } = await render(
      <SubmitReportScreen {...defaultProps({ onSubmit })} />
    );
    await fireEvent.press(getByText('Elephant Sighting'));
    await fireEvent.changeText(getByLabelText('Description, optional'), '  Herd crossing  ');
    await fireEvent.press(getByText('Submit Report'));
    const data = onSubmit.mock.calls[0][0] as SubmitData;
    expect(data).toEqual({
      incidentType: 'elephant_sighting',
      location: { coordinates: [81.42, 6.62] },
      description: 'Herd crossing',
      accuracyMeters: 12,
      locationText: 'North Boundary'
    });
  });

  it('omits the description and accuracy for a manual location with no text', async () => {
    const onSubmit = jest.fn();
    const { getByText } = await render(
      <SubmitReportScreen
        {...defaultProps({
          onSubmit,
          gps: { status: 'located', fix: { coordinates: [10, 10] }, manual: true }
        })}
      />
    );
    await fireEvent.press(getByText('Crop Damage'));
    await fireEvent.press(getByText('Submit Report'));
    const data = onSubmit.mock.calls[0][0] as SubmitData;
    expect(data.description).toBeUndefined();
    expect(data.accuracyMeters).toBeUndefined();
    expect(data.locationText).toBeUndefined();
  });

  it('forwards the picker and photo callbacks and disables submit while sending', async () => {
    const onOpenPicker = jest.fn();
    const onPhotoChange = jest.fn();
    const { getByText, getByLabelText } = await render(
      <SubmitReportScreen
        {...defaultProps({ submitting: true, onOpenPicker, onPhotoChange })}
      />
    );
    await fireEvent.press(getByLabelText('Change incident location'));
    expect(onOpenPicker).toHaveBeenCalled();
    await fireEvent.press(getByText('Take Photo'));
    expect(onPhotoChange).not.toHaveBeenCalled();
  });

  it('shows the character counter for the description', async () => {
    const { getByLabelText, getByText } = await render(
      <SubmitReportScreen {...defaultProps()} />
    );
    await fireEvent.changeText(getByLabelText('Description, optional'), 'abcd');
    expect(getByText('4/500')).toBeTruthy();
  });
});
