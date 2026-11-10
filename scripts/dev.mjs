#!/usr/bin/env node
/**
 * 一条命令同时启动 FastAPI 后端与 Vite 前端。
 *
 * 用法（在项目根目录执行）：
 *   npm run dev
 *   node scripts/dev.mjs
 *
 * 仅使用 Node.js 内置模块，不引入额外依赖。
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const isWindows = process.platform === 'win32'
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(scriptDir, '..')
const backendDir = path.join(rootDir, 'backend')
const frontendDir = path.join(rootDir, 'frontend')

const children = []
let shuttingDown = false

function fail(message) {
  process.stdout.write(`\n[dev] ${message}\n\n`)
  process.exit(1)
}

function resolvePython() {
  const candidates = isWindows
    ? [
        path.join(backendDir, '.venv', 'Scripts', 'python.exe'),
        path.join(backendDir, 'venv', 'Scripts', 'python.exe'),
      ]
    : [
        path.join(backendDir, '.venv', 'bin', 'python'),
        path.join(backendDir, 'venv', 'bin', 'python'),
      ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return isWindows ? 'python' : 'python3'
}

function canRun(command, args, options) {
  const result = spawnSync(command, args, { ...options, stdio: 'ignore' })
  return !result.error && result.status === 0
}

function writePrefixed(stream, prefix, target) {
  let buffer = ''
  stream.setEncoding('utf8')
  stream.on('data', (chunk) => {
    buffer += chunk
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      target.write(`${prefix} ${line}\n`)
    }
  })
  stream.on('end', () => {
    if (buffer) {
      target.write(`${prefix} ${buffer}\n`)
      buffer = ''
    }
  })
}

function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return
  }
  if (isWindows) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    return
  }
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    try {
      child.kill('SIGTERM')
    } catch {
      // 进程已经退出时忽略
    }
  }
}

function shutdown(exitCode) {
  if (shuttingDown) {
    return
  }
  shuttingDown = true
  for (const child of children) {
    stopChild(child)
  }
  setTimeout(() => process.exit(exitCode), 600)
}

function startService(name, command, args, options) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: options.shell === true,
    detached: !isWindows,
    windowsHide: true,
  })
  children.push(child)

  const prefix = `[${name}]`
  writePrefixed(child.stdout, prefix, process.stdout)
  writePrefixed(child.stderr, prefix, process.stderr)

  child.on('error', (error) => {
    process.stderr.write(`[dev] ${name} 启动失败：${error.message}\n`)
    shutdown(1)
  })

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return
    }
    const interrupted =
      signal === 'SIGINT' || signal === 'SIGTERM' || code === 130 || code === 0xC000013A
    process.stdout.write(
      `[dev] ${name} 已退出（code=${code ?? 'null'}，signal=${signal ?? 'null'}），正在停止另一个服务。\n`,
    )
    shutdown(interrupted ? 0 : (code ?? 1))
  })

  return child
}

if (!existsSync(backendDir)) {
  fail(`未找到 backend 目录：${backendDir}`)
}
if (!existsSync(frontendDir)) {
  fail(`未找到 frontend 目录：${frontendDir}`)
}
if (!existsSync(path.join(frontendDir, 'node_modules'))) {
  fail('未找到 frontend/node_modules，请先执行：\n  cd frontend\n  npm install')
}

const python = resolvePython()
if (!canRun(python, ['-c', 'import fastapi, uvicorn'], { cwd: backendDir })) {
  fail(
    `无法使用 ${python} 导入 fastapi/uvicorn，请先准备后端环境：\n` +
      '  cd backend\n' +
      (isWindows
        ? '  python -m venv .venv\n  .venv\\Scripts\\activate\n'
        : '  python3 -m venv .venv\n  source .venv/bin/activate\n') +
      '  pip install -r requirements.txt',
  )
}

const npmCommand = isWindows ? 'npm.cmd' : 'npm'
if (!canRun(npmCommand, ['--version'], { shell: isWindows })) {
  fail('未找到 npm，请安装 Node.js 18+ 并确认 npm 在 PATH 中。')
}

if (!existsSync(path.join(backendDir, '.env'))) {
  process.stdout.write(
    '[dev] 提示：未找到 backend/.env。后端仍会启动，但 /api/generate 会返回 503。\n' +
      '[dev] 如需真实生成，请把 backend/.env.example 复制为 backend/.env 并填入 LLM Key。\n\n',
  )
}

process.stdout.write(
  '== AI Frontend Agent 开发模式 ==\n' +
    '  后端  http://127.0.0.1:8000  （FastAPI + uvicorn --reload）\n' +
    '  前端  http://localhost:5173  （Vite dev server）\n' +
    '  按 Ctrl+C 同时停止两个服务。\n\n',
)

startService(
  'backend',
  python,
  ['-m', 'uvicorn', 'app.main:app', '--reload', '--host', '127.0.0.1', '--port', '8000'],
  {
    cwd: backendDir,
    env: { PYTHONUNBUFFERED: '1' },
  },
)

startService(
  'frontend',
  npmCommand,
  ['run', 'dev', '--', '--host', 'localhost', '--port', '5173', '--strictPort'],
  {
    cwd: frontendDir,
    shell: isWindows,
  },
)

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    process.stdout.write('\n[dev] 收到退出信号，正在停止前后端服务。\n')
    shutdown(0)
  })
}
