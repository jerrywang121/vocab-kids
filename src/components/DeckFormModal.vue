<script setup>
import { ref } from 'vue'

const props = defineProps({
  deck: { type: Object, default: null }, // null = create mode
})
const emit = defineEmits(['save', 'cancel'])

const form = ref({
  name: props.deck?.name ?? '',
  description: props.deck?.description ?? '',
})
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('cancel')">
    <div class="modal card-surface">
      <h2>{{ deck ? '✏️ Edit Deck' : '➕ New Deck' }}</h2>
      <form class="deck-form" @submit.prevent="emit('save', { ...form })">
        <div class="form-field">
          <label>Deck Name *</label>
          <input v-model="form.name" placeholder="e.g. KS2 Vocabulary" required />
        </div>
        <div class="form-field">
          <label>Description</label>
          <input v-model="form.description" placeholder="Optional description" />
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" @click="emit('cancel')">Cancel</button>
          <button type="submit" class="btn btn-primary">{{ deck ? 'Save Changes' : 'Create Deck' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 200; padding: 1rem;
}
.modal {
  width: 100%; max-width: 440px;
  display: flex; flex-direction: column; gap: 1rem;
}
.deck-form { display: flex; flex-direction: column; gap: 0.9rem; }
.form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }
</style>
