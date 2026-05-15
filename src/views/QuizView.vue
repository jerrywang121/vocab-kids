<script setup>
import { ref, computed } from 'vue'
import { useDecksStore }    from '../stores/useDecksStore'
import { useCardsStore }    from '../stores/useCardsStore'
import { useProgressStore } from '../stores/useProgressStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { buildQuiz }        from '../quiz/generator'

const decksStore    = useDecksStore()
const cardsStore    = useCardsStore()
const progressStore = useProgressStore()
const settings      = useSettingsStore()

// ── State machine: 'select' | 'running' | 'result'
const phase          = ref('select')
const selectedDeckId = ref(null)
const session        = ref(null)
const currentIdx     = ref(0)
const answers        = ref([])        // { questionIdx, chosenIndex, correct }[]
const chosenIndex    = ref(null)
const feedbackClass  = ref('')

const selectedDeck  = computed(() => decksStore.decks.find(d => d.id === selectedDeckId.value))
const currentQ      = computed(() => session.value?.questions[currentIdx.value])
const totalQ        = computed(() => session.value?.questions.length ?? 0)

// For fill-gap: split prompt around ___ so we can animate the revealed word
const gapParts = computed(() => {
  if (currentQ.value?.type !== 'fillgap') return null
  const parts = currentQ.value.prompt.split('___')
  return parts.length === 2 ? parts : null
})

// ── Score breakdown
const scoreByType = computed(() => {
  const map = { definition: [0,0], synonym: [0,0], fillgap: [0,0] }
  for (const a of answers.value) {
    const q = session.value.questions[a.questionIdx]
    if (!map[q.type]) map[q.type] = [0,0]
    map[q.type][1]++
    if (a.correct) map[q.type][0]++
  }
  return map
})

const totalCorrect  = computed(() => answers.value.filter(a => a.correct).length)
const scorePercent  = computed(() => Math.round((totalCorrect.value / totalQ.value) * 100))
const scoreMoji     = computed(() => {
  const p = scorePercent.value
  if (p >= 90) return '🌟'
  if (p >= 70) return '🎉'
  if (p >= 50) return '👍'
  return '💪'
})

// ── Start quiz
async function startQuiz(deckId) {
  selectedDeckId.value = deckId
  const cards = cardsStore.cardsForDeck(deckId)
  if (cardsStore.uniqueCardCount(deckId) < 6) {
    alert('You need at least 6 unique words in a deck to start a quiz.')
    return
  }

  // Try AI generation first, fall back to local generator
  let built = null
  if (false &&settings.aiApiUrl && settings.aiApiKey) {
    try {
      const { generateQuizWithAI } = await import('../api/ai.js')
      const aiQuestions = await generateQuizWithAI(cards, settings.questionsPerQuiz)
      if (aiQuestions?.length) {
        built = { id: crypto.randomUUID(), deckId, generatedAt: new Date().toISOString(), questions: aiQuestions }
      }
    } catch { /* fall through */ }
  }

  if (!built) built = buildQuiz(cards, deckId, settings.questionsPerQuiz, progressStore.cardScoreForOrder)
  if (!built) { alert('Not enough cards to build a quiz.'); return }

  progressStore.cacheQuizSession(built)
  session.value    = built
  currentIdx.value = 0
  answers.value    = []
  chosenIndex.value = null
  feedbackClass.value = ''
  phase.value = 'running'
}

// ── Answer a question
async function answer(idx) {
  if (chosenIndex.value !== null) return  // already answered
  chosenIndex.value = idx
  const correct = idx === currentQ.value.correctIndex

  if (correct) {
    progressStore.recordCorrect(currentQ.value.cardId)
    feedbackClass.value = 'animate-correct'
  } else {
    progressStore.recordWrong(currentQ.value.cardId)
    progressStore.resetLearned(currentQ.value.cardId)
    feedbackClass.value = 'animate-wrong'
  }

  answers.value.push({ questionIdx: currentIdx.value, chosenIndex: idx, correct })

  await new Promise(r => setTimeout(r, 900))
  feedbackClass.value = ''
  chosenIndex.value = null

  if (currentIdx.value < totalQ.value - 1) {
    currentIdx.value++
  } else {
    phase.value = 'result'
  }
}

function reset() {
  phase.value = 'select'
  session.value = null
  selectedDeckId.value = null
}
</script>

<template>
  <main class="page">
    <h1>🧠 Quiz</h1>

    <!-- ── Deck selector ───────────────────────── -->
    <template v-if="phase === 'select'">
      <p class="text-muted mt-1">Choose a deck to quiz yourself on:</p>
      <p v-if="!decksStore.decks.length" class="text-muted mt-2">
        No decks yet — <RouterLink to="/manage">create one first</RouterLink>.
      </p>
      <div class="deck-list mt-2">
        <button
          v-for="deck in decksStore.decks"
          :key="deck.id"
          class="deck-btn card-surface"
          :disabled="cardsStore.uniqueCardCount(deck.id) < 6"
          @click="startQuiz(deck.id)"
        >
          <span class="deck-name">{{ deck.name }}</span>
          <span class="deck-count text-muted">
            {{ cardsStore.cardsForDeck(deck.id).length }} cards
            <span v-if="cardsStore.uniqueCardCount(deck.id) !== cardsStore.cardsForDeck(deck.id).length" class="unique-badge">{{ cardsStore.uniqueCardCount(deck.id) }} unique</span>
            <span v-if="cardsStore.uniqueCardCount(deck.id) < 6">&nbsp;(need 6+ unique)</span>
          </span>
        </button>
      </div>
    </template>

    <!-- ── Running ─────────────────────────────── -->
    <template v-else-if="phase === 'running' && currentQ">
      <div class="session-header mt-1">
        <button class="btn btn-ghost" style="font-size:0.85rem;padding:0.3rem 0.8rem" @click="reset">✕ Quit</button>
        <span class="progress-text text-muted">{{ currentIdx + 1 }} / {{ totalQ }}</span>
      </div>
      <div class="progress-track mt-1">
        <div class="progress-fill" :style="{ width: `${(currentIdx / totalQ) * 100}%` }" />
      </div>

      <div class="question-card card-surface mt-3" :class="feedbackClass">
        <p class="q-label text-muted">{{ currentQ.promptLabel }}</p>
        <!-- Fill-gap: once answered, animate the correct word into the gap -->
        <p v-if="currentQ.type === 'fillgap' && gapParts && chosenIndex !== null" class="q-prompt">
          {{ gapParts[0] }}<span class="gap-reveal" :key="currentIdx">{{ currentQ.gapWord }}</span>{{ gapParts[1] }}
        </p>
        <p v-else class="q-prompt">
          {{ currentQ.prompt }}
          <span v-if="currentQ.partOfSpeech" class="q-pos">({{ currentQ.partOfSpeech }})</span>
        </p>
        <div class="choices mt-2">
          <button
            v-for="(choice, i) in currentQ.choices"
            :key="i"
            class="choice-btn"
            :class="{
              correct:   chosenIndex !== null && i === currentQ.correctIndex,
              wrong:     chosenIndex !== null && i === chosenIndex && i !== currentQ.correctIndex,
              disabled:  chosenIndex !== null,
            }"
            @click="answer(i)"
          >{{ choice }}</button>
        </div>
      </div>
    </template>

    <!-- ── Result ──────────────────────────────── -->
    <template v-else-if="phase === 'result'">
      <div class="result-card card-surface mt-3 text-center">
        <div class="score-emoji">{{ scoreMoji }}</div>
        <h2>{{ totalCorrect }} / {{ totalQ }}</h2>
        <p class="score-pct">{{ scorePercent }}%</p>
        <p class="text-muted" style="font-size:0.9rem">{{ selectedDeck?.name }}</p>
      </div>

      <div class="breakdown card-surface mt-2">
        <h3 style="font-size:1rem;margin-bottom:0.75rem">Breakdown</h3>
        <div v-for="(val, type) in scoreByType" :key="type" class="breakdown-row">
          <span class="breakdown-label">{{ { definition:'📖 Definition', synonym:'🔀 Synonym/Antonym', fillgap:'✏️ Fill the Gap' }[type] }}</span>
          <span class="breakdown-score">{{ val[0] }} / {{ val[1] }}</span>
        </div>
      </div>

      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <button class="btn btn-ghost" @click="reset">Choose Deck</button>
        <button class="btn btn-primary" @click="startQuiz(selectedDeckId)">🔄 Retry</button>
        <RouterLink to="/achievements" class="btn btn-secondary">🏆 Achievements</RouterLink>
      </div>
    </template>
  </main>
</template>

<style>
/* Dark mode overrides for choice feedback — must be global to beat scoped specificity */
body.dark .choice-btn.correct { background: #1b3a1d !important; color: #a5d6a7 !important; border-color: #2e7d32 !important; }
body.dark .choice-btn.wrong   { background: #3a1a1a !important; color: #ef9a9a !important; border-color: #c62828 !important; }
</style>

<style scoped>
.deck-list { display: flex; flex-direction: column; gap: 0.75rem; }
.deck-btn {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; background: var(--color-surface); color: var(--color-text); border: none;
  cursor: pointer; text-align: left; transition: transform 0.15s, box-shadow 0.15s; min-height: 44px;
}
.deck-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.1); }
.deck-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.deck-name { font-weight: 800; font-size: 1rem; }
.deck-count { font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem; }
.unique-badge {
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  background: var(--color-surface-alt);
  color: var(--color-primary);
}
.session-header { display: flex; align-items: center; justify-content: space-between; }
.progress-text { font-size: 0.9rem; font-weight: 700; }
.question-card { display: flex; flex-direction: column; gap: 0.5rem; }
.q-label { font-size: 0.85rem; }
.q-prompt { font-family: 'Fredoka One', cursive; font-size: 1.5rem; color: var(--color-primary); line-height: 1.3; }
.q-pos { font-family: 'Nunito', sans-serif; font-size: 0.95rem; font-weight: 700; color: var(--color-text-muted); opacity: 0.75; }
.choices { display: flex; flex-direction: column; gap: 0.6rem; }
.choice-btn {
  padding: 0.75rem 1rem;
  border-radius: 0.9rem;
  border: 2px solid var(--color-surface-alt);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: 'Nunito', sans-serif;
  font-size: 0.95rem;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
  min-height: 44px;
}
.choice-btn:hover:not(.disabled) { border-color: var(--color-primary); background: var(--color-surface-alt); }
.choice-btn.correct  { border-color: #388e3c; background: #e8f5e9; color: #1b5e20; }
.choice-btn.wrong    { border-color: #d32f2f; background: #ffebee; color: #b71c1c; }
.choice-btn.disabled { cursor: default; }
.result-card { padding: 2rem; }
.score-emoji { font-size: 3.5rem; }
.score-pct { font-family: 'Fredoka One', cursive; font-size: 2rem; color: var(--color-primary); }
.breakdown { display: flex; flex-direction: column; gap: 0.5rem; }
.breakdown-row { display: flex; justify-content: space-between; font-size: 0.9rem; }
.breakdown-label { font-weight: 600; }
.breakdown-score { font-weight: 800; color: var(--color-primary); }

.gap-reveal {
  display: inline-block;
  color: var(--color-accent, var(--color-primary));
  font-weight: 900;
  border-bottom: 3px solid currentColor;
  padding: 0 0.1em;
  animation: gap-flash 1s ease-out forwards;
}
@keyframes gap-flash {
  0%   { opacity: 0; transform: scale(0.6) translateY(4px); }
  25%  { opacity: 1; transform: scale(1.18) translateY(-2px); }
  45%  { transform: scale(1); }
  60%  { opacity: 0.3; }
  75%  { opacity: 1; }
  88%  { opacity: 0.3; }
  100% { opacity: 1; transform: scale(1); }
}
</style>
