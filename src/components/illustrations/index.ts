/**
 * Empty / error state illustrations, drawn with react-native-svg in the theme colours (light and dark).
 *
 *   import { Illustration, illustrations, type IllustrationName } from "../../components/illustrations";
 *   <Illustration name="calendar" size={140} />
 *   <EmptyState illustration="calendar" title="No bookings yet" />
 *
 * Guide: src/components/ui/docs/illustrations.md
 */
export { ILLUSTRATION_NAMES, isIllustrationName, type IllustrationName } from "./names";
export { illustrations } from "./map";
export { Illustration, type NamedIllustrationProps } from "./Illustration";
export {
  createIllustration,
  ILLUSTRATION_SIZE,
  type IllustrationProps,
  type IllustrationComponent,
  type IllustrationDrawing,
} from "./createIllustration";
export { illustrationPalette, type IllustrationPalette } from "./palette";
export { CalendarIllustration } from "./Calendar";
export { ReceiptIllustration } from "./Receipt";
export { DocumentIllustration } from "./Document";
export { PeopleIllustration } from "./People";
export { BellIllustration } from "./Bell";
export { SearchIllustration } from "./Search";
export { InboxIllustration } from "./Inbox";
export { DoorIllustration } from "./Door";
export { ChartIllustration } from "./Chart";
export { CloudOffIllustration } from "./CloudOff";
export { BuildingIllustration } from "./Building";
export { ImageIllustration } from "./Image";
