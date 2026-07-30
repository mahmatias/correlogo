import domtoimage from 'dom-to-image-more';
import { isNative } from './capacitor/platform';

export async function captureCard(element: HTMLElement): Promise<Blob> {
  return domtoimage.toBlob(element, {
    width: 1080,
    height: 1920,
    style: {
      width: '1080px',
      height: '1920px',
      transform: 'scale(1)',
      transformOrigin: '0 0',
    },
    cacheBust: true,
  });
}

export async function shareImage(blob: Blob, filename = 'corre-logo-card.png'): Promise<void> {
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
