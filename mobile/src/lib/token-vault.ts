import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'ricoz.access-token';
const REFRESH_TOKEN_KEY = 'ricoz.refresh-token';
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

let accessTokenCache: string | null | undefined;

const getItem = (key: string) => {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.sessionStorage?.getItem(key) ?? null);
  return SecureStore.getItemAsync(key, options);
};

const setItem = (key: string, value: string) => {
  if (Platform.OS === 'web') { globalThis.sessionStorage?.setItem(key, value); return Promise.resolve(); }
  return SecureStore.setItemAsync(key, value, options);
};

const deleteItem = (key: string) => {
  if (Platform.OS === 'web') { globalThis.sessionStorage?.removeItem(key); return Promise.resolve(); }
  return SecureStore.deleteItemAsync(key, options);
};

export const tokenVault = {
  async getAccessToken() {
    if (accessTokenCache !== undefined) return accessTokenCache;
    accessTokenCache = await getItem(ACCESS_TOKEN_KEY);
    return accessTokenCache;
  },

  getRefreshToken() {
    return getItem(REFRESH_TOKEN_KEY);
  },

  async save(accessToken: string, refreshToken?: string) {
    if (typeof accessToken !== 'string' || !accessToken) {
      throw new Error('The authentication server did not return a valid access token.');
    }
    await Promise.all([
      setItem(ACCESS_TOKEN_KEY, accessToken),
      typeof refreshToken === 'string' && refreshToken
        ? setItem(REFRESH_TOKEN_KEY, refreshToken)
        : deleteItem(REFRESH_TOKEN_KEY),
    ]);
    accessTokenCache = accessToken;
  },

  async clear() {
    await Promise.all([
      deleteItem(ACCESS_TOKEN_KEY),
      deleteItem(REFRESH_TOKEN_KEY),
    ]);
    accessTokenCache = null;
  },
};