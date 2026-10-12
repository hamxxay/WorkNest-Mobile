import type { IllustrationProps } from "./createIllustration";
import { illustrations } from "./map";
import type { IllustrationName } from "./names";

export type NamedIllustrationProps = IllustrationProps & { name: IllustrationName };

/**
 * Renders an illustration by name: <Illustration name="calendar" />. Renders nothing for an unknown name
 * (names from data should be checked with isIllustrationName first).
 */
export function Illustration({ name, ...props }: NamedIllustrationProps) {
  const Drawing = illustrations[name];
  return Drawing ? <Drawing {...props} /> : null;
}
