/**
 * Challan <-> Booking details link to each other. Opening the other screen again would stack copies
 * (Booking, Challan, Booking, Challan...), so when the screen for the same booking is already open further down the
 * stack, the app goes back to it instead.
 */

type RouteLike = { name: string; params?: object | undefined };

/**
 * Index of the closest earlier screen called `name` whose `bookingId` param is one of `bookingIds` (number or public
 * id, compared as text), or -1 when there is none below `currentIndex`.
 */
export function findEarlierBookingScreen(
  routes: readonly RouteLike[],
  currentIndex: number,
  name: string,
  bookingIds: ReadonlyArray<number | string | null | undefined>,
): number {
  const wanted = bookingIds.filter((id) => id !== null && id !== undefined && String(id) !== "").map(String);
  if (wanted.length === 0) return -1;
  for (let i = Math.min(currentIndex, routes.length) - 1; i >= 0; i--) {
    const route = routes[i];
    if (route?.name !== name) continue;
    const id = (route.params as { bookingId?: unknown } | undefined)?.bookingId;
    if (id !== undefined && id !== null && wanted.includes(String(id))) return i;
  }
  return -1;
}

type StackNav = {
  getState: () => { index: number; routes: readonly RouteLike[] } | undefined;
  pop: (count?: number) => void;
};

/**
 * Goes back to the screen `name` for this booking when it is open further down the stack and returns true;
 * returns false when it isn't (the caller then opens it).
 */
export function returnToBookingScreen(
  navigation: StackNav,
  name: string,
  bookingIds: ReadonlyArray<number | string | null | undefined>,
): boolean {
  const state = navigation.getState();
  if (!state) return false;
  const index = findEarlierBookingScreen(state.routes, state.index, name, bookingIds);
  if (index < 0) return false;
  navigation.pop(state.index - index);
  return true;
}
