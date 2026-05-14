import { useSettingsStore } from '../stores/useSettingsStore'
import { lookupWord } from '../api/dictionary'

/**
 * Enriches a partial card object by filling missing fields.
 * Pipeline: Dictionary API → AI API (if configured).
 * Always resolves — never throws.
 *
 * @param {string} word
 * @param {object} existing  Already-known fields (won't be overwritten)
 * @returns {Promise<object>} Merged card fields
 */
export async function useEnrich() {
  async function enrich(word, existing = {}) {
    const settings = useSettingsStore()

    let enriched = { ...existing }

    const needsDef     = !enriched.definition
    const needsSyn     = !enriched.synonyms?.length
    const needsExample = !enriched.exampleSentence

    // Step 1 — Dictionary API
    if (settings.dictionaryApiEnabled && (needsDef || needsSyn || needsExample)) {
      const dict = await lookupWord(word)
      if (!enriched.partOfSpeech  && dict.partOfSpeech)  enriched.partOfSpeech  = dict.partOfSpeech
      if (!enriched.definition    && dict.definition)    enriched.definition    = dict.definition
      if (!enriched.exampleSentence && dict.exampleSentence) enriched.exampleSentence = dict.exampleSentence
      if (!enriched.synonyms?.length && dict.synonyms)   enriched.synonyms  = dict.synonyms
      if (!enriched.antonyms?.length && dict.antonyms)   enriched.antonyms  = dict.antonyms
    }

    // Step 2 — AI API (if still missing fields and user has configured a provider)
    const needsForms    = !enriched.forms || !Object.keys(enriched.forms ?? {}).length
    const stillMissing  = !enriched.definition || !enriched.exampleSentence || needsForms
    const hasProvider   = !!settings.aiProvider
    const hasKey        = !!settings.aiApiKey || settings.aiProvider === 'ollama'
    if (stillMissing && hasProvider && hasKey) {
      try {
        const { enrichWithAI } = await import('../api/ai.js')
        const ai = await enrichWithAI(word, enriched)
        if (!enriched.partOfSpeech   && ai.partOfSpeech)   enriched.partOfSpeech   = ai.partOfSpeech
        if (!enriched.definition     && ai.definition)     enriched.definition     = ai.definition
        if (!enriched.exampleSentence && ai.exampleSentence) enriched.exampleSentence = ai.exampleSentence
        if (!enriched.synonyms?.length && ai.synonyms)     enriched.synonyms = ai.synonyms
        if (!enriched.antonyms?.length && ai.antonyms)     enriched.antonyms = ai.antonyms
        if (needsForms && ai.forms && typeof ai.forms === 'object') enriched.forms = ai.forms
      } catch {
        // AI unavailable — continue with what we have
      }
    }

    return enriched
  }

  return { enrich }
}
