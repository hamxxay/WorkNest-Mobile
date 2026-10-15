import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import type { StaffRole } from "../../../../context/roles";
import { badgesByRoute, withoutCapacityRequests } from "../../../../navigation/staff/access";
import { errorMessage } from "../../../../services/apiClient";
import type { StaffRouteName } from "../../../../navigation/staffTypes";
import {
  getLocations,
  getNavBadges,
  getStaffProfile,
  listCapacityRequests,
  markNavBadgesRead,
  type NavBadges,
  type StaffLocation,
  type StaffProfile,
} from "../../../../services/staff";

// What every staff screen needs about the signed-in staff member: the role whose navigator is showing, the
// profile (GET auth/me: name, phone, assigned locations), the locations the API lets them see, and the
// "waiting on you" badge counts (GET admin/nav-badges, polled like the CMS sidebar, every 60 s while the app is
// open). Badges are a hint: a failed poll keeps the last values and never shows an error.

const POLL_MS = 60_000;

export type StaffSession = {
  role: StaffRole;
  profile: StaffProfile | null;
  /** Locations the user may see (admins / sales executives: their own; super admins: all), A-Z. */
  locations: StaffLocation[];
  locationsLoading: boolean;
  /** Why the locations could not be loaded (null when they were). */
  locationsError: string | null;
  /** Reloads profile and locations (after editing the profile, or to retry). */
  reloadProfile: () => void;
  /** Nav badges keyed by CMS route (admins: without the capacity requests, which are in pendingApprovals). */
  navBadges: NavBadges;
  /** Badge per app screen the role may open. */
  badges: Partial<Record<StaffRouteName, number>>;
  /** Admins: capacity requests waiting for a decision (Approvals tab); counted only here. */
  pendingApprovals: number;
  /** Total of everything waiting (notifications bell): the screen badges plus the capacity requests, each once. */
  badgeTotal: number;
  refreshBadges: () => void;
  /** POST admin/nav-badges/read: clears the badges of these CMS routes (all when omitted). */
  markBadgesRead: (cmsRoutes?: string[]) => Promise<void>;
};

const StaffSessionContext = createContext<StaffSession | null>(null);

export function StaffSessionProvider({ role, children }: { role: StaffRole; children: ReactNode }) {
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [locations, setLocations] = useState<StaffLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [navBadges, setNavBadges] = useState<NavBadges>({});
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const isAdmin = role === "admin" || role === "super_admin";
  const active = useRef(true);

  const reloadProfile = useCallback(() => {
    getStaffProfile()
      .then((p) => active.current && setProfile(p))
      .catch(() => undefined);
    setLocationsLoading(true);
    setLocationsError(null);
    getLocations()
      .then((l) => active.current && setLocations(l))
      .catch((err) => active.current && setLocationsError(errorMessage(err, "Could not load the locations.")))
      .finally(() => active.current && setLocationsLoading(false));
  }, []);

  const refreshBadges = useCallback(() => {
    getNavBadges()
      .then((b) => active.current && setNavBadges(b))
      .catch(() => undefined);
    if (isAdmin) {
      listCapacityRequests({ status: "Pending" })
        .then((r) => active.current && setPendingApprovals(r.length))
        .catch(() => undefined);
    }
  }, [isAdmin]);

  useEffect(() => {
    active.current = true;
    reloadProfile();
    refreshBadges();
    const timer = setInterval(() => {
      if (AppState.currentState === "active") refreshBadges();
    }, POLL_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshBadges();
    });
    return () => {
      active.current = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [refreshBadges, reloadProfile]);

  const markBadgesRead = useCallback(
    async (cmsRoutes?: string[]) => {
      await markNavBadgesRead(cmsRoutes);
      refreshBadges();
    },
    [refreshBadges],
  );

  const value = useMemo<StaffSession>(() => {
    // The API counts admins' pending capacity requests under "/admin/attendants" too: shown once, on Approvals.
    const own = isAdmin ? withoutCapacityRequests(navBadges, pendingApprovals) : navBadges;
    const badges = badgesByRoute(role, own);
    const approvals = isAdmin ? pendingApprovals : 0;
    const badgeTotal = Object.values(badges).reduce((sum: number, n) => sum + (n ?? 0), 0) + approvals;
    return {
      role,
      profile,
      locations,
      locationsLoading,
      locationsError,
      reloadProfile,
      navBadges: own,
      badges,
      pendingApprovals: approvals,
      badgeTotal,
      refreshBadges,
      markBadgesRead,
    };
  }, [role, isAdmin, profile, locations, locationsLoading, locationsError, reloadProfile, navBadges, pendingApprovals, refreshBadges, markBadgesRead]);

  return <StaffSessionContext.Provider value={value}>{children}</StaffSessionContext.Provider>;
}

export function useStaffSession(): StaffSession {
  const ctx = useContext(StaffSessionContext);
  if (!ctx) throw new Error("useStaffSession must be used inside a staff navigator");
  return ctx;
}

/** The staff role of the navigator that is showing. */
export function useStaffRole(): StaffRole {
  return useStaffSession().role;
}

export const isAdminRole = (role: StaffRole) => role === "admin" || role === "super_admin";
