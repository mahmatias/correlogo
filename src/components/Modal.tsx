import { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  role?: 'dialog' | 'alertdialog';
}

export default function Modal({ open, onClose, title, children, role = 'dialog' }: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      role={role}
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className="p-6 rounded-2xl shadow-xl w-full max-w-sm bg-bg-surface border border-border" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4 text-center text-text-primary">{title}</h2>
        {children}
      </div>
    </div>
  );
}
