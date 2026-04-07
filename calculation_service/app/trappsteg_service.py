"""
Är hela beräkningsflödet mellan repository och engine.

Den här filen ansvarar för att:
- ta emot indata från API-lagret
- normalisera och förbereda indata
- hämta nödvändig data från repository
- anropa rätt steg i TrappstegEngine
- hantera fallback-logiken mellan steg 1, 2 och 3

Service-lagret är den sammanhållande länken mellan API:t och den rena
beräkningslogiken, och innehåller själva flödeslogiken för motorn.
"""

from __future__ import annotations

from typing import Any

from app.trappsteg_engine import ProfitabilityInput, StepResult, TrappstegEngine
from app.trappsteg_repository import TrappstegRepository


class TrappstegService:
    def __init__(self, supabase_client: Any) -> None:
        self.repository = TrappstegRepository(supabase_client)

    def calculate(self, data: ProfitabilityInput) -> StepResult:
        engine = TrappstegEngine()

        kundnamn = engine.normalize_text(data.kundnamn)
        start = engine.normalize_code(data.start)
        slut = engine.normalize_code(data.slut)
        weight = float(data.chargeable_weight)

        if weight <= 0:
            raise ValueError("chargeable_weight måste vara > 0")

        vklfgrv = engine.get_vklfgrv(weight)
        taxeprel = engine.build_taxeprel(start, slut)

        # Steg 1 först
        exact_row = self.repository.fetch_exact_trappsteg_row(
            kundnamn=kundnamn,
            taxeprel=taxeprel,
            vklfgrv=vklfgrv,
        )
        if exact_row is not None and exact_row.kndntofgrv > 0:
            return engine.calculate_step_1(
                row=exact_row,
                weight=weight,
                taxeprel=taxeprel,
            )

        # Bas för steg 2 och 3
        km = self.repository.fetch_km_by_taxeprel(taxeprel)
        if km is None:
            raise ValueError(f"Inget km-värde hittades för taxeprel='{taxeprel}'.")

        medelse_rows = self.repository.fetch_medelse_rows_by_vkl(vklfgrv)
        km_bucket = engine.choose_km_bucket(km, medelse_rows, vklfgrv)

        medelse_row = next(
            (row for row in medelse_rows if row.km_bucket == km_bucket),
            None,
        )
        if medelse_row is None:
            raise ValueError(
                f"Ingen MedelSE-rad hittades för km_bucket='{km_bucket}', vklfgrv='{vklfgrv}'."
            )

        medelse_value = medelse_row.kndnto_medelse

        # Steg 2
        customer_vkl_rows = self.repository.fetch_customer_vkl_rows(
            kundnamn=kundnamn,
            vklfgrv=vklfgrv,
        )
        valid_step2_rows = [row for row in customer_vkl_rows if row.forh_se_radvis > 0]
        if valid_step2_rows:
            return engine.calculate_step_2(
                rows=valid_step2_rows,
                medelse_value=medelse_value,
                weight=weight,
                taxeprel=taxeprel,
                vklfgrv=vklfgrv,
            )

        # Steg 3
        customer_rows = self.repository.fetch_customer_rows(kundnamn)
        valid_step3_rows = [row for row in customer_rows if row.forh_se_kundvis > 0]
        if valid_step3_rows:
            return engine.calculate_step_3(
                rows=valid_step3_rows,
                medelse_value=medelse_value,
                weight=weight,
                taxeprel=taxeprel,
                vklfgrv=vklfgrv,
            )

        raise ValueError(
            f"Ingen träff i steg 1-3 för kundnamn='{kundnamn}', "
            f"taxeprel='{taxeprel}', vklfgrv='{vklfgrv}'."
        )