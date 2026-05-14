import { randomUUID } from '../utils/uuid'
import { definitionQuestion, synonymQuestion, fillGapQuestion } from './types'

const FACTORIES = [definitionQuestion, synonymQuestion, fillGapQuestion]

/**
 * Build a mixed quiz session from a deck's cards.
 *
 * @param {object[]} cards         All cards in the deck
 * @param {string}   deckId
 * @param {number}   questionCount How many questions (default 30)
 * @param {function} scoreOf       Optional fn(cardId) → [0,1]; lower score = higher priority
 * @returns {object} QuizSession { id, deckId, generatedAt, questions }
 */
export function buildQuiz(cards, deckId, questionCount = 30, scoreOf = null) {
  // Weighted shuffle: lower-scored cards tend to appear first; pure random if no scorer
  const shuffled = [...cards].sort((a, b) => {
    const sa = (scoreOf ? scoreOf(a.id) : 0.5)
    const sb = (scoreOf ? scoreOf(b.id) : 0.5)
    return sa - sb + (Math.random() - 0.5) * 0.1  // add some jitter for variety
  })

  // extract cards with unique word and partOfSpeech to ensure we have enough distinct options for questions
  const uniqueCards = new Map()
  for (const card of shuffled) {
    const key = `${card.word}-${card.partOfSpeech}`
    if (!uniqueCards.has(key)) {
      uniqueCards.set(key, card)
    }
  }
  if (uniqueCards.size < 4) return null   // Need at least 4 unique cards for distractors
  // extract the original cards from the uniqueCards for easy access
  const uniqueCardsArr = Array.from(uniqueCards.values())

  const questions = []
  let attempts = 0
  const maxAttempts = questionCount * 6   // guard against sparse decks

  while (questions.length < questionCount && attempts < maxAttempts) {
    attempts++
    const card    = uniqueCardsArr[attempts % uniqueCardsArr.length]  // cycle through unique cards
    const factory = FACTORIES[Math.floor(Math.random() * FACTORIES.length)]
    const q       = factory(card, uniqueCardsArr)  // pass unique cards for better distractor selection
    if (q) questions.push(q)
  }

  return {
    id: randomUUID(),
    deckId,
    generatedAt: new Date().toISOString(),
    questions: questions.slice(0, questionCount),
  }
}
