import { removeToken } from "../utils/authStorage";

export async function logoutUser(): Promise<void> {
  await removeToken();
}
