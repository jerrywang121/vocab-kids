<script setup>
import { ref } from 'vue'
import { useSpeech } from '../composables/useSpeech'

const props = defineProps({
  card: { type: Object, required: true },
  mode: { type: String, default: 'flip' }, // 'flip' | 'full'
})
const emit = defineEmits(['flip'])

const { speak } = useSpeech()
const flipped = ref(false)

function flip() {
  flipped.value = !flipped.value
  emit('flip', flipped.value)
}

function reset() {
  flipped.value = false
}

defineExpose({ reset })
</script>

<template>
  <!-- Full-info mode: single flat card -->
  <div v-if="mode === 'full'" class="full-card card-surface">
    <div class="word-row">
      <h2 class="card-word">{{ card.word }}</h2>
      <button class="btn-speaker" :title="`Pronounce '${card.word}'`" @click.stop="speak(card.word)">🔊</button>
    </div>
    <span v-if="card.partOfSpeech" class="pos-badge">{{ card.partOfSpeech }}</span>
    <p class="card-def">{{ card.definition }}</p>
    <p v-if="card.exampleSentence" class="card-example text-muted">
      "{{ card.exampleSentence }}"
    </p>
    <div v-if="card.synonyms?.length || card.antonyms?.length" class="tag-row">
      <span v-if="card.synonyms?.length" class="tag syn">↑ {{ card.synonyms.slice(0,4).join(', ') }}</span>
      <span v-if="card.antonyms?.length" class="tag ant">↓ {{ card.antonyms.slice(0,4).join(', ') }}</span>
    </div>
    <div v-if="card.forms && Object.keys(card.forms).length" class="forms-row">
      <span v-for="(val, key) in card.forms" :key="key" class="form-tag">
        <span class="form-label">{{ key }}:</span> {{ val }}
      </span>
    </div>
  </div>

  <!-- Flip mode: two-sided card -->
  <div v-else class="flip-card" @click="flip">
    <div class="flip-card-inner" :class="{ flipped }">
      <!-- Front: word side -->
      <div class="flip-card-front card-surface front">
        <div class="card-hint text-muted">Tap to reveal ✨</div>
        <div class="word-row">
          <h2 class="card-word">{{ card.word }}</h2>
          <button class="btn-speaker" :title="`Pronounce '${card.word}'`" @click.stop="speak(card.word)">🔊</button>
        </div>
        <span v-if="card.partOfSpeech" class="pos-badge">{{ card.partOfSpeech }}</span>
      </div>

      <!-- Back: definition side -->
      <div class="flip-card-back card-surface back">
        <div class="card-hint text-muted">{{ card.word }}</div>
        <p class="card-def">{{ card.definition }}</p>
        <p v-if="card.exampleSentence" class="card-example text-muted">
          "{{ card.exampleSentence }}"
        </p>
        <div v-if="card.synonyms?.length || card.antonyms?.length" class="tag-row">
          <span v-if="card.synonyms?.length" class="tag syn">↑ {{ card.synonyms.slice(0,4).join(', ') }}</span>
          <span v-if="card.antonyms?.length" class="tag ant">↓ {{ card.antonyms.slice(0,4).join(', ') }}</span>
        </div>
        <div v-if="card.forms && Object.keys(card.forms).length" class="forms-row">
          <span v-for="(val, key) in card.forms" :key="key" class="form-tag">
            <span class="form-label">{{ key }}:</span> {{ val }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.full-card {
  width: 100%;
  padding: 1.5rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
}
.flip-card {
  width: 100%;
  height: 290px;
  cursor: pointer;
  user-select: none;
}
.front, .back {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  text-align: center;
  height: 100%;
  padding: 2rem;
}
.card-hint { font-size: 0.8rem; letter-spacing: 0.04em; }
.word-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.card-word {
  font-family: 'Fredoka One', cursive;
  font-size: 2.2rem;
  color: var(--color-primary);
}
.btn-speaker {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.4rem;
  padding: 0.25rem;
  border-radius: 50%;
  min-width: 44px;
  min-height: 44px;
  transition: background 0.15s, transform 0.1s;
}
.btn-speaker:hover { background: color-mix(in srgb, var(--color-primary) 12%, transparent); transform: scale(1.15); }
.btn-speaker:active { transform: scale(0.9); }
.pos-badge {
  padding: 0.2rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
  background: var(--color-surface-alt);
  color: var(--color-text-muted);
}
.card-def { font-size: 1rem; font-weight: 600; line-height: 1.5; }
.card-example { font-size: 0.85rem; font-style: italic; }
.tag-row { display: flex; gap: 0.4rem; flex-wrap: wrap; justify-content: center; }
.tag { font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 999px; font-weight: 700; }
.syn { background: #e8f5e9; color: #2e7d32; }
.ant { background: #fce4ec; color: #c62828; }
.forms-row { display: flex; gap: 0.35rem; flex-wrap: wrap; justify-content: center; margin-top: 0.15rem; }
.form-tag {
  font-size: 0.72rem;
  padding: 0.12rem 0.5rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  color: var(--color-text);
  font-weight: 600;
}
.form-label { color: var(--color-text-muted); font-weight: 700; }
</style>
