type ConfirmModalProps = {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="panel w-full max-w-md p-6">
        <h2 className="font-display text-2xl text-gold">{title}</h2>
        <p className="mt-3 text-parchment-dim">{body}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button className="ghost-btn" onClick={onCancel} type="button">
            {cancelLabel}
          </button>
          <button className="gold-btn" onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
