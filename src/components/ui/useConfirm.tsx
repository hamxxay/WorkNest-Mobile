import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Alert } from "react-native";
import { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog";

export type ConfirmOptions = Pick<
  ConfirmDialogProps,
  "title" | "message" | "confirmLabel" | "cancelLabel" | "destructive" | "icon"
> & {
  /**
   * Optional async work to run when the user confirms. The confirm button shows a spinner and the dialog stays
   * open until it finishes; then `confirm()` resolves true. If it throws, the dialog closes and `confirm()`
   * rejects with that error (show it with a toast).
   */
  onConfirm?: () => unknown | Promise<unknown>;
};

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

type Pending = { options: ConfirmOptions; resolve: (ok: boolean) => void; reject: (error: unknown) => void };

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Without <ConfirmProvider>: a native Alert with the same buttons. */
const alertConfirm: ConfirmFn = options =>
  new Promise<boolean>((resolve, reject) => {
    Alert.alert(
      options.title,
      options.message,
      [
        { text: options.cancelLabel ?? "Cancel", style: "cancel", onPress: () => resolve(false) },
        {
          text: options.confirmLabel ?? "Confirm",
          style: options.destructive ? "destructive" : "default",
          onPress: () => {
            Promise.resolve(options.onConfirm?.()).then(() => resolve(true), reject);
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });

/** Mounted once in App.tsx. Renders the single ConfirmDialog that useConfirm() drives. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const pendingRef = useRef<Pending | null>(null);
  // In-flight guard read synchronously: `busy` state only changes on the next render, so a fast double tap could
  // run onConfirm (e.g. "Cancel booking") twice before the spinner showed.
  const busyRef = useRef(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const setInFlight = (value: boolean) => {
    busyRef.current = value;
    setBusy(value);
  };

  const close = () => {
    pendingRef.current = null;
    setVisible(false);
    setInFlight(false);
  };

  const confirm = useCallback<ConfirmFn>(
    next =>
      new Promise<boolean>((resolve, reject) => {
        // A new question replaces an unanswered one (which counts as cancelled).
        pendingRef.current?.resolve(false);
        pendingRef.current = { options: next, resolve, reject };
        setOptions(next);
        busyRef.current = false;
        setBusy(false);
        setVisible(true);
      }),
    [],
  );

  const handleConfirm = async () => {
    const pending = pendingRef.current;
    if (!pending || busyRef.current) return;
    if (!pending.options.onConfirm) {
      close();
      pending.resolve(true);
      return;
    }
    setInFlight(true);
    try {
      await pending.options.onConfirm();
      if (pendingRef.current === pending) close();
      pending.resolve(true);
    } catch (error) {
      if (pendingRef.current === pending) close();
      pending.reject(error);
    }
  };

  const handleCancel = () => {
    const pending = pendingRef.current;
    if (!pending || busyRef.current) return;
    close();
    pending.resolve(false);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        visible={visible}
        title={options?.title ?? ""}
        message={options?.message}
        confirmLabel={options?.confirmLabel}
        cancelLabel={options?.cancelLabel}
        destructive={options?.destructive}
        icon={options?.icon}
        loading={busy}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
}

/**
 * Promise-based confirmation, no local state needed:
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Cancel this booking?", destructive: true, confirmLabel: "Cancel booking" })) { ... }
 *
 * Falls back to a native Alert when <ConfirmProvider> is not mounted.
 */
export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext) ?? alertConfirm;
}
