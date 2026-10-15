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
  isAccessOfficer as isAccessOfficerRole,
  isAdminOrAbove,
  isCeo as isCeoRole,
  isLocationBound,
  isSalesManager as isSalesManagerRole,
  isStaffRole,
  isSuperAdmin as isSuperAdminRole,
  resolveRole,
  type StaffRole,
  type UserRole,
} from "./roles";
import { greetingName, userDisplayName, userRoleLabel } from "./userDisplay";

// The role model lives in ./roles (pure, unit-tested); re-exported here for existing imports.
export {
  hasRole,
  isAccessOfficer,
  isAdminOrAbove,
  isCeo,
  isLocationBound,
  isSalesManager,
  isStaffRole,
  isSuperAdmin,
  normalizeRoleName,
  resolveRole,
  roleLabel,
  rolesOf,
  STAFF_ROLES,
} from "./roles";
export type { StaffRole, UserRole } from "./roles";
export { emailPrefixName, greetingName, realName, userDisplayName, userRoleLabel } from "./userDisplay";

type AuthContextValue = {
  user: StoredUser | null;
  /**
   * The experience to show: general (customer app), sales_executive, admin, super_admin, access_officer,
   * sales_manager or ceo.
   */
  role: UserRole;
  /** The staff role, or null for customers. */
  staffRole: StaffRole | null;
  /** Sales executive, admin or super admin (never the CEO, the Sales Manager or the Access Officer). */
  isStaff: boolean;
  /** The CEO: read-only, every location, only the CEO dashboard (its own navigator). */
  isCeo: boolean;
  /** The Sales Manager: read-only, their assigned locations, only the sales dashboard (its own navigator). */
  isSalesManager: boolean;
  /** The Access Officer: door access by CNIC at their assigned locations, only the Access screen (its own navigator). */
  isAccessOfficer: boolean;
  /** Admin or super admin (CMS `adminOnly`, API "admin,Admin,super_admin,SuperAdmin"). */
  isAdmin: boolean;
  /** Super admin only (CMS `superAdminOnly`). */
  isSuperAdmin: boolean;
  /** Sales executive and not an admin. */
  isSalesExecutive: boolean;
  /** Admins, sales executives, the Sales Manager and the Access Officer only see their own location(s); super admins see all. */
  isLocationBound: boolean;
  /** The user's name from auth/me (WN_Users.Name) as it is; the email prefix only when there is none. */
  displayName: string;
  /** The first word of the real name, for greetings ("CEO1", "Sara"); "" when there is no name or email. */
  greetingName: string;
  /** The role as shown: WN_Roles.DisplayName from auth/me ("Sales Manager"), else the app's label. */
  roleDisplayLabel: string;
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
      isSalesManager: isSalesManagerRole(role),
      isAccessOfficer: isAccessOfficerRole(role),
      isAdmin: isAdminOrAbove(role),
      isSuperAdmin: isSuperAdminRole(role),
      isSalesExecutive: role === "sales_executive",
      isLocationBound: isLocationBound(role),
      displayName: userDisplayName(user),
      greetingName: greetingName(user),
      roleDisplayLabel: userRoleLabel(user, role),
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
