import React from 'react';
import { render } from '@testing-library/react-native';
import SmsGuideScreen from '../SmsGuideScreen';
import { SMS_AREA_CODES, SMS_HOTLINE, SMS_TYPE_CODES } from '../../constants/sms';

describe('SmsGuideScreen', () => {
  it('renders the header, hotline and message format', async () => {
    const { getByText } = await render(<SmsGuideScreen />);
    expect(getByText('SMS Reporting Guide')).toBeTruthy();
    expect(getByText(SMS_HOTLINE)).toBeTruthy();
    expect(getByText('TYPE-CODE AREA-CODE')).toBeTruthy();
    expect(getByText('Example: 1 NORTHBOUNDARY')).toBeTruthy();
  });

  it('lists every SMS type code with its label', async () => {
    const { getByText } = await render(<SmsGuideScreen />);
    for (const row of SMS_TYPE_CODES) {
      expect(getByText(row.label)).toBeTruthy();
    }
  });

  it('lists every area code and the 24-hour reply hint', async () => {
    const { getByText } = await render(<SmsGuideScreen />);
    for (const code of SMS_AREA_CODES) {
      expect(getByText(code)).toBeTruthy();
    }
    expect(getByText(/replies stay\s+valid for 24 hours/)).toBeTruthy();
  });
});
