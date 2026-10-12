import { Circle, Line, Path, Rect } from "react-native-svg";
import { createIllustration, Dot, outline, Sparkle } from "./createIllustration";

const FRAME = "M56 28 H104 A8 8 0 0 1 112 36 V126 H48 V36 A8 8 0 0 1 56 28 Z";

/** A closed door and a key. For: no access yet, verify access. */
export const DoorIllustration = createIllustration("DoorIllustration", (p) => {
  const o = outline(p);
  const key = outline(p, p.accent);
  return (
    <>
      <Sparkle x={30} y={48} r={7} fill={p.accent} />
      <Dot x={132} y={40} fill={p.muted} />
      <Path d={FRAME} fill={p.surface} {...o} />
      <Rect x={58} y={38} width={44} height={88} rx={3} fill={p.accent} {...o} />
      <Rect x={66} y={48} width={28} height={28} rx={3} fill="none" stroke={p.onAccent} strokeOpacity={0.45} strokeWidth={2} />
      <Rect x={66} y={94} width={28} height={22} rx={3} fill="none" stroke={p.onAccent} strokeOpacity={0.45} strokeWidth={2} />
      <Circle cx={94} cy={85} r={3.5} fill={p.onAccent} />
      <Line x1={28} y1={126} x2={132} y2={126} {...o} />
      <Circle cx={120} cy={98} r={16} fill={p.surface} {...o} />
      <Circle cx={113} cy={98} r={5} fill="none" {...key} />
      <Line x1={118} y1={98} x2={129} y2={98} {...key} />
      <Line x1={125} y1={98} x2={125} y2={103} {...key} />
      <Line x1={129} y1={98} x2={129} y2={102} {...key} />
    </>
  );
});
