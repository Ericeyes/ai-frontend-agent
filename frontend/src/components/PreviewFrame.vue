<script setup lang="ts">
import { computed } from 'vue'
import type { VariantResult } from '../types'
import { buildPreviewDocument, previewStatus } from '../preview'

const props = defineProps<{
  result: VariantResult
}>()

const status = computed(() => previewStatus(props.result))

const srcdoc = computed<string>(() => {
  return status.value === 'ready' ? buildPreviewDocument(props.result) : ''
})
</script>

<template>
  <div class="preview-wrap">
    <iframe
      v-if="status === 'ready'"
      class="preview-frame"
      :srcdoc="srcdoc"
      sandbox="allow-scripts"
      title="方案实时预览"
    ></iframe>
    <div v-else class="preview-fallback">
      <p v-if="status === 'unsupported'">该方案不支持实时预览，请在代码视图中查看完整实现。</p>
      <p v-else>未找到入口文件，无法预览。</p>
    </div>
  </div>
  <p v-if="result.preview_notes" class="preview-notes">预览说明：{{ result.preview_notes }}</p>
</template>

<style scoped>
.preview-wrap {
  height: 480px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  background: #ffffff;
}

.preview-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #ffffff;
}

.preview-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 20px;
  color: #6b7280;
  font-size: 13px;
  text-align: center;
  background: #fafbfc;
}

.preview-fallback p {
  margin: 0;
  max-width: 320px;
  line-height: 1.6;
}

.preview-notes {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #6b7280;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
