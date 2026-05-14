import { useSettingsStore } from '../stores/useSettingsStore'

export function useSpeech() {
  const settings = useSettingsStore()

  function speak(text) {
    if (!text || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.pitch = settings.ttsPitch
    utt.rate  = settings.ttsRate
    if (settings.ttsVoice) {
      const voice = window.speechSynthesis.getVoices().find(v => v.voiceURI === settings.ttsVoice)
      if (voice) utt.voice = voice
    }
    window.speechSynthesis.speak(utt)
  }

  return { speak }
}
