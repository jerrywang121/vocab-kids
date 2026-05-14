# VocabKids — Design Document

## 1. Purpose

VocabKids is a browser-based flashcard app to help kids learn English vocabulary. It runs entirely client-side (no server required) and stores all data in the browser's `localStorage`.

---

## 2. Target Users

- Primary: children aged 7–16 (KS2 / GCSE level)
- Secondary: parents/teachers who manage decks

---

## 3. Tech Stack

| Concern | Choice | Reason |
|---|---|---|
| Framework | Vue 3 (`<script setup>`) | Reactive UI, SFC, great ecosystem |
| Build tool | Vite | Fast HMR, zero-config, ES modules |
| Routing | Vue Router 4 (hash mode) | No server config needed |
| State | Pinia + pinia-plugin-persistedstate | Simple stores, auto localStorage sync |
| Charts | Chart.js + vue-chartjs | Lightweight; achievements page only |
| Styling | CSS3 + Custom Properties | Theme switching without JS |
| Storage | `localStorage` via Pinia plugin | Zero infrastructure |
| Dictionary API | `api.dictionaryapi.dev` | Free, no key required |
| AI API | User-supplied (OpenAI-compatible) | Optional enrichment & quiz generation |

---

## 4. Screens / Modes

### 4.1 Home
- Welcome screen with user avatar and name
- Quick links to all modes
- Shows today's study streak

### 4.2 Management Mode (`/manage`)
- Deck list: create, rename, delete deck
- Card list within a deck: add, edit, delete, bulk import (CSV/JSON)
- Auto-enrich card fields via Dictionary API or AI on add/import
- Card uniqueness enforced by `word + definition`

### 4.3 Learning Mode (`/learn`)
- User selects a deck
- Cards shown one at a time; tap/click to flip (word → definition side)
- Mark card as "Got it" or "Keep practising"
- Updates `progress.lastReviewedAt`

### 4.4 Quiz Mode (`/quiz`)
- User selects a deck and starts a quiz
- Default: 30 questions per run (configurable in Settings)
- Three question types drawn at random, weighted equally:
  1. **Definition Quiz** — given the word, pick the correct definition (4 choices)
  2. **Synonym/Antonym Quiz** — given the word, pick correct synonym or antonym (4 choices)
  3. **Fill-the-Gap Quiz** — given a sentence with `___`, pick the correct word (4 choices)
- Distractors are other cards from the same deck
- Result screen: score as fraction (e.g. 24/30) and percentage; breakdown by type
- Quiz sessions can be pre-generated (and cached) by AI if configured

### 4.5 Achievements (`/achievements`)
- Per-deck progress bar: % of cards with at least one correct answer
- Line chart (vue-chartjs): progress % over time (sampled daily)
- Overall stats: total cards learned, longest streak, total quizzes taken

### 4.6 Settings (`/settings`)
- User name and avatar selection
- Colour scheme selector (Pink, Blue, Green, Purple, Orange)
- Questions per quiz (default 30)
- Dictionary API toggle (on/off)
- AI API endpoint URL + API key (stored encrypted with Web Crypto or obfuscated)
- Export data button → downloads JSON file
- Import data button → file picker → merges data
- Clear all data button (with confirmation)

---

## 5. Data Architecture

### 5.1 Pinia Stores + localStorage Persistence

All state lives in four Pinia stores, each persisted to a separate `localStorage` key via `pinia-plugin-persistedstate`:

| Store | localStorage key | Contents |
|---|---|---|
| `useDecksStore` | `vocab-decks` | `decks[]` |
| `useCardsStore` | `vocab-cards` | `cards[]` |
| `useProgressStore` | `vocab-progress` | `progress[]`, `quizSessions[]`, `achievementSnapshots[]` |
| `useSettingsStore` | `vocab-settings` | `settings` object |

> **No direct `localStorage` calls outside of Pinia stores.**

### 5.2 FlashCard Fields

| Field | Type | Notes |
|---|---|---|
| `id` | UUID string | |
| `word` | string | |
| `partOfSpeech` | string | noun, verb, adj, adv, etc. |
| `definition` | string | |
| `synonyms` | string[] | |
| `antonyms` | string[] | |
| `exampleSentence` | string | Used in Fill-the-Gap quiz |
| `deckId` | string | FK to Deck |
| `createdAt` | ISO8601 | |

Uniqueness: `word + definition` pair must be unique per deck.

### 5.3 Progress Fields

| Field | Type |
|---|---|
| `cardId` | UUID string |
| `correctCount` | number |
| `wrongCount` | number |
| `lastCorrectAt` | ISO8601 \| null |
| `lastWrongAt` | ISO8601 \| null |
| `lastReviewedAt` | ISO8601 \| null |

### 5.4 Achievement Snapshots

Snapshots are appended daily when the user opens the app:
```json
{
  "date": "2025-01-15",
  "deckId": "...",
  "learnedPercent": 42
}
```

---

## 6. Colour Themes

Themes are CSS classes applied to `<body>`. Each defines a set of custom properties:

```css
.scheme-pink  { --color-primary: #e91e8c; --color-accent: #ff6eb4; ... }
.scheme-blue  { --color-primary: #1976d2; --color-accent: #64b5f6; ... }
.scheme-green { --color-primary: #388e3c; --color-accent: #81c784; ... }
```

---

## 7. Quiz Generation Logic

```
generator.js
  input: deck (cards[]), questionCount (default 30), seed?
  1. Shuffle cards
  2. For each question slot, pick a type: 'definition' | 'synonym' | 'fillgap'
     - Skip 'synonym' if card has no synonyms/antonyms
     - Skip 'fillgap' if card has no exampleSentence
  3. Pick 3 distractor cards (different word, same deck)
  4. Shuffle correct answer + distractors
  output: Question[]
```

If AI is configured, `ai.js` can be called instead to generate the full question set, which is then cached in `quizSessions[]` against the deck ID.

---

## 8. External API Integration

### Dictionary API (`api/dictionary.js`)
- Endpoint: `GET https://api.dictionaryapi.dev/api/v2/entries/en/{word}`
- Called when: new card added/imported with missing definition, synonyms, or example
- Result merged into card fields (existing values not overwritten)
- No API key required

### AI API (`api/ai.js`)
- Endpoint: user-configured (OpenAI-compatible `/v1/chat/completions`)
- Used for:
  1. Enriching missing card fields when dictionary API is insufficient
  2. Generating quiz question sets (stored and reused)
- Graceful degradation: if AI unavailable, fall back to `generator.js`

---

## 9. Import / Export

### Export
Triggered from Settings. Produces a file `vocabkids-backup-YYYY-MM-DD.json`:
```json
{
  "version": 1,
  "exportedAt": "2025-01-15T10:00:00Z",
  "decks": [...],
  "cards": [...],
  "progress": [...]
}
```

### Import
- Merges by ID: existing records with matching ID are updated; new IDs are added
- Progress is preserved unless the imported file contains newer progress entries
- Version field used for migration handling

---

## 10. UI / UX Principles

- **Large tap targets** (min 44×44 px) for touch screens / small hands
- **Readable fonts**: Google Fonts — *Nunito* (body) or *Fredoka One* (headings)
- **Card flip animation**: CSS 3D transform on `.card` → `.card.flipped`
- **Quiz feedback**: green pulse on correct, red shake on wrong
- **Persistent header**: avatar + name + current deck indicator
- **Responsive**: works on tablet and desktop; primary layout is single-column

---

## 11. Project Structure

```
lingokids-local/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   └── avatars/
├── src/
│   ├── main.js
│   ├── App.vue
│   ├── router/index.js
│   ├── stores/
│   │   ├── useDecksStore.js
│   │   ├── useCardsStore.js
│   │   ├── useProgressStore.js
│   │   └── useSettingsStore.js
│   ├── views/
│   │   ├── HomeView.vue
│   │   ├── ManageView.vue
│   │   ├── LearnView.vue
│   │   ├── QuizView.vue
│   │   ├── AchievementsView.vue
│   │   └── SettingsView.vue
│   ├── components/
│   │   ├── AppHeader.vue
│   │   ├── FlashCard.vue
│   │   ├── DeckCard.vue
│   │   ├── QuizQuestion.vue
│   │   └── ProgressBar.vue
│   ├── composables/
│   │   └── useEnrich.js
│   ├── api/
│   │   ├── dictionary.js
│   │   └── ai.js
│   ├── quiz/
│   │   ├── generator.js
│   │   └── types.js
│   ├── utils/
│   │   └── uuid.js
│   └── assets/
│       └── main.css
└── docs/
    └── design.md
```

## 12. Dev Commands

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output → dist/
npm run preview
```

## 13. Phased Implementation Plan

### Phase 1 — Foundation
- [ ] Scaffold with `npm create vite@latest` (Vue template)
- [ ] Install: `vue-router`, `pinia`, `pinia-plugin-persistedstate`, `chart.js`, `vue-chartjs`
- [ ] `src/main.js` — createApp, router, pinia with persistedstate plugin
- [ ] `src/App.vue` — `<RouterView>` + theme class binding via `watchEffect`
- [ ] `src/router/index.js` — hash history, 6 lazy-loaded routes
- [ ] `src/stores/` — all four Pinia stores with persist config
- [ ] `src/assets/main.css` — CSS custom properties for all 5 colour schemes
- [ ] `HomeView.vue` skeleton

### Phase 2 — Management Mode
- [ ] `ManageView.vue` — Deck CRUD + card CRUD
- [ ] `DeckCard.vue`, card list/form components
- [ ] Bulk import from CSV/JSON
- [ ] `api/dictionary.js` + `composables/useEnrich.js`

### Phase 3 — Learning Mode
- [ ] `FlashCard.vue` — CSS 3D flip animation
- [ ] `LearnView.vue` — Got-it / Keep-practising → `useProgressStore`

### Phase 4 — Quiz Mode
- [ ] `src/quiz/types.js` — question factories
- [ ] `src/quiz/generator.js` — mixed session builder
- [ ] `QuizQuestion.vue` — multiple choice with feedback animation
- [ ] `QuizView.vue` — flow + result screen

### Phase 5 — Achievements & Settings
- [ ] `AchievementsView.vue` — `vue-chartjs` line chart + progress bars
- [ ] Daily snapshot logic in `useProgressStore`
- [ ] `SettingsView.vue` — avatar, scheme, quiz config, export/import/clear

### Phase 6 — AI Integration
- [ ] `api/ai.js` — OpenAI-compatible wrapper
- [ ] AI quiz generation + caching in `useProgressStore`
- [ ] AI enrichment fallback in `useEnrich.js`
