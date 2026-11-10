"""并行编排：每个 variant 一个协程，Semaphore 限流，gather 汇总，单点失败不影响整体。"""

import asyncio
import json
import logging
import re
import time
import uuid
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

from app.agent.llm import get_llm
from app.agent.prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE
from app.agent.variants import DEFAULT_VARIANTS
from app.config import settings
from app.schemas import GenerateRequest, GridResponse, VariantResult, VariantSpec
from app.services.validate import validate_variant_result

logger = logging.getLogger(__name__)

_JSON_PARSER = JsonOutputParser()
_PLACEHOLDER_PATTERN = re.compile(r"\{(\w+)\}")
_MAX_ERROR_LENGTH = 500


class LLMFilePayload(BaseModel):
    path: str
    language: str = "ts"
    content: str


class LLMOutputPayload(BaseModel):
    variant: str = ""
    variant_note: str = ""
    framework: str = ""
    component_name: str = ""
    files: list[LLMFilePayload] = Field(default_factory=list)
    entry_file: str = ""
    dependencies: list[str] = Field(default_factory=list)
    preview_notes: str = ""


def render_user_prompt(spec: VariantSpec, req: GenerateRequest) -> str:
    values = {
        "requirement": req.requirement,
        "framework": req.framework,
        "styling": req.styling,
        "variant_key": spec.key,
        "variant_hint": spec.hint or spec.key,
        "constraints": req.constraints.strip() or "无",
    }

    def _replace(match: re.Match[str]) -> str:
        return values.get(match.group(1), match.group(0))

    return _PLACEHOLDER_PATTERN.sub(_replace, USER_PROMPT_TEMPLATE)


def _strip_code_fence(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        first_newline = cleaned.find("\n")
        if first_newline != -1:
            cleaned = cleaned[first_newline + 1:]
    if cleaned.rstrip().endswith("```"):
        cleaned = cleaned.rstrip()[:-3]
    return cleaned.strip()


def _parse_json_text(text: str) -> dict[str, Any]:
    cleaned = _strip_code_fence(text)
    try:
        parsed = _JSON_PARSER.parse(cleaned)
    except Exception:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end <= start:
            raise ValueError("LLM 返回内容不是合法 JSON")
        parsed = json.loads(cleaned[start:end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("LLM 返回的 JSON 顶层必须是对象")
    return parsed


def _message_text(message: Any) -> str:
    content = getattr(message, "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(str(block.get("text", "")))
        return "\n".join(parts)
    return str(content)


async def _invoke_llm(llm: BaseChatModel, spec: VariantSpec, req: GenerateRequest) -> dict[str, Any]:
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=render_user_prompt(spec, req)),
    ]

    try:
        structured_llm = llm.with_structured_output(LLMOutputPayload)
        structured = await structured_llm.ainvoke(messages)
        if isinstance(structured, LLMOutputPayload):
            return structured.model_dump()
        if isinstance(structured, dict):
            return structured
    except Exception as exc:
        logger.info(
            "structured output unavailable for variant %s, falling back to JSON text: %s",
            spec.key,
            exc,
        )

    response = await llm.ainvoke(messages)
    return _parse_json_text(_message_text(response))


def _failed_result(slot: int, spec: VariantSpec, error: str) -> VariantResult:
    message = (error or "未知错误").strip() or "未知错误"
    if len(message) > _MAX_ERROR_LENGTH:
        message = message[:_MAX_ERROR_LENGTH] + "（错误信息已截断）"
    return VariantResult(
        slot=slot,
        ok=False,
        error=message,
        variant_key=spec.key,
        variant_label=spec.label or spec.key,
    )


async def _generate_one(
    llm: BaseChatModel,
    slot: int,
    spec: VariantSpec,
    req: GenerateRequest,
    semaphore: asyncio.Semaphore,
) -> VariantResult:
    try:
        async with semaphore:
            data = await asyncio.wait_for(
                _invoke_llm(llm, spec, req),
                timeout=settings.per_variant_timeout_sec,
            )
        return validate_variant_result(
            data,
            slot=slot,
            spec=spec,
            requested_framework=req.framework,
        )
    except asyncio.TimeoutError:
        logger.warning("variant %s timed out after %ss", spec.key, settings.per_variant_timeout_sec)
        return _failed_result(
            slot,
            spec,
            f"LLM 调用超时（超过 {settings.per_variant_timeout_sec:g} 秒）",
        )
    except Exception as exc:
        logger.warning("variant %s failed: %s", spec.key, exc)
        return _failed_result(slot, spec, str(exc) or exc.__class__.__name__)


async def generate_grid(req: GenerateRequest) -> GridResponse:
    started = time.perf_counter()
    request_id = uuid.uuid4().hex[:8]

    llm = get_llm()
    specs = list(req.variants or DEFAULT_VARIANTS)
    semaphore = asyncio.Semaphore(max(1, settings.max_concurrency))

    gathered = await asyncio.gather(
        *(_generate_one(llm, slot, spec, req, semaphore) for slot, spec in enumerate(specs)),
        return_exceptions=True,
    )

    results: list[VariantResult] = []
    for slot, item in enumerate(gathered):
        if isinstance(item, BaseException):
            logger.error("variant %s raised unexpectedly: %s", specs[slot].key, item)
            results.append(_failed_result(slot, specs[slot], str(item) or item.__class__.__name__))
        else:
            results.append(item)

    results.sort(key=lambda result: result.slot)
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    return GridResponse(request_id=request_id, elapsed_ms=elapsed_ms, results=results)
