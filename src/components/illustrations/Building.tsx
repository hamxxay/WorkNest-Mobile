import { Circle, Line, Path, Rect } from "react-native-svg";
import { createIllustration, Dot, outline, Sparkle } from "./createIllustration";

const WINDOW_ROWS = [42, 58, 74, 90];
const PIN = "M114 58 C114 58 102 46 102 39 A12 12 0 0 1 126 39 C126 46 114 58 114 58 Z";

/** An office building with a location pin. For: no spaces or locations. */
export const BuildingIllustration = createIllustration("BuildingIllustration", (p) => {
  const o = outline(p);
  return (
    <>
      <Sparkle x={28} y={50} r={7} fill={p.accent} />
      <Dot x={138} y={84} fill={p.muted} />
      <Rect x={82} y={66} width={36} height={60} rx={6} fill={p.accent} {...o} />
      {[78, 92, 106].map((y) => (
        <Rect key={y} x={98} y={y} width={12} height={8} rx={2} fill={p.surface} />
      ))}
      <Rect x={42} y={30} width={46} height={96} rx={6} fill={p.surface} {...o} />
      {WINDOW_ROWS.flatMap((y) => [
        <Rect key={`a${y}`} x={52} y={y} width={10} height={10} rx={2} fill={p.muted} />,
        <Rect key={`b${y}`} x={68} y={y} width={10} height={10} rx={2} fill={p.muted} />,
      ])}
      <Rect x={58} y={106} width={14} height={20} rx={2} fill={p.accent} {...o} />
      <Line x1={28} y1={126} x2={132} y2={126} {...o} />
      <Path d={PIN} fill={p.accent} {...o} />
      <Circle cx={114} cy={39} r={4.5} fill={p.surface} />
    </>
  );
});
