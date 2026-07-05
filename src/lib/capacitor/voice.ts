import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { registerPlugin } from '@capacitor/core';
import { isNative } from './platform';

interface AudioFocusPlugin {
  requestFocus(): Promise<void>;
  abandonFocus(): Promise<void>;
}

const AudioFocus = registerPlugin<AudioFocusPlugin>('AudioFocus');

export async function speak(text: string, lang = 'pt-BR') {
  if (isNative()) {
    try {
      await AudioFocus.requestFocus();
      await TextToSpeech.stop();
      await TextToSpeech.speak({ text, lang, rate: 1.1 });
    } catch (e) {
      console.warn('[voice] native TTS error:', e);
    } finally {
      await AudioFocus.abandonFocus();
    }
  } else {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(
        (v) => v.lang === 'pt-BR' && v.name.toLowerCase().includes('female')
      );
      if (femaleVoice) utterance.voice = femaleVoice;
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  }
}

export function stopSpeaking() {
  if (isNative()) {
    TextToSpeech.stop().catch(() => {});
  } else if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
