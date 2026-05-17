<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import {
  Chart,
  LineController,
  CategoryScale, LinearScale,
  PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js'

Chart.register(LineController, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const props = defineProps({
  data:    { type: Object, required: true },
  options: { type: Object, default: () => ({}) },
})

const canvasEl = ref(null)
let chart = null

onMounted(() => {
  chart = new Chart(canvasEl.value, {
    type: 'line',
    data: props.data,
    options: props.options,
  })
})

watch(() => props.data, (newData) => {
  if (!chart) return
  chart.data = newData
  chart.update()
}, { deep: true })

onUnmounted(() => {
  chart?.destroy()
  chart = null
})
</script>

<template>
  <canvas ref="canvasEl" role="img"></canvas>
</template>
