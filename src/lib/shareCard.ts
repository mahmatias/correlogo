import domtoimage from 'dom-to-image-more';
import { isNative } from './capacitor/platform';
import { registerPlugin } from '@capacitor/core';

export interface ShareTarget {
  id: 'native' | 'instagram-stories';
  label: string;
  icon: string;
}

export const SHARE_TARGETS: ShareTarget[] = [
  { id: 'native', label: 'Compartilhar', icon: 'share' },
  { id: 'instagram-stories', label: 'Instagram Stories', icon: 'instagram' },
];

export interface SocialSharePluginInterface {
  shareToInstagram(options: {
    backgroundPath?: string;
    stickerPath?: string;
    sourceApplication?: string;
  }): Promise<void>;
  copyImageToClipboard(options: { imagePath: string }): Promise<void>;
  saveToGallery(options: { data: string; filename?: string; mimeType?: string }): Promise<{ uri: string }>;
  shareToWhatsApp(options: { imagePath: string }): Promise<void>;
}

const SocialShare = registerPlugin<SocialSharePluginInterface>('SocialShare');

const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID || '';

export async function captureCard(element: HTMLElement): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // continue even if font check fails
    }
  }
  const scale = 2;
  return domtoimage.toBlob(element, {
    width: 1080 * scale,
    height: 1920 * scale,
    style: {
      width: '1080px',
      height: '1920px',
      transform: `scale(${scale})`,
      transformOrigin: '0 0',
    },
    cacheBust: true,
    quality: 1.0,
  });
}

async function saveBlobToCache(blob: Blob, filename: string): Promise<{ uri: string }> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const reader = new FileReader();
  const base64 = await new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  });
}

async function webShare(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  try {
    if (navigator.share) {
      const file = new File([blob], filename, { type: 'image/png' });
      await navigator.share({
        files: [file],
        title: 'Corre Logo',
      });
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function nativeShare(blob: Blob, filename: string): Promise<void> {
  const { Share } = await import('@capacitor/share');
  const saved = await saveBlobToCache(blob, filename);
  await Share.share({
    files: [saved.uri],
    title: 'Corre Logo',
    dialogTitle: 'Compartilhar atividade',
  });
}

export async function shareImage(
  blob: Blob,
  filename = 'corre-logo-card.png',
  target: 'native' | 'instagram-stories' = 'native',
  instagramMode: 'background' | 'sticker' = 'background'
): Promise<void> {
  if (target === 'instagram-stories') {
    const result = await shareToInstagramStories(blob, instagramMode);
    if (result === 'fallback') {
      if (isNative()) {
        await nativeShare(blob, filename);
      } else {
        await webShare(blob, filename);
      }
    }
    return;
  }
  if (isNative()) {
    await nativeShare(blob, filename);
  } else {
    await webShare(blob, filename);
  }
}

export async function shareToInstagramStories(blob: Blob, mode: 'background' | 'sticker' = 'background'): Promise<'ok' | 'fallback'> {
  if (!isNative()) return 'fallback';
  if (!FACEBOOK_APP_ID) return 'fallback';

  try {
    const filename = mode === 'sticker' ? 'instagram-sticker.png' : 'instagram-story.png';
    const saved = await saveBlobToCache(blob, filename);
    await SocialShare.shareToInstagram({
      backgroundPath: mode === 'sticker' ? undefined : saved.uri,
      stickerPath: mode === 'sticker' ? saved.uri : undefined,
      sourceApplication: FACEBOOK_APP_ID,
    });
    return 'ok';
  } catch (e) {
    console.error('[instagram-stories]', e);
    return 'fallback';
  }
}

export async function copyCardToClipboard(blob: Blob): Promise<void> {
  if (!isNative()) {
    throw new Error('Copiar imagem só está disponível no app');
  }
  const saved = await saveBlobToCache(blob, 'corre-logo-card.png');
  await SocialShare.copyImageToClipboard({ imagePath: saved.uri });
}
