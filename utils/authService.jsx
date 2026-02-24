import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from './apiConfig';

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
 * Check if user is logged in (has tokens stored)
 */
export async function isLoggedIn() {
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
 * Login and store tokens
 */
export async function login(username, password) {
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
      // Refresh token is invalid/expired — force re-login
      await clearAuth();
      return null;
    }

    const data = await res.json();
    await storeTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

/**
 * Logout — revoke refresh token on server, then clear local storage
 */
export async function logout() {
  try {
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
      // Session is dead — force re-login
      if (onSessionExpired) onSessionExpired();
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
