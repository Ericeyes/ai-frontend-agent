"""前后端共享的数据契约（Pydantic v2）。"""

from typing import Literal

from pydantic import BaseModel, field_validator


class VariantSpec(BaseModel):
    key: str
    label: str | None = None
    hint: str | None = None


class GenerateRequest(BaseModel):
    requirement: str
    framework: Literal["vue3", "react"]
    styling: Literal["tailwind", "css", "scss"] = "tailwind"
    variants: list[VariantSpec] | None = None
    constraints: str = ""

    @field_validator("variants")
    @classmethod
    def _limit_variant_count(cls, value: list[VariantSpec] | None) -> list[VariantSpec] | None:
        if value is not None and len(value) > 12:
            raise ValueError("variants 数量不能超过 12 个")
        return value


class GeneratedFile(BaseModel):
    path: str
    language: Literal["vue", "tsx", "ts", "css", "scss", "html"]
    content: str


class VariantResult(BaseModel):
    slot: int
    ok: bool
    error: str | None = None
    variant_key: str
    variant_label: str
    variant_note: str = ""
    framework: str = ""
    component_name: str = ""
    files: list[GeneratedFile] = []
    entry_file: str = ""
    dependencies: list[str] = []
    preview_notes: str = ""


class GridResponse(BaseModel):
    request_id: str
    elapsed_ms: int
    results: list[VariantResult]
