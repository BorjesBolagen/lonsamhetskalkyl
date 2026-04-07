"""
Innehåller den centrala beräkningslogiken för trappstegsmotorn.

Den här filen definierar:
- dataklasser för in- och utdata
- hjälpmetoder för normalisering
- logik för att:
  - bygga taxeprel från start/slut
  - beräkna viktklass (vklfgrv)
  - välja rätt km-bucket för MedelSE
  - beräkna steg 1, steg 2 och steg 3

Filen ska endast innehålla ren affärslogik och inga direkta databas-anrop.
Den används av service-lagret efter att nödvändig data har hämtats från repository.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List


@dataclass(frozen=True)
class TrappstegRow:
    kundnamn: str
    taxeprel: str
    vklfgrv: int
    kndntofgrv: float
    forh_se_radvis: float
    forh_se_kundvis: float
    km: float


@dataclass(frozen=True)
class MedelseRow:
    km_bucket: float
    vklfgrv: int
    kndnto_medelse: float


@dataclass(frozen=True)
class ProfitabilityInput:
    kundnamn: str
    start: str
    slut: str
    chargeable_weight: float


@dataclass(frozen=True)
class StepResult:
    step_used: int
    taxeprel: str
    vklfgrv: int
    estimated_revenue: float
    explanation: str


class TrappstegEngine:
    @staticmethod
    def normalize_text(value: str) -> str:
        return " ".join(value.strip().upper().split())

    @staticmethod
    def normalize_code(value: str) -> str:
        return "".join(ch for ch in value.strip() if ch.isdigit())

    @staticmethod
    def build_taxeprel(start: str, slut: str) -> str:
        return f"{start}-{slut}"

    @staticmethod
    def average(values: List[float]) -> float:
        if not values:
            raise ValueError("Kan inte ta medelvärde av tom lista.")
        return sum(values) / len(values)

    @staticmethod
    def get_vklfgrv(weight: float) -> int:
        thresholds = [
            (1, 1),
            (10, 2),
            (20, 3),
            (30, 4),
            (40, 5),
            (60, 6),
            (80, 7),
            (100, 8),
            (150, 9),
            (200, 10),
            (250, 11),
            (300, 12),
            (350, 13),
            (400, 14),
            (450, 15),
            (500, 16),
            (600, 17),
            (700, 18),
            (800, 19),
            (900, 20),
            (1000, 21),
            (2500, 22),
            (5000, 23),
            (7000, 24),
            (10000, 25),
            (15000, 26),
            (21000, 27),
            (28000, 28),
        ]

        if weight < 1:
            raise ValueError("chargeable_weight måste vara minst 1.")

        selected_vkl = 1
        for min_weight, vkl in thresholds:
            if weight >= min_weight:
                selected_vkl = vkl
            else:
                break

        return selected_vkl

    @staticmethod
    def choose_km_bucket(km: float, medelse_rows: List[MedelseRow], vklfgrv: int) -> float:
        buckets = sorted({row.km_bucket for row in medelse_rows if row.vklfgrv == vklfgrv})

        if not buckets:
            raise ValueError(f"Inga km-buckets hittades för vklfgrv={vklfgrv}.")

        # Om km redan matchar exakt används det värdet.
        if km in buckets:
            return km

        # Annars välj minsta bucket som är >= km
        for bucket in buckets:
            if km <= bucket:
                return bucket

        return buckets[-1]

    @staticmethod
    def calculate_step_1(
        row: TrappstegRow,
        weight: float,
        taxeprel: str,
    ) -> StepResult:
        estimated_revenue = row.kndntofgrv * weight

        return StepResult(
            step_used=1,
            taxeprel=taxeprel,
            vklfgrv=row.vklfgrv,
            estimated_revenue=estimated_revenue,
            explanation="Steg 1: exakt träff på kundnamn + taxeprel + vklfgrv.",
        )

    @staticmethod
    def calculate_step_2(
        rows: List[TrappstegRow],
        medelse_value: float,
        weight: float,
        taxeprel: str,
        vklfgrv: int,
    ) -> StepResult:
        factors = [row.forh_se_radvis for row in rows if row.forh_se_radvis > 0]
        if not factors:
            raise ValueError("Steg 2 saknar giltiga värden för forh_se_radvis.")

        factor = TrappstegEngine.average(factors)
        estimated_revenue = medelse_value * factor * weight

        return StepResult(
            step_used=2,
            taxeprel=taxeprel,
            vklfgrv=vklfgrv,
            estimated_revenue=estimated_revenue,
            explanation="Steg 2: fallback på kundnamn + vklfgrv.",
        )

    @staticmethod
    def calculate_step_3(
        rows: List[TrappstegRow],
        medelse_value: float,
        weight: float,
        taxeprel: str,
        vklfgrv: int,
    ) -> StepResult:
        factors = [row.forh_se_kundvis for row in rows if row.forh_se_kundvis > 0]
        if not factors:
            raise ValueError("Steg 3 saknar giltiga värden för forh_se_kundvis.")

        factor = TrappstegEngine.average(factors)
        estimated_revenue = medelse_value * factor * weight

        return StepResult(
            step_used=3,
            taxeprel=taxeprel,
            vklfgrv=vklfgrv,
            estimated_revenue=estimated_revenue,
            explanation="Steg 3: fallback på endast kundnamn.",
        )