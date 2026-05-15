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
| AI API | User-configured; 17+ providers supported | Optional enrichment & quiz generation |
| TTS | Web Speech API (`SpeechSynthesis`) | Built-in, no extra dependency |

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
- Mark card as "Got it" (sets `isLearned` flag); navigate cards with ← / → arrows
- Learned cards are skipped during navigation; progress bar shows learned / total
- `isLearned` flag resets when the quiz marks the card wrong

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
- Per-deck progress bar: average `cardScore` across all cards in the deck (expressed as %)
- Line chart (vue-chartjs): progress % over time (sampled daily)
- Overall stats: average score across all cards (%), total cards, total quizzes taken

### 4.6 Settings (`/settings`)
- User name and avatar selection
- User age group selector: `3–5`, `6–8`, `9–11`, `12+` (affects AI prompt complexity)
- Colour scheme selector (Pink, Blue, Green, Purple, Orange)
- Theme toggle: Light / Dark / Auto (follows OS preference)
- Questions per quiz (default 30)
- Dictionary API toggle (on/off)
- AI provider selector (17+ built-in providers; see §8)
- AI model selector (dynamically fetched from provider's `/models` endpoint)
- AI rate limit (max calls per minute; 0 = unlimited)
- TTS (Text-to-Speech) voice, pitch, and rate via Web Speech API
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

> **No direct `localStorage` calls outside of Pinia stores** (except the AI rate-limit timestamp buffer stored under `vocab-ai-rate-limit`).

### 5.2 FlashCard Fields

| Field | Type | Notes |
|---|---|---|
| `id` | UUID string | |
| `word` | string | |
| `partOfSpeech` | string | noun, verb, adj, adv, etc. |
| `forms` | object | Inflected forms, e.g. `{ "Past Tense": "ran", "Plural": "cats" }` |
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
| `correctCount` | number (capped at 5) |
| `wrongCount` | number (capped at 5) |
| `lastCorrectAt` | ISO8601 \| null |
| `lastWrongAt` | ISO8601 \| null |
| `isLearned` | boolean (default `false`) |

**Decay-based scoring** — `useProgressStore` exposes two scoring functions:
- `cardScore(cardId)` — correct ratio; based on correct and wrong counts
- `cardScoreForOrder(cardId)` — cardScore with time-based decay applied.

These cardScoreForOrder values drive the learn order, and weighted card shuffle in quiz generation (lower score = shown more often).

When a count hits the cap of 5 the opposing count is decremented by 1 to prevent permanent masking.

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

## 6. Colour Themes & Dark Mode

Themes are CSS classes applied to `<body>`. Each defines a set of custom properties:

```css
.scheme-pink  { --color-primary: #e91e8c; --color-accent: #ff6eb4; ... }
.scheme-blue  { --color-primary: #1976d2; --color-accent: #64b5f6; ... }
.scheme-green { --color-primary: #388e3c; --color-accent: #81c784; ... }
```

`App.vue` also toggles a `.dark` class on `<body>` based on the `theme` setting (`'light'` | `'dark'` | `'auto'`). In `auto` mode the OS `prefers-color-scheme` media query is observed reactively.

---

## 7. Quiz Generation Logic

```
generator.js  buildQuiz(cards, deckId, questionCount, scoreOf?)
  1. Weighted shuffle — lower-scored cards (via scoreOf) float to the top;
     pure random order if no scorer supplied.
  2. Deduplicate by word + partOfSpeech → uniqueCards[].
     Abort (return null) if fewer than 4 unique cards.
  3. Cycle through uniqueCards[]; for each slot pick a random factory:
       definitionQuestion | synonymQuestion | fillGapQuestion
     - Skip 'synonym' if card has no synonyms/antonyms
     - Skip 'fillgap' if card has no exampleSentence (or no word match in sentence)
     - fillGapQuestion also tries inflected forms from card.forms before giving up
  4. Repeat up to questionCount × 6 attempts to fill all slots.
  output: QuizSession { id, deckId, generatedAt, questions[] }
```

### Fill-the-Gap matching
The gap is created by replacing the first occurrence of `card.word` (or any value in `card.forms`) in the example sentence using a word-boundary regex. The exact form and casing as it appears in the sentence is preserved in the `gapWord` field.

### Distractor formatting
Fill-the-gap choices are formatted as `word (partOfSpeech)` to avoid ambiguity between homophones.

---

## 8. External API Integration

### Dictionary API (`api/dictionary.js`)
- Endpoint: `GET https://api.dictionaryapi.dev/api/v2/entries/en/{word}`
- Called when: new card added/imported with missing definition, synonyms, or example
- Result merged into card fields (existing values not overwritten)
- No API key required

### AI API (`api/ai.js` + `api/providers.js`)

#### Supported providers (17+)

| Provider | Format | Auth |
|---|---|---|
| OpenAI | openai | Bearer |
| Anthropic | anthropic | x-api-key |
| OpenRouter | openai | Bearer |
| Google Gemini | openai (compat.) | Bearer |
| Google Vertex AI | openai | Bearer |
| Azure OpenAI | azure | api-key |
| Ollama (Local) | openai | none |
| Ollama (Cloud) | openai | Bearer |
| Groq | openai | Bearer |
| Mistral | openai | Bearer |
| xAI (Grok) | openai | Bearer |
| DeepSeek | openai | Bearer |
| Together AI | openai | Bearer |
| Fireworks AI | openai | Bearer |
| Perplexity | openai | Bearer |
| Cohere | cohere | Bearer |
| Venice | openai | Bearer |
| MiniMax | minimax | Bearer |
| Custom / Self-hosted | openai | Bearer |

Provider definitions live in `api/providers.js` (`PROVIDERS` array). Each entry declares `baseUrl`, wire format, auth type, chat path, and model-listing path. `getProvider(id)` resolves a provider by ID.

#### Public functions exported by `api/ai.js`

| Function | Purpose |
|---|---|
| `enrichWithAI(word, existing)` | Fill missing card fields; age-group–aware prompt |
| `convertWordsToCards(words[])` | Bulk convert a word list → FlashCard objects (one per part of speech) |
| `generateQuizWithAI(cards, count)` | Generate quiz questions; result cached in `quizSessions[]` |
| `listModels(settingsObj)` | Fetch available model IDs from the provider's `/models` endpoint |

#### Rate limiting
`api/ai.js` enforces a configurable calls-per-minute limit (stored in `vocab-ai-rate-limit` in localStorage). Default: 10 calls/min; 0 = unlimited.

#### Age-group awareness
All AI prompts are tailored to the `userAgeGroup` setting:
- `'3-5'` → very simple words, short sentences
- `'6-8'` → simple vocabulary, friendly language
- `'9-11'` → moderate vocabulary, clear language
- `'12+'` → richer vocabulary, more nuanced

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
- **Readable fonts**: Google Fonts — *Nunito* (body) and *Fredoka One* (headings)
- **Card flip animation**: CSS 3D transform on `.card` → `.card.flipped`
- **Quiz feedback**: green pulse on correct, red shake on wrong
- **Persistent header**: avatar + name + current deck indicator
- **Responsive**: works on tablet and desktop; primary layout is single-column
- **Dark mode**: `.dark` body class toggled by App.vue based on `theme` setting
- **Text-to-speech**: `composables/useSpeech.js` wraps `SpeechSynthesis`; voice, pitch, and rate are configurable in Settings

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
│   ├── App.vue                   # theme + dark-mode class binding
│   ├── router/index.js
│   ├── stores/
│   │   ├── useDecksStore.js
│   │   ├── useCardsStore.js
│   │   ├── useProgressStore.js   # decay scoring, quiz session cache
│   │   └── useSettingsStore.js   # theme, age group, TTS, AI provider/model/rate
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
│   │   ├── DeckFormModal.vue     # deck create / edit dialog
│   │   └── CardFormModal.vue     # card create / edit dialog
│   ├── composables/
│   │   ├── useEnrich.js          # dictionary → AI enrichment pipeline
│   │   └── useSpeech.js          # Web Speech API TTS wrapper
│   ├── api/
│   │   ├── dictionary.js
│   │   ├── ai.js                 # enrich / convert / quiz / listModels
│   │   └── providers.js          # PROVIDERS registry (17+ entries)
│   ├── quiz/
│   │   ├── generator.js          # weighted shuffle + session builder
│   │   └── types.js              # definitionQuestion / synonymQuestion / fillGapQuestion
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

## 13. Settings Store Reference

| Field | Type | Default | Notes |
|---|---|---|---|
| `userName` | string | `'Learner'` | |
| `avatar` | string | `'avatar-1.svg'` | filename in `public/avatars/` |
| `colorScheme` | string | `'scheme-blue'` | CSS body class |
| `theme` | string | `'auto'` | `'light'` \| `'dark'` \| `'auto'` |
| `questionsPerQuiz` | number | `30` | |
| `dictionaryApiEnabled` | boolean | `true` | |
| `aiProvider` | string | `'openai'` | provider ID from `providers.js` |
| `aiApiUrl` | string | `''` | override / custom base URL |
| `aiApiKey` | string | `''` | stored in localStorage (plain) |
| `aiModel` | string | `''` | empty = use provider's `defaultModel` |
| `aiCallsPerMinute` | number | `10` | 0 = unlimited |
| `userAgeGroup` | string | `'6-8'` | `'3-5'` \| `'6-8'` \| `'9-11'` \| `'12+'` |
| `ttsVoice` | string | `''` | `voiceURI`; empty = browser default |
| `ttsPitch` | number | `1` | 0.5 – 2 |
| `ttsRate` | number | `1` | 0.5 – 2 |
