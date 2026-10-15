// Sales Manager dashboard service layer: typed from the shared contract (api/sales-manager/dashboard, complaints,
// breakdown, records/*), tolerant of missing fields, with the 503 "needs the database update SM_01 / SM_02 / SM_03"
// case turned into a clear message. Desks, never money. Built on the CEO dashboard's kit (services/ceo): general formatting helpers
// (count, pct, monthLabel...) are imported from there; desk wording is in ./format.
export * from "./types";
export * from "./format";
export * from "./normalize";
export * from "./errors";
export * from "./drill";
export * from "./records";
export * from "./api";
