import { G, Circle, Path, Rect } from "react-native-svg";
import { createIllustration, Dot, outline, Sparkle } from "./createIllustration";

/** A photo in front of another one. For: no photos yet. */
export const ImageIllustration = createIllustration("ImageIllustration", (p) => {
  const o = outline(p);
  return (
    <>
      <Sparkle x={132} y={36} r={7} fill={p.accent} />
      <Dot x={28} y={118} r={4} fill={p.muted} />
      <G transform="rotate(-8 80 80)">
        <Rect x={40} y={34} width={84} height={68} rx={10} fill={p.surface} {...o} />
      </G>
      <Rect x={34} y={48} width={92} height={74} rx={10} fill={p.surface} {...o} />
      <Rect x={42} y={56} width={76} height={58} rx={4} fill={p.accentSoft} />
      <Path d="M42 114 L64 86 L78 102 L90 90 L118 114 Z" fill={p.accent} />
      <Circle cx={100} cy={72} r={6} fill={p.accent} />
      <Rect x={42} y={56} width={76} height={58} rx={4} fill="none" stroke={p.muted} strokeWidth={2} />
    </>
  );
});
