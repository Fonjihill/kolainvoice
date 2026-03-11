import { useEffect, useRef } from "react";

/**
 * Right-side slide-in panel matching the mockup's modal system.
 * Dark header (.mh), scrollable body (.mb), sticky footer (.mf).
 */
function SlidePanel({
  open,
  onClose,
  title,
  subtitle,
  wide,
  small,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  wide?: boolean;
  small?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
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

  const width = small ? "w-[460px]" : wide ? "w-[860px]" : "w-[680px]";

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/50"
    >
      <div className={`${width} h-screen overflow-y-auto flex flex-col bg-white shadow-[-8px_0_32px_rgba(0,0,0,0.2)]`}>
        {/* Dark header */}
        <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between shrink-0 bg-stone-900">
          <div>
            <div className="font-serif text-lg text-white">{title}</div>
            {subtitle && (
              <div className="text-[11px] text-stone-400 mt-0.5">{subtitle}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer text-stone-400 text-xl px-2 py-1 leading-none hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-stone-200 flex justify-end gap-2 shrink-0 bg-stone-50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default SlidePanel;
