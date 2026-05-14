<script setup>
const props = defineProps({
  deck: { type: Object, required: true },
  cardCount: { type: Number, default: 0 },
  uniqueCount: { type: Number, default: 0 },
})
const emit = defineEmits(['select', 'edit', 'delete'])
</script>

<template>
  <div class="deck-card card-surface" @click="emit('select', deck)">
    <div class="deck-top">
      <div class="deck-icon">🗂️</div>
      <div class="deck-actions" @click.stop>
        <button class="icon-btn" title="Edit deck" @click="emit('edit', deck)">✏️</button>
        <button class="icon-btn" title="Delete deck" @click="emit('delete', deck)">🗑️</button>
      </div>
    </div>
    <h3 class="deck-name">{{ deck.name }}</h3>
    <p v-if="deck.description" class="deck-desc text-muted">{{ deck.description }}</p>
    <div class="deck-footer text-muted">
      <span>{{ cardCount }} card{{ cardCount !== 1 ? 's' : '' }}</span>
      <span v-if="uniqueCount !== cardCount" class="unique-badge">{{ uniqueCount }} unique</span>
    </div>
  </div>
</template>

<style scoped>
.deck-card {
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.deck-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}
.deck-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.deck-icon { font-size: 1.8rem; }
.deck-actions { display: flex; gap: 0.25rem; }
.icon-btn {
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.25rem;
  min-height: 36px;
  min-width: 36px;
  border-radius: 0.5rem;
  transition: background 0.15s;
}
.icon-btn:hover { background: var(--color-surface-alt); }
.deck-name { font-family: 'Fredoka One', cursive; font-size: 1.1rem; }
.deck-desc { font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.deck-footer { font-size: 0.8rem; margin-top: auto; padding-top: 0.5rem; display: flex; align-items: center; gap: 0.5rem; }
.unique-badge {
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  background: var(--color-surface-alt);
  color: var(--color-primary);
}
</style>
