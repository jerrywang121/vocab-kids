import { defineStore } from 'pinia'
import { ref } from 'vue'
import { randomUUID } from '../utils/uuid'

export const useDecksStore = defineStore('decks', () => {
  const decks = ref([])

  function addDeck({ id, name, description = '', colorScheme = 'scheme-blue', createdAt } = {}) {
    decks.value.push({
      id: id ?? randomUUID(),
      name,
      description,
      colorScheme,
      createdAt: createdAt ?? new Date().toISOString(),
    })
  }

  function updateDeck(id, updates) {
    const i = decks.value.findIndex(d => d.id === id)
    if (i !== -1) Object.assign(decks.value[i], updates)
  }

  function deleteDeck(id) {
    decks.value = decks.value.filter(d => d.id !== id)
  }

  return { decks, addDeck, updateDeck, deleteDeck }
}, {
  persist: { key: 'vocab-decks' },
})
