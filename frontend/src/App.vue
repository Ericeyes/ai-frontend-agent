<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { generate as requestGenerate } from './api'
import RequirementForm from './components/RequirementForm.vue'
import GridBoard from './components/GridBoard.vue'
import CodeViewer from './components/CodeViewer.vue'
import PreviewFrame from './components/PreviewFrame.vue'
import { openPreviewInNewTab, previewStatus } from './preview'
import { downloadResultZip } from './download'
import type { GenerateRequest, GridResponse, VariantResult, VariantSpec } from './types'

const loading = ref(false)
const grid = ref<GridResponse | null>(null)
const selectedSlot = ref<number | null>(null)
const error = ref<string | null>(null)
const retrying = ref<number[]>([])
const lastRequest = ref<GenerateRequest | null>(null)

const results = computed<VariantResult[]>(() =>
  grid.value ? [...grid.value.results].sort((a, b) => a.slot - b.slot) : [],
)

const selectedResult = computed<VariantResult | null>(() => {
  if (selectedSlot.value === null) {
    return null
  }
  return results.value.find((item) => item.slot === selectedSlot.value) ?? null
})

const elapsedText = computed<string>(() => {
  if (!grid.value) {
    return ''
  }
  return `${(grid.value.elapsed_ms / 1000).toFixed(1)}s`
})

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
})

function handleWindowKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && selectedSlot.value !== null) {
    selectedSlot.value = null
  }
}

async function handleSubmit(payload: GenerateRequest): Promise<void> {
  loading.value = true
  error.value = null
  lastRequest.value = payload
  try {
    const response = await requestGenerate(payload)
    grid.value = response
    const firstOk = [...response.results]
      .filter((item) => item.ok)
      .sort((a, b) => a.slot - b.slot)[0]
    selectedSlot.value = firstOk ? firstOk.slot : null
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    grid.value = null
    selectedSlot.value = null
  } finally {
    loading.value = false
  }
}

function handleSelect(slot: number): void {
  selectedSlot.value = slot
}

function closeDrawer(): void {
  selectedSlot.value = null
}

function handleOpenStandalone(result: VariantResult): void {
  if (!openPreviewInNewTab(result)) {
    window.alert('无法在新标签页打开：请确认浏览器没有拦截弹窗，且该方案支持实时预览。')
  }
}

function handleDownload(result: VariantResult): void {
  downloadResultZip(result)
}

function retrySpecFor(result: VariantResult): VariantSpec {
  const request = lastRequest.value
  if (request?.variants) {
    const byKey = request.variants.find((spec) => spec.key === result.variant_key)
    if (byKey) {
      return byKey
    }
    const bySlot = request.variants[result.slot]
    if (bySlot) {
      return bySlot
    }
  }
  return { key: result.variant_key, label: result.variant_label, hint: null }
}

async function handleRetry(slot: number): Promise<void> {
  if (!grid.value || !lastRequest.value || retrying.value.includes(slot)) {
    return
  }
  const current = results.value.find((item) => item.slot === slot)
  if (!current) {
    return
  }

  retrying.value = [...retrying.value, slot]
  error.value = null
  try {
    const response = await requestGenerate({
      ...lastRequest.value,
      variants: [retrySpecFor(current)],
    })
    const fresh = response.results[0]
    if (!fresh) {
      throw new Error('重试请求未返回结果')
    }
    const merged: VariantResult = { ...fresh, slot }
    grid.value = {
      ...grid.value,
      results: grid.value.results.map((item) => (item.slot === slot ? merged : item)),
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    retrying.value = retrying.value.filter((item) => item !== slot)
  }
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <h1>AI Frontend Agent</h1>
        <p>一句话需求，并发生成多个结构不同的前端方案。</p>
      </div>
      <RequirementForm :loading="loading" @submit="handleSubmit" />
    </aside>

    <main class="main-area">
      <header class="main-head">
        <div>
          <h2>方案九宫格</h2>
          <p v-if="grid" class="meta">
            request {{ grid.request_id }} · {{ elapsedText }} · 共 {{ results.length }} 个方案
          </p>
          <p v-else class="meta">填写左侧需求后提交，方案会并行生成。</p>
        </div>
      </header>

      <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
      <p v-if="loading" class="loading-banner">正在并行调用 LLM 生成方案，请保持页面打开。</p>

      <GridBoard
        v-if="results.length > 0 || !loading"
        :results="results"
        :selected-slot="selectedSlot"
        @select="handleSelect"
        @retry="handleRetry"
      />
    </main>

    <div v-if="selectedResult" class="drawer-backdrop" @click="closeDrawer"></div>

    <aside v-if="selectedResult" class="detail-drawer" aria-label="方案详情">
      <header class="drawer-head">
        <div>
          <h2>{{ selectedResult.variant_label }}</h2>
          <p class="drawer-sub">
            <span class="mono">{{ selectedResult.component_name || '未命名组件' }}</span>
            <span class="dot">·</span>
            <span>{{ selectedResult.framework || '未知框架' }}</span>
          </p>
          <p v-if="selectedResult.variant_note" class="drawer-note">{{ selectedResult.variant_note }}</p>
          <div v-if="selectedResult.dependencies.length > 0" class="drawer-deps">
            <span v-for="dep in selectedResult.dependencies" :key="dep" class="dep">{{ dep }}</span>
          </div>
        </div>
        <div class="drawer-head-side">
          <button
            v-if="selectedResult.ok && previewStatus(selectedResult) === 'ready'"
            type="button"
            class="head-action"
            @click="handleOpenStandalone(selectedResult)"
          >
            在新标签页打开
          </button>
          <button v-if="selectedResult.ok" type="button" class="head-action" @click="handleDownload(selectedResult)">
            下载源码
          </button>
          <button type="button" class="drawer-close" aria-label="关闭详情" @click="closeDrawer">×</button>
        </div>
      </header>

      <div v-if="!selectedResult.ok" class="drawer-error">
        <p>{{ selectedResult.error }}</p>
        <button
          type="button"
          class="retry-btn"
          :disabled="retrying.includes(selectedResult.slot)"
          @click="handleRetry(selectedResult.slot)"
        >
          {{ retrying.includes(selectedResult.slot) ? '正在重试…' : '重试此方向' }}
        </button>
      </div>

      <template v-else>
        <section class="drawer-section">
          <h3>实时预览</h3>
          <PreviewFrame :result="selectedResult" />
        </section>
        <section class="drawer-section">
          <h3>代码</h3>
          <CodeViewer :files="selectedResult.files" :entry-file="selectedResult.entry_file" />
        </section>
      </template>
    </aside>
  </div>
</template>

<style>
:root {
  color-scheme: light;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  background: #f5f6f8;
  color: #1f2937;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

#app {
  min-height: 100vh;
}

button {
  font-family: inherit;
}
</style>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  flex: 0 0 320px;
  width: 320px;
  height: 100vh;
  position: sticky;
  top: 0;
  overflow-y: auto;
  padding: 20px;
  background: #ffffff;
  border-right: 1px solid #e5e7eb;
}

.brand h1 {
  margin: 0 0 4px;
  font-size: 18px;
  color: #111827;
}

.brand p {
  margin: 0 0 18px;
  font-size: 12.5px;
  line-height: 1.5;
  color: #6b7280;
}

.main-area {
  flex: 1;
  min-width: 0;
  padding: 24px 28px 60px;
}

.main-head h2 {
  margin: 0 0 4px;
  font-size: 16px;
  color: #111827;
}

.meta {
  margin: 0 0 16px;
  font-size: 12.5px;
  color: #6b7280;
}

.error-banner {
  margin: 0 0 16px;
  padding: 10px 12px;
  border: 1px solid #fecaca;
  border-radius: 10px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.loading-banner {
  margin: 0 0 16px;
  padding: 10px 12px;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 13px;
}

.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  z-index: 10;
}

.detail-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(1040px, 96vw);
  overflow-y: auto;
  padding: 20px;
  background: #ffffff;
  border-left: 1px solid #e5e7eb;
  box-shadow: -12px 0 32px rgba(15, 23, 42, 0.14);
  z-index: 20;
}

.drawer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.drawer-head h2 {
  margin: 0 0 4px;
  font-size: 16px;
  color: #111827;
}

.drawer-sub {
  margin: 0 0 6px;
  font-size: 12.5px;
  color: #4b5563;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.dot {
  margin: 0 6px;
  color: #9ca3af;
}

.drawer-note {
  margin: 0 0 8px;
  font-size: 12.5px;
  line-height: 1.5;
  color: #6b7280;
}

.drawer-deps {
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

.drawer-head-side {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
}

.head-action {
  padding: 6px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  color: #334155;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}

.head-action:hover {
  background: #f8fafc;
  border-color: #94a3b8;
}

.drawer-close {
  flex: none;
  width: 30px;
  height: 30px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  color: #4b5563;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.drawer-close:hover {
  background: #f3f4f6;
}

.drawer-error {
  padding: 12px;
  border: 1px solid #fecaca;
  border-radius: 10px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.drawer-error p {
  margin: 0 0 10px;
}

.retry-btn {
  padding: 5px 12px;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  background: #ffffff;
  color: #b91c1c;
  font-size: 12px;
  cursor: pointer;
}

.retry-btn:hover:enabled {
  background: #fee2e2;
}

.retry-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.drawer-section {
  margin-top: 18px;
}

.drawer-section h3 {
  margin: 0 0 8px;
  font-size: 13px;
  color: #374151;
}
</style>
