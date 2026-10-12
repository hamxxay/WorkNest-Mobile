import { Line, Path } from "react-native-svg";
import { createIllustration, Dot, outline, Sparkle } from "./createIllustration";

const CLOUD = "M54 112 H108 A20 20 0 0 0 110 72 A28 28 0 0 0 56 68 A22 22 0 0 0 54 112 Z";

/** A cloud with a slash. For: load failed, offline (the ErrorState default). */
export const CloudOffIllustration = createIllustration("CloudOffIllustration", (p) => {
  return (
    <>
      <Sparkle x={130} y={38} r={7} fill={p.accent} />
      <Dot x={30} y={50} fill={p.muted} />
      <Dot x={136} y={118} r={4} fill={p.muted} />
      <Path d={CLOUD} fill={p.surface} {...outline(p)} />
      <Line x1={54} y1={50} x2={112} y2={118} stroke={p.surface} strokeWidth={11} strokeLinecap="round" />
      <Line x1={54} y1={50} x2={112} y2={118} stroke={p.alert} strokeWidth={4} strokeLinecap="round" />
    </>
  );
});
