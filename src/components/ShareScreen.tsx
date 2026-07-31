import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, ClipboardCopy, Download, Instagram, Map as MapIcon, MessageCircle, Share2, SlidersHorizontal, X } from 'lucide-react';
import { Camera as CameraPlugin, CameraResultType, CameraSource } from '@capacitor/camera';
import ShareCard, { extractCardData, gridCells, STAT_CHIP_LABELS } from './ShareCard';
import type { CardVariant } from './ShareCard';
import { captureCard, shareImage, copyCardToClipboard, saveCardToGallery, shareToWhatsApp } from '../lib/shareCard';
import { GRADIENT_PRESETS } from '../lib/gradients';
import type { GradientPreset } from '../lib/gradients';
import Button from './Button';
import type { TrainingSession } from '../types';

const VARIANTS: CardVariant[] = ['pace', 'left', 'bottom', 'map'];
const PREVIEW_W = 324;
const CARD_SCALE = PREVIEW_W / 1080;

interface Props {
  session: TrainingSession;
  onClose: () => void;
  showFeedback?: (type: 'success' | 'error', message: string) => void;
}

const DEFAULT_STATS: Record<string, boolean> = {
  distance: true,
  duration: true,
  pace: true,
  speed: true,
  date: true,
  mode: true,
  name: true,
  logo: true,
};

type BusyState = 'idle' | 'sharing' | 'saving' | 'copying';

export default function ShareScreen({ session, onClose, showFeedback }: Props) {
  const [tab, setTab] = useState<'cards' | 'stickers'>('cards');
  const [cardIndex, setCardIndex] = useState(0);
  const [showStats, setShowStats] = useState(DEFAULT_STATS);
  const [gradient, setGradient] = useState<GradientPreset>(GRADIENT_PRESETS[0]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [stickerMap, setStickerMap] = useState(false);
  const [busy, setBusy] = useState<BusyState>('idle');
  const carouselRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  const variant = VARIANTS[cardIndex];
  const data = useMemo(() => extractCardData(session), [session]);
  const activeCells = useMemo(() => gridCells(showStats), [showStats]);
  const canSave = activeCells.length >= 2;
  const captureKey = useMemo(
    () => `${variant}-${gradient.id}-${photoUrl ?? 'none'}-${JSON.stringify(showStats)}-${tab}`,
    [variant, gradient.id, photoUrl, showStats, tab]
  );

  useEffect(() => {
    carouselRef.current?.scrollTo({ left: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const scrollToIndex = (i: number) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollTo({ left: i * PREVIEW_W, behavior: 'smooth' });
  };

  const onCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / PREVIEW_W);
    const clamped = Math.max(0, Math.min(VARIANTS.length - 1, idx));
    if (clamped !== cardIndex) setCardIndex(clamped);
  };

  const toggleStat = (key: string) => {
    setShowStats(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const pickPhoto = async () => {
    try {
      const photo = await CameraPlugin.getPhoto({
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
        quality: 90,
        width: 1080,
      });
      setPhotoUrl(photo.dataUrl ?? null);
      showFeedback?.('success', 'Foto aplicada ao fundo');
    } catch (err) {
      console.error('[pick-photo]', err);
      showFeedback?.('error', 'Não foi possível carregar a foto');
    }
  };

  const runAction = async (fn: (blob: Blob) => Promise<void>, state: Exclude<BusyState, 'idle'>) => {
    const el = captureRef.current;
    if (!el) return;
    setBusy(state);
    try {
      await new Promise(r => setTimeout(r, 400));
      const blob = await captureCard(el);
      await fn(blob);
    } catch (err) {
      console.error('[share-action]', err);
      showFeedback?.('error', 'Erro ao processar imagem');
    } finally {
      setBusy('idle');
    }
  };

  const onStory = () => runAction(async blob => {
    await shareImage(blob, 'corre-logo-story.png', 'instagram-stories', 'background');
    onClose();
  }, 'sharing');

  const onWhatsApp = () => runAction(async blob => {
    const ok = await shareToWhatsApp(blob);
    if (ok === 'fallback') await shareImage(blob, 'corre-logo-card.png', 'native');
    onClose();
  }, 'sharing');

  const onMore = () => runAction(async blob => {
    await shareImage(blob, 'corre-logo-card.png', 'native');
    onClose();
  }, 'sharing');

  const onSave = () => runAction(async blob => {
    await saveCardToGallery(blob, 'corre-logo-card.png');
    showFeedback?.('success', 'Salvo na galeria');
  }, 'saving');

  const onStickerSave = () => runAction(async blob => {
    await saveCardToGallery(blob, 'corre-logo-sticker.png');
    showFeedback?.('success', 'Sticker salvo na galeria');
  }, 'saving');

  const onCopy = () => runAction(async blob => {
    await copyCardToClipboard(blob);
    showFeedback?.('success', 'Imagem copiada! Abra o Instagram e cole no story');
  }, 'copying');

  const stickerVariant: CardVariant = stickerMap ? 'map' : 'pace';

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg-deep overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onClose} className="text-text-muted p-1" aria-label="Fechar">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-bold">Compartilhar atividade</h2>
        <div className="w-7" />
      </div>

      <div className="flex gap-2 mb-4">
        {(['cards', 'stickers'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${tab === t ? 'bg-accent text-white border-accent' : 'bg-bg-elevated text-text-secondary border-border'}`}
          >
            {t === 'cards' ? 'Cartões' : 'Adesivos'}
          </button>
        ))}
      </div>

      {/* Elemento de captura oculto (fora da tela) */}
      <div key={captureKey} ref={captureRef} style={{ position: 'fixed', left: -9999, top: 0, zIndex: -1 }}>
        <ShareCard
          data={data}
          variant={tab === 'stickers' ? stickerVariant : variant}
          showStats={showStats}
          session={session}
          gradient={gradient}
          photoUrl={tab === 'stickers' ? undefined : photoUrl}
          transparent={tab === 'stickers'}
        />
      </div>

      {tab === 'cards' ? (
        <>
          {/* Carrossel */}
          <div
            ref={carouselRef}
            onScroll={onCarouselScroll}
            className="overflow-x-auto snap-x snap-mandatory no-scrollbar mb-2"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            <div style={{ display: 'flex', width: PREVIEW_W * VARIANTS.length }}>
              {VARIANTS.map((v, i) => (
                <div key={v} className="snap-center" style={{ width: PREVIEW_W, flexShrink: 0, padding: '0 4px' }}>
                  {i === cardIndex && (
                    <div style={{ aspectRatio: '9/16', overflow: 'hidden', borderRadius: 12 }}>
                      <div style={{ width: 1080, height: 1920, transform: `scale(${CARD_SCALE})`, transformOrigin: 'top left' }}>
                        <ShareCard
                          data={data}
                          variant={v}
                          showStats={showStats}
                          session={session}
                          gradient={gradient}
                          photoUrl={photoUrl}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Navegação do carrossel */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <button onClick={() => scrollToIndex(cardIndex - 1)} disabled={cardIndex === 0} className="text-text-muted disabled:opacity-30 p-1" aria-label="Anterior">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-1.5">
              {VARIANTS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToIndex(i)}
                  aria-label={`Cartão ${i + 1}`}
                  className={`w-2 h-2 rounded-full transition-colors ${i === cardIndex ? 'bg-accent' : 'bg-border'}`}
                />
              ))}
            </div>
            <button onClick={() => scrollToIndex(cardIndex + 1)} disabled={cardIndex === VARIANTS.length - 1} className="text-text-muted disabled:opacity-30 p-1" aria-label="Próximo">
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <Button variant="secondary" size="md" onClick={() => setEditing(e => !e)} className="w-full mb-2 flex items-center justify-center gap-2">
            <SlidersHorizontal className="w-4 h-4" /> {editing ? 'Ocultar edição' : 'Editar cartão'}
          </Button>

          {editing && (
            <div className="mb-3 p-3 rounded-xl bg-bg-surface space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(STAT_CHIP_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-text-primary">
                    <input
                      type="checkbox"
                      checked={showStats[key]}
                      onChange={() => toggleStat(key)}
                      className="accent-accent w-4 h-4"
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div>
                <div className="text-xs font-bold text-text-secondary mb-2">Gradiente</div>
                <div className="flex gap-2 flex-wrap">
                  {GRADIENT_PRESETS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setGradient(p)}
                      aria-label={p.label}
                      title={p.label}
                      className={`w-10 h-16 rounded-lg border-2 transition-colors ${gradient.id === p.id ? 'border-accent' : 'border-border'}`}
                      style={{ background: p.css }}
                    />
                  ))}
                </div>
              </div>

              {variant !== 'map' && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="md" onClick={pickPhoto} className="flex items-center gap-2 flex-1">
                    <Camera className="w-4 h-4" /> Foto de fundo
                  </Button>
                  {photoUrl && (
                    <Button variant="ghost" size="md" onClick={() => setPhotoUrl(null)}>
                      Remover foto
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 mb-2">
            <Button variant="secondary" size="lg" onClick={onStory} disabled={busy !== 'idle'} className="flex items-center justify-center gap-1">
              <Instagram className="w-5 h-5" /> Story
            </Button>
            <Button variant="secondary" size="lg" onClick={onWhatsApp} disabled={busy !== 'idle'} className="flex items-center justify-center gap-1">
              <MessageCircle className="w-5 h-5" /> WhatsApp
            </Button>
            <Button variant="secondary" size="lg" onClick={onMore} disabled={busy !== 'idle'} className="flex items-center justify-center gap-1">
              <Share2 className="w-5 h-5" /> Mais
            </Button>
          </div>

          <Button variant="primary" size="lg" onClick={onSave} disabled={busy !== 'idle' || !canSave} className="w-full flex items-center justify-center gap-2">
            <Download className="w-5 h-5" />
            {busy === 'saving' ? 'Salvando...' : 'Salvar no dispositivo'}
          </Button>
          {!canSave && <p className="text-xs text-text-muted text-center mt-1">Ative ao menos 2 estatísticas para salvar</p>}
        </>
      ) : (
        <>
          {/* Aba Adesivos */}
          <div className="flex-1 flex flex-col items-center justify-center mb-4 min-h-0">
            <div style={{ aspectRatio: '9/16', overflow: 'hidden', borderRadius: 12, maxWidth: '100%' }}>
              <div style={{ width: 1080, height: 1920, transform: `scale(${Math.min(1, 270 / 1080)})`, transformOrigin: 'top left' }}>
                <ShareCard
                  data={data}
                  variant={stickerVariant}
                  showStats={showStats}
                  session={session}
                  gradient={gradient}
                  transparent
                />
              </div>
            </div>
          </div>

          <div className="mb-3 p-3 rounded-xl bg-bg-surface space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(STAT_CHIP_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-text-primary">
                  <input
                    type="checkbox"
                    checked={showStats[key]}
                    onChange={() => toggleStat(key)}
                    className="accent-accent w-4 h-4"
                  />
                  {label}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-text-primary text-sm">
              <input
                type="checkbox"
                checked={stickerMap}
                onChange={e => setStickerMap(e.target.checked)}
                className="accent-accent w-4 h-4"
              />
              <MapIcon className="w-4 h-4" /> Incluir mapa no sticker
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" size="lg" onClick={onStickerSave} disabled={busy !== 'idle' || !canSave} className="flex items-center justify-center gap-2">
              <Download className="w-5 h-5" /> Salvar PNG
            </Button>
            <Button variant="secondary" size="lg" onClick={onCopy} disabled={busy !== 'idle'} className="flex items-center justify-center gap-2">
              <ClipboardCopy className="w-5 h-5" /> Copiar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}