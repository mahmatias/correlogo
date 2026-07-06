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
      await TextToSpeech.stop();
      await AudioFocus.requestFocus();
      // speak() returns immediately - do NOT abandon focus synchronously
      // The TTS engine keeps focus naturally while audio is playing
      await TextToSpeech.speak({ text, lang, rate: 1.0 });
      // Abandon focus after a delay longer than the typical utterance length
      const durationMs = Math.max(2000, text.length * 90);
      setTimeout(() => {
        AudioFocus.abandonFocus().catch(() => {});
      }, durationMs);
    } catch (e) {
      console.warn('[voice] native TTS error:', e);
      AudioFocus.abandonFocus().catch(() => {});
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
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }
}

export function stopSpeaking() {
  if (isNative()) {
    TextToSpeech.stop().catch(() => {});
    AudioFocus.abandonFocus().catch(() => {});
  } else if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
