# Vocab Kids — Project Context & Instructions

This document provides essential context and instructions for the **Vocab Kids** project, a browser-based English vocabulary flashcard app designed for kids.

---

## 🚀 Project Overview

**Vocab Kids** is a client-side application that runs entirely in the browser, using `localStorage` for data persistence. It is designed to be offline-first and installable as a Progressive Web App (PWA).

### 🛠️ Tech Stack
- **Framework:** Vue 3 (Composition API with `<script setup>`)
- **Build Tool:** Vite
- **Routing:** Vue Router 4 (Hash history mode for serverless deployment)
- **State Management:** Pinia + `pinia-plugin-persistedstate` (Auto-persists to `localStorage`)
- **Charts:** Chart.js + `vue-chartjs`
- **Styling:** Vanilla CSS3 with Custom Properties (Supports dynamic themes and Dark Mode)
- **APIs:** 
  - [dictionaryapi.dev](https://dictionaryapi.dev/) for basic enrichment.
  - 17+ AI providers (OpenAI, Gemini, Anthropic, etc.) for advanced enrichment and quiz generation.
- **TTS:** Web Speech API (via `composables/useSpeech.js`)
- **PWA:** `vite-plugin-pwa` (Workbox)

---

## 📂 Project Structure

- `src/api/`: API wrappers for Dictionary and AI services.
- `src/components/`: Reusable UI components.
- `src/composables/`: Shared logic (enrichment, speech).
- `src/quiz/`: Core logic for quiz generation and question factories.
- `src/router/`: Vue Router configuration.
- `src/stores/`: Pinia stores (Decks, Cards, Progress, Settings).
- `src/views/`: Main page components for each route.
- `src/assets/`: Global styles and assets.
- `public/`: Static assets (avatars, PWA icons, templates).
- `docs/`: Design documentation (`design.md`).

---

## ⚙️ Building and Running

### Prerequisites
- Node.js 18 or later
- npm

### Commands
- **Install Dependencies:** `npm install`
- **Start Development Server:** `npm run dev` (Runs at http://localhost:5173)
- **Production Build:** `npm run build` (Outputs to `dist/`)
- **Preview Production Build:** `npm run preview`

---

## 📝 Development Conventions

- **Component Style:** Use Vue 3 Single File Components (SFC) with `<script setup>`.
- **State Management:** Always use Pinia stores for state. Do not access `localStorage` directly; use the `pinia-plugin-persistedstate` configured in the stores.
- **Styling:** Prefer CSS Custom Properties for theming. The app supports 5 color schemes and a dark mode, toggled via classes on the `<body>`.
- **Typing:** The project uses plain JavaScript but follows consistent object structures for `FlashCard`, `Deck`, and `Progress`.
- **Routing:** Use hash history (`/#/route`) to ensure compatibility with static hosting like GitHub Pages.
- **AI Integration:** AI features are optional. The app should gracefully fall back to the Dictionary API if no AI key is provided.
- **Testing:** Currently, there is no formal testing suite (e.g., Vitest). Verification should be done via manual testing in the browser.

---

## 🤖 AI & Dictionary Enrichment

The app provides an enrichment pipeline (`composables/useEnrich.js`) that:
1. Tries the free Dictionary API first.
2. Uses the configured AI provider for more complex fields (synonyms, antonyms, example sentences, inflected forms).
3. Adapts AI prompts based on the `userAgeGroup` (3–5, 6–8, 9–11, 12+).

---

## 📱 PWA Support

The app is configured as a PWA in `vite.config.js`. It uses Workbox for precaching and runtime caching of Google Fonts. It is designed to be fully functional offline once the initial load is complete.
