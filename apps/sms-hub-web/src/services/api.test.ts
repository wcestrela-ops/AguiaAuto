import { describe, it, expect, beforeEach } from 'vitest';

describe('ApiClient token storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and clears tokens', async () => {
    const { api } = await import('./api');

    api.setTokens({
      access_token: 'access-abc',
      refresh_token: 'refresh-xyz',
      expires_in: '1h',
      user: {
        id: '1',
        name: 'Test',
        email: 'test@local',
        role: 'COMPANY_USER',
        company_id: 'c1',
        status: 'ACTIVE',
      },
    });

    expect(localStorage.getItem('sms_hub_access')).toBe('access-abc');
    expect(api.getUser()?.email).toBe('test@local');

    api.clearTokens();
    expect(localStorage.getItem('sms_hub_access')).toBeNull();
    expect(api.getUser()).toBeNull();
  });
});
