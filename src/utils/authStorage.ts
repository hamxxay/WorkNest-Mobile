import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';

export type StoredUser = {
  id?: string | number;
  name?: string;
  email?: string;
  role?: string;
  roles?: string[] | string;
  userType?: string;
  userRole?: string;
  isAdmin?: boolean | string;
  [key: string]: unknown;
};

export const saveToken = async (token: string) => {
  try {
    await Keychain.setGenericPassword(TOKEN_KEY, token, { service: TOKEN_KEY });
  } catch {}
  // Clean up legacy AsyncStorage
  await AsyncStorage.removeItem(TOKEN_KEY);
};

export const saveRefreshToken = async (token: string) => {
  try {
    await Keychain.setGenericPassword(REFRESH_TOKEN_KEY, token, { service: REFRESH_TOKEN_KEY });
  } catch {}
  // Clean up legacy AsyncStorage
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const saveUser = async (user: StoredUser) => {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getToken = async () => {
  try {
    const credentials = await Keychain.getGenericPassword({ service: TOKEN_KEY });
    if (credentials) {
      return credentials.password;
    }
    // Migration: check legacy AsyncStorage
    const legacy = await AsyncStorage.getItem(TOKEN_KEY);
    if (legacy) {
      await saveToken(legacy);
      await AsyncStorage.removeItem(TOKEN_KEY); // Clean up after migration
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
};

export const getRefreshToken = async () => {
  try {
    const credentials = await Keychain.getGenericPassword({ service: REFRESH_TOKEN_KEY });
    if (credentials) {
      return credentials.password;
    }
    // Migration: check legacy AsyncStorage
    const legacy = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    if (legacy) {
      await saveRefreshToken(legacy);
      await AsyncStorage.removeItem(REFRESH_TOKEN_KEY); // Clean up after migration
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
};

export const getUser = async (): Promise<StoredUser | null> => {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
};

export const removeToken = async () => {
  try {
    await Keychain.resetGenericPassword({ service: TOKEN_KEY });
  } catch {}
};

export const removeRefreshToken = async () => {
  try {
    await Keychain.resetGenericPassword({ service: REFRESH_TOKEN_KEY });
  } catch {}
};

export const removeUser = async () => {
  await AsyncStorage.removeItem(USER_KEY);
};

export const isAuthenticated = async () => {
  const token = await getToken();
  if (token) {
    return true;
  }

  const user = await getUser();
  return Boolean(user);
};

export const clearAuthStorage = async () => {
  await Promise.allSettled([
    AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]),
    Keychain.resetGenericPassword({ service: TOKEN_KEY }),
    Keychain.resetGenericPassword({ service: REFRESH_TOKEN_KEY }),
  ]);
};

export const clearDeviceCache = async () => {
  await clearAuthStorage();
};
// export const isAuthenticated = async (): Promise<boolean> => {
//   const token = await getToken();
//   return !!token;
// }
