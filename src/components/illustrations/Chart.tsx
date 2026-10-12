import { Circle, Line, Path, Rect } from "react-native-svg";
import { createIllustration, Dot, outline, Sparkle } from "./createIllustration";

const BARS: Array<[number, number]> = [
  [50, 14],
  [66, 26],
  [82, 18],
  [98, 32],
];

/** A chart card with ghost bars and a dashed trend line. For: no data yet. */
export const ChartIllustration = createIllustration("ChartIllustration", (p) => {
  const o = outline(p);
  return (
    <>
      <Sparkle x={134} y={34} r={7} fill={p.accent} />
      <Dot x={28} y={56} fill={p.muted} />
      <Dot x={30} y={124} r={4} fill={p.accent} />
      <Rect x={32} y={36} width={96} height={84} rx={12} fill={p.surface} {...o} />
      <Circle cx={47} cy={51} r={3.5} fill={p.accent} />
      <Rect x={55} y={48} width={26} height={6} rx={3} fill={p.muted} />
      {BARS.map(([x, h]) => (
        <Rect key={x} x={x} y={106 - h} width={10} height={h} rx={3} fill={p.muted} />
      ))}
      <Line x1={44} y1={106} x2={116} y2={106} stroke={p.muted} strokeWidth={2} strokeLinecap="round" />
      <Path d="M50 84 L70 70 L86 78 L104 62" fill="none" {...outline(p, p.accent)} strokeDasharray="5 6" />
      <Circle cx={104} cy={62} r={4.5} fill={p.surface} {...outline(p, p.accent)} />
    </>
  );
});
