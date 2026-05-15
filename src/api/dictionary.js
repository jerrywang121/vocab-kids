const BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en'
const TAG = '[dictionary]'

/**
 * Fetch the raw API response for a word (array of entry objects).
 * Returns { data, error } — data is the entries array, error is a human-readable string or null.
 */
export async function lookupWordRaw(word) {
  const url = `${BASE}/${encodeURIComponent(word.trim())}`
  console.debug(`${TAG} lookupWordRaw →`, url)
  try {
    const res = await fetch(url)
    console.debug(`${TAG} lookupWordRaw ← status`, res.status)
    if (res.status === 404) {
      console.warn(`${TAG} lookupWordRaw — word not found`)
      return { data: null, error: `"${word}" was not found in the dictionary.` }
    }
    if (!res.ok) {
      console.warn(`${TAG} lookupWordRaw non-OK response`, res.status)
      return { data: null, error: `Dictionary API error (HTTP ${res.status}). Please try again.` }
    }
    const data = await res.json()
    console.debug(`${TAG} lookupWordRaw raw response`, data)
    if (!Array.isArray(data) || !data.length) {
      return { data: null, error: `No dictionary entries found for "${word}".` }
    }
    return { data, error: null }
  } catch (err) {
    console.error(`${TAG} lookupWordRaw error`, err)
    return { data: null, error: 'Could not reach the dictionary API. Check your connection.' }
  }
}

/**
 * Parse raw API entries into a flat list of card-shaped objects — one per definition.
 * Synonyms and antonyms are merged from both the meaning-level and definition-level arrays.
 *
 * @param {Array} entries  Raw array returned by the dictionary API
 * @returns {Array<object>} Partial card objects matching the FlashCard schema
 */
export function parseEntriesToCards(entries) {
  const cards = []
  for (const entry of entries) {
    const word = entry.word ?? ''
    for (const meaning of entry.meanings ?? []) {
      const partOfSpeech = meaning.partOfSpeech ?? ''

      // Synonyms / antonyms declared at the meaning level apply to all definitions in it
      const meaningSynonyms = meaning.synonyms ?? []
      const meaningAntonyms = meaning.antonyms ?? []

      for (const def of meaning.definitions ?? []) {
        const synonyms = [...new Set([...meaningSynonyms, ...(def.synonyms ?? [])])].slice(0, 8)
        const antonyms = [...new Set([...meaningAntonyms, ...(def.antonyms ?? [])])].slice(0, 8)

        const card = {
          word,
          partOfSpeech,
          definition: def.definition ?? '',
          synonyms,
          antonyms,
        }
        if (def.example) card.exampleSentence = def.example

        cards.push(card)
      }
    }
  }
  return cards
}

/**
 * Fetch all dictionary definitions for a word as a list of partial card objects.
 * Returns { data: CardDetail[], error } — data is null on failure.
 */
export async function lookupWordCards(word) {
  const { data, error } = await lookupWordRaw(word)
  if (error) return { data: null, error }
  const cards = parseEntriesToCards(data)
  console.debug(`${TAG} lookupWordCards parsed ${cards.length} card(s)`, cards)
  return { data: cards, error: null }
}

