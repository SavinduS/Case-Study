import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import PrimaryButton from '../PrimaryButton';

describe('PrimaryButton', () => {
  it('renders the label', async () => {
    const { getByText } = await render(<PrimaryButton label="Submit Report" onPress={jest.fn()} />);
    expect(getByText('Submit Report')).toBeTruthy();
  });

  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(<PrimaryButton label="Send" onPress={onPress} />);
    await fireEvent.press(getByText('Send'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(<PrimaryButton label="Send" onPress={onPress} disabled />);
    await fireEvent.press(getByText('Send'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows a spinner instead of the label while loading and blocks press', async () => {
    const onPress = jest.fn();
    const { getByLabelText, queryByText } = await render(
      <PrimaryButton label="Send" onPress={onPress} loading />
    );
    expect(queryByText('Send')).toBeNull();
    await fireEvent.press(getByLabelText('Send'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
