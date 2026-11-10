"""LLM 工厂：所有 provider SDK 的导入集中在这里，其他模块只依赖 get_llm()。"""

import logging

from langchain_core.language_models.chat_models import BaseChatModel

from app.config import settings

logger = logging.getLogger(__name__)


def _require_key(provider: str, value: str) -> str:
    if not value or not value.strip():
        raise RuntimeError(f"LLM_API_KEY_MISSING: {provider}")
    return value.strip()


def get_llm() -> BaseChatModel:
    provider = (settings.llm_provider or "").strip().lower()
    logger.info("Creating chat model: provider=%s model=%s", provider, settings.llm_model)

    if provider == "openai":
        api_key = _require_key(provider, settings.openai_api_key)
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(model=settings.llm_model, api_key=api_key, temperature=0.7)

    if provider == "anthropic":
        api_key = _require_key(provider, settings.anthropic_api_key)
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(model=settings.llm_model, api_key=api_key, temperature=0.7)

    if provider == "deepseek":
        api_key = _require_key(provider, settings.deepseek_api_key)
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=settings.llm_model,
            api_key=api_key,
            base_url=settings.deepseek_base_url,
            temperature=0.7,
        )

    raise RuntimeError(f"LLM_PROVIDER_UNSUPPORTED: {provider}")
