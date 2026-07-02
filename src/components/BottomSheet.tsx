import { ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function BottomSheet({ open, onClose, children }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70"
      onClick={onClose}
    >
      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto bg-bg-surface border border-border rounded-t-2xl shadow-xl transition-transform duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
