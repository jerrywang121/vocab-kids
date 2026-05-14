import { useSettingsStore } from '../stores/useSettingsStore'
import { getProvider } from './providers.js'

const TAG = '[ai]'

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveBaseUrl(provider, settings) {
  return (provider.baseUrl || settings.aiApiUrl || '').replace(/\/$/, '')
}

function buildAuthHeaders(provider, apiKey) {
  switch (provider.authType) {
    case 'bearer':  return { 'Authorization': `Bearer ${apiKey}` }
    case 'x-api-key': return { 'x-api-key': apiKey }
    case 'api-key': return { 'api-key': apiKey }
    default:        return {}
  }
}

function buildChatBody(provider, model, messages, temperature) {
  switch (provider.format) {
    case 'anthropic':
      return { model, max_tokens: 1024, messages, temperature }

    case 'cohere':
      return { model, messages, temperature }

    case 'minimax':
      return { model, messages, temperature }

    // OpenAI, azure, vertex, and all other OpenAI-compatible providers
    default:
      return { model, messages, temperature }
  }
}

function extractContent(provider, data) {
  switch (provider.format) {
    case 'anthropic':
      return data.content?.[0]?.text ?? ''
    case 'cohere':
      return data.message?.content?.[0]?.text ?? ''
    default:
      return data.choices?.[0]?.message?.content ?? ''
  }
}

function isAiConfigured(settings) {
  if (!settings.aiProvider) return false
  const provider = getProvider(settings.aiProvider)
  if (!provider || provider.disabled) return false
  if (provider.authType !== 'none' && !settings.aiApiKey) return false
  return true
}

// ── Core chat call ─────────────────────────────────────────────────────────────

async function callChat(prompt, settings, temperature = 0.3) {
  const provider = getProvider(settings.aiProvider)
  if (!provider || provider.disabled) {
    console.warn(`${TAG} callChat — provider not found or disabled:`, settings.aiProvider)
    return null
  }
  if (provider.format === 'bedrock') {
    console.warn(`${TAG} callChat — bedrock requires server-side auth, skipping`)
    return null
  }

  const apiKey  = (settings.aiApiKey ?? '').trim()
  const model   = settings.aiModel || provider.defaultModel || ''
  const baseUrl = resolveBaseUrl(provider, settings)

  if (!model || !baseUrl) {
    console.warn(`${TAG} callChat — missing model or baseUrl`, { model, baseUrl })
    return null
  }
  if (provider.authType !== 'none' && !apiKey) {
    console.warn(`${TAG} callChat — API key required but not set`)
    return null
  }

  const chatPath = provider.chatPath.replace('{model}', encodeURIComponent(model))
  const url = baseUrl + chatPath

  const headers = {
    'Content-Type': 'application/json',
    ...buildAuthHeaders(provider, apiKey),
    ...(provider.extraHeaders ?? {}),
  }

  const body = buildChatBody(
    provider,
    model,
    [{ role: 'user', content: prompt }],
    temperature,
  )

  console.warn(`${TAG} callChat — provider: ${provider.id}, model: ${model}, authType: ${provider.authType}, apiKey set: ${!!apiKey}`)
  console.warn(`${TAG} callChat headers (masked)`, {
    'Content-Type': headers['Content-Type'],
    'Authorization': headers['Authorization']
      ? `Bearer ***${apiKey.slice(-4)}`
      : '⚠️ NOT SET',
    'x-api-key': headers['x-api-key'] ? `***${apiKey.slice(-4)}` : undefined,
    'api-key':   headers['api-key']   ? `***${apiKey.slice(-4)}` : undefined,
    ...Object.fromEntries(
      Object.entries(headers).filter(([k]) =>
        !['Content-Type','Authorization','x-api-key','api-key'].includes(k)
      )
    ),
  })
  console.debug(`${TAG} callChat body`, body)

  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    console.debug(`${TAG} callChat ← status`, res.status)
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error(`${TAG} callChat non-OK response`, res.status, errText)
      // Parse a human-readable message from the API error body if possible
      let apiMessage = ''
      try {
        const errJson = JSON.parse(errText)
        apiMessage = errJson?.error?.message ?? errJson?.message ?? ''
      } catch { /* not JSON */ }
      // OpenRouter (and some other providers) return 401 "Missing Authentication header"
      // even when the auth header is present but the model ID is invalid.
      const hint = res.status === 401
        ? ' (Check that your API key in Settings is correct and not expired.)'
        : ''
      throw new Error(apiMessage
        ? `AI API error ${res.status}: ${apiMessage}${hint}`
        : `AI API returned HTTP ${res.status}. Check your API key and model settings.`
      )
    }
    const data = await res.json()
    console.debug(`${TAG} callChat raw response`, data)
    const content = extractContent(provider, data)
    console.debug(`${TAG} callChat extracted content`, content)
    return content
  } catch (err) {
    // Re-throw errors we created above; log unexpected network errors
    if (err.message.startsWith('AI API')) throw err
    console.error(`${TAG} callChat network error`, err)
    throw new Error('Could not reach the AI API. Check your connection and endpoint URL.')
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Enrich a card's missing fields using the configured AI provider.
 * Returns a partial card object. Never throws.
 */
export async function enrichWithAI(word, existing = {}) {
  const settings = useSettingsStore()
  if (!isAiConfigured(settings)) {
    console.warn(`${TAG} enrichWithAI — AI not configured, skipping`)
    return {}
  }

  const missing = []
  if (!existing.definition)       missing.push('definition')
  if (!existing.partOfSpeech)     missing.push('partOfSpeech')
  if (!existing.exampleSentence)  missing.push('exampleSentence (a short kid-friendly sentence)')
  if (!existing.synonyms?.length) missing.push('synonyms (array of up to 5 words)')
  if (!existing.antonyms?.length) missing.push('antonyms (array of up to 5 words)')
  const needsForms = !existing.forms || !Object.keys(existing.forms ?? {}).length
  if (needsForms)                 missing.push('forms (object: include only keys relevant to the part of speech — "Past Tense", "Past Participle", "3rd Person Singular", "Present Participle" for verbs; "Comparative", "Superlative" for adjectives; "Plural" for nouns — omit keys that do not apply)')
  if (!missing.length) {
    console.debug(`${TAG} enrichWithAI — nothing missing for "${word}", skipping`)
    return {}
  }

  const ageLabel = AGE_GROUP_LABELS[settings.userAgeGroup] ?? AGE_GROUP_LABELS['6-8']
  console.debug(`${TAG} enrichWithAI "${word}" — missing fields:`, missing)
  const prompt = `For the English word / term "${word}", provide the following as JSON with keys: ${missing.join(', ')}. The learner is ${ageLabel} — keep definitions and sentences appropriately simple. Respond with only valid JSON.`

  try {
    const content = await callChat(prompt, settings, 0.3)
    if (!content) return {}
    const result = JSON.parse(content.replace(/```json|```/g, '').trim())
    console.debug(`${TAG} enrichWithAI result`, result)
    return result
  } catch (err) {
    // Background enrichment — fail silently so the card can still be saved
    console.error(`${TAG} enrichWithAI failed (silent)`, err)
    return {}
  }
}

/**
 * Convert a list of words / terms into an array of
 * schema-aligned FlashCard objects, one per distinct meaning / part-of-speech.
 * Returns Card[] or null if AI is unavailable.
 */
export async function convertWordsToCards(words) {
  const settings = useSettingsStore()
  if (!isAiConfigured(settings)) {
    console.warn(`${TAG} convertWordsToCards — AI not configured, skipping`)
    return null
  }

  console.debug(`${TAG} convertWordsToCards ["${words.join('", "')}"]`)

  const ageLabel = AGE_GROUP_LABELS[settings.userAgeGroup] ?? AGE_GROUP_LABELS['6-8']

  const schema = `{
  "word": "the word / term itself, as a string",
  "partOfSpeech": "noun | verb | adjective | adverb | idiom | adverbial phrase | etc.",
  "forms": {
    "Plural": "cats",
    "Past Tense": "ran",
    "Past Participle": "run",
    "3rd Person Singular": "runs",
    "Present Participle": "running",
    "Comparative": "faster",
    "Superlative": "fastest"
  },
  "definition": "simple, child-friendly definition",
  "synonyms": ["up to 5 words"],
  "antonyms": ["up to 5 words"],
  "exampleSentence": "A short, simple sentence using the word."
}`

  let prompt
    prompt = `You are building vocabulary flashcards for children aged ${ageLabel}.

The list of English words /terms:  ["${words.join('", "')}"]

Each word / term may have multiple meanings. Create a JSON array of flashcard objects — one card per word / term per distinct part of speech or meaning. 
Each object must match this schema exactly:
${schema}

For "forms": include only the keys that apply to the part of speech.
For verb: include "Past Tense", "Past Participle", "3rd Person Singular", "Present Participle" (use the base word form as "word").
For adjective: include "Comparative", "Superlative" if applicable (use the simple form as "word").
For noun: include "Plural" (use the singular form as "word").
For other parts of speech: omit "forms" or leave it as an empty object.

Skip any word / term that is inappropriate the age group.
Simplify definitions and example sentences appropriately for the age group. 
Skip any word / term you cannot recognize, confidently define, or use in a sentence.

Respond with ONLY a valid JSON array, no extra text.`

  // Let API/network errors propagate to the caller so they can be shown to the user.
  // Only catch JSON parse failures here.
  let content
  try {
    content = await callChat(prompt, settings, 0.3)
  } catch (err) {
    console.error(`${TAG} convertWordsToCards API error`, err)
    throw err  // re-throw so runAILookup can surface it
  }

  if (!content) {
    console.warn(`${TAG} convertWordsToCards — no content returned from AI`)
    throw new Error('AI returned an empty response. Try again or check your model setting.')
  }

  try {
    const parsed = JSON.parse(content.replace(/```json|```/g, '').trim())
    if (!Array.isArray(parsed)) {
      console.warn(`${TAG} convertWordsToCards — AI response is not an array`, parsed)
      throw new Error('AI response was not in the expected format. Try again.')
    }
    // console.warn(`${TAG} convertWordsToCards — try to parse AI response as JSON array`, parsed)
    const cards = parsed.map(c => ({
      partOfSpeech: '',
      forms: {},
      definition: '',
      synonyms: [],
      antonyms: [],
      exampleSentence: '',
      ...c,
      forms: (c.forms && typeof c.forms === 'object') ? c.forms : {},
    }))
    console.debug(`${TAG} convertWordsToCards result (${cards.length} cards)`, cards)
    return cards
  } catch (err) {
    if (err.message.startsWith('AI response')) throw err
    console.error(`${TAG} convertWordsToCards parse error`, err)
    throw new Error('Could not parse AI response as JSON. Try again.')
  }
}

/**
 * Generate quiz questions for a deck using AI.
 * Returns Question[] or null if unavailable.
 */
const AGE_GROUP_LABELS = {
  '3-5':  '3–5 years old (very simple words, short sentences)',
  '6-8':  '6–8 years old (simple vocabulary, friendly language)',
  '9-11': '9–11 years old (moderate vocabulary, clear language)',
  '12+':  '12 years old and above (richer vocabulary, more nuanced)',
}

export async function generateQuizWithAI(cards, questionCount = 30) {
  const settings = useSettingsStore()
  if (!isAiConfigured(settings)) return null

  const ageLabel = AGE_GROUP_LABELS[settings.userAgeGroup] ?? AGE_GROUP_LABELS['6-8']

  const cardSummaries = cards.slice(0, 60).map(c => ({
    word: c.word,
    definition: c.definition,
    synonyms: c.synonyms,
    antonyms: c.antonyms,
    exampleSentence: c.exampleSentence,
  }))

  const prompt = `Generate ${questionCount} multiple-choice quiz questions for these English vocabulary words. The learner is ${ageLabel} — tailor complexity, vocabulary, and sentence length accordingly. Each question must have type ('definition'|'synonym'|'fillgap'), prompt, choices (array of 4 strings), and correctIndex (0-3). Mix types evenly. Return only a JSON array.\n\nWords:\n${JSON.stringify(cardSummaries)}`

  try {
    const content = await callChat(prompt, settings, 0.7)
    if (!content) return null
    return JSON.parse(content.replace(/```json|```/g, '').trim())
  } catch {
    return null
  }
}

/**
 * List available models for the given provider settings.
 * Accepts a plain settings object (not necessarily the store) so the UI can
 * call this before saving.
 *
 * @param {{ aiProvider, aiApiKey, aiApiUrl }} settingsObj
 * @returns {Promise<Array<{id:string, name:string}>>}
 */
export async function listModels(settingsObj) {
  const provider = getProvider(settingsObj.aiProvider)
  if (!provider) return []

  // Providers with no API endpoint — return static list
  if (!provider.modelsPath) {
    return (provider.staticModels ?? []).map(id => ({ id, name: id }))
  }

  const apiKey  = settingsObj.aiApiKey ?? ''
  const baseUrl = (provider.baseUrl || settingsObj.aiApiUrl || '').replace(/\/$/, '')
  if (!baseUrl) return []
  if (provider.authType !== 'none' && !apiKey) return []

  const headers = {
    ...buildAuthHeaders(provider, apiKey),
    ...(provider.extraHeaders ?? {}),
  }

  const url = baseUrl + provider.modelsPath

  try {
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    let items = provider.modelsResponseKey ? (data[provider.modelsResponseKey] ?? []) : data
    if (!Array.isArray(items)) items = []

    if (provider.filterModels) {
      const filtered = items.filter(provider.filterModels)
      if (filtered.length > 0) items = filtered
    }

    const field = provider.modelIdField ?? 'id'
    return items
      .map(m => {
        const id   = String(m[field] ?? m.id ?? m.name ?? '').trim()
        const name = String(m.name ?? m.displayName ?? m.id ?? id).trim()
        return { id, name: name !== id ? `${id}  (${name})` : id }
      })
      .filter(m => m.id)
      .sort((a, b) => a.id.localeCompare(b.id))
  } catch {
    // Fall back to static models if the endpoint fails
    return (provider.staticModels ?? []).map(id => ({ id, name: id }))
  }
}
