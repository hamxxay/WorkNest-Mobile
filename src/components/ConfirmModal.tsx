import type { ReactNode } from "react";
import { ConfirmDialog } from "./ui/ConfirmDialog";

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Red confirm button + warning icon (delete, cancel booking, log out). */
  destructive?: boolean;
  /** Spinner on the confirm button; blocks closing. */
  loading?: boolean;
  /** Ionicons name above the title. */
  icon?: string;
  children?: ReactNode;
};

/**
 * Legacy confirm dialog API, kept for existing screens. It now renders the themed ConfirmDialog from the UI kit.
 * New code: `import { ConfirmDialog } from "../components/ui"` (confirmLabel / cancelLabel instead of *Text).
 */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
  loading = false,
  icon,
  children,
}: ConfirmModalProps) {
  return (
    <ConfirmDialog
      visible={visible}
      title={title}
      message={message}
      confirmLabel={confirmText}
      cancelLabel={cancelText}
      onConfirm={onConfirm}
      onCancel={onCancel}
      destructive={destructive}
      loading={loading}
      icon={icon}
    >
      {children}
    </ConfirmDialog>
  );
}
