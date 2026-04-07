"""
Applikationens entrypoint för beräkningsmotorn.

Den här filen startar FastAPI-applikationen och exponerar HTTP-endpoints
som frontend kan anropa. Den ansvarar för att:

- läsa in miljövariabler
- skapa Supabase-klienten
- ta emot request-data från frontend
- anropa TrappstegService
- returnera beräkningsresultatet som JSON

Den innehåller ingen affärslogik för själva beräkningen, utan fungerar
som ett API-lager mellan frontend och beräkningsmotorn.
"""

from __future__ import annotations

import os
import traceback
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from supabase import Client, create_client

from app.trappsteg_engine import ProfitabilityInput
from app.trappsteg_service import TrappstegService


BASE_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BASE_DIR / "web" / ".env.local"

load_dotenv(dotenv_path=ENV_PATH)

app = FastAPI(
    title="Lönsamhetsmotor",
    version="0.1.0",
)


def get_supabase_client() -> Client:
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        raise RuntimeError(
            f"SUPABASE_URL och SUPABASE_SERVICE_KEY måste finnas i environment. "
            f"Försökte läsa från: {ENV_PATH}"
        )

    return create_client(supabase_url, supabase_key)


class ProfitabilityRequest(BaseModel):
    kundnamn: str = Field(..., min_length=1)
    start: str = Field(..., min_length=1)
    slut: str = Field(..., min_length=1)
    chargeable_weight: float = Field(..., gt=0)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/profitability/steps-1-3")
def calculate_profitability_steps_1_to_3(payload: ProfitabilityRequest):
    try:
        supabase = get_supabase_client()
        service = TrappstegService(supabase)

        result = service.calculate(
            ProfitabilityInput(
                kundnamn=payload.kundnamn,
                start=payload.start,
                slut=payload.slut,
                chargeable_weight=payload.chargeable_weight,
            )
        )

        return {
            "success": True,
            "value": {
                "step_used": result.step_used,
                "taxeprel": result.taxeprel,
                "vklfgrv": result.vklfgrv,
                "estimated_revenue": result.estimated_revenue,
                "explanation": result.explanation,
            },
        }

    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Oväntat fel i beräkningsmotorn: {str(exc)}",
        ) from exc