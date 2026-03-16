import type { ImageSourcePropType } from "react-native";

const registry: Record<string, ImageSourcePropType> = {
  "images/happy-team.jpg": require("../../public/images/happy-team.jpg"),

  "images/spaces/board-room.jpg": require("../../public/images/spaces/board-room.jpg"),
  "images/spaces/collaborative.jpg": require("../../public/images/spaces/collaborative.jpg"),
  "images/spaces/creative-cowork.jpg": require("../../public/images/spaces/creative-cowork.jpg"),
  "images/spaces/lounge.jpg": require("../../public/images/spaces/lounge.jpg"),
  "images/spaces/meeting-room.jpg": require("../../public/images/spaces/meeting-room.jpg"),
  "images/spaces/modern-office.jpg": require("../../public/images/spaces/modern-office.jpg"),

  "images/gallery/cafe-break.jpg": require("../../public/images/gallery/cafe-break.jpg"),
  "images/gallery/corner-office.jpg": require("../../public/images/gallery/corner-office.jpg"),
  "images/gallery/meeting-pod.jpg": require("../../public/images/gallery/meeting-pod.jpg"),
  "images/gallery/private-suite.jpg": require("../../public/images/gallery/private-suite.jpg"),
  "images/gallery/rooftop-terrace.jpg": require("../../public/images/gallery/rooftop-terrace.jpg"),
  "images/gallery/team-collab.jpg": require("../../public/images/gallery/team-collab.jpg"),
};

function normalizePath(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "")
    .replace(/^publish\/+api\/+/i, "")
    .replace(/^publish\/+/i, "")
    .replace(/^api\/+/i, "")
    .toLowerCase();
}

export function resolveBundledImage(pathOrUrl?: string | null): ImageSourcePropType | null {
  if (!pathOrUrl) {
    return null;
  }

  let candidate = pathOrUrl.trim();
  if (!candidate) {
    return null;
  }

  try {
    const parsed = new URL(candidate);
    candidate = `${parsed.pathname}${parsed.search}`;
  } catch {
    // Keep value as-is when it is a plain relative path.
  }

  const withoutQuery = candidate.split("?")[0] ?? candidate;
  const key = normalizePath(withoutQuery);
  return registry[key] ?? null;
}
