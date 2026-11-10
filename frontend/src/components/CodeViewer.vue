<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import type { FileLanguage, GeneratedFile } from '../types'

const props = defineProps<{
  files: GeneratedFile[]
  entryFile: string
}>()

const HLJS_LANGUAGE: Record<FileLanguage, string> = {
  vue: 'xml',
  tsx: 'typescript',
  ts: 'typescript',
  css: 'css',
  scss: 'scss',
  html: 'xml',
}

const activePath = ref('')
const copied = ref(false)

const sortedFiles = computed<GeneratedFile[]>(() => {
  const entry = props.files.find((file) => file.path === props.entryFile)
  const rest = props.files.filter((file) => file.path !== props.entryFile)
  return entry ? [entry, ...rest] : [...props.files]
})

const activeFile = computed<GeneratedFile | null>(() => {
  return sortedFiles.value.find((file) => file.path === activePath.value) ?? sortedFiles.value[0] ?? null
})

watch(
  () => [props.files, props.entryFile] as const,
  () => {
    activePath.value = props.entryFile || props.files[0]?.path || ''
  },
  { immediate: true },
)

const highlighted = computed<string>(() => {
  const file = activeFile.value
  if (!file) {
    return ''
  }
  try {
    return hljs.highlight(file.content, { language: HLJS_LANGUAGE[file.language] ?? 'plaintext' }).value
  } catch {
    return escapeHtml(file.content)
  }
})

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function copyActiveFile(): Promise<void> {
  const file = activeFile.value
  if (!file) {
    return
  }
  try {
    await navigator.clipboard.writeText(file.content)
  } catch {
    const area = document.createElement('textarea')
    area.value = file.content
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    document.body.removeChild(area)
  }
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1500)
}
</script>

<template>
  <div class="code-viewer">
    <aside class="file-list" aria-label="生成文件列表">
      <button
        v-for="file in sortedFiles"
        :key="file.path"
        type="button"
        class="file-item"
        :class="{ active: activeFile?.path === file.path }"
        @click="activePath = file.path"
      >
        <span class="file-path" :title="file.path">{{ file.path }}</span>
        <span v-if="file.path === entryFile" class="entry-tag">入口</span>
      </button>
      <p v-if="sortedFiles.length === 0" class="no-files">无文件</p>
    </aside>

    <section class="code-pane">
      <header class="code-head">
        <span class="active-path" :title="activeFile?.path ?? ''">{{ activeFile?.path ?? '无文件' }}</span>
        <div class="code-actions">
          <span class="lang-tag">{{ activeFile?.language ?? '' }}</span>
          <button type="button" class="copy-btn" :disabled="!activeFile" @click="copyActiveFile">
            {{ copied ? '已复制' : '复制当前文件' }}
          </button>
        </div>
      </header>
      <pre class="code-block"><code class="hljs" v-html="highlighted"></code></pre>
    </section>
  </div>
</template>

<style scoped>
.code-viewer {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  height: 380px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  background: #ffffff;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  border-right: 1px solid #e5e7eb;
  background: #f8fafc;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #334155;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-align: left;
  cursor: pointer;
}

.file-item:hover {
  background: #eef2f7;
}

.file-item.active {
  background: #e0ecff;
  color: #1d4ed8;
}

.file-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-tag {
  flex: none;
  margin-left: auto;
  padding: 0 5px;
  border-radius: 4px;
  background: #2563eb;
  color: #ffffff;
  font-size: 10px;
  line-height: 16px;
}

.no-files {
  margin: 8px;
  font-size: 12px;
  color: #94a3b8;
}

.code-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #0f172a;
}

.code-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 12px;
  border-bottom: 1px solid #1e293b;
  background: #111c31;
}

.active-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #cbd5e1;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.code-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.lang-tag {
  padding: 0 6px;
  border-radius: 4px;
  background: #1e293b;
  color: #94a3b8;
  font-size: 11px;
  line-height: 18px;
}

.copy-btn {
  padding: 3px 9px;
  border: 1px solid #334155;
  border-radius: 6px;
  background: transparent;
  color: #e2e8f0;
  font-size: 12px;
  cursor: pointer;
}

.copy-btn:hover:enabled {
  background: #1e293b;
}

.copy-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.code-block {
  flex: 1;
  margin: 0;
  padding: 12px;
  overflow: auto;
  font-size: 12.5px;
  line-height: 1.55;
}

.code-block code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: pre;
}
</style>
