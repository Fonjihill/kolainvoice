import { useEffect, useRef } from "react";

function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="bg-white border border-stone-200 shadow-lg w-full max-w-md mx-4 animate-in">
        {children}
      </div>
    </div>
  );
}

function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel}>
      <div className="p-6">
        <h3 className="text-base font-semibold text-stone-900 mb-2">
          {title}
        </h3>
        <p className="text-sm text-stone-600">{message}</p>
      </div>
      <div className="flex justify-end gap-3 px-6 pb-6">
        <button
          onClick={onCancel}
          className="border border-stone-300 text-stone-600 text-sm px-4 py-2 hover:bg-stone-50 transition-colors"
        >
          {cancelLabel ?? "Annuler"}
        </button>
        <button
          onClick={onConfirm}
          className={`text-sm font-semibold px-4 py-2 transition-colors ${
            danger
              ? "bg-red-50 border border-red-500 text-red-700 hover:bg-red-100"
              : "bg-amber-500 hover:bg-amber-600 text-stone-900"
          }`}
        >
          {confirmLabel ?? "Confirmer"}
        </button>
      </div>
    </Modal>
  );
}

export { Modal, ConfirmModal };
