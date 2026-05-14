# VocabKids – Copilot Instructions

## Project Overview

**VocabKids** is a client-side single-page web application for kids learning English vocabulary through flashcards, learning mode, and quizzes. It runs entirely in the browser with no backend — all data persists via `localStorage`.

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Vue 3 (`<script setup>` Composition API) |
| Build tool | Vite |
| Routing | Vue Router 4 (hash mode) |
| State management | Pinia + `pinia-plugin-persistedstate` |
| Charts | Chart.js via `vue-chartjs` |
| Styling | CSS3 + CSS custom properties (no CSS framework) |
| Storage | `localStorage` via Pinia persistence plugin |
| Dictionary API | `https://api.dictionaryapi.dev/api/v2/entries/en/<word>` |
| AI API | User-supplied OpenAI-compatible endpoint |

## Commands

```bash
npm install          # install dependencies
npm run dev          # dev server → http://localhost:5173
npm run build        # production build → dist/
npm run preview      # preview production build
```

## Repository Layout

```
lingokids-local/
├── index.html              # Vite entry (just mounts #app)
├── package.json
├── vite.config.js
├── public/
│   └── avatars/            # SVG avatar files (static, not processed by Vite)
├── src/
│   ├── main.js             # createApp → use(router) → use(pinia) → mount('#app')
│   ├── App.vue             # Root: binds theme class to <body>, renders <AppHeader> + <RouterView>
│   ├── router/
│   │   └── index.js        # Vue Router 4, createWebHashHistory, lazy-loaded route components
│   ├── stores/             # Pinia stores — one per domain
│   │   ├── useDecksStore.js
│   │   ├── useCardsStore.js
│   │   ├── useProgressStore.js
│   │   └── useSettingsStore.js
│   ├── views/              # Route-level components (one per route)
│   │   ├── HomeView.vue
│   │   ├── ManageView.vue  # Deck + card CRUD, bulk import
│   │   ├── LearnView.vue   # Card flip, Got-it / Keep-practising
│   │   ├── QuizView.vue    # Quiz flow + result screen
│   │   ├── AchievementsView.vue
│   │   └── SettingsView.vue
│   ├── components/         # Reusable child components
│   │   ├── AppHeader.vue
│   │   ├── FlashCard.vue   # Flip animation component
│   │   ├── DeckCard.vue
│   │   ├── QuizQuestion.vue
│   │   └── ProgressBar.vue
│   ├── composables/        # Shared logic (no state; use stores for state)
│   │   └── useEnrich.js    # Orchestrates dictionary → AI enrichment pipeline
│   ├── api/
│   │   ├── dictionary.js   # Wrapper for dictionaryapi.dev
│   │   └── ai.js           # Wrapper for user-configured AI endpoint
│   ├── quiz/
│   │   ├── generator.js    # Builds mixed question set from deck cards
│   │   └── types.js        # Definition / Synonym+Antonym / Fill-the-Gap factories
│   ├── utils/
│   │   └── uuid.js         # crypto.randomUUID() wrapper
│   └── assets/
│       └── main.css        # Global styles + theme CSS custom properties
└── docs/
    └── design.md
```

## Data Models

### FlashCard
```js
{
  id: string,           // crypto.randomUUID()
  word: string,
  partOfSpeech: string, // 'noun' | 'verb' | 'adjective' | etc.
  definition: string,
  synonyms: string[],
  antonyms: string[],
  exampleSentence: string,
  deckId: string,
  createdAt: string,    // ISO8601
}
```
Uniqueness constraint: `word + definition` per deck (enforced in `useCardsStore`).

### Deck
```js
{
  id: string,
  name: string,
  description: string,
  colorScheme: string,  // e.g. 'scheme-pink'
  createdAt: string,
}
```

### Progress (per card)
```js
{
  cardId: string,
  correctCount: number,
  wrongCount: number,
  lastCorrectAt: string | null,
  lastWrongAt: string | null,
  lastReviewedAt: string | null,
}
```

### QuizSession (cached)
```js
{
  id: string,
  deckId: string,
  generatedAt: string,
  questions: Question[],
}
```

## Key Conventions

### Vue style
- Use `<script setup>` exclusively — no Options API.
- Views live in `src/views/` and are named `XxxView.vue`.
- Reusable components live in `src/components/` and are PascalCase.
- Use `defineProps` / `defineEmits` (compiler macros, no import needed).

### State management
- All app state lives in Pinia stores (`src/stores/`).
- Stores are persisted to `localStorage` automatically via `pinia-plugin-persistedstate` — no manual `localStorage` calls anywhere else.
- Store names follow the `useXxxStore` convention.

### Routing
- Vue Router 4 with `createWebHashHistory` (hash URLs, no server config).
- All route components are **lazy-loaded**: `component: () => import('../views/XxxView.vue')`.
- Routes: `/` (home), `/manage`, `/learn`, `/quiz`, `/achievements`, `/settings`.

### Colour scheme
- CSS custom properties (`--color-primary`, `--color-accent`, etc.) are defined per `.scheme-*` class in `src/assets/main.css`.
- `useSettingsStore` exposes `colorScheme`; `App.vue` applies the class to `document.body` via a `watchEffect`.

### Quiz generation
`quiz/generator.js` builds a mixed session (default 30 questions) from the deck's cards, calling factories in `quiz/types.js`. Distractors are drawn from other cards in the same deck. The session is cached in `useProgressStore` with a TTL to avoid regeneration on every visit.

### API enrichment pipeline
When adding/importing a card, `composables/useEnrich.js` is called:
1. Fetch from `api/dictionary.js` (free, no key).
2. For any fields still missing, call `api/ai.js` (only if user has configured an AI key).
3. Card is always saved with whatever data is available — both calls are optional and gracefully degrade.

### Kids-friendly UI
- Minimum tap target: 44 × 44 px.
- Fonts: *Nunito* (body) + *Fredoka One* (headings) via Google Fonts.
- Card flip: CSS 3D transform with `perspective` on `FlashCard.vue`.
- Quiz feedback: green `.animate-correct` pulse / red `.animate-wrong` shake, triggered by class binding.

## Import / Export Format

```json
{
  "version": 1,
  "exportedAt": "<ISO8601>",
  "decks": [...],
  "cards": [...],
  "progress": [...]
}
```
Import merges by `id`; newer `progress` entries (by `lastCorrectAt` / `lastWrongAt`) win on conflict.
