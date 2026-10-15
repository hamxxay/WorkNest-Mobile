// Routes of the Access Officer app (role "access_officer", WN_Roles.Id 19): one stack, nothing else. The Access
// Officer never gets the customer (./types.ts), staff (./staffTypes.ts), CEO (./ceoTypes.ts) or Sales Manager
// (./salesManagerTypes.ts) routes: its navigator (./accessOfficer/AccessOfficerNavigator.tsx) registers only these
// two screens.
//
//   AccessOfficerAccess   (root) Door access by CNIC: find a person, add them to their room, enrol face /
//                         fingerprint on the room machine, remove or restore door access
//   AccessOfficerProfile  name, role, locations, appearance, sign out

export type AccessOfficerStackParamList = {
  AccessOfficerAccess: undefined;
  /** `locations`: the names of the officer's locations, when the Access screen has loaded them. */
  AccessOfficerProfile: { locations?: string[] } | undefined;
};

export type AccessOfficerRouteName = keyof AccessOfficerStackParamList;
