export type Workspace = {
  id: number | string;
  name: string;
  type: string;
  location: string;
  capacity?: string;
  /** Listed price from the API, per priceUnit (Monthly, Hourly...). */
  price: number;
  priceUnit?: string;
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
