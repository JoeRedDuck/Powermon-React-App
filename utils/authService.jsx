import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from './apiConfig';
import { isTestMode, setTestMode, clearTestMode } from './testMode';

const ACCESS_TOKEN_KEY = '@powermon_access_token';
const REFRESH_TOKEN_KEY = '@powermon_refresh_token';
const USER_KEY = '@powermon_user';

/**
 * Store auth tokens in AsyncStorage
 */
export async function storeTokens(accessToken, refreshToken) {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, accessToken],
    [REFRESH_TOKEN_KEY, refreshToken],
  ]);
}

/**
 * Get stored access token
 */
export async function getAccessToken() {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Get stored refresh token
 */
export async function getRefreshToken() {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Store user info
 */
export async function storeUser(user) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Get stored user info
 */
export async function getStoredUser() {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Clear all auth data (logout)
 */
export async function clearAuth() {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
}

/**
 * Check if user is logged in.
 * Only checks if a refresh token exists locally — does NOT hit the network.
 * This ensures network outages never force an unwanted logout.
 * Token validity is checked lazily when API calls are made via fetchWithAuth.
 */
export async function isLoggedIn() {
  if (await isTestMode()) return true;

  const refreshToken = await getRefreshToken();
  return !!refreshToken;
}

/**
 * Register a new account
 */
export async function register(username, email, password) {
  const apiBase = await getApiUrl();
  const url = `${apiBase}/api/v1/auth/register`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    const detail = data.detail;
    if (typeof detail === 'object' && detail.status === 'weak_password') {
      throw new Error('Password must be at least 8 characters.');
    }
    if (typeof detail === 'object' && detail.status === 'duplicate') {
      throw new Error(detail.reason || 'Username or email already exists.');
    }
    throw new Error(typeof detail === 'string' ? detail : detail?.reason || 'Registration failed.');
  }

  return data;
}

/**
 * Login and store tokens.
 * Username "tester" activates offline testing mode with mock data.
 */
export async function login(username, password) {
  if (username.toLowerCase() === 'tester') {
    await setTestMode();
    await storeTokens('test_access_token', 'test_refresh_token');
    return { access_token: 'test_access_token', refresh_token: 'test_refresh_token', token_type: 'bearer' };
  }

  const apiBase = await getApiUrl();
  const url = `${apiBase}/api/v1/auth/login`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    const detail = data.detail;
    if (typeof detail === 'object' && detail.status === 'invalid_credentials') {
      throw new Error('Invalid username or password.');
    }
    throw new Error(typeof detail === 'string' ? detail : 'Login failed.');
  }

  await storeTokens(data.access_token, data.refresh_token);
  return data;
}

/**
 * Refresh the access token using the refresh token.
 * Returns the new access token or null if refresh fails.
 * Only clears auth (forces logout) when the server explicitly rejects the token
 * (401/403). Network errors and server errors are treated as temporary — the
 * user stays logged in so the app can retry when connectivity returns.
 */
export async function refreshAccessToken() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const apiBase = await getApiUrl();
    const url = `${apiBase}/api/v1/auth/refresh`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      // Only clear auth if the server explicitly rejected the token
      // 500s, timeouts, etc. are temporary — keep the session alive
      if (res.status === 401 || res.status === 403) {
        await clearAuth();
      }
      return null;
    }

    const data = await res.json();
    await storeTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    // Network error — server unreachable, keep tokens, don't log out
    return null;
  }
}

/**
 * Logout — revoke refresh token on server, then clear local storage
 */
export async function logout() {
  try {
    if (await isTestMode()) {
      await clearTestMode();
      await clearAuth();
      return;
    }
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      const apiBase = await getApiUrl();
      const url = `${apiBase}/api/v1/auth/logout`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {}); // best-effort
    }
  } finally {
    await clearAuth();
  }
}

/**
 * Authenticated fetch wrapper — automatically refreshes the access token on 401.
 * Returns null (and clears auth) if the session cannot be recovered.
 * Pass onSessionExpired callback to handle forced logout in the UI.
 */
export async function fetchWithAuth(url, options = {}, onSessionExpired = null) {
  let accessToken = await getAccessToken();

  const doFetch = (token) =>
    fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

  let res = await doFetch(accessToken);

  if (res.status === 401) {
    // Try refresh
    const newToken = await refreshAccessToken();
    if (!newToken) {
      // Only trigger session expired if tokens were actually cleared by the
      // server rejecting them. If it's just a network error, the tokens are
      // still stored and the user stays logged in.
      const stillHasToken = await getRefreshToken();
      if (!stillHasToken && onSessionExpired) onSessionExpired();
      return null;
    }
    res = await doFetch(newToken);
  }

  return res;
}

/**
 * Delete the current user's account permanently
 */
export async function deleteAccount() {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const apiBase = await getApiUrl();
  const url = `${apiBase}/api/v1/auth/account`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const detail = data.detail;
    if (typeof detail === 'object' && detail.status === 'delete_failed') {
      throw new Error('Failed to delete account. Please try again.');
    }
    throw new Error(typeof detail === 'string' ? detail : 'Account deletion failed.');
  }

  // Clear local auth data after successful deletion
  await clearAuth();
  return data;
}

/**
 * Make an authenticated fetch. Automatically refreshes the access token once if expired.
 */
export async function authFetch(url, options = {}) {
  let accessToken = await getAccessToken();

  const doFetch = (token) =>
    fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  let res = await doFetch(accessToken);

  // If 401, try refreshing the token once
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await doFetch(newToken);
    }
  }

  return res;
}
