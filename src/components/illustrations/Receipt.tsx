import { Circle, Line, Path, Rect } from "react-native-svg";
import { createIllustration, Dot, outline, Sparkle } from "./createIllustration";

const PAPER =
  "M54 28 H106 A6 6 0 0 1 112 34 V130 L108 124 L104 130 L100 124 L96 130 L92 124 L88 130 L84 124 L80 130 " +
  "L76 124 L72 130 L68 124 L64 130 L60 124 L56 130 L52 124 L48 130 V34 A6 6 0 0 1 54 28 Z";

/** A receipt with a torn edge and a coin. For: no payments, invoices or challans. */
export const ReceiptIllustration = createIllustration("ReceiptIllustration", (p) => {
  const o = outline(p);
  return (
    <>
      <Sparkle x={32} y={50} r={7} fill={p.accent} />
      <Dot x={130} y={36} fill={p.muted} />
      <Dot x={28} y={112} r={4} fill={p.muted} />
      <Path d={PAPER} fill={p.surface} {...o} />
      <Rect x={62} y={40} width={36} height={8} rx={4} fill={p.accent} />
      {[58, 70, 82].flatMap((y) => [
        <Rect key={`l${y}`} x={58} y={y} width={26} height={6} rx={3} fill={p.muted} />,
        <Rect key={`r${y}`} x={90} y={y} width={12} height={6} rx={3} fill={p.muted} />,
      ])}
      <Line x1={58} y1={97} x2={102} y2={97} stroke={p.muted} strokeWidth={2} strokeDasharray="4 5" strokeLinecap="round" />
      <Rect x={58} y={106} width={20} height={7} rx={3.5} fill={p.ink} />
      <Rect x={86} y={106} width={16} height={7} rx={3.5} fill={p.accent} />
      <Circle cx={120} cy={110} r={15} fill={p.accent} {...o} />
      <Circle cx={120} cy={110} r={8} fill="none" stroke={p.onAccent} strokeWidth={2.5} />
    </>
  );
});
