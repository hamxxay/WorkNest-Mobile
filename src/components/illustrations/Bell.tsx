import { Circle, Line, Path } from "react-native-svg";
import { createIllustration, Dot, outline, Sparkle } from "./createIllustration";

const BELL = "M80 36 C98 36 108 50 108 68 V88 L118 102 H42 L52 88 V68 C52 50 62 36 80 36 Z";

/** A quiet bell ("z z"). For: no notifications, all caught up. */
export const BellIllustration = createIllustration("BellIllustration", (p) => {
  const o = outline(p);
  return (
    <>
      <Sparkle x={30} y={58} r={7} fill={p.accent} />
      <Dot x={36} y={118} r={4} fill={p.muted} />
      <Circle cx={80} cy={31} r={5} fill={p.accent} {...o} />
      <Path d="M70 102 A10 10 0 0 0 90 102 Z" fill={p.accent} {...o} />
      <Path d={BELL} fill={p.surface} {...o} />
      <Line x1={52} y1={88} x2={108} y2={88} {...o} />
      <Path d="M62 74 C62 62 66 54 74 50" fill="none" {...outline(p, p.muted)} />
      <Path d="M110 30 H120 L110 42 H120" fill="none" {...outline(p, p.accent)} />
      <Path d="M126 14 H133 L126 23 H133" fill="none" {...outline(p, p.accent)} strokeWidth={2.5} />
    </>
  );
});
