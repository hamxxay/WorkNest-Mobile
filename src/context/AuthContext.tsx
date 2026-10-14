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
import { hydrateSessionUser, subscribeToAuthChanges } from "../services/authService";

import {
  hasRole as userHasRole,
  isAdminOrAbove,
  isCeo as isCeoRole,
  isLocationBound,
  isStaffRole,
  isSuperAdmin as isSuperAdminRole,
  resolveRole,
  type StaffRole,
  type UserRole,
} from "./roles";

// The role model lives in ./roles (pure, unit-tested); re-exported here for existing imports.
export {
  hasRole,
  isAdminOrAbove,
  isCeo,
  isLocationBound,
  isStaffRole,
  isSuperAdmin,
  normalizeRoleName,
  resolveRole,
  roleLabel,
  rolesOf,
  STAFF_ROLES,
} from "./roles";
export type { StaffRole, UserRole } from "./roles";

type AuthContextValue = {
  user: StoredUser | null;
  /** The experience to show: general (customer app), sales_executive, admin, super_admin or ceo. */
  role: UserRole;
  /** The staff role, or null for customers. */
  staffRole: StaffRole | null;
  /** Sales executive, admin or super admin (never the CEO). */
  isStaff: boolean;
  /** The CEO: read-only, every location, only the CEO dashboard (its own navigator). */
  isCeo: boolean;
  /** Admin or super admin (CMS `adminOnly`, API "admin,Admin,super_admin,SuperAdmin"). */
  isAdmin: boolean;
  /** Super admin only (CMS `superAdminOnly`). */
  isSuperAdmin: boolean;
  /** Sales executive and not an admin. */
  isSalesExecutive: boolean;
  /** Admins and sales executives only see their own location(s); super admins see all. */
  isLocationBound: boolean;
  /** True when the user carries this exact role (CMS AuthService.hasRole). */
  hasRole: (role: UserRole) => boolean;
  isLoadingUser: boolean;
  refreshUser: () => Promise<void>;
  setUser: (nextUser: StoredUser | null) => void;
  clearSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const refreshUser = useCallback(async () => {
    const cachedUser = await getUser();
    setUser(cachedUser);

    const sessionUser = await hydrateSessionUser();
    setUser(sessionUser);
  }, []);

  const clearSession = useCallback(async () => {
    await clearAuthStorage();
    setUser(null);
  }, []);

  useEffect(() => {
    let active = true;

    refreshUser()
      .catch(() => {
        if (active) {
          setUser(null);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingUser(false);
        }
      });

    const unsubscribe = subscribeToAuthChanges((nextUser) => {
      if (!active) {
        return;
      }

      setUser(nextUser);
      setIsLoadingUser(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [refreshUser]);

  const value = useMemo<AuthContextValue>(() => {
    const role = resolveRole(user);
    return {
      user,
      role,
      staffRole: isStaffRole(role) ? role : null,
      isStaff: isStaffRole(role),
      isCeo: isCeoRole(role),
      isAdmin: isAdminOrAbove(role),
      isSuperAdmin: isSuperAdminRole(role),
      isSalesExecutive: role === "sales_executive",
      isLocationBound: isLocationBound(role),
      hasRole: (target: UserRole) => userHasRole(user, target),
      isLoadingUser,
      refreshUser,
      setUser,
      clearSession,
    };
  }, [clearSession, isLoadingUser, refreshUser, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
