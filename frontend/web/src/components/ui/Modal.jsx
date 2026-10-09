import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Accessible dialog shell: focus is moved inside on open, Escape closes,
 * and focus is restored to the trigger on unmount.
 */
export default function Modal({ open, onClose, labelledBy, children, width = 'max-w-3xl' }) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    restoreRef.current = document.activeElement;
    panelRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`relative w-full ${width} overflow-hidden rounded-lg bg-white shadow-2xl
          outline-none ring-1 ring-black/10`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}