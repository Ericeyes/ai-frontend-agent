import type { GeneratedFile, VariantResult } from './types'

const SCRIPT_CLOSE = '</' + 'script>'

const ERROR_GUARD = String.raw`
  function showError(message) {
    var text = String(message || '未知错误');
    var box = document.createElement('div');
    box.className = 'preview-error';
    var title = document.createElement('strong');
    title.textContent = '预览渲染失败';
    var body = document.createElement('pre');
    body.textContent = text;
    box.appendChild(title);
    box.appendChild(body);
    document.body.innerHTML = '';
    document.body.appendChild(box);
  }

  window.onerror = function (message, source, lineno, colno, error) {
    showError((error && (error.stack || error.message)) || message);
    return true;
  };

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    var text = reason && (reason.stack || reason.message) ? (reason.stack || reason.message) : String(reason);
    showError(text);
  });

  function extractMockProps(notes) {
    if (!notes) return null;
    try { return JSON.parse(notes); } catch (firstError) { }
    var start = notes.indexOf('{');
    var end = notes.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try { return JSON.parse(notes.slice(start, end + 1)); } catch (secondError) { }
    }
    return null;
  }
`

const PAGE_STYLE = String.raw`
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; background: #ffffff; color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
  #preview-root { height: 100%; min-height: 100vh; box-sizing: border-box; padding: 16px; }
  img, svg, video { max-width: 100%; height: auto; }
  button, input, select, textarea { font: inherit; }
  .preview-error { margin: 16px; padding: 12px 14px; border: 1px solid #fecaca; background: #fef2f2; color: #991b1b; border-radius: 8px; font-size: 13px; }
  .preview-error strong { display: block; margin-bottom: 6px; }
  .preview-error pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.5; }
`

export type PreviewStatus = 'ready' | 'unsupported' | 'missing-entry'

export function findEntryFile(result: VariantResult): GeneratedFile | null {
  return result.files.find((file) => file.path === result.entry_file) ?? null
}

export function previewStatus(result: VariantResult): PreviewStatus {
  const entry = findEntryFile(result)
  if (!entry) {
    return 'missing-entry'
  }
  if (result.framework === 'react') {
    return entry.language === 'tsx' || entry.language === 'ts' ? 'ready' : 'unsupported'
  }
  if (result.framework === 'vue3') {
    return entry.language === 'vue' ? 'ready' : 'unsupported'
  }
  return 'unsupported'
}

export function buildPreviewDocument(result: VariantResult): string {
  if (previewStatus(result) !== 'ready') {
    return ''
  }
  return result.framework === 'react'
    ? buildReactDocument(result)
    : buildVueDocument(result)
}

export function openPreviewInNewTab(result: VariantResult): boolean {
  const html = buildPreviewDocument(result)
  if (!html) {
    return false
  }
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const opened = window.open(url, '_blank')
  if (!opened) {
    URL.revokeObjectURL(url)
    return false
  }
  try {
    opened.opener = null
  } catch {
    // 新窗口与当前页同源时不会进入此分支，忽略即可
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  return true
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function serialize(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function collectExtraCss(result: VariantResult): string {
  return result.files
    .filter((file) => file.language === 'css' || file.language === 'scss')
    .map((file) => `/* ${file.path} */\n${file.content}`)
    .join('\n\n')
}

function buildReactDocument(result: VariantResult): string {
  const runner = buildReactRunner(result)
  const title = escapeHtml(result.variant_label || result.component_name || '方案预览')
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>${PAGE_STYLE}</style>
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4">${SCRIPT_CLOSE}
<script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.development.js">${SCRIPT_CLOSE}
<script src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.development.js">${SCRIPT_CLOSE}
<script src="https://cdn.jsdelivr.net/npm/@babel/standalone/babel.min.js">${SCRIPT_CLOSE}
</head>
<body>
<div id="preview-root"></div>
<script>${ERROR_GUARD}${SCRIPT_CLOSE}
<script>${runner}${SCRIPT_CLOSE}
</body>
</html>`
}

function buildReactRunner(result: VariantResult): string {
  const hint = /^[A-Za-z_$][\w$]*$/.test(result.component_name) ? result.component_name : ''
  const modules = [
    ...result.files.filter(
      (file) => file.path !== result.entry_file && (file.language === 'tsx' || file.language === 'ts'),
    ),
    ...result.files.filter((file) => file.path === result.entry_file),
  ]
  const modulePayload = modules.map((file) => ({
    path: file.path,
    content: file.content,
    entry: file.path === result.entry_file,
  }))

  return String.raw`(function () {
  var userModules = ${serialize(modulePayload)};
  var extraCss = ${serialize(collectExtraCss(result))};
  var previewNotes = ${serialize(result.preview_notes)};
  var hintName = ${serialize(hint)};

  function makeStubValue() {
    var stub = new Proxy(function () { return null; }, {
      get: function (target, prop) {
        if (prop === Symbol.toPrimitive) return function () { return ''; };
        if (typeof prop === 'symbol') return undefined;
        if (prop === 'prototype' || prop === 'length' || prop === 'name') return target[prop];
        if (prop === 'then' || prop === 'constructor' || prop === '$$typeof') return undefined;
        return stub;
      },
      apply: function () { return null; }
    });
    return stub;
  }

  function addClauseNames(clause, names, seen) {
    var text = clause.trim();
    if (!text) return;
    function add(name) {
      var trimmed = (name || '').trim().replace(/^type\s+/, '');
      if (!/^[A-Za-z_$][\w$]*$/.test(trimmed) || seen[trimmed]) return;
      seen[trimmed] = true;
      names.push(trimmed);
    }
    var braceMatch = text.match(/\{([\s\S]*?)\}/);
    if (braceMatch) {
      var items = braceMatch[1].split(',');
      for (var i = 0; i < items.length; i += 1) {
        var parts = items[i].split(/\s+as\s+/);
        add(parts[parts.length - 1]);
      }
    }
    var defaultMatch = text.match(/^([A-Za-z_$][\w$]*)\s*(?:,|$)/);
    if (defaultMatch) add(defaultMatch[1]);
    var namespaceMatch = text.match(/\*\s*as\s+([A-Za-z_$][\w$]*)/);
    if (namespaceMatch) add(namespaceMatch[1]);
  }

  function collectStubNames(modules) {
    var names = [];
    var seen = {};
    var importPattern = /^[ \t]*import\s+(?:type\s+)?([\s\S]*?)\bfrom\s*['"]([^'"]+)['"][ \t]*;?/gm;
    for (var m = 0; m < modules.length; m += 1) {
      var source = modules[m].content;
      var match = importPattern.exec(source);
      while (match !== null) {
        var spec = match[2];
        var isLocal = spec.charAt(0) === '.' || spec.charAt(0) === '/';
        var isKnown = spec === 'react'
          || spec === 'react-dom'
          || spec === 'react-dom/client'
          || spec === 'react/jsx-runtime'
          || spec === 'react/jsx-dev-runtime'
          || spec === 'vue';
        if (!isLocal && !isKnown) {
          addClauseNames(match[1], names, seen);
        }
        match = importPattern.exec(source);
      }
      importPattern.lastIndex = 0;
    }
    return names;
  }

  function collectDeclaredNames(source) {
    var declared = {};
    var pattern = /^[ \t]*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s*\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
    var match = pattern.exec(source);
    while (match !== null) {
      declared[match[1]] = true;
      match = pattern.exec(source);
    }
    return declared;
  }

  function prepareSource(source, isEntry) {
    var defaultTarget = isEntry ? '__default_export' : '__aux_export';
    var prepared = source;
    prepared = prepared.replace(/^[ \t]*import\s+(?:type\s+)?\{[\s\S]*?\}\s*from\s*['"][^'"]+['"][ \t]*;?/gm, '');
    prepared = prepared.replace(/^[ \t]*import\s+[A-Za-z_$][\w$]*\s*,\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"][ \t]*;?/gm, '');
    prepared = prepared.replace(/^[ \t]*import\s+(?:type\s+)?[^'"\n]*?\bfrom\s*['"][^'"]+['"][ \t]*;?[ \t]*$/gm, '');
    prepared = prepared.replace(/^[ \t]*import\s*['"][^'"]+['"][ \t]*;?[ \t]*$/gm, '');
    prepared = prepared.replace(/\bexport\s+default\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g, 'function $1');
    prepared = prepared.replace(/\bexport\s+default\s+class\s+([A-Za-z_$][\w$]*)/g, 'class $1');
    prepared = prepared.replace(/\bexport\s+default\s+/g, 'var ' + defaultTarget + ' = ');
    prepared = prepared.replace(/\bexport\s+(const|let|var|function|class|interface|type|enum)\s+/g, '$1 ');
    prepared = prepared.replace(/\bexport\s+(?:type\s+)?\{[^}]*\}\s*;?/g, '');
    prepared = prepared.replace(/\bexport\s+\*\s+from\s*['"][^'"]+['"]\s*;?/g, '');
    return prepared;
  }

  function collectCandidates(source) {
    var names = [];
    var pattern = /(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g;
    var match = pattern.exec(source);
    while (match !== null) {
      if (/^[A-Z]/.test(match[1])) {
        names.push(match[1]);
      }
      match = pattern.exec(source);
    }
    return names;
  }

  function isRenderable(value) {
    if (typeof value === 'function') return true;
    if (typeof value === 'object' && value !== null) {
      return Boolean(value.$$typeof || value.render);
    }
    return false;
  }

  if (!window.React || !window.ReactDOM) {
    showError('预览依赖加载失败：无法加载 React / ReactDOM，请确认网络可访问 cdn.jsdelivr.net。');
    return;
  }
  if (typeof Babel === 'undefined') {
    showError('预览依赖加载失败：无法加载 @babel/standalone，请确认网络可访问 cdn.jsdelivr.net。');
    return;
  }

  var React = window.React;
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useLayoutEffect = React.useLayoutEffect;
  var useInsertionEffect = React.useInsertionEffect;
  var useMemo = React.useMemo;
  var useCallback = React.useCallback;
  var useRef = React.useRef;
  var useReducer = React.useReducer;
  var useContext = React.useContext;
  var useImperativeHandle = React.useImperativeHandle;
  var useDebugValue = React.useDebugValue;
  var useId = React.useId;
  var useTransition = React.useTransition;
  var useDeferredValue = React.useDeferredValue;
  var useSyncExternalStore = React.useSyncExternalStore;
  var createContext = React.createContext;
  var createElement = React.createElement;
  var cloneElement = React.cloneElement;
  var createRef = React.createRef;
  var isValidElement = React.isValidElement;
  var Children = React.Children;
  var Component = React.Component;
  var PureComponent = React.PureComponent;
  var Fragment = React.Fragment;
  var StrictMode = React.StrictMode;
  var Suspense = React.Suspense;
  var lazy = React.lazy;
  var memo = React.memo;
  var forwardRef = React.forwardRef;
  var createPortal = window.ReactDOM.createPortal;
  var mockProps = extractMockProps(previewNotes);
  var component = null;

  if (extraCss) {
    var extraStyle = document.createElement('style');
    extraStyle.textContent = extraCss;
    document.head.appendChild(extraStyle);
  }

  class PreviewErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
      return { error: error };
    }
    componentDidCatch(error) {
      showError((error && (error.stack || error.message)) || String(error));
    }
    render() {
      if (this.state.error) {
        return null;
      }
      return this.props.children;
    }
  }

  try {
    var preparedParts = [];
    var entryPrepared = '';
    for (var m = 0; m < userModules.length; m += 1) {
      var part = prepareSource(userModules[m].content, userModules[m].entry);
      if (userModules[m].entry) {
        entryPrepared = part;
      }
      preparedParts.push('// ---- ' + userModules[m].path + ' ----\n' + part);
    }
    var joinedParts = preparedParts.join('\n\n');
    var declaredNames = collectDeclaredNames(joinedParts);
    var rawStubNames = collectStubNames(userModules);
    var stubNames = [];
    for (var nIdx = 0; nIdx < rawStubNames.length; nIdx += 1) {
      if (!declaredNames[rawStubNames[nIdx]]) {
        stubNames.push(rawStubNames[nIdx]);
      }
    }
    var stubSource = '';
    for (var sIdx = 0; sIdx < stubNames.length; sIdx += 1) {
      stubSource += 'var ' + stubNames[sIdx] + ' = makeStubValue();\n';
    }
    var prepared = stubSource + joinedParts;
    var compiled = Babel.transform(prepared, {
      presets: [['react', { runtime: 'classic' }], 'typescript'],
      filename: 'Component.tsx',
      sourceType: 'module',
    }).code;
    var candidates = collectCandidates(entryPrepared || prepared);
    var expression = 'component = (typeof __default_export !== "undefined" ? __default_export : null)';
    if (hintName) {
      expression += ' || (typeof ' + hintName + ' !== "undefined" ? ' + hintName + ' : null)';
    }
    for (var i = 0; i < candidates.length; i += 1) {
      expression += ' || (typeof ' + candidates[i] + ' !== "undefined" && isRenderable(' + candidates[i] + ') ? ' + candidates[i] + ' : null)';
    }
    eval(compiled + '\n; ' + expression + ';');
  } catch (error) {
    showError((error && (error.stack || error.message)) || String(error));
  }

  if (!component) {
    if (document.body.querySelector('.preview-error') === null) {
      showError('未找到可渲染的 React 组件：请确认入口文件提供了 named export 或 default export。');
    }
    return;
  }

  try {
    var root = ReactDOM.createRoot(document.getElementById('preview-root'));
    root.render(React.createElement(PreviewErrorBoundary, null, React.createElement(component, mockProps || {})));
  } catch (error) {
    showError((error && (error.stack || error.message)) || String(error));
  }
})();`
}

function buildVueDocument(result: VariantResult): string {
  const filesMap: Record<string, { content: string; language: string }> = {}
  for (const file of result.files) {
    filesMap[file.path] = { content: file.content, language: file.language }
  }
  const runner = buildVueRunner(
    serialize(filesMap),
    serialize(result.entry_file),
    serialize(result.preview_notes),
    serialize(collectExtraCss(result)),
  )
  const title = escapeHtml(result.variant_label || result.component_name || '方案预览')
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>${PAGE_STYLE}</style>
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4">${SCRIPT_CLOSE}
<script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.js">${SCRIPT_CLOSE}
<script src="https://cdn.jsdelivr.net/npm/vue3-sfc-loader/dist/vue3-sfc-loader.js">${SCRIPT_CLOSE}
<script src="https://cdn.jsdelivr.net/npm/@babel/standalone/babel.min.js">${SCRIPT_CLOSE}
</head>
<body>
<div id="preview-root"></div>
<script>${ERROR_GUARD}${SCRIPT_CLOSE}
<script>${runner}${SCRIPT_CLOSE}
</body>
</html>`
}

function buildVueRunner(filesJson: string, entryJson: string, notesJson: string, cssJson: string): string {
  return String.raw`(function () {
  var filesMap = ${filesJson};
  var entryPath = ${entryJson};
  var previewNotes = ${notesJson};
  var extraCss = ${cssJson};
  var SCRIPT_END = '</' + 'script>';

  if (extraCss) {
    var extraStyle = document.createElement('style');
    extraStyle.textContent = extraCss;
    document.head.appendChild(extraStyle);
  }

  function imageDataUrl() {
    return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22/%3E';
  }

  function stubUnknownImports(body) {
    var stubNames = [];
    var imageNames = [];
    var seen = {};
    function add(list, name) {
      var trimmed = (name || '').trim();
      if (!/^[A-Za-z_$][\w$]*$/.test(trimmed) || seen[trimmed]) return;
      seen[trimmed] = true;
      list.push(trimmed);
    }
    var cleaned = body.replace(/^[ \t]*import\s+(?:type\s+)?([\s\S]*?)\bfrom\s*['"]([^'"]+)['"][ \t]*;?/gm, function (statement, clause, spec) {
      if (/\.(css|scss|sass|less)(\?.*)?$/i.test(spec)) {
        return '';
      }
      var isImage = /\.(svg|png|jpe?g|gif|webp)(\?.*)?$/i.test(spec);
      if (!isImage && (spec === 'vue' || spec.charAt(0) === '.' || spec.charAt(0) === '/')) {
        return statement;
      }
      var target = isImage ? imageNames : stubNames;
      var braceMatch = clause.match(/\{([\s\S]*?)\}/);
      if (braceMatch) {
        var items = braceMatch[1].split(',');
        for (var i = 0; i < items.length; i += 1) {
          var item = items[i].trim().replace(/^type\s+/, '');
          var parts = item.split(/\s+as\s+/);
          add(target, parts[parts.length - 1]);
        }
      }
      var defaultMatch = clause.match(/^([A-Za-z_$][\w$]*)\s*(?:,|$)/);
      if (defaultMatch) add(target, defaultMatch[1]);
      var namespaceMatch = clause.match(/\*\s*as\s+([A-Za-z_$][\w$]*)/);
      if (namespaceMatch) add(target, namespaceMatch[1]);
      return '';
    });
    cleaned = cleaned.replace(/^[ \t]*import\s*['"]([^'"]+)['"][ \t]*;?[ \t]*$/gm, function (statement, spec) {
      if (/\.(css|scss|sass|less|svg|png|jpe?g|gif|webp)(\?.*)?$/i.test(spec)) {
        return '';
      }
      if (spec.charAt(0) !== '.' && spec.charAt(0) !== '/' && spec !== 'vue') {
        return '';
      }
      return statement;
    });
    if (stubNames.length === 0 && imageNames.length === 0) return cleaned;
    var declarations = [];
    for (var s = 0; s < stubNames.length; s += 1) {
      declarations.push('const ' + stubNames[s] + ' = window.__previewStub();');
    }
    for (var im = 0; im < imageNames.length; im += 1) {
      declarations.push('const ' + imageNames[im] + ' = ' + JSON.stringify(imageDataUrl()) + ';');
    }
    return declarations.join('\n') + '\n' + cleaned;
  }

  var TS_MARKER = /\bas\s+(?:const\s|[A-Za-z_$])|\bsatisfies\s|:\s*[A-Za-z_$][\w$]*(?:<[^<>]*>)?(?:\[\])*\s*(?:[,)=]|=>)|![.)\],]/;

  function stripTemplateExpression(expression, quote) {
    if (!expression || !TS_MARKER.test(expression)) return expression;
    if (typeof Babel === 'undefined') return expression;
    try {
      var code = Babel.transform('(' + expression + ')', {
        presets: ['typescript'],
        filename: 'preview-expression.ts',
        sourceType: 'module',
      }).code.trim().replace(/;$/, '').trim();
      if (!code) return expression;
      if (quote === '"') code = code.replace(/"/g, '&quot;');
      if (quote === "'") code = code.replace(/'/g, '&#39;');
      return code;
    } catch (error) {
      return expression;
    }
  }

  function transformTemplateExpressions(template) {
    var result = template.replace(/(\s(?:[:@#][^\s=\/>]+|v-[^\s=\/>]+))=(["'])([\s\S]*?)\2/g, function (statement, name, quote, value) {
      if (/^(?:v-slot|#)/i.test(name.trim())) return statement;
      return name + '=' + quote + stripTemplateExpression(value, quote) + quote;
    });
    return result.replace(/\{\{([\s\S]*?)\}\}/g, function (statement, expression) {
      return '{{' + stripTemplateExpression(expression, '') + '}}';
    });
  }

  function transformSfcTemplate(source) {
    var lower = source.toLowerCase();
    var cursor = 0;
    while (cursor < source.length) {
      var match = /<\/?(script|style|template)\b/gi;
      match.lastIndex = cursor;
      var found = match.exec(source);
      if (!found) return source;
      var tagName = found[1].toLowerCase();
      var tagStart = found.index;
      if (tagName === 'script' || tagName === 'style') {
        var closeIndex = lower.indexOf('</' + tagName, tagStart);
        if (closeIndex === -1) return source;
        var closeEnd = source.indexOf('>', closeIndex);
        if (closeEnd === -1) return source;
        cursor = closeEnd + 1;
        continue;
      }
      if (found[0].charAt(1) === '/') { cursor = tagStart + 8; continue; }
      var openEnd = source.indexOf('>', tagStart);
      if (openEnd === -1) return source;
      var depth = 1;
      var scan = openEnd + 1;
      var closeStart = -1;
      while (depth > 0) {
        var nextOpen = lower.indexOf('<template', scan);
        var nextClose = lower.indexOf('</template', scan);
        if (nextClose === -1) return source;
        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth += 1;
          scan = nextOpen + 9;
        } else {
          depth -= 1;
          closeStart = nextClose;
          scan = nextClose + 10;
        }
      }
      var closeEndPos = source.indexOf('>', closeStart);
      if (closeEndPos === -1) return source;
      var inner = source.slice(openEnd + 1, closeStart);
      var transformed = transformTemplateExpressions(inner);
      return source.slice(0, openEnd + 1) + transformed + source.slice(closeStart);
    }
    return source;
  }

  function sanitizeSfc(source) {
    var result = source.replace(/(<style\b[^>]*?)\s+lang=(['"])(?:scss|sass|less|stylus)\2/gi, '$1');
    result = result.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, function (match, openTag, css, closeTag) {
      return openTag + css.replace(/^[ \t]*\/\/[^\n]*$/gm, '') + closeTag;
    });
    result = transformSfcTemplate(result);
    var searchFrom = 0;
    while (true) {
      var lower = result.toLowerCase();
      var openIndex = lower.indexOf('<script', searchFrom);
      if (openIndex === -1) return result;
      var openEnd = result.indexOf('>', openIndex);
      if (openEnd === -1) return result;
      var tag = result.slice(openIndex, openEnd + 1);
      if (!/\blang\s*=/.test(tag)) {
        var newTag = tag.replace(/>$/, ' lang="ts">');
        result = result.slice(0, openIndex) + newTag + result.slice(openEnd + 1);
        tag = newTag;
        openEnd = openIndex + newTag.length - 1;
      }
      var bodyStart = openEnd + 1;
      var closeIndex = result.indexOf(SCRIPT_END, bodyStart);
      if (closeIndex === -1) return result;
      var body = result.slice(bodyStart, closeIndex);
      var cleaned = body;
      if (/\bsetup\b/i.test(tag)) {
        cleaned = cleaned
          .replace(/^[ \t]*export\s+default\s+/gm, '')
          .replace(/^[ \t]*export\s+(?:type\s+)?\{[^}]*\}\s*;?[ \t]*$/gm, '')
          .replace(/^[ \t]*export\s+(?=(?:async\s+)?(?:interface|type|function|class|const|let|var|enum)\b)/gm, '');
      }
      cleaned = stubUnknownImports(cleaned);
      result = result.slice(0, bodyStart) + cleaned + result.slice(closeIndex);
      searchFrom = bodyStart + cleaned.length + SCRIPT_END.length;
    }
  }

  function dirname(path) {
    var index = path.lastIndexOf('/');
    return index === -1 ? '' : path.slice(0, index);
  }

  function normalizePath(path) {
    var parts = path.split('/');
    var stack = [];
    for (var i = 0; i < parts.length; i += 1) {
      var part = parts[i];
      if (!part || part === '.') continue;
      if (part === '..') { stack.pop(); continue; }
      stack.push(part);
    }
    return stack.join('/');
  }

  function resolvePath(fromPath, request) {
    if (request.charAt(0) === '.') {
      return normalizePath(dirname(fromPath) + '/' + request);
    }
    return normalizePath(request);
  }

  function findFile(path) {
    if (path && filesMap[path]) return filesMap[path];
    var normalized = path ? normalizePath(path) : '';
    if (normalized && filesMap[normalized]) return filesMap[normalized];
    var keys = Object.keys(filesMap);
    var candidates = [normalized];
    if (normalized && !/\.[A-Za-z0-9]+$/.test(normalized)) {
      var extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.json'];
      for (var e = 0; e < extensions.length; e += 1) {
        candidates.push(normalized + extensions[e]);
      }
    }
    for (var c = 0; c < candidates.length; c += 1) {
      var candidate = candidates[c];
      if (candidate && filesMap[candidate]) return filesMap[candidate];
      for (var i = 0; i < keys.length; i += 1) {
        if (candidate && keys[i].slice(-(candidate.length + 1)) === '/' + candidate) {
          return filesMap[keys[i]];
        }
      }
    }
    var basename = normalized.split('/').pop();
    var matches = keys.filter(function (key) { return key.split('/').pop() === basename; });
    if (matches.length === 1) return filesMap[matches[0]];
    return null;
  }

  function resolveFileKey(request, fromPath) {
    var queryIndex = request.indexOf('?');
    if (queryIndex !== -1) {
      request = request.slice(0, queryIndex);
    }
    var target;
    if (request.indexOf('@/') === 0) {
      target = request.slice(2);
    } else if (request.indexOf('~/') === 0) {
      target = request.slice(2);
    } else if (request.charAt(0) === '.') {
      target = normalizePath((fromPath ? fromPath + '/' : '') + request);
    } else {
      target = normalizePath(request);
    }
    if (filesMap[target]) return target;
    var extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.json'];
    for (var e = 0; e < extensions.length; e += 1) {
      if (filesMap[target + extensions[e]]) return target + extensions[e];
    }
    var indexNames = ['/index.ts', '/index.js', '/index.vue', '/index.tsx', '/index.jsx'];
    for (var i = 0; i < indexNames.length; i += 1) {
      if (filesMap[target + indexNames[i]]) return target + indexNames[i];
    }
    var keys = Object.keys(filesMap);
    for (var e2 = 0; e2 < extensions.length; e2 += 1) {
      var suffix = target + extensions[e2];
      for (var k = 0; k < keys.length; k += 1) {
        if (keys[k].slice(-(suffix.length + 1)) === '/' + suffix) return keys[k];
      }
    }
    var basename = target.split('/').pop();
    var matches = keys.filter(function (key) { return key.split('/').pop() === basename; });
    if (matches.length === 1) return matches[0];
    return target;
  }

  function pathResolve(state, context) {
    var request = String(state && state.relPath !== undefined ? state.relPath : '');
    var refPath = state ? state.refPath : undefined;
    var base = '';
    if (refPath !== undefined && refPath !== null) {
      var refName = String(refPath);
      if (context && typeof context.getPathname === 'function') {
        refName = String(context.getPathname(refName));
      }
      base = dirname(refName);
    }
    return resolveFileKey(request, base);
  }

  function prepareModuleContent(content, url, language) {
    var languageValue = language || '';
    var mayContainTs = /\.(ts|tsx|js|jsx)$/i.test(url) || languageValue === 'ts' || languageValue === 'tsx';
    var prepared = content;
    if (typeof Babel !== 'undefined' && mayContainTs) {
      try {
        prepared = Babel.transform(content, {
          presets: ['typescript'],
          filename: 'preview-module.ts',
          sourceType: 'module',
        }).code;
      } catch (error) {
        prepared = content;
      }
    }
    return stubUnknownImports(prepared);
  }

  function makeStub() {
    var stub = new Proxy(function () { return null; }, {
      get: function (target, prop) {
        if (prop === Symbol.toPrimitive) return function () { return ''; };
        if (typeof prop === 'symbol') return undefined;
        if (prop === 'prototype' || prop === 'length' || prop === 'name') return target[prop];
        if (prop === 'then' || prop === 'constructor' || prop === '$$typeof') return undefined;
        return stub;
      },
      apply: function () { return null; }
    });
    return stub;
  }

  window.__previewStub = makeStub;

  if (!window.Vue) {
    showError('预览依赖加载失败：无法加载 Vue，请确认网络可访问 cdn.jsdelivr.net。');
    return;
  }

  var loader = window['vue3-sfc-loader'] || window.Vue3SfcLoader;
  if (!loader || typeof loader.loadModule !== 'function') {
    showError('预览依赖 vue3-sfc-loader 加载失败，请检查网络。');
    return;
  }

  var options = {
    moduleCache: { vue: window.Vue },
    pathResolve: pathResolve,
    getFile: function (url) {
      var lookup = String(url || '');
      var queryIndex = lookup.indexOf('?');
      if (queryIndex !== -1) {
        lookup = lookup.slice(0, queryIndex);
      }
      if (/\.(css|scss|sass|less)$/i.test(lookup)) {
        return Promise.resolve('');
      }
      if (/\.(svg|png|jpe?g|gif|webp)$/i.test(lookup)) {
        return Promise.resolve('export default ' + JSON.stringify(imageDataUrl()));
      }
      var file = findFile(lookup) || findFile(resolvePath(entryPath, lookup)) || findFile(url);
      if (!file) {
        if (/\.vue$/i.test(lookup)) {
          return Promise.resolve('<template><div></div></template>');
        }
        return Promise.reject(new Error('预览无法解析文件：' + url));
      }
      var content = file.content;
      if (file.language === 'vue' || /\.vue$/i.test(lookup)) {
        content = sanitizeSfc(content);
      } else {
        content = prepareModuleContent(content, lookup, file.language);
      }
      return Promise.resolve(content);
    },
    addStyle: function (textContent) {
      var style = document.createElement('style');
      style.textContent = textContent;
      document.head.appendChild(style);
    },
    log: function () { }
  };

  loader.loadModule(entryPath, options).then(function (module) {
    var component = module && (module.default || module);
    if (!component) {
      throw new Error('入口 SFC 没有可用的默认导出');
    }
    var app = window.Vue.createApp(component, extractMockProps(previewNotes) || {});
    app.mount('#preview-root');
  }).catch(function (error) {
    showError((error && (error.stack || error.message)) || String(error));
  });
})();`
}
