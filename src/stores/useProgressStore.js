import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useProgressStore = defineStore('progress', () => {
  const progress = ref([])              // Progress[]
  const quizSessions = ref([])          // QuizSession[]
  const achievementSnapshots = ref([])  // { date, deckId, learnedPercent }[]

  function getProgress(cardId) {
    return progress.value.find(p => p.cardId === cardId) ?? null
  }

  function ensureProgress(cardId) {
    let p = getProgress(cardId)
    if (!p) {
      p = { cardId, correctCount: 0, wrongCount: 0, lastCorrectAt: null, lastWrongAt: null, isLearned: false }
      progress.value.push(p)
    }
    return p
  }

  const MAX_COUNT = 5

  function recordCorrect(cardId) {
    const p = ensureProgress(cardId)
    p.correctCount++
    if (p.correctCount >= MAX_COUNT){
      p.wrongCount = p.wrongCount > 0 ? p.wrongCount - 1 : 0
      p.correctCount = MAX_COUNT
    }
    p.lastCorrectAt = new Date().toISOString()
  }

  function recordWrong(cardId) {
    const p = ensureProgress(cardId)
    p.wrongCount++
    if (p.wrongCount >= MAX_COUNT){
      p.correctCount = p.correctCount > 0 ? p.correctCount - 1 : 0
      p.wrongCount = MAX_COUNT
    }
    p.lastWrongAt = new Date().toISOString()
  }

  function markLearned(cardId) {
    const p = ensureProgress(cardId)
    p.isLearned = true
  }

  function resetLearned(cardId) {
    const p = getProgress(cardId)
    if (p) p.isLearned = false
  }

  function resetLearnedForDeck(cardIds) {
    for (const id of cardIds) {
      const p = getProgress(id)
      if (p) p.isLearned = false
    }
  }

  function cacheQuizSession(session) {
    quizSessions.value = quizSessions.value.filter(s => s.deckId !== session.deckId)
    quizSessions.value.push(session)
  }

  function getCachedQuizSession(deckId, ttlMs = 24 * 60 * 60 * 1000) {
    const s = quizSessions.value.find(s => s.deckId === deckId)
    if (!s) return null
    if (Date.now() - new Date(s.generatedAt).getTime() > ttlMs) return null
    return s
  }

  function appendTodaySnapshot(deckId, learnedPercent) {
    const today = new Date().toISOString().slice(0, 10)
    const idx = achievementSnapshots.value.findIndex(s => s.date === today && s.deckId === deckId)
    if (idx !== -1) {
      achievementSnapshots.value[idx].learnedPercent = learnedPercent
    } else {
      achievementSnapshots.value.push({ date: today, deckId, learnedPercent })
    }
  }

  const COUNT_DECAY_DAYS = 7
  const SCORE_DECAY_DAYS = 30
  
  function daysSince(lastDate) {
    if (!lastDate) return 90
    const last = new Date(lastDate).getTime()
    return (Date.now() - last) / (1000.0 * 60 * 60 * 24)
  }

  function decayFactor(days, decayDays) {
    if (days >= decayDays) return 0
    return Math.pow(2, - days / decayDays)
  }

  function cardScoreForOrder(cardId) {
    const p = getProgress(cardId)
    if (!p) return 0.5
    const total = p.correctCount + p.wrongCount
    if (total === 0) return 0.5
    const correctDecay = decayFactor(daysSince(p.lastCorrectAt), COUNT_DECAY_DAYS)
    const lastDate = Math.max(p.lastCorrectAt, p.lastWrongAt)
    const scoreDecay   = decayFactor(daysSince(lastDate), SCORE_DECAY_DAYS)
    return p.correctCount * correctDecay / (p.wrongCount + MAX_COUNT * correctDecay) * scoreDecay
  }

  function cardScore(cardId) {
    const p = getProgress(cardId)
    if (!p) return null
    const total = p.correctCount + p.wrongCount
    return total === 0 ? null : p.correctCount / (p.wrongCount + MAX_COUNT)
  }

  function deleteProgressForCards(cardIds) {
    progress.value = progress.value.filter(p => !cardIds.includes(p.cardId))
  }

  return {
    progress, quizSessions, achievementSnapshots,
    getProgress, cardScore, cardScoreForOrder, recordCorrect, recordWrong,
    markLearned, resetLearned, resetLearnedForDeck,
    cacheQuizSession, getCachedQuizSession, appendTodaySnapshot, deleteProgressForCards,
  }
}, {
  persist: { key: 'vocab-progress' },
})
