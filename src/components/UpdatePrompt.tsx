import { Download, X, ShieldCheck } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import type { UpdateInfo } from '../lib/update-checker';

interface UpdatePromptProps {
  open: boolean;
  update: UpdateInfo | null;
  downloading: boolean;
  installBlocked: boolean;
  onUpdate: () => void;
  onOpenInstallSettings: () => void;
  onDismiss: () => void;
}

export default function UpdatePrompt({
  open,
  update,
  downloading,
  installBlocked,
  onUpdate,
  onOpenInstallSettings,
  onDismiss,
}: UpdatePromptProps) {
  return (
    <Modal open={open} onClose={onDismiss} title="Atualização disponível">
      <div className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-3">
          <Download size={24} className="text-accent" />
        </div>
        <p className="text-text-primary text-sm mb-1">
          Nova versão <strong>{update?.versionName}</strong> disponível
        </p>

        {installBlocked ? (
          <>
            <p className="text-text-muted text-xs mb-4">
              O Android bloqueia a instalação por segurança. Toque em{' '}
              <strong>Permitir</strong> para habilitar a instalação de apps desconhecidos
              para o Corre Logo e volte para baixar.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={onDismiss}>
                <X size={16} />
                Agora não
              </Button>
              <Button variant="primary" className="flex-1" onClick={onOpenInstallSettings}>
                <ShieldCheck size={16} />
                Permitir
              </Button>
            </div>
          </>
        ) : downloading ? (
          <>
            <p className="text-text-muted text-xs mb-4">
              Baixando atualização… aguarde (pode levar alguns minutos)
            </p>
            <div className="mb-4">
              <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full animate-pulse transition-all duration-500"
                  style={{ width: '60%', marginLeft: '20%' }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={onDismiss} disabled={downloading}>
                <X size={16} />
                Cancelar
              </Button>
              <Button variant="primary" className="flex-1" disabled>
                <Download size={16} className="animate-pulse" />
                Baixando…
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-text-muted text-xs mb-4">
              Toque em <strong>Baixar</strong> para instalar a atualização.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={onDismiss}>
                <X size={16} />
                Agora não
              </Button>
              <Button variant="primary" className="flex-1" onClick={onUpdate}>
                <Download size={16} />
                Baixar
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
