import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const userName             = ref('Learner')
  const avatar               = ref('avatar-1.svg')
  const colorScheme          = ref('scheme-blue')
  const theme                = ref('auto')   // 'light' | 'dark' | 'auto'
  const questionsPerQuiz     = ref(30)
  const dictionaryApiEnabled = ref(true)
  const aiApiUrl             = ref('')   // custom / override base URL
  const aiApiKey             = ref('')
  const aiProvider           = ref('openai')  // provider ID from providers.js
  const aiModel              = ref('')         // selected model ID
  const aiCallsPerMinute       = ref(10)         // rate limit: max AI calls per minute (0 = unlimited)
  const aiBatchSize            = ref(5)          // words per AI batch during bulk import (1–20)
  const userAgeGroup         = ref('6-8')      // '3-5' | '6-8' | '9-11' | '12+'

  // Card list sort preference
  const cardSortField = ref('createdAt')  // 'name' | 'createdAt' | 'score'
  const cardSortDir   = ref('desc')     // 'asc' | 'desc'

  // TTS (Web Speech API)
  const ttsVoice  = ref('')   // voiceURI of the selected voice ('' = browser default)
  const ttsPitch  = ref(1)    // 0.5 – 2
  const ttsRate   = ref(1)    // 0.5 – 2

  function updateSettings(updates) {
    if (updates.userName             !== undefined) userName.value             = updates.userName
    if (updates.avatar               !== undefined) avatar.value               = updates.avatar
    if (updates.colorScheme          !== undefined) colorScheme.value          = updates.colorScheme
    if (updates.theme                !== undefined) theme.value                = updates.theme
    if (updates.questionsPerQuiz     !== undefined) questionsPerQuiz.value     = updates.questionsPerQuiz
    if (updates.dictionaryApiEnabled !== undefined) dictionaryApiEnabled.value = updates.dictionaryApiEnabled
    if (updates.aiApiUrl             !== undefined) aiApiUrl.value             = updates.aiApiUrl
    if (updates.aiApiKey             !== undefined) aiApiKey.value             = updates.aiApiKey
    if (updates.aiProvider           !== undefined) aiProvider.value           = updates.aiProvider
    if (updates.aiModel              !== undefined) aiModel.value              = updates.aiModel
    if (updates.aiCallsPerMinute       !== undefined) aiCallsPerMinute.value       = Math.max(0, Math.min(600, Number(updates.aiCallsPerMinute) || 0))
    if (updates.aiBatchSize            !== undefined) aiBatchSize.value            = Math.max(1, Math.min(20, Number(updates.aiBatchSize) || 5))
    if (updates.userAgeGroup !== undefined && ['3-5','6-8','9-11','12+'].includes(updates.userAgeGroup))
      userAgeGroup.value = updates.userAgeGroup
    if (updates.ttsVoice  !== undefined) ttsVoice.value  = updates.ttsVoice
    if (updates.ttsPitch  !== undefined) ttsPitch.value  = Number(updates.ttsPitch)
    if (updates.ttsRate   !== undefined) ttsRate.value   = Number(updates.ttsRate)
    if (updates.cardSortField !== undefined && ['name','createdAt','score'].includes(updates.cardSortField))
      cardSortField.value = updates.cardSortField
    if (updates.cardSortDir !== undefined && ['asc','desc'].includes(updates.cardSortDir))
      cardSortDir.value = updates.cardSortDir
  }

  return { userName, avatar, colorScheme, theme, questionsPerQuiz, dictionaryApiEnabled, aiApiUrl, aiApiKey, aiProvider, aiModel, aiCallsPerMinute, aiBatchSize, userAgeGroup, ttsVoice, ttsPitch, ttsRate, cardSortField, cardSortDir, updateSettings }
}, {
  persist: {
    key: 'vocab-settings',
    afterRestore: (ctx) => {
      const valid = ['3-5', '6-8', '9-11', '12+']
      if (!valid.includes(ctx.store.userAgeGroup)) ctx.store.userAgeGroup = '6-8'
    },
  },
})
