import type { VariantResult } from './types'

interface ZipEntry {
  name: string
  data: Uint8Array
}

const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let value = n
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[n] = value >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.min(2107, Math.max(1980, date.getFullYear()))
  const time =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    (Math.floor(date.getSeconds() / 2) & 0x1f)
  const dosDate =
    (((year - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f)
  return { time, date: dosDate }
}

function createZip(entries: ZipEntry[]): Blob {
  const stamp = dosDateTime(new Date())
  const localParts: BlobPart[] = []
  const centralParts: BlobPart[] = []
  let offset = 0
  let centralSize = 0

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name)
    const crc = crc32(entry.data)

    const localHeader = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(localHeader.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0x0800, true)
    localView.setUint16(8, 0, true)
    localView.setUint16(10, stamp.time, true)
    localView.setUint16(12, stamp.date, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, entry.data.length, true)
    localView.setUint32(22, entry.data.length, true)
    localView.setUint16(26, nameBytes.length, true)
    localView.setUint16(28, 0, true)
    localHeader.set(nameBytes, 30)
    localParts.push(localHeader, entry.data)

    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(centralHeader.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0x0800, true)
    centralView.setUint16(10, 0, true)
    centralView.setUint16(12, stamp.time, true)
    centralView.setUint16(14, stamp.date, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, entry.data.length, true)
    centralView.setUint32(24, entry.data.length, true)
    centralView.setUint16(28, nameBytes.length, true)
    centralView.setUint16(30, 0, true)
    centralView.setUint16(32, 0, true)
    centralView.setUint16(34, 0, true)
    centralView.setUint16(36, 0, true)
    centralView.setUint32(38, 0, true)
    centralView.setUint32(42, offset, true)
    centralHeader.set(nameBytes, 46)
    centralParts.push(centralHeader)

    centralSize += centralHeader.length
    offset += localHeader.length + entry.data.length
  }

  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(4, 0, true)
  endView.setUint16(6, 0, true)
  endView.setUint16(8, entries.length, true)
  endView.setUint16(10, entries.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)
  endView.setUint16(20, 0, true)

  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' })
}

function normalizeZipPath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..')
    .join('/')
}

function safeFilename(value: string): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|\r\n]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || 'frontend-solution'
}

function buildReadme(result: VariantResult): string {
  const frameworkLabel =
    result.framework === 'react' ? 'React' : result.framework === 'vue3' ? 'Vue 3' : result.framework || '未知框架'
  const rawName = result.component_name || ''
  const component = /^[A-Za-z_$][\w$]*$/.test(rawName) ? rawName : 'GeneratedComponent'
  const entry = result.entry_file || ''
  const entryImport = entry.startsWith('src/') ? '@/'.concat(entry.slice(4)) : entry
  const entryWithoutExtension = entryImport.replace(/\.(vue|tsx?|jsx?)$/i, '')
  const dependencies = (result.dependencies ?? []).filter((item) => Boolean(item))

  const lines: string[] = []
  lines.push('# ' + (rawName || result.variant_label || '前端方案'))
  lines.push('')
  lines.push(
    '由「AI Frontend Agent」生成的 ' +
      frameworkLabel +
      ' 方案：' +
      (result.variant_label || result.variant_key || '未命名'),
  )
  lines.push('')
  lines.push('- 入口文件：' + (entry || '未提供'))
  lines.push('- 依赖：' + (dependencies.length > 0 ? dependencies.join(', ') : '无额外依赖'))

  if (result.variant_note) {
    lines.push('')
    lines.push('## 方案说明')
    lines.push('')
    lines.push(result.variant_note)
  }

  if (result.preview_notes) {
    lines.push('')
    lines.push('## 预览说明')
    lines.push('')
    lines.push(result.preview_notes)
  }

  lines.push('')
  lines.push('## 使用')
  lines.push('')
  lines.push('1. 将压缩包内的文件按原路径复制到你的项目。')
  if (dependencies.length > 0) {
    lines.push('2. 按需安装依赖：' + dependencies.join(', '))
  }
  lines.push('3. 在页面中引入入口文件导出的组件。')

  if (result.framework === 'vue3' && entry) {
    lines.push('')
    lines.push('以下示例假设项目配置了 `@` → `src` 别名，请按实际路径调整：')
    lines.push('')
    lines.push('```vue')
    lines.push('<script setup lang="ts">')
    lines.push("import " + component + " from '" + entryImport + "'")
    lines.push('<' + '/script>')
    lines.push('')
    lines.push('<template>')
    lines.push('  <' + component + ' />')
    lines.push('</template>')
    lines.push('```')
  } else if (result.framework === 'react' && entry) {
    lines.push('')
    lines.push('以下示例假设项目配置了 `@` → `src` 别名，请按实际路径调整：')
    lines.push('')
    lines.push('```tsx')
    lines.push("import " + component + " from '" + entryWithoutExtension + "'")
    lines.push('')
    lines.push('export default function Page() {')
    lines.push('  return <' + component + ' />')
    lines.push('}')
    lines.push('```')
  }

  return lines.join('\n') + '\n'
}

export function downloadResultZip(result: VariantResult): void {
  const encoder = new TextEncoder()
  const seen = new Set<string>()
  const entries: ZipEntry[] = []
  const readmeName = result.files.some((file) => normalizeZipPath(file.path) === 'README.md')
    ? 'GENERATED_README.md'
    : 'README.md'

  entries.push({ name: readmeName, data: encoder.encode(buildReadme(result)) })
  seen.add(readmeName)

  for (const file of result.files) {
    const name = normalizeZipPath(file.path)
    if (!name || seen.has(name)) {
      continue
    }
    seen.add(name)
    entries.push({ name, data: encoder.encode(file.content) })
  }

  const blob = createZip(entries)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = safeFilename(result.component_name || result.variant_key || 'frontend-solution') + '.zip'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => URL.revokeObjectURL(url), 10000)
}
