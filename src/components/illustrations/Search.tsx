import { Circle, Line, Path } from "react-native-svg";
import { createIllustration, Dot, outline, Sparkle } from "./createIllustration";

/** A magnifier with a question mark. For: no results for a search or filter. */
export const SearchIllustration = createIllustration("SearchIllustration", (p) => {
  const o = outline(p);
  return (
    <>
      <Sparkle x={128} y={40} r={7} fill={p.accent} />
      <Dot x={30} y={110} r={4} fill={p.accent} />
      <Dot x={34} y={40} fill={p.muted} />
      <Line x1={92} y1={90} x2={118} y2={116} stroke={p.ink} strokeWidth={14} strokeLinecap="round" />
      <Line x1={92} y1={90} x2={118} y2={116} stroke={p.accent} strokeWidth={8} strokeLinecap="round" />
      <Circle cx={72} cy={70} r={30} fill={p.surface} {...o} />
      <Path d="M52 64 A21 21 0 0 1 64 51" fill="none" {...outline(p, p.muted)} />
      <Path d="M65 63 A7.5 7.5 0 1 1 76 69 C73.5 71 72 72.5 72 77" fill="none" {...outline(p, p.accent)} strokeWidth={4} />
      <Circle cx={72} cy={85} r={2.6} fill={p.accent} />
    </>
  );
});
