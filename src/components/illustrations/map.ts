import { BellIllustration } from "./Bell";
import { BuildingIllustration } from "./Building";
import { CalendarIllustration } from "./Calendar";
import { ChartIllustration } from "./Chart";
import { CloudOffIllustration } from "./CloudOff";
import type { IllustrationComponent } from "./createIllustration";
import { DocumentIllustration } from "./Document";
import { DoorIllustration } from "./Door";
import { ImageIllustration } from "./Image";
import { InboxIllustration } from "./Inbox";
import type { IllustrationName } from "./names";
import { PeopleIllustration } from "./People";
import { ReceiptIllustration } from "./Receipt";
import { SearchIllustration } from "./Search";

/** Name -> component. Every name in ILLUSTRATION_NAMES has exactly one entry (checked by the type and a test). */
export const illustrations: Record<IllustrationName, IllustrationComponent> = {
  calendar: CalendarIllustration,
  receipt: ReceiptIllustration,
  document: DocumentIllustration,
  people: PeopleIllustration,
  bell: BellIllustration,
  search: SearchIllustration,
  inbox: InboxIllustration,
  door: DoorIllustration,
  chart: ChartIllustration,
  "cloud-off": CloudOffIllustration,
  building: BuildingIllustration,
  image: ImageIllustration,
};
