import domtoimage from 'dom-to-image-more';
import { isNative } from './capacitor/platform';

export interface ShareTarget {
  id: 'native' | 'instagram-stories';
  label: string;
  icon: string;
}

export const SHARE_TARGETS: ShareTarget[] = [
  { id: 'native', label: 'Compartilhar', icon: 'share' },
  { id: 'instagram-stories', label: 'Instagram Stories', icon: 'instagram' },
];

export async function captureCard(element: HTMLElement): Promise<Blob> {
  // Use fixed dimensions since the capture element is positioned off-screen
  const scale = 2; // 2x for high DPI
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

export async function shareImage(blob: Blob, filename = 'corre-logo-card.png', target: 'native' | 'instagram-stories' = 'native'): Promise<void> {
  if (target === 'instagram-stories') {
    await shareToInstagramStories(blob);
    return;
  }

  if (isNative()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');

    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const saved = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    });

    await Share.share({
      files: [saved.uri],
      title: 'Corre Logo',
      dialogTitle: 'Compartilhar atividade',
    });
  } else {
    // Web fallback: download + Web Share API if available
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
}

async function shareToInstagramStories(blob: Blob): Promise<void> {
  if (!isNative()) {
    // Web: try Web Share API level 2 (not widely supported yet)
    if (navigator.share) {
      try {
        const file = new File([blob], 'corre-logo-card.png', { type: 'image/png' });
        await navigator.share({
          files: [file],
          title: 'Corre Logo',
        });
        return;
      } catch {
        // fall through
      }
    }
    // Download fallback
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'corre-logo-card.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  // Native Android: use intent to share to Instagram Stories
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');

  const reader = new FileReader();
  const base64 = await new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const filename = 'instagram-stories.png';
  const saved = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  });

  // Use Capacitor Share with Instagram package name hint
  // Note: On Android, Share.share doesn't directly target Instagram Stories
  // We need a custom plugin or intent. For now, use regular share which will
  // show Instagram in the share sheet if installed.
  await Share.share({
    files: [saved.uri],
    title: 'Corre Logo',
    dialogTitle: 'Compartilhar no Instagram Stories',
    // @ts-ignore - non-standard option for Android intent targeting
    mimeType: 'image/png',
  });
}
