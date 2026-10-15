// Access Officer service layer (role "access_officer", WN_Roles.Id 19): typed client for api/access-officer/*
// (lookup by CNIC, add to room, enrol face / fingerprint, remove / restore door access), tolerant normalisers, the
// 503 "needs the database update AO_01" case turned into a clear message, the ID field's input rules and the match
// card's action rules.
export * from "./types";
export * from "./normalize";
export * from "./errors";
export * from "./format";
export * from "./rules";
export * from "./api";
