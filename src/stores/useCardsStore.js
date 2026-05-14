import { defineStore } from 'pinia'
import { ref } from 'vue'
import { randomUUID } from '../utils/uuid'

export const useCardsStore = defineStore('cards', () => {
  const cards = ref([])

  function cardsForDeck(deckId) {
    return cards.value.filter(c => c.deckId === deckId)
  }

  /** Count of cards with a unique word + partOfSpeech combination in a deck */
  function uniqueCardCount(deckId) {
    const seen = new Set()
    for (const c of cards.value) {
      if (c.deckId !== deckId) continue
      seen.add(`${c.word.trim().toLowerCase()}|${(c.partOfSpeech ?? '').trim().toLowerCase()}`)
    }
    return seen.size
  }

  function isDuplicate(word, definition, deckId) {
    return cards.value.some(
      c => c.deckId === deckId &&
           c.word.trim().toLowerCase() === word.trim().toLowerCase() &&
           c.definition.trim().toLowerCase() === definition.trim().toLowerCase()
    )
  }

  // Returns the new card, or null if it's a duplicate
  function addCard(cardData) {
    if (isDuplicate(cardData.word ?? '', cardData.definition ?? '', cardData.deckId)) return null
    const card = {
      id: randomUUID(),
      word: '',
      partOfSpeech: '',
      forms: {},
      definition: '',
      synonyms: [],
      antonyms: [],
      exampleSentence: '',
      ...cardData,
      createdAt: new Date().toISOString(),
    }
    cards.value.push(card)
    return card
  }

  function updateCard(id, updates) {
    const i = cards.value.findIndex(c => c.id === id)
    if (i !== -1) Object.assign(cards.value[i], updates)
  }

  function deleteCard(id) {
    cards.value = cards.value.filter(c => c.id !== id)
  }

  function deleteCardsForDeck(deckId) {
    cards.value = cards.value.filter(c => c.deckId !== deckId)
  }

  return { cards, cardsForDeck, uniqueCardCount, addCard, updateCard, deleteCard, deleteCardsForDeck, isDuplicate }
}, {
  persist: { key: 'vocab-cards' },
})
