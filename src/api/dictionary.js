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
 * Fetch dictionary data for a word.
 * Returns a partial card object with whichever fields were found.
 * Never throws — resolves with an empty object on any error.
 */
export async function lookupWord(word) {
  const url = `${BASE}/${encodeURIComponent(word.trim())}`
  console.debug(`${TAG} lookupWord →`, url)
  try {
    const res = await fetch(url)
    console.debug(`${TAG} lookupWord ← status`, res.status)
    if (!res.ok) {
      console.warn(`${TAG} lookupWord non-OK response`, res.status)
      return {}
    }
    const data = await res.json()
    if (!Array.isArray(data) || !data.length) {
      console.warn(`${TAG} lookupWord unexpected shape`, data)
      return {}
    }

    const entry = data[0]
    const result = {}

    // Collect meanings by part-of-speech
    const meanings = entry.meanings ?? []
    if (meanings.length) {
      const first = meanings[0]
      result.partOfSpeech = first.partOfSpeech ?? ''

      const def = first.definitions?.[0]
      if (def) {
        result.definition = def.definition ?? ''
        if (def.example) result.exampleSentence = def.example
      }

      // Gather synonyms / antonyms across all meanings
      const synonyms = new Set()
      const antonyms = new Set()
      for (const m of meanings) {
        m.synonyms?.forEach(s => synonyms.add(s))
        m.antonyms?.forEach(a => antonyms.add(a))
        for (const d of m.definitions ?? []) {
          d.synonyms?.forEach(s => synonyms.add(s))
          d.antonyms?.forEach(a => antonyms.add(a))
        }
      }
      if (synonyms.size) result.synonyms = [...synonyms].slice(0, 8)
      if (antonyms.size) result.antonyms = [...antonyms].slice(0, 8)
    }

    console.debug(`${TAG} lookupWord result`, result)
    return result
  } catch (err) {
    console.error(`${TAG} lookupWord error`, err)
    return {}
  }
}
