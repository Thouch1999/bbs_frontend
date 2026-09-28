import type { ReactNode } from "react";
import { Modal } from "react-bootstrap";

// Thin wrapper around react-bootstrap's Modal matching the Stitch reference
// shell shared by the cancellation/reschedule/trip-status dialogs: an
// icon-badge header, a scrollable body, and a sticky footer with a
// secondary text button plus one primary action button.
type ConfirmVariant = "cta" | "danger" | "primary";

const CONFIRM_CLASS: Record<ConfirmVariant, string> = {
  cta: "btn bbms-cta",
  danger: "btn btn-danger",
  primary: "btn btn-primary",
};

interface ModalShellProps {
  show: boolean;
  onHide: () => void;
  icon?: string;
  title: ReactNode;
  children: ReactNode;
  size?: "sm" | "lg" | "xl";
  /** Provide a fully custom footer instead of the default secondary/confirm pair. */
  footer?: ReactNode;
  secondaryLabel?: ReactNode;
  onSecondary?: () => void;
  confirmLabel?: ReactNode;
  onConfirm?: () => void;
  confirmVariant?: ConfirmVariant;
  confirmDisabled?: boolean;
}

export function ModalShell({
  show,
  onHide,
  icon,
  title,
  children,
  size,
  footer,
  secondaryLabel,
  onSecondary,
  confirmLabel,
  onConfirm,
  confirmVariant = "cta",
  confirmDisabled,
}: ModalShellProps) {
  return (
    <Modal show={show} onHide={onHide} centered scrollable size={size}>
      <Modal.Header closeButton>
        {icon && (
          <span
            className="bg-bbms-tint text-primary rounded-circle d-inline-flex align-items-center justify-content-center me-2"
            style={{ width: "2.25rem", height: "2.25rem" }}
            aria-hidden="true"
          >
            <i className={icon} />
          </span>
        )}
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{children}</Modal.Body>
      <Modal.Footer>
        {footer ?? (
          <>
            {onSecondary && (
              <button type="button" className="btn btn-link text-primary" onClick={onSecondary}>
                {secondaryLabel}
              </button>
            )}
            {onConfirm && (
              <button
                type="button"
                className={CONFIRM_CLASS[confirmVariant]}
                onClick={onConfirm}
                disabled={confirmDisabled}
              >
                {confirmLabel}
              </button>
            )}
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
}
