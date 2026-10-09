import React from 'react';
import { render } from '@testing-library/react-native';
import StatusBanner from '../StatusBanner';

describe('StatusBanner', () => {
  it('renders the banner with the title', async () => {
    const { getByText } = await render(
      <StatusBanner tone="error" title="Report not sent" />
    );
    expect(getByText('Report not sent')).toBeTruthy();
    expect(getByText('!')).toBeTruthy();
  });

  it('renders the message when provided', async () => {
    const { getByText } = await render(
      <StatusBanner tone="error" title="Report not sent" message="Server rejected it" />
    );
    expect(getByText('Server rejected it')).toBeTruthy();
  });

  it('omits the message when not provided', async () => {
    const { queryByText } = await render(<StatusBanner tone="success" title="Server reachable" />);
    expect(queryByText(/chosen automatically/)).toBeNull();
  });

  it.each([
    ['error', '!'],
    ['warn', '!'],
    ['offline', '↓'],
    ['success', '✓']
  ] as const)('shows the %s tone icon', async (tone, icon) => {
    const { getByText } = await render(<StatusBanner tone={tone} title="Something" />);
    expect(getByText(icon)).toBeTruthy();
  });
});
