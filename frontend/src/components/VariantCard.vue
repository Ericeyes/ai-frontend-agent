<script setup lang="ts">
import { computed } from 'vue'
import type { VariantResult } from '../types'
import { openPreviewInNewTab, previewStatus } from '../preview'
import { downloadResultZip } from '../download'

const props = defineProps<{
  result: VariantResult
  selected: boolean
}>()

const emit = defineEmits<{
  select: []
  retry: []
}>()

const dependencies = computed<string[]>(() => props.result.dependencies ?? [])

const canPreview = computed<boolean>(
  () => props.result.ok && previewStatus(props.result) === 'ready',
)

function handleSelect(): void {
  emit('select')
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.target !== event.currentTarget) {
    return
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    handleSelect()
  }
}

function handleRetry(): void {
  emit('retry')
}

function handleOpenTab(): void {
  if (!openPreviewInNewTab(props.result)) {
    window.alert('新标签页被浏览器拦截，请允许本站弹出窗口后重试。')
  }
}

function handleDownload(): void {
  downloadResultZip(props.result)
}
</script>

<template>
  <article
    class="card"
    :class="{ selected, failed: !result.ok }"
    role="button"
    tabindex="0"
    :aria-pressed="selected"
    :aria-label="`方案 ${result.variant_label}，${result.ok ? '生成成功' : '生成失败'}`"
    @click="handleSelect"
    @keydown="handleKeydown"
  >
    <header class="card-head">
      <span class="card-label">{{ result.variant_label || result.variant_key }}</span>
      <span class="badge" :class="result.ok ? 'badge-ok' : 'badge-fail'">
        {{ result.ok ? '成功' : '失败' }}
      </span>
    </header>

    <p class="component-name">{{ result.component_name || '未命名组件' }}</p>

    <p v-if="result.variant_note" class="note" :title="result.variant_note">
      {{ result.variant_note }}
    </p>

    <div v-if="dependencies.length > 0" class="deps">
      <span v-for="dep in dependencies" :key="dep" class="dep">{{ dep }}</span>
    </div>

    <div v-if="result.ok" class="card-actions">
      <button v-if="canPreview" type="button" class="action-btn" @click.stop="handleOpenTab">
        新标签页预览
      </button>
      <button type="button" class="action-btn" @click.stop="handleDownload">下载源码</button>
    </div>

    <div v-if="!result.ok" class="error-box">
      <p class="error-text">{{ result.error }}</p>
      <button type="button" class="retry-btn" @click.stop="handleRetry">重试此方向</button>
    </div>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 180px;
  padding: 14px;
  border: 1px solid #e0e3e8;
  border-radius: 12px;
  background: #ffffff;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
  outline: none;
}

.card:hover {
  border-color: #b6c2d4;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.card:focus-visible {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.25);
}

.card.selected {
  border: 2px solid #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.card.failed {
  background: #fffafa;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-label {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.badge {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 18px;
}

.badge-ok {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.badge-fail {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.component-name {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: #4b5563;
}

.note {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: #6b7280;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.deps {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.dep {
  padding: 1px 7px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #475569;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: auto;
}

.action-btn {
  padding: 4px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  color: #334155;
  font-size: 12px;
  cursor: pointer;
}

.action-btn:hover {
  background: #f8fafc;
  border-color: #94a3b8;
}

.error-box {
  margin-top: auto;
  padding: 8px;
  border-radius: 8px;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.error-text {
  margin: 0 0 6px;
  font-size: 12px;
  line-height: 1.45;
  color: #b91c1c;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.retry-btn {
  padding: 4px 10px;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  background: #ffffff;
  color: #b91c1c;
  font-size: 12px;
  cursor: pointer;
}

.retry-btn:hover {
  background: #fee2e2;
}
</style>
