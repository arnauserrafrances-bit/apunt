import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Diàleg de confirmació. Enter confirma, Esc cancel·la. */
export function ConfirmDialog({ open, title, children, confirmLabel, danger, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => e.target === ref.current && onCancel()}
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-xl border border-line bg-card p-0 text-ink shadow-xl backdrop:bg-ink/30"
    >
      {open && (
        <div className="space-y-4 p-6">
          <h2 className="text-xl font-bold">{title}</h2>
          {children && <div className="text-muted">{children}</div>}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button className="btn btn-secondary" onClick={onCancel}>
              Cancel·la
            </button>
            <button autoFocus className={danger ? "btn btn-danger" : "btn btn-primary"} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
