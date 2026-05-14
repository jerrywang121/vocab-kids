/** Shuffle an array in-place (Fisher-Yates). Returns the array. */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Pick `n` random items from `arr` excluding items where predicate is true */
function pickDistractors(arr, excludeId, n = 3) {
  const pool = arr.filter(c => c.id !== excludeId)
  return shuffle([...pool]).slice(0, n)
}

/**
 * Definition quiz: given the word, select the correct definition.
 */
export function definitionQuestion(card, allCards) {
  const distractors = pickDistractors(allCards, card.id)
  if (distractors.length < 3) return null

  const choices = shuffle([
    card.definition,
    ...distractors.map(c => c.definition),
  ])
  return {
    type: 'definition',
    cardId: card.id,
    prompt: card.word,
    partOfSpeech: card.partOfSpeech ?? null,
    promptLabel: 'What is the definition of:',
    choices,
    correctIndex: choices.indexOf(card.definition),
  }
}

/**
 * Synonym/Antonym quiz: given the word, select the correct synonym or antonym.
 * Returns null if the card has neither synonyms nor antonyms.
 */
export function synonymQuestion(card, allCards) {
  const useSynonyms = card.synonyms?.length > 0
  const useAntonyms = card.antonyms?.length > 0
  if (!useSynonyms && !useAntonyms) return null

  let correctAnswer, questionLabel
  if (useSynonyms && (!useAntonyms || Math.random() < 0.5)) {
    correctAnswer = card.synonyms[Math.floor(Math.random() * card.synonyms.length)]
    questionLabel = 'Which word means the SAME as:'
  } else {
    correctAnswer = card.antonyms[Math.floor(Math.random() * card.antonyms.length)]
    questionLabel = 'Which word means the OPPOSITE of:'
  }

  // Distractors: words from other cards' synonyms/antonyms, or the words themselves
  const distractorPool = allCards
    .filter(c => c.id !== card.id)
    .flatMap(c => [...(c.synonyms ?? []), ...(c.antonyms ?? []), c.word])
    .filter(w => w !== correctAnswer)

  const distractors = shuffle([...new Set(distractorPool)]).slice(0, 3)
  if (distractors.length < 3) return null

  const choices = shuffle([correctAnswer, ...distractors])
  return {
    type: 'synonym',
    cardId: card.id,
    prompt: card.word,
    partOfSpeech: card.partOfSpeech ?? null,
    promptLabel: questionLabel,
    choices,
    correctIndex: choices.indexOf(correctAnswer),
  }
}

/**
 * Fill-the-gap quiz: given a sentence with ___, select the correct word.
 * Returns null if card has no exampleSentence.
 */
export function fillGapQuestion(card, allCards) {
  if (!card.exampleSentence) return null

  // Replace the word in the sentence (case-insensitive) with ___
  const regex = new RegExp(`\\b${card.word}\\b`, 'i')
  const sentence = card.exampleSentence.replace(regex, '___')
  if (!sentence.includes('___')) return null

  const distractors = pickDistractors(allCards, card.id)
  if (distractors.length < 3) return null

  const fmt = c => c.partOfSpeech ? `${c.word} (${c.partOfSpeech})` : c.word
  const correctAnswer = fmt(card)
  const choices = shuffle([correctAnswer, ...distractors.map(fmt)])
  return {
    type: 'fillgap',
    cardId: card.id,
    prompt: sentence,
    promptLabel: 'Fill in the gap:',
    choices,
    correctIndex: choices.indexOf(correctAnswer),
  }
}
