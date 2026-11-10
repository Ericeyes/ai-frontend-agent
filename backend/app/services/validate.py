"""LLM 输出契约校验：把模型返回的原始 dict 转成可信的 VariantResult。"""

from typing import Any

from app.schemas import GeneratedFile, VariantResult, VariantSpec

VALID_FRAMEWORKS = {"vue3", "react"}
VALID_LANGUAGES = {"vue", "tsx", "ts", "css", "scss", "html"}

_EXTENSION_LANGUAGE = {
    ".vue": "vue",
    ".tsx": "tsx",
    ".ts": "ts",
    ".css": "css",
    ".scss": "scss",
    ".html": "html",
}


def _normalize_language(value: Any, path: str) -> str:
    if isinstance(value, str) and value in VALID_LANGUAGES:
        return value
    lower_path = path.lower()
    for extension, language in _EXTENSION_LANGUAGE.items():
        if lower_path.endswith(extension):
            return language
    return "ts"


def validate_variant_result(
    data: dict[str, Any],
    *,
    slot: int = 0,
    spec: VariantSpec | None = None,
    requested_framework: str = "",
) -> VariantResult:
    if not isinstance(data, dict):
        raise ValueError("LLM 返回内容不是 JSON 对象")

    raw_files = data.get("files")
    if not isinstance(raw_files, list) or not raw_files:
        raise ValueError("files 为空：至少需要一个可独立渲染的组件文件")

    files: list[GeneratedFile] = []
    seen_paths: set[str] = set()
    for index, raw in enumerate(raw_files):
        if not isinstance(raw, dict):
            raise ValueError(f"files[{index}] 不是对象")
        path = raw.get("path")
        content = raw.get("content")
        if not isinstance(path, str) or not path.strip():
            raise ValueError(f"files[{index}].path 为空")
        if not isinstance(content, str) or not content.strip():
            raise ValueError(f"files[{index}].content 为空")
        normalized_path = path.strip()
        if normalized_path in seen_paths:
            continue
        seen_paths.add(normalized_path)
        files.append(
            GeneratedFile(
                path=normalized_path,
                language=_normalize_language(raw.get("language"), normalized_path),
                content=content,
            )
        )

    entry_file = data.get("entry_file")
    if not isinstance(entry_file, str) or not entry_file.strip():
        raise ValueError("entry_file 为空")
    entry_file = entry_file.strip()
    if entry_file not in seen_paths:
        raise ValueError(f"entry_file '{entry_file}' 不在 files[].path 中")

    requested = requested_framework.strip()
    llm_framework_raw = data.get("framework")
    llm_framework = llm_framework_raw.strip().lower() if isinstance(llm_framework_raw, str) else ""

    if requested in VALID_FRAMEWORKS:
        framework = requested
    elif llm_framework in VALID_FRAMEWORKS:
        framework = llm_framework
    else:
        raise ValueError("framework 缺失或非法")

    note_raw = data.get("variant_note")
    note = note_raw.strip() if isinstance(note_raw, str) else ""
    if requested in VALID_FRAMEWORKS and llm_framework != requested:
        note = f"{note} [framework corrected]".strip()

    dependencies_raw = data.get("dependencies")
    dependencies = (
        [str(item) for item in dependencies_raw if isinstance(item, (str, int, float))]
        if isinstance(dependencies_raw, list)
        else []
    )

    component_name_raw = data.get("component_name")
    component_name = component_name_raw.strip() if isinstance(component_name_raw, str) else ""

    preview_notes_raw = data.get("preview_notes")
    preview_notes = preview_notes_raw.strip() if isinstance(preview_notes_raw, str) else ""

    if spec is not None:
        variant_key = spec.key
        variant_label = spec.label or spec.key
    else:
        variant_key_raw = data.get("variant")
        variant_key = variant_key_raw.strip() if isinstance(variant_key_raw, str) else ""
        if not variant_key:
            raise ValueError("variant_key 缺失")
        variant_label = variant_key

    return VariantResult(
        slot=slot,
        ok=True,
        error=None,
        variant_key=variant_key,
        variant_label=variant_label,
        variant_note=note,
        framework=framework,
        component_name=component_name,
        files=files,
        entry_file=entry_file,
        dependencies=dependencies,
        preview_notes=preview_notes,
    )
