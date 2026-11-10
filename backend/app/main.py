"""FastAPI 应用入口。"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.generate import router as generate_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)

app = FastAPI(title="AI Frontend Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate_router)


@app.get("/")
async def root() -> dict[str, object]:
    return {
        "name": "AI Frontend Agent",
        "docs": "/docs",
        "endpoints": [
            "POST /api/generate",
            "GET /api/variants",
            "GET /api/health",
        ],
    }
