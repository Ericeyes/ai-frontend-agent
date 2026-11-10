<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchDefaultVariants } from '../api'
import type { Framework, GenerateRequest, Styling, VariantMeta, VariantSpec } from '../types'

interface CustomVariantRow {
  key: string
  hint: string
}

defineProps<{
  loading: boolean
}>()

const emit = defineEmits<{
  submit: [payload: GenerateRequest]
}>()

const requirement = ref('')
const framework = ref<Framework>('vue3')
const styling = ref<Styling>('tailwind')
const count = ref<number>(9)
const customVariants = ref<CustomVariantRow[]>([])
const constraints = ref('')
const formError = ref('')
const defaults = ref<VariantMeta[]>([])
const defaultsLoading = ref(false)
const defaultsNotice = ref('')

const useCustom = computed<boolean>(() => customVariants.value.length > 0)

onMounted(() => {
  void loadDefaults(false)
})

async function loadDefaults(manual: boolean): Promise<void> {
  defaultsLoading.value = true
  defaultsNotice.value = ''
  try {
    defaults.value = await fetchDefaultVariants()
    if (manual) {
      customVariants.value = []
      count.value = Math.min(Math.max(defaults.value.length, 1), 12)
      defaultsNotice.value = `已恢复默认 ${defaults.value.length} 个方向`
    }
  } catch (error) {
    defaultsNotice.value = `默认方向加载失败：${error instanceof Error ? error.message : String(error)}`
  } finally {
    defaultsLoading.value = false
  }
}

function handleRestoreDefaults(): void {
  void loadDefaults(true)
}

function addCustomRow(): void {
  if (customVariants.value.length >= 12) {
    return
  }
  customVariants.value.push({ key: '', hint: '' })
}

function removeCustomRow(index: number): void {
  customVariants.value.splice(index, 1)
}

function buildVariants(): VariantSpec[] | null {
  if (useCustom.value) {
    const rows = customVariants.value
    if (rows.length > 12) {
      throw new Error('自定义方向最多 12 个')
    }
    const keys = new Set<string>()
    for (const row of rows) {
      const key = row.key.trim()
      if (!key) {
        throw new Error('自定义方向的 key 不能为空')
      }
      if (keys.has(key)) {
        throw new Error(`自定义方向 key 重复：${key}`)
      }
      keys.add(key)
    }
    return rows.map((row) => ({
      key: row.key.trim(),
      label: null,
      hint: row.hint.trim() || null,
    }))
  }

  if (!Number.isInteger(count.value) || count.value < 1 || count.value > 12) {
    throw new Error('方案数量必须是 1–12 的整数')
  }

  if (defaults.value.length === 0) {
    return null
  }

  const limit = Math.min(count.value, defaults.value.length)
  return defaults.value.slice(0, limit).map((item) => ({
    key: item.key,
    label: item.label,
    hint: item.hint,
  }))
}

function handleSubmit(): void {
  formError.value = ''
  const requirementText = requirement.value.trim()
  if (requirementText.length < 5) {
    formError.value = '需求描述至少需要 5 个字符'
    return
  }

  let variants: VariantSpec[] | null
  try {
    variants = buildVariants()
  } catch (error) {
    formError.value = error instanceof Error ? error.message : String(error)
    return
  }

  emit('submit', {
    requirement: requirementText,
    framework: framework.value,
    styling: styling.value,
    variants,
    constraints: constraints.value.trim(),
  })
}
</script>

<template>
  <form class="requirement-form" @submit.prevent="handleSubmit">
    <div class="field">
      <label for="requirement">需求描述 <span class="required">*</span></label>
      <textarea
        id="requirement"
        v-model="requirement"
        class="requirement-input"
        rows="14"
        placeholder="例如：一个用户资料卡片，展示头像、姓名、职位和关注按钮"
        :disabled="loading"
      ></textarea>
      <p class="hint">至少 5 个字符；可直接粘贴 FastAPI 源码或接口代码，模型会据此生成前端页面</p>
    </div>

    <div class="row">
      <div class="field">
        <label for="framework">框架</label>
        <select id="framework" v-model="framework" :disabled="loading">
          <option value="vue3">Vue 3</option>
          <option value="react">React</option>
        </select>
      </div>
      <div class="field">
        <label for="styling">样式</label>
        <select id="styling" v-model="styling" :disabled="loading">
          <option value="tailwind">Tailwind</option>
          <option value="css">CSS</option>
          <option value="scss">SCSS</option>
        </select>
      </div>
    </div>

    <div class="field">
      <label for="count">方案数量</label>
      <input
        id="count"
        v-model.number="count"
        type="number"
        min="1"
        max="12"
        step="1"
        :disabled="loading || useCustom"
      />
      <p class="hint">{{ useCustom ? '自定义方向已启用，数量由列表决定' : '1–12 个，默认 9 个' }}</p>
    </div>

    <div class="field">
      <div class="field-head">
        <span class="field-title">自定义方向</span>
        <button
          type="button"
          class="link-btn"
          :disabled="loading || customVariants.length >= 12"
          @click="addCustomRow"
        >
          + 添加方向
        </button>
      </div>
      <p v-if="customVariants.length === 0" class="hint">未添加时使用内置 9 个方向。</p>
      <div v-for="(row, index) in customVariants" :key="index" class="custom-row">
        <input
          v-model="row.key"
          type="text"
          placeholder="key，如 vibe"
          aria-label="自定义方向 key"
          :disabled="loading"
        />
        <input
          v-model="row.hint"
          type="text"
          placeholder="hint（可选）：结构 / 视觉倾向"
          aria-label="自定义方向 hint"
          :disabled="loading"
        />
        <button type="button" class="remove-btn" :disabled="loading" @click="removeCustomRow(index)">
          删除
        </button>
      </div>
      <button
        type="button"
        class="restore-btn"
        :disabled="loading || defaultsLoading"
        @click="handleRestoreDefaults"
      >
        {{ defaultsLoading ? '加载中…' : '恢复默认方向' }}
      </button>
      <p v-if="defaultsNotice" class="hint">{{ defaultsNotice }}</p>
    </div>

    <div class="field">
      <label for="constraints">额外约束</label>
      <textarea
        id="constraints"
        v-model="constraints"
        rows="3"
        placeholder="可选，例如：按钮需要 loading 状态，仅使用 CSS 变量"
        :disabled="loading"
      ></textarea>
    </div>

    <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

    <button type="submit" class="submit-btn" :disabled="loading">
      {{ loading ? '正在生成方案…请稍候' : '生成方案' }}
    </button>
  </form>
</template>

<style scoped>
.requirement-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

label,
.field-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.required {
  color: #dc2626;
}

textarea,
select,
input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  color: #111827;
  font-size: 13px;
  font-family: inherit;
  box-sizing: border-box;
}

textarea {
  resize: vertical;
  line-height: 1.5;
}

.requirement-input {
  min-height: 280px;
}

textarea:focus,
select:focus,
input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

input:disabled,
textarea:disabled,
select:disabled {
  background: #f3f4f6;
  color: #6b7280;
}

.hint {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}

.field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.link-btn {
  border: none;
  background: none;
  color: #2563eb;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}

.link-btn:disabled {
  color: #9ca3af;
  cursor: not-allowed;
}

.custom-row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
}

.remove-btn {
  padding: 6px 8px;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  background: #ffffff;
  color: #b91c1c;
  font-size: 12px;
  cursor: pointer;
}

.remove-btn:hover {
  background: #fee2e2;
}

.restore-btn {
  align-self: flex-start;
  padding: 5px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #f8fafc;
  color: #334155;
  font-size: 12px;
  cursor: pointer;
}

.restore-btn:hover {
  background: #f1f5f9;
}

.form-error {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 12.5px;
  line-height: 1.45;
}

.submit-btn {
  padding: 10px 14px;
  border: none;
  border-radius: 10px;
  background: #2563eb;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.submit-btn:hover:enabled {
  background: #1d4ed8;
}

.submit-btn:disabled {
  background: #93b4f5;
  cursor: not-allowed;
}
</style>
