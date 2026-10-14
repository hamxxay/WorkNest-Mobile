import { useCallback, useEffect, useState } from "react";
import { getEmployeeSummary, type EmployeeSummary } from "../../../../services/employeeService";

/**
 * What the "Employees" entry of a booking shows:
 *   ready    the count is known ("Employees 2/4")
 *   unknown  the count could not be loaded (offline...): the entry shows "Employees" and the screen retries
 *   hidden   the API answered 404 (not the customer's own booking, or no employees endpoint): no entry
 * A booking missing from the map is still loading: no entry yet, so a hidden one never flashes up.
 */
export type EmployeeEntry =
  | { status: "ready"; summary: EmployeeSummary }
  | { status: "unknown" }
  | { status: "hidden" };

/**
 * Loads the employee count of each booking (in parallel). Results replace the previous ones only once all have
 * arrived, so a reload never blanks the entries; `reload` fetches again (e.g. when the screen comes back into view).
 */
export function useEmployeeSummaries(bookingIds: readonly number[]): {
  entries: Record<number, EmployeeEntry>;
  reload: () => void;
} {
  const [entries, setEntries] = useState<Record<number, EmployeeEntry>>({});
  const [version, setVersion] = useState(0);
  const key = bookingIds.filter((id) => id > 0).join(",");

  useEffect(() => {
    const ids = key ? key.split(",").map(Number) : [];
    if (!ids.length) {
      setEntries({});
      return;
    }
    let active = true;
    Promise.all(
      ids.map((id) =>
        getEmployeeSummary(id).then(
          (summary): [number, EmployeeEntry] => [id, summary ? { status: "ready", summary } : { status: "hidden" }],
          (): [number, EmployeeEntry] => [id, { status: "unknown" }],
        ),
      ),
    ).then((results) => {
      if (active) setEntries(Object.fromEntries(results));
    });
    return () => {
      active = false;
    };
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { entries, reload };
}
