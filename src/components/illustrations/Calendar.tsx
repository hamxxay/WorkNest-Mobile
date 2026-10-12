import { Line, Path, Rect } from "react-native-svg";
import { createIllustration, Dot, outline, Sparkle } from "./createIllustration";

const COLS = [47, 65, 83, 101];
const ROWS = [74, 89, 104];

/** A month with no days booked (one day highlighted). For: no bookings. */
export const CalendarIllustration = createIllustration("CalendarIllustration", (p) => {
  const o = outline(p);
  return (
    <>
      <Sparkle x={28} y={48} r={7} fill={p.accent} />
      <Dot x={136} y={34} fill={p.muted} />
      <Dot x={138} y={118} r={4} fill={p.accent} />
      <Rect x={36} y={40} width={88} height={84} rx={12} fill={p.surface} />
      <Path d="M48 40 H112 A12 12 0 0 1 124 52 V64 H36 V52 A12 12 0 0 1 48 40 Z" fill={p.accent} />
      <Rect x={36} y={40} width={88} height={84} rx={12} fill="none" {...o} />
      <Line x1={36} y1={64} x2={124} y2={64} {...o} />
      {ROWS.map((y, r) =>
        COLS.map((x, c) => (
          <Rect key={`${r}-${c}`} x={x} y={y} width={12} height={10} rx={3} fill={r === 1 && c === 2 ? p.accent : p.muted} />
        )),
      )}
      <Line x1={58} y1={32} x2={58} y2={48} {...o} strokeWidth={6} />
      <Line x1={102} y1={32} x2={102} y2={48} {...o} strokeWidth={6} />
    </>
  );
});
