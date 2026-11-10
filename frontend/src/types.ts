export interface VariantSpec {
  key: string
  label?: string | null
  hint?: string | null
}

export type Framework = 'vue3' | 'react'

export type Styling = 'tailwind' | 'css' | 'scss'

export type FileLanguage = 'vue' | 'tsx' | 'ts' | 'css' | 'scss' | 'html'

export interface GenerateRequest {
  requirement: string
  framework: Framework
  styling: Styling
  variants?: VariantSpec[] | null
  constraints: string
}

export interface GeneratedFile {
  path: string
  language: FileLanguage
  content: string
}

export interface VariantResult {
  slot: number
  ok: boolean
  error: string | null
  variant_key: string
  variant_label: string
  variant_note: string
  framework: string
  component_name: string
  files: GeneratedFile[]
  entry_file: string
  dependencies: string[]
  preview_notes: string
}

export interface GridResponse {
  request_id: string
  elapsed_ms: number
  results: VariantResult[]
}

export interface VariantMeta {
  key: string
  label: string
  hint: string
}
