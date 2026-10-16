import { textScale } from "../../utils/responsive";

/**
 * How a slide card is laid out in the carousel viewport (`width` x `height`, the height 0 until measured):
 * - stacked (phones, tablets, an unfolded foldable): photo on top, text below. The photo is 4:3 but at most about
 *   half the card (40% with large text), so the text always has room.
 * - side by side (wide and short, e.g. a phone in landscape): photo on the left, text on the right.
 * In a short window the screen scrolls and the card gets `cardHeight`, enough for its text at this font size;
 * otherwise `cardHeight` is null and the card fills the space between the header and the Next button.
 */
export function slideLayout({
  width,
  height,
  windowHeight,
  fontScale = 1,
  short = false,
}: {
  width: number;
  height: number;
  windowHeight: number;
  fontScale?: number;
  short?: boolean;
}): { side: boolean; imageHeight: number; cardHeight: number | null } {
  const scale = textScale(fontScale);
  if (short) {
    if (width >= 480) return { side: true, imageHeight: 0, cardHeight: Math.round(Math.max(windowHeight - 150, 240 * scale)) };
    const photo = Math.floor(Math.min(width * 0.75, 200));
    return { side: false, imageHeight: photo, cardHeight: Math.round(photo + 220 * scale) };
  }
  if (width >= 480 && height > 0 && width > height * 1.2) return { side: true, imageHeight: 0, cardHeight: null };
  const byHeight = height > 0 ? height * (scale >= 1.3 ? 0.4 : 0.55) : Number.POSITIVE_INFINITY;
  return { side: false, imageHeight: Math.max(0, Math.floor(Math.min(width * 0.75, byHeight))), cardHeight: null };
}
