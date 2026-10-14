// Sales Manager dashboard service layer: typed from the shared contract (api/sales-manager/dashboard, breakdown,
// records/*), tolerant of missing fields, with the 503 "needs the database update SM_01" case turned into a clear
// message. Built on the CEO dashboard's kit (services/ceo): formatting helpers (money, count, monthLabel...) are
// imported from there.
export * from "./types";
export * from "./normalize";
export * from "./errors";
export * from "./drill";
export * from "./records";
export * from "./api";
