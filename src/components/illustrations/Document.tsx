import { Line, Path, Rect } from "react-native-svg";
import { createIllustration, Dot, outline, Sparkle } from "./createIllustration";

const PAGE = "M50 26 H94 L116 48 V126 A6 6 0 0 1 110 132 H50 A6 6 0 0 1 44 126 V32 A6 6 0 0 1 50 26 Z";
const FOLD = "M94 26 V42 A6 6 0 0 0 100 48 H116 Z";
const SIGNATURE = "M56 116 C60 104 66 104 64 112 C62 120 70 118 74 108 C76 104 80 106 80 112 C82 108 86 108 90 110";
const LINES: Array<[number, number]> = [
  [58, 52],
  [70, 52],
  [82, 40],
  [94, 46],
];

/** A page with a folded corner and a signature line. For: no agreements, quotations or documents. */
export const DocumentIllustration = createIllustration("DocumentIllustration", (p) => {
  const o = outline(p);
  return (
    <>
      <Sparkle x={130} y={36} r={7} fill={p.accent} />
      <Dot x={30} y={52} fill={p.muted} />
      <Dot x={134} y={116} r={4} fill={p.accent} />
      <Path d={PAGE} fill={p.surface} {...o} />
      <Path d={FOLD} fill={p.accentSoft} {...o} />
      <Rect x={54} y={40} width={28} height={7} rx={3.5} fill={p.accent} />
      {LINES.map(([y, w]) => (
        <Rect key={y} x={54} y={y} width={w} height={6} rx={3} fill={p.muted} />
      ))}
      <Line x1={54} y1={122} x2={106} y2={122} stroke={p.muted} strokeWidth={2} strokeLinecap="round" />
      <Path d={SIGNATURE} fill="none" {...outline(p, p.accent)} />
    </>
  );
});
