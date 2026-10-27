/**
 * The period selector of the CEO and Sales Manager dashboards: Custom opens the From / To editor (with the current
 * period to today), refuses a range the API would refuse, and applies a valid one; the chosen range then shows under
 * the selector and opens the editor again. Calendar periods keep the range for later. React Native and the UI kit are
 * mocked so this runs in plain Node; the period rules are the real ones.
 */
import React from "react";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

jest.mock("react-native", () => ({ StyleSheet: { create: <T,>(styles: T) => styles }, View: "View" }));
jest.mock("../../../components/ui", () => ({
  AppText: "AppText",
  BottomSheet: "BottomSheet",
  Button: "Button",
  DateField: "DateField",
  PressableField: "PressableField",
  SegmentedControl: "SegmentedControl",
}));
jest.mock("../../../theme", () => ({ spacing: jest.requireActual("../../../theme/tokens").spacing }));
jest.mock("../../../services/ceo", () => ({
  ...jest.requireActual("../../../services/ceo/format"),
  ...jest.requireActual("../../../services/ceo/period"),
}));

import { PeriodControl } from "./PeriodControl";

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
g.IS_REACT_ACT_ENVIRONMENT = true;

const TODAY = new Date(2026, 9, 19, 9, 0, 0);

function render(element: React.ReactElement) {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer!;
}

const one = (root: ReactTestInstance, type: string) => root.findAll((n) => n.type === (type as unknown))[0];
const all = (root: ReactTestInstance, type: string) => root.findAll((n) => n.type === (type as unknown));
/** A button of the sheet's footer (Cancel / Apply). */
const button = (root: ReactTestInstance, title: string) => {
  const footer = one(root, "BottomSheet").props.footer as React.ReactElement<{ children: React.ReactNode }>;
  return React.Children.toArray(footer.props.children).find(
    (b): b is React.ReactElement<{ title: string; onPress: () => void }> => React.isValidElement(b) && (b.props as { title?: string }).title === title,
  )!;
};

beforeEach(() => {
  jest.useFakeTimers({ now: TODAY });
});
afterEach(() => {
  jest.useRealTimers();
});

test("Custom opens the editor with this month to today; Cancel leaves the period as it was", () => {
  const onChange = jest.fn();
  const onEditingChange = jest.fn();
  const r = render(<PeriodControl period="month" range={null} onChange={onChange} onEditingChange={onEditingChange} />);
  const seg = one(r.root, "SegmentedControl");
  expect(seg.props.options.map((o: { label: string }) => o.label)).toEqual(["This month", "Quarter", "Year", "Custom"]);
  expect(one(r.root, "BottomSheet").props.visible).toBe(false);
  expect(all(r.root, "PressableField")).toHaveLength(0);

  act(() => seg.props.onChange("custom"));
  const sheet = one(r.root, "BottomSheet");
  expect(sheet.props).toMatchObject({ visible: true, title: "Custom date range", error: null });
  const [from, to] = all(r.root, "DateField");
  expect(from.props).toMatchObject({ label: "From", required: true, value: "2026-10-01" });
  expect(to.props).toMatchObject({ label: "To", required: true, value: "2026-10-19" });
  expect(from.props.minimumDate.getFullYear()).toBe(2000);
  expect(onEditingChange).toHaveBeenLastCalledWith(true);

  act(() => button(r.root, "Cancel").props.onPress());
  expect(one(r.root, "BottomSheet").props.visible).toBe(false);
  expect(onChange).not.toHaveBeenCalled();
  expect(onEditingChange).toHaveBeenLastCalledWith(false);
});

test("refuses a range the API would refuse and applies a valid one", () => {
  const onChange = jest.fn();
  const r = render(<PeriodControl period="quarter" range={null} onChange={onChange} />);
  act(() => one(r.root, "SegmentedControl").props.onChange("custom"));
  const pick = (index: number, date: Date) => act(() => all(r.root, "DateField")[index].props.onChange(date));

  // The start after the end.
  pick(0, new Date(2026, 9, 18));
  pick(1, new Date(2026, 9, 10));
  act(() => button(r.root, "Apply").props.onPress());
  expect(one(r.root, "BottomSheet").props).toMatchObject({ visible: true, error: "The start date must be on or before the end date." });
  expect(onChange).not.toHaveBeenCalled();

  // More than 366 days.
  pick(0, new Date(2025, 9, 1));
  pick(1, new Date(2026, 9, 15));
  expect(one(r.root, "BottomSheet").props.error).toBeNull();
  act(() => button(r.root, "Apply").props.onPress());
  expect(one(r.root, "BottomSheet").props.error).toBe("Choose at most 366 days.");

  // 1 to 15 October: applied.
  pick(0, new Date(2026, 9, 1));
  pick(1, new Date(2026, 9, 15));
  expect(one(r.root, "AppText").props.children).toBe("15 days, compared with the 15 days before.");
  act(() => button(r.root, "Apply").props.onPress());
  expect(onChange).toHaveBeenCalledWith("custom", { from: "2026-10-01", to: "2026-10-15" });
  expect(one(r.root, "BottomSheet").props.visible).toBe(false);
});

test("the chosen range shows under the selector and opens the editor with it; a calendar period keeps it", () => {
  const onChange = jest.fn();
  const range = { from: "2026-10-01", to: "2026-10-15" };
  const r = render(<PeriodControl period="custom" range={range} onChange={onChange} />);
  const field = one(r.root, "PressableField");
  expect(field.props).toMatchObject({
    value: "1 Oct - 15 Oct 2026",
    subtitle: "15 days, compared with the 15 days before",
    leftIcon: "calendar-outline",
    accessibilityLabel: "Date range",
  });
  act(() => field.props.onPress());
  expect(one(r.root, "BottomSheet").props.visible).toBe(true);
  expect(all(r.root, "DateField").map((d) => d.props.value)).toEqual(["2026-10-01", "2026-10-15"]);
  act(() => button(r.root, "Cancel").props.onPress());

  act(() => one(r.root, "SegmentedControl").props.onChange("year"));
  expect(onChange).toHaveBeenCalledWith("year", range);
});
