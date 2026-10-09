import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import PhotoPicker from '../PhotoPicker';

const mockLaunchCameraAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();
const mockRequestCameraPermissionsAsync = jest.fn();
const mockRequestMediaLibraryPermissionsAsync = jest.fn();

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: (...args: unknown[]) => mockLaunchCameraAsync(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
  requestCameraPermissionsAsync: (...args: unknown[]) => mockRequestCameraPermissionsAsync(...args),
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) =>
    mockRequestMediaLibraryPermissionsAsync(...args),
  MediaTypeOptions: { Images: 'Images' }
}));

const granted = { granted: true, canAskAgain: true, status: 'granted' };
const denied = { granted: false, canAskAgain: false, status: 'denied' };

beforeEach(() => {
  jest.clearAllMocks();
  mockRequestCameraPermissionsAsync.mockResolvedValue(granted);
  mockRequestMediaLibraryPermissionsAsync.mockResolvedValue(granted);
});

describe('PhotoPicker', () => {
  it('shows the hint when no photo is attached', async () => {
    const { getByText } = await render(
      <PhotoPicker photoUri={null} photoError={null} onChange={jest.fn()} />
    );
    expect(
      getByText('Take a photo or choose from gallery. You can submit without a photo.')
    ).toBeTruthy();
  });

  it('shows the preview and removes the photo', async () => {
    const onChange = jest.fn();
    const { getByText, getByLabelText } = await render(
      <PhotoPicker photoUri="file:///photo.jpg" photoError={null} onChange={onChange} />
    );
    expect(getByText('Photo attached')).toBeTruthy();
    await fireEvent.press(getByLabelText('Remove attached photo'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('uploads the camera result through onChange', async () => {
    const onChange = jest.fn();
    mockLaunchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cam.jpg' }]
    });
    const { getByLabelText } = await render(
      <PhotoPicker photoUri={null} photoError={null} onChange={onChange} />
    );
    await fireEvent.press(getByLabelText('Take photo with camera'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('file:///cam.jpg'));
    expect(mockRequestCameraPermissionsAsync).toHaveBeenCalled();
  });

  it('shows a message when camera permission is denied', async () => {
    const onChange = jest.fn();
    mockRequestCameraPermissionsAsync.mockResolvedValue(denied);
    const { getByLabelText, findByText } = await render(
      <PhotoPicker photoUri={null} photoError={null} onChange={onChange} />
    );
    await fireEvent.press(getByLabelText('Take photo with camera'));
    expect(
      await findByText('Camera permission was denied. You can still submit without a photo.')
    ).toBeTruthy();
    expect(mockLaunchCameraAsync).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uploads the gallery result through onChange', async () => {
    const onChange = jest.fn();
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///lib.jpg' }]
    });
    const { getByLabelText } = await render(
      <PhotoPicker photoUri={null} photoError={null} onChange={onChange} />
    );
    await fireEvent.press(getByLabelText('Choose photo from gallery'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('file:///lib.jpg'));
    expect(mockRequestMediaLibraryPermissionsAsync).toHaveBeenCalled();
  });

  it('does nothing when the picker is canceled', async () => {
    const onChange = jest.fn();
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: [] });
    const { getByLabelText } = await render(
      <PhotoPicker photoUri={null} photoError={null} onChange={onChange} />
    );
    await fireEvent.press(getByLabelText('Choose photo from gallery'));
    await waitFor(() => expect(mockLaunchImageLibraryAsync).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a fallback message when the picker throws', async () => {
    const onChange = jest.fn();
    mockRequestCameraPermissionsAsync.mockRejectedValue(new Error('boom'));
    const { getByLabelText, findByText } = await render(
      <PhotoPicker photoUri={null} photoError={null} onChange={onChange} />
    );
    await fireEvent.press(getByLabelText('Take photo with camera'));
    expect(await findByText('The photo could not be selected. Try again.')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the photoError prop text', async () => {
    const { getByText } = await render(
      <PhotoPicker
        photoUri={null}
        photoError="Photo could not be uploaded: too large."
        onChange={jest.fn()}
      />
    );
    expect(getByText('Photo could not be uploaded: too large.')).toBeTruthy();
  });

  it('ignores presses while disabled', async () => {
    const onChange = jest.fn();
    const { getByLabelText } = await render(
      <PhotoPicker photoUri={null} photoError={null} disabled onChange={onChange} />
    );
    await fireEvent.press(getByLabelText('Take photo with camera'));
    await fireEvent.press(getByLabelText('Choose photo from gallery'));
    expect(mockRequestCameraPermissionsAsync).not.toHaveBeenCalled();
    expect(mockRequestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
