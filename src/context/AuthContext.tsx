import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { clearAuthStorage, getUser, type StoredUser } from "../utils/authStorage";
import { hydrateSessionUser } from "../services/authService";

type AuthContextValue = {
  user: StoredUser | null;
  isAdmin: boolean;
  isLoadingUser: boolean;
  refreshUser: () => Promise<void>;
  setUser: (nextUser: StoredUser | null) => void;
  clearSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function hasAdminRole(user: StoredUser | null): boolean {
  if (!user) {
    return false;
  }

  if (
    user.isAdmin === true ||
    (typeof user.isAdmin === "string" &&
      user.isAdmin.toLowerCase() === "true")
  ) {
    return true;
  }

  const roleCandidate = user.role ?? user.userType ?? (user.userRole as string | undefined);
  if (typeof roleCandidate === "string" && roleCandidate.toLowerCase() === "admin") {
    return true;
  }

  if (typeof user.roles === "string") {
    return user.roles
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .includes("admin");
  }

  if (Array.isArray(user.roles)) {
    return user.roles.some(
      (role) => typeof role === "string" && role.toLowerCase() === "admin"
    );
  }

  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const refreshUser = useCallback(async () => {
    const cachedUser = await getUser();
    setUser(cachedUser);

    const sessionUser = await hydrateSessionUser();
    if (sessionUser) {
      setUser(sessionUser);
    }
  }, []);

  const clearSession = useCallback(async () => {
    await clearAuthStorage();
    setUser(null);
  }, []);

  useEffect(() => {
    refreshUser()
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setIsLoadingUser(false);
      });
  }, [refreshUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAdmin: hasAdminRole(user),
      isLoadingUser,
      refreshUser,
      setUser,
      clearSession,
    }),
    [clearSession, isLoadingUser, refreshUser, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
