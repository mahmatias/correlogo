import { Download, X } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import type { UpdateInfo } from '../lib/update-checker';

interface UpdatePromptProps {
  open: boolean;
  update: UpdateInfo | null;
  downloading: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
}

export default function UpdatePrompt({ open, update, downloading, onUpdate, onDismiss }: UpdatePromptProps) {
  return (
    <Modal open={open} onClose={onDismiss} title="Atualização disponível">
      <div className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-3">
          <Download size={24} className="text-accent" />
        </div>
        <p className="text-text-primary text-sm mb-1">
          Nova versão <strong>{update?.versionName}</strong> disponível
        </p>
        <p className="text-text-muted text-xs mb-4">
          Toque em <strong>Baixar</strong> para instalar a atualização.
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onDismiss}>
            <X size={16} />
            Agora não
          </Button>
          <Button variant="primary" className="flex-1" onClick={onUpdate} disabled={downloading}>
            <Download size={16} className={downloading ? 'animate-pulse' : ''} />
            {downloading ? 'Baixando…' : 'Baixar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
