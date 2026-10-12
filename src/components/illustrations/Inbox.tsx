import { Circle, Path } from "react-native-svg";
import { createIllustration, Dot, outline, Sparkle } from "./createIllustration";

const TRAY = "M40 90 L54 58 H106 L120 90 V118 A8 8 0 0 1 112 126 H48 A8 8 0 0 1 40 118 Z";
const FRONT = "M40 90 H62 L68 102 H92 L98 90 H120 V118 A8 8 0 0 1 112 126 H48 A8 8 0 0 1 40 118 Z";
const BUBBLE =
  "M104 20 H128 A8 8 0 0 1 136 28 V40 A8 8 0 0 1 128 48 H114 L104 56 L106 48 H104 A8 8 0 0 1 96 40 V28 A8 8 0 0 1 104 20 Z";

/** An empty tray and a waiting chat bubble. For: no inquiries, complaints or requests. */
export const InboxIllustration = createIllustration("InboxIllustration", (p) => {
  const o = outline(p);
  return (
    <>
      <Sparkle x={30} y={50} r={7} fill={p.accent} />
      <Dot x={30} y={120} r={4} fill={p.muted} />
      <Path d={TRAY} fill={p.surface} {...o} />
      <Path d={FRONT} fill={p.accent} {...o} />
      <Path d={BUBBLE} fill={p.surface} {...o} />
      {[106, 116, 126].map((x) => (
        <Circle key={x} cx={x} cy={34} r={3} fill={p.muted} />
      ))}
    </>
  );
});
