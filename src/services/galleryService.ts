import { API_ENDPOINTS } from "../config/api";
import { apiRequest } from "./apiClient";
import { resolveMediaUrl } from "../utils/mediaUrl";

export type GalleryImage = {
  id?: string | number;
  src: string;
  alt: string;
  title: string;
  description?: string;
  category?: string;
  locationName?: string;
};

type ApiGalleryImage = {
  id?: string | number;
  title?: string;
  description?: string;
  imageUrl?: string;
  locationName?: string;
};
type GalleryResponse =
  | ApiGalleryImage[]
  | { data?: ApiGalleryImage[]; items?: ApiGalleryImage[]; images?: ApiGalleryImage[] };

function assignCategory(title: string) {
  const value = title.toLowerCase();
  if (value.includes("meeting") || value.includes("board") || value.includes("pod")) {
    return "Meeting Rooms";
  }
  if (value.includes("office") || value.includes("suite") || value.includes("corner")) {
    return "Offices";
  }
  if (
    value.includes("co-working") ||
    value.includes("hot desk") ||
    value.includes("creative") ||
    value.includes("collaboration") ||
    value.includes("team")
  ) {
    return "Co-Working";
  }
  if (
    value.includes("lounge") ||
    value.includes("cafe") ||
    value.includes("terrace") ||
    value.includes("break")
  ) {
    return "Lounges";
  }
  return "Offices";
}

export async function getGalleryImages(): Promise<GalleryImage[]> {
  const payload = await apiRequest<GalleryResponse>(API_ENDPOINTS.gallery.list, {
    requiresAuth: true,
  });

  const images = Array.isArray(payload)
    ? payload
    : payload.data ?? payload.items ?? payload.images ?? [];

  return images.map((image, index) => {
    const title = image.title ?? `Workspace ${index + 1}`;
    const resolvedSrc = resolveMediaUrl(image.imageUrl);
    return {
      id: image.id,
      src:
        resolvedSrc ??
        "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800",
      alt: title,
      title,
      description: image.description,
      category: assignCategory(title),
      locationName: image.locationName,
    };
  });
}
