import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import TabBar from '../TabBar';

describe('TabBar', () => {
  it('renders the three tabs', async () => {
    const { getByText } = await render(<TabBar active="form" onSelect={jest.fn()} />);
    expect(getByText('Submit Report')).toBeTruthy();
    expect(getByText('My Reports')).toBeTruthy();
    expect(getByText('SMS Guide')).toBeTruthy();
  });

  it('marks only the active tab as selected', async () => {
    const { getByLabelText } = await render(<TabBar active="myReports" onSelect={jest.fn()} />);
    expect(getByLabelText('My Reports').props.accessibilityState.selected).toBe(true);
    expect(getByLabelText('Submit Report').props.accessibilityState.selected).toBe(false);
    expect(getByLabelText('SMS Guide').props.accessibilityState.selected).toBe(false);
  });

  it('reports the tapped tab id', async () => {
    const onSelect = jest.fn();
    const { getByLabelText } = await render(<TabBar active="form" onSelect={onSelect} />);
    await fireEvent.press(getByLabelText('SMS Guide'));
    expect(onSelect).toHaveBeenCalledWith('smsGuide');
    await fireEvent.press(getByLabelText('Submit Report'));
    expect(onSelect).toHaveBeenCalledWith('form');
    await fireEvent.press(getByLabelText('My Reports'));
    expect(onSelect).toHaveBeenCalledWith('myReports');
  });
});
