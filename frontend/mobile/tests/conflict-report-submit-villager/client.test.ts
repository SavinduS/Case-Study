import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The API client transitively imports Expo native modules (expo-constants for
// the host address, expo-file-system for photo upload). They are irrelevant to
// registerVillager, so they are stubbed to plain objects for these node tests.
vi.mock('expo-constants', () => ({
  default: { expoConfig: null }
}));
vi.mock('expo-file-system', () => ({ File: class {} }));

import { ApiError, registerVillager } from '../../src/api/client';
import { invalidateBaseUrl } from '../../src/api/baseUrl';

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

function mockFetchOnce(payload: { status: number; body: unknown; ok?: boolean }) {
  const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => ({
    ok: payload.ok ?? (payload.status >= 200 && payload.status < 300),
    status: payload.status,
    json: async () => payload.body
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function registerCalls(fetchMock: ReturnType<typeof vi.fn>): Promise<FetchCall[]> {
  const calls = fetchMock.mock.calls as [string, RequestInit?][];
  return calls
    .filter(([url]) => String(url).includes('/api/auth/register/villager'))
    .map(([url, init]) => ({ url: String(url), init }));
}

const SESSION_BODY = {
  id: 'u1',
  name: 'Soma Silva',
  role: 'villager',
  phone: '+94712345678',
  email: 'soma@example.com',
  token: 'jwt.token.value'
};

beforeEach(() => {
  invalidateBaseUrl();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  invalidateBaseUrl();
});

describe('registerVillager (POST /api/auth/register/villager)', () => {
  it('probes the server, sends no role, and resolves the session', async () => {
    const fetchMock = mockFetchOnce({ status: 200, body: SESSION_BODY });

    const session = await registerVillager({
      name: 'Soma Silva',
      phone: '+94712345678',
      password: 'secret123',
      email: 'soma@example.com'
    });

    expect(session).toEqual(SESSION_BODY);

    const [call] = await registerCalls(fetchMock);
    expect(call.url).toMatch(/\/api\/auth\/register\/villager$/);
    const sent = JSON.parse(String(call.init?.body));
    expect(sent).toEqual({
      name: 'Soma Silva',
      phone: '+94712345678',
      password: 'secret123',
      email: 'soma@example.com'
    });
    // The server decides the role; the client never asks for one.
    expect(sent).not.toHaveProperty('role');
    expect((call.init?.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json'
    );
  });

  it('rejects a response the app cannot route on', async () => {
    // First fetch answers the /health probe; the register call then returns a
    // payload without the session fields.
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => ({ ok: true, status: 200, json: async () => ({}) }))
      .mockImplementationOnce(async () => ({
        ok: true,
        status: 201,
        json: async () => ({ message: 'created but not a session' })
      }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      registerVillager({ name: 'Soma', phone: '+94712345678', password: 'secret123' })
    ).rejects.toThrow(/not understood/i);
  });

  it('passes the server rejection (e.g. duplicate phone) through as ApiError', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => ({ ok: true, status: 200, json: async () => ({}) }))
      .mockImplementationOnce(async () => ({
        ok: false,
        status: 409,
        json: async () => ({ message: 'Phone already registered' })
      }));
    vi.stubGlobal('fetch', fetchMock);

    const attempt = registerVillager({
      name: 'Copycat',
      phone: '+94712345678',
      password: 'secret123'
    });
    await expect(attempt).rejects.toBeInstanceOf(ApiError);
    await expect(attempt).rejects.toMatchObject({
      status: 409,
      message: 'Phone already registered'
    });
  });
});
