"""HTTP 路由：生成、内置方向元信息、健康检查。"""

import logging
import time
import uuid

from fastapi import APIRouter, HTTPException

from app.agent.orchestrator import generate_grid
from app.agent.variants import DEFAULT_VARIANTS
from app.config import settings
from app.schemas import GenerateRequest, GridResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["generate"])


def _llm_configured() -> bool:
    provider = (settings.llm_provider or "").strip().lower()
    if provider == "openai":
        return bool(settings.openai_api_key.strip())
    if provider == "anthropic":
        return bool(settings.anthropic_api_key.strip())
    if provider == "deepseek":
        return bool(settings.deepseek_api_key.strip())
    return False


@router.post("/generate", response_model=GridResponse)
async def generate(req: GenerateRequest) -> GridResponse:
    request_id = uuid.uuid4().hex[:8]
    started = time.perf_counter()

    try:
        response = await generate_grid(req)
    except RuntimeError as exc:
        message = str(exc)
        if "LLM_API_KEY_MISSING" in message or "LLM_PROVIDER_UNSUPPORTED" in message:
            logger.warning("LLM is not configured: %s", message)
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "LLM_NOT_CONFIGURED",
                    "provider": settings.llm_provider,
                    "message": (
                        f"LLM 未配置（{message}）。请在 backend/.env 中设置 LLM_PROVIDER "
                        "对应的 API Key 后重启服务。"
                    ),
                },
            ) from exc
        raise

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    logger.info(
        "generate request %s finished in %dms with %d results",
        request_id,
        elapsed_ms,
        len(response.results),
    )
    return response.model_copy(update={"request_id": request_id, "elapsed_ms": elapsed_ms})


@router.get("/variants")
async def list_variants() -> dict[str, list[dict[str, str]]]:
    return {
        "variants": [
            {"key": variant.key, "label": variant.label or variant.key, "hint": variant.hint or ""}
            for variant in DEFAULT_VARIANTS
        ]
    }


@router.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True, "llm_configured": _llm_configured()}
