import { Circle, Line, Path } from "react-native-svg";
import { createIllustration, Dot, outline, Sparkle } from "./createIllustration";

/** Two people and an "add" badge. For: no customers, attendants or users. */
export const PeopleIllustration = createIllustration("PeopleIllustration", (p) => {
  const o = outline(p);
  const plus = outline(p, p.accent);
  return (
    <>
      <Sparkle x={30} y={46} r={7} fill={p.accent} />
      <Dot x={30} y={110} r={4} fill={p.muted} />
      <Path d="M34 124 C34 102 44 90 58 90 C72 90 82 102 82 124 Z" fill={p.surface} {...o} />
      <Circle cx={58} cy={64} r={13} fill={p.surface} {...o} />
      <Path d="M64 124 C64 102 78 92 94 92 C110 92 124 102 124 124 Z" fill={p.accent} {...o} />
      <Circle cx={94} cy={66} r={16} fill={p.surface} {...o} />
      <Line x1={28} y1={124} x2={132} y2={124} {...o} />
      <Circle cx={126} cy={44} r={12} fill={p.surface} {...o} />
      <Line x1={126} y1={38.5} x2={126} y2={49.5} {...plus} />
      <Line x1={120.5} y1={44} x2={131.5} y2={44} {...plus} />
    </>
  );
});
