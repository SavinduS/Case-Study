import Constants from 'expo-constants';

const constantsMock = Constants as unknown as {
  expoConfig: { hostUri?: string } | undefined;
};

describe('config', () => {
  beforeEach(() => {
    constantsMock.expoConfig = { hostUri: '192.168.50.10:8081' };
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  });

  afterEach(() => {
    delete (globalThis as { document?: unknown }).document;
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  });

  it('derives the host from the Metro hostUri (port stripped)', () => {
    const { getHostAddress } = require('../config');
    expect(getHostAddress()).toBe('192.168.50.10');
  });

  it('prefers the document hostname when running on web', () => {
    (globalThis as { document?: unknown }).document = { location: { hostname: 'web.example' } };
    const { getHostAddress } = require('../config');
    expect(getHostAddress()).toBe('web.example');
  });

  it('returns null without a hostUri and no document', () => {
    constantsMock.expoConfig = undefined;
    const { getHostAddress } = require('../config');
    expect(getHostAddress()).toBeNull();
  });

  it('orders candidates: Metro host :5000, :5001, then the emulator address', () => {
    const { apiBaseCandidates } = require('../config');
    expect(apiBaseCandidates()).toEqual([
      'http://192.168.50.10:5000',
      'http://192.168.50.10:5001',
      'http://10.0.2.2:5000'
    ]);
  });

  it('puts the EXPO_PUBLIC_API_BASE_URL override first and de-duplicates', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://192.168.50.10:5000';
    jest.resetModules();
    const { apiBaseCandidates } = require('../config');
    expect(apiBaseCandidates()).toEqual([
      'http://192.168.50.10:5000',
      'http://192.168.50.10:5001',
      'http://10.0.2.2:5000'
    ]);
  });

  it('always includes the emulator fallback even with an override', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://pin.test:9000';
    jest.resetModules();
    const { apiBaseCandidates } = require('../config');
    expect(apiBaseCandidates()[0]).toBe('http://pin.test:9000');
    expect(apiBaseCandidates()).toContain('http://10.0.2.2:5000');
  });
});
