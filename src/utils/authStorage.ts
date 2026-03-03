import AsyncStorage from '@react-native-async-storage/async-storage';

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
  await AsyncStorage.setItem(TOKEN_KEY, token);
};

export const saveRefreshToken = async (token: string) => {
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token);
};

export const saveUser = async (user: StoredUser) => {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getToken = async () => {
  return AsyncStorage.getItem(TOKEN_KEY);
};

export const getRefreshToken = async () => {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
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
  await AsyncStorage.removeItem(TOKEN_KEY);
};

export const removeRefreshToken = async () => {
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
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
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
};
// export const isAuthenticated = async (): Promise<boolean> => {
//   const token = await getToken();
//   return !!token;
// }