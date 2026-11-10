<script setup lang="ts">
import { computed } from 'vue'
import VariantCard from './VariantCard.vue'
import type { VariantResult } from '../types'

const props = defineProps<{
  results: VariantResult[]
  selectedSlot: number | null
}>()

const emit = defineEmits<{
  select: [slot: number]
  retry: [slot: number]
}>()

const placeholderIndexes = computed<number[]>(() => {
  const missing = (3 - (props.results.length % 3)) % 3
  return Array.from({ length: missing }, (_, index) => index)
})
</script>

<template>
  <div v-if="results.length === 0" class="empty-board">
    提交需求后，这里会以九宫格展示生成的方案。
  </div>

  <div v-else class="grid-board">
    <VariantCard
      v-for="result in results"
      :key="result.slot"
      :result="result"
      :selected="result.slot === selectedSlot"
      @select="emit('select', result.slot)"
      @retry="emit('retry', result.slot)"
    />

    <div
      v-for="index in placeholderIndexes"
      :key="`empty-${index}`"
      class="empty-slot"
      aria-hidden="true"
    >
      空位
    </div>
  </div>
</template>

<style scoped>
.grid-board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.empty-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  color: #9ca3af;
  font-size: 13px;
  background: #fafbfc;
}

.empty-board {
  padding: 60px 20px;
  border: 1px dashed #d1d5db;
  border-radius: 12px;
  background: #ffffff;
  color: #9ca3af;
  text-align: center;
  font-size: 14px;
}

@media (max-width: 1100px) {
  .grid-board {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .grid-board {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
