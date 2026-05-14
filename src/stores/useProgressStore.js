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
      p = { cardId, correctCount: 0, wrongCount: 0, lastCorrectAt: null, lastWrongAt: null, lastReviewedAt: null }
      progress.value.push(p)
    }
    return p
  }

  const MAX_COUNT = 10

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

  function recordReviewed(cardId) {
    const p = ensureProgress(cardId)
    p.lastReviewedAt = new Date().toISOString()
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
  const VIEW_DECAY_DAYS = 3
  
  function daysSince(lastDate) {
    if (!lastDate) return 90
    const last = new Date(lastDate).getTime()
    return (Date.now() - last) / (1000.0 * 60 * 60 * 24)
  }

  function decayFactor(days, decayDays) {
    if (days >= decayDays) return 0
    return Math.pow(2, - days / decayDays)
  }

  function cardScoreDecayed(cardId) {
    const p = getProgress(cardId)
    if (!p) return 0.5
    const correctDecay = decayFactor(daysSince(p.lastCorrectAt), COUNT_DECAY_DAYS)
    const wrongDecay   = decayFactor(daysSince(p.lastWrongAt), COUNT_DECAY_DAYS)
    const lastDate = Math.max(p.lastReviewedAt, p.lastCorrectAt, p.lastWrongAt)
    const scoreDecay   = decayFactor(daysSince(lastDate), SCORE_DECAY_DAYS)
    const total = p.correctCount * correctDecay + p.wrongCount * wrongDecay
    return total === 0 ? 0.5 : p.correctCount * correctDecay / total * scoreDecay
  }

  function cardScore(cardId) {
    const p = getProgress(cardId)
    if (!p) return 0.5
    const correctDecay = decayFactor(daysSince(p.lastCorrectAt), COUNT_DECAY_DAYS)
    const wrongDecay   = decayFactor(daysSince(p.lastWrongAt), COUNT_DECAY_DAYS)
    const total = p.correctCount * correctDecay + p.wrongCount * wrongDecay
    return total === 0 ? 0.5 : p.correctCount * correctDecay / total
  }

  function deleteProgressForCards(cardIds) {
    progress.value = progress.value.filter(p => !cardIds.includes(p.cardId))
  }

  return {
    progress, quizSessions, achievementSnapshots,
    getProgress, cardScore, cardScoreDecayed, recordCorrect, recordWrong, recordReviewed,
    cacheQuizSession, getCachedQuizSession, appendTodaySnapshot, deleteProgressForCards,
  }
}, {
  persist: { key: 'vocab-progress' },
})
