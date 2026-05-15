<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { useDecksStore }    from '../stores/useDecksStore'
import { useCardsStore }    from '../stores/useCardsStore'
import { useProgressStore } from '../stores/useProgressStore'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const decksStore    = useDecksStore()
const cardsStore    = useCardsStore()
const progressStore = useProgressStore()

// ── Per-deck stats ────────────────────────────────────
const deckStats = computed(() =>
  decksStore.decks.map(deck => {
    const cards = cardsStore.cardsForDeck(deck.id)
    const scoreSum = cards.reduce((acc, c) => acc + (progressStore.cardScore(c.id) ?? 0), 0)
    const pct = cards.length ? Math.round((scoreSum / cards.length) * 100) : 0
    return { deck, total: cards.length, pct }
  })
)

// ── Overall stats ─────────────────────────────────────
const totalCards    = computed(() => cardsStore.cards.length)
const overallScore  = computed(() => {
  const cards = cardsStore.cards
  if (!cards.length) return 0
  const sum = cards.reduce((acc, c) => acc + (progressStore.cardScore(c.id) ?? 0), 0)
  return Math.round((sum / cards.length) * 100)
})
const totalQuizzes  = computed(() => progressStore.quizSessions.length)

// ── Chart: last 30 days across all decks ─────────────
const chartData = computed(() => {
  const snapshots = progressStore.achievementSnapshots
  if (!snapshots.length) return null

  // Get sorted unique dates (last 30)
  const allDates = [...new Set(snapshots.map(s => s.date))].sort().slice(-30)

  // One dataset per deck (only decks that have snapshot data)
  const datasets = decksStore.decks
    .filter(d => snapshots.some(s => s.deckId === d.id))
    .map((deck, i) => {
      const COLORS = ['#1976d2','#e91e8c','#388e3c','#7b1fa2','#e65100']
      const color  = COLORS[i % COLORS.length]
      const data   = allDates.map(date => {
        const snap = snapshots.find(s => s.deckId === deck.id && s.date === date)
        return snap?.learnedPercent ?? null
      })
      return {
        label: deck.name,
        data,
        borderColor: color,
        backgroundColor: color + '22',
        tension: 0.3,
        fill: false,
        spanGaps: true,
      }
    })

  return { labels: allDates, datasets }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' },
    title:  { display: false },
  },
  scales: {
    y: { min: 0, max: 100, ticks: { callback: v => v + '%' } },
  },
}
</script>

<template>
  <main class="page">
    <h1>🏆 Achievements</h1>

    <!-- Overall stats -->
    <div class="stats-row mt-2">
      <div class="stat-chip card-surface text-center">
        <div class="stat-num">{{ overallScore }}%</div>
        <div class="stat-label text-muted">Avg Score</div>
      </div>
      <div class="stat-chip card-surface text-center">
        <div class="stat-num">{{ totalCards }}</div>
        <div class="stat-label text-muted">Total Cards</div>
      </div>
      <div class="stat-chip card-surface text-center">
        <div class="stat-num">{{ totalQuizzes }}</div>
        <div class="stat-label text-muted">Quizzes Done</div>
      </div>
    </div>

    <!-- Per-deck progress bars -->
    <section class="card-surface mt-3" v-if="deckStats.length">
      <h2 style="font-size:1.1rem;margin-bottom:1rem">📊 Deck Progress</h2>
      <div v-for="ds in deckStats" :key="ds.deck.id" class="deck-progress">
        <div class="deck-progress-header">
          <span class="deck-name">{{ ds.deck.name }}</span>
          <span class="deck-pct text-muted">{{ ds.pct }}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: ds.pct + '%' }" />
        </div>
      </div>
    </section>

    <!-- Progress chart -->
    <section class="card-surface mt-3" v-if="chartData">
      <h2 style="font-size:1.1rem;margin-bottom:1rem">📈 Progress Over Time</h2>
      <div class="chart-wrap">
        <Line :data="chartData" :options="chartOptions" />
      </div>
    </section>

    <p v-if="!decksStore.decks.length" class="text-muted mt-3">
      No decks yet — <RouterLink to="/manage">create one</RouterLink> and start learning!
    </p>
  </main>
</template>

<style scoped>
.stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
.stat-num  { font-family: 'Fredoka One', cursive; font-size: 2rem; color: var(--color-primary); }
.stat-label { font-size: 0.85rem; }
.deck-progress { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem; }
.deck-progress:last-child { margin-bottom: 0; }
.deck-progress-header { display: flex; justify-content: space-between; }
.deck-name { font-weight: 700; }
.deck-pct  { font-size: 0.85rem; }
.chart-wrap { height: 240px; }
</style>
