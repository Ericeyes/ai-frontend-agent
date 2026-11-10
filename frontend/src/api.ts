import type { GenerateRequest, GridResponse, VariantMeta } from './types'

const API_BASE = '/api'
const GENERATE_TIMEOUT_MS = 300_000

async function toError(response: Response): Promise<Error> {
  let detail = `请求失败（HTTP ${response.status}）`
  try {
    const data: unknown = await response.json()
    if (typeof data === 'object' && data !== null && 'detail' in data) {
      const raw = (data as { detail: unknown }).detail
      if (typeof raw === 'string') {
        detail = raw
      } else if (raw !== undefined && raw !== null) {
        const message = (raw as { message?: unknown }).message
        detail = typeof message === 'string' ? message : JSON.stringify(raw)
      }
    }
  } catch {
    detail = `请求失败（HTTP ${response.status}）`
  }
  return new Error(detail)
}

export async function generate(req: GenerateRequest): Promise<GridResponse> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS)
  try {
    const response = await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: controller.signal,
    })
    if (!response.ok) {
      throw await toError(response)
    }
    return (await response.json()) as GridResponse
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('请求超时（超过 300 秒），请减少方案数量或稍后重试')
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

export async function fetchDefaultVariants(): Promise<VariantMeta[]> {
  const response = await fetch(`${API_BASE}/variants`)
  if (!response.ok) {
    throw await toError(response)
  }
  const data = (await response.json()) as { variants: VariantMeta[] }
  return data.variants
}

export async function health(): Promise<{ ok: boolean; llm_configured: boolean }> {
  const response = await fetch(`${API_BASE}/health`)
  if (!response.ok) {
    throw await toError(response)
  }
  return (await response.json()) as { ok: boolean; llm_configured: boolean }
}
