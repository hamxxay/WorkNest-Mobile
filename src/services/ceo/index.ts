// CEO dashboard service layer: typed from the shared contract (api/ceo/dashboard, breakdown, records/*, rooms), tolerant
// of missing fields, with the 503 "needs the database update" case turned into a clear message.
export * from "./types";
export * from "./format";
export * from "./period";
export * from "./refresh";
export * from "./normalize";
export * from "./errors";
export * from "./drill";
export * from "./records";
export * from "./rooms";
export * from "./api";
