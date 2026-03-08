import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({ isOpen, onClose, title, children, maxWidth }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full overflow-y-auto rounded-lg bg-[#F5EACB] p-6 shadow-xl"
        style={{ maxWidth: maxWidth || '32rem' }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#3D2B1F]">{title}</h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-[#3D2B1F] hover:text-[#8B6914]"
            aria-label="Close"
          >
            x
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
