// Staff service layer (sales executive, admin, super admin). One module per area; every function documents its
// endpoint and the roles the API allows. Shared transport and normalisers: ./http, ./normalize.
export * from "./normalize";
export * from "./http";
export * from "./files";
export { STAFF_ENDPOINTS } from "./endpoints";
export * from "./dashboard";
export * from "./profile";
export * from "./customers";
export * from "./kyc";
export * from "./quotations";
export * from "./bookings";
export * from "./agreements";
export * from "./invoices";
export * from "./attendants";
export * from "./doorMachines";
export * from "./initialInvoice";
export * from "./complaints";
export * from "./branches";
export * from "./inquiries";
export * from "./accessActivity";
export * from "./users";
export * from "./challan";
export {
  floorLabel,
  filterSpaces,
  getAllSpaces,
  getBillingPeriods,
  getFloors,
  getLocations,
  getSpace,
  getSpaceConfig,
  getSpaceTypes,
  isSpaceBooked,
  listSpaces,
  normalizeLocation,
  normalizeSpace,
  privateRoomCapacities,
  spaceInGroup,
  spaceMonthlyPrice,
  spaceTypeGroup,
  SPACE_GROUP_LABELS,
  type BillingPeriod,
  type Floor,
  type SpaceConfig,
  type SpaceGroup,
  type SpaceType,
  type StaffLocation,
  type StaffSpace,
} from "./lookups";
export * from "./listFilters";
