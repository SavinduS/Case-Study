import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import ScreenHeader from '../ScreenHeader';

describe('ScreenHeader', () => {
  it('renders the centred title', async () => {
    const { getByText } = await render(<ScreenHeader title="My Reports" />);
    expect(getByText('My Reports')).toBeTruthy();
  });

  it('renders a right slot when provided', async () => {
    const { getByText } = await render(<ScreenHeader title="My Reports" right={<Text>Refresh</Text>} />);
    expect(getByText('Refresh')).toBeTruthy();
  });

  it('renders a left slot when provided', async () => {
    const { getByText } = await render(
      <ScreenHeader title="Submit Conflict Report" left={<Text>Back</Text>} />
    );
    expect(getByText('Back')).toBeTruthy();
  });
});
