import { removeToken } from '../utils/authStorage';

export const logoutUser = async () => {
  await removeToken();
};