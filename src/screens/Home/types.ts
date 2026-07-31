export type Workspace = {
  id: number | string;
  name: string;
  type: string;
  location: string;
  capacity?: string;
  price: number;
  amenities: string[];
  image: string;
  available: boolean;
  availableCount?: number;
  totalCount?: number;
};

export type HomeFilter =
  | "Private Office"
  | "Meeting Room"
  | "Shared Desk"
  | "Conference Hall"
  | "Daily"
  | "Monthly";
