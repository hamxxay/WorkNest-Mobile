export type ApiResponse<T> = {
  isSuccessful: boolean;
  message: string | null;
  data: T | null;
};

export type AuthResponse = {
  token: string | null;
  email: string | null;
  userId: string | null;
  roles: string[] | null;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
};

