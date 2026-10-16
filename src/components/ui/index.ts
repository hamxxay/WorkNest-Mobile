/**
 * WorkNest UI kit. Import everything from here:
 *   import { Button, TextField, Card, StatusPill, AsyncList, AppHeader, useToast } from "../../components/ui";
 * Usage guide: ./README.md
 */
export { AppText, type AppTextProps, type TextColor } from "./AppText";
export {
  Button,
  IconButton,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
  type IconButtonProps,
  type IconButtonVariant,
} from "./Button";
export { TextField, type TextFieldProps } from "./TextField";
export { PressableField, type PressableFieldProps } from "./PressableField";
export { Checkbox, type CheckboxProps } from "./Checkbox";
export { Switch, SwitchRow, type SwitchProps, type SwitchRowProps } from "./Switch";
export { SelectField, PickerField, type SelectFieldProps, type PickerFieldProps, type SelectOption } from "./SelectField";
export { DateField, type DateFieldProps, type DateFieldMode } from "./DateField";
export { FieldShell, FieldLabel, FieldMessage, fieldStyles, fieldBoxColors, type FieldBaseProps } from "./Field";
export { Card, type CardProps, type CardVariant } from "./Card";
export { ListRow, type ListRowProps } from "./ListRow";
export { InfoRow, type InfoRowProps } from "./InfoRow";
export { SectionHeader, type SectionHeaderProps } from "./SectionHeader";
export { Divider, type DividerProps } from "./Divider";
export { StatusPill, type StatusPillProps } from "./StatusPill";
export { StatCard, KpiCard, STAT_CARD_MIN_WIDTH, type StatCardProps, type KpiCardProps, type StatTrend } from "./StatCard";
export { SegmentedControl, type SegmentedControlProps, type SegmentOption } from "./SegmentedControl";
export { Chip, FilterChips, type ChipProps, type FilterChipsProps, type FilterOption } from "./Chip";
export { Badge, type BadgeProps } from "./Badge";
export { Avatar, initialsOf, type AvatarProps } from "./Avatar";
export { TabBar, useTabBarSpace, type TabBarProps } from "./TabBar";
export { ResponsiveGrid, type ResponsiveGridProps } from "./ResponsiveGrid";
export {
  LoadingState,
  ListSkeleton,
  KpiSkeleton,
  EmptyState,
  ErrorState,
  type LoadingStateProps,
  type ListSkeletonProps,
  type KpiSkeletonProps,
  type EmptyStateProps,
  type ErrorStateProps,
} from "./States";
export { AsyncList, type AsyncListProps } from "./AsyncList";
export { SuccessCheck, type SuccessCheckProps } from "./SuccessCheck";
export { SuccessOverlay, type SuccessOverlayProps } from "./SuccessOverlay";
export { ToastProvider, ToastModalHost, useToast, type ToastApi, type ToastOptions, type ToastType } from "./Toast";
export { BottomSheet, type BottomSheetProps } from "./BottomSheet";
export { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog";
export { ConfirmProvider, useConfirm, type ConfirmOptions, type ConfirmFn } from "./useConfirm";
export { Banner, type BannerProps, type BannerTone } from "./Banner";
export { GoogleSignInButton, GoogleMark, type GoogleSignInButtonProps } from "./GoogleSignInButton";
export { AppHeader, greeting, type AppHeaderProps, type AppHeaderVariant, type HeaderAction } from "./AppHeader";
export { BrandLogo, BRAND_NAVY, BRAND_W_ASPECT, type BrandLogoProps } from "./BrandLogo";
export { AppearanceSetting, type AppearanceSettingProps } from "./AppearanceSetting";
export { HapticsSetting, type HapticsSettingProps } from "./HapticsSetting";
export { FocusAwareStatusBar, barStyleFor, type FocusAwareStatusBarProps } from "./FocusAwareStatusBar";
export { useScreenChrome, useScreenColumnWidth, type StatusBarChrome } from "./screenChrome";

// Re-exported so screens can get everything UI-related from one import.
export { SkeletonGroup, SkeletonBlock, FadeInView } from "../Skeleton";
export { Screen } from "../Screen";
export { SmartImage } from "../SmartImage";
export { statusTone, statusLabel, normalizeStatus, type Tone } from "../../theme";
