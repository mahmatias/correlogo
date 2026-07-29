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
      // On Android, the plugin resolves the Promise in UtteranceProgressListener.onDone(),
      // so await here actually waits for TTS to finish speaking.
      await TextToSpeech.speak({ text, lang, rate: 1.0 });
      // TTS is done — abandon focus so the music player restores volume.
      await AudioFocus.abandonFocus().catch(() => {});
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
