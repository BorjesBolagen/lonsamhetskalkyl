"""
Ansvarar för all datahämtning från Supabase.

Den här filen kapslar in all åtkomst till databasen och innehåller metoder
för att hämta lookup-data som beräkningsmotorn behöver, till exempel:

- exakta trappstegsrader för steg 1
- kund- och viktklassbaserade rader för steg 2
- kundbaserade rader för steg 3
- km-värden per taxeprel
- MedelSE-rader per viktklass

Syftet är att separera databaslogik från affärslogik så att motorn
förblir lättare att testa, läsa och underhålla.
"""

from __future__ import annotations

from typing import Any, List, Optional

from app.trappsteg_engine import MedelseRow, TrappstegRow


class TrappstegRepository:
    def __init__(self, supabase_client: Any) -> None:
        self.supabase = supabase_client

    def _map_trappsteg_row(self, row: dict) -> TrappstegRow:
        return TrappstegRow(
            kundnamn=row["kundnamn"],
            taxeprel=row["taxeprel"],
            vklfgrv=int(row["vklfgrv"]),
            kndntofgrv=float(row["kndntofgrv"]) if row["kndntofgrv"] is not None else 0.0,
            forh_se_radvis=float(row["forh_se_radvis"]) if row["forh_se_radvis"] is not None else 0.0,
            forh_se_kundvis=float(row["forh_se_kundvis"]) if row["forh_se_kundvis"] is not None else 0.0,
            km=float(row["km"]) if row["km"] is not None else 0.0,
        )

    def fetch_exact_trappsteg_row(
        self,
        kundnamn: str,
        taxeprel: str,
        vklfgrv: int,
    ) -> Optional[TrappstegRow]:
        response = (
            self.supabase
            .table("calculation_trappsteg")
            .select("*")
            .ilike("kundnamn", kundnamn)
            .eq("taxeprel", taxeprel)
            .eq("vklfgrv", vklfgrv)
            .limit(1)
            .execute()
        )

        rows = response.data or []
        if not rows:
            return None

        return self._map_trappsteg_row(rows[0])

    def fetch_customer_vkl_rows(self, kundnamn: str, vklfgrv: int) -> List[TrappstegRow]:
        response = (
            self.supabase
            .table("calculation_trappsteg")
            .select("*")
            .ilike("kundnamn", kundnamn)
            .eq("vklfgrv", vklfgrv)
            .execute()
        )

        rows = response.data or []
        return [self._map_trappsteg_row(row) for row in rows]

    def fetch_customer_rows(self, kundnamn: str) -> List[TrappstegRow]:
        response = (
            self.supabase
            .table("calculation_trappsteg")
            .select("*")
            .ilike("kundnamn", kundnamn)
            .execute()
        )

        rows = response.data or []
        return [self._map_trappsteg_row(row) for row in rows]

    def fetch_km_by_taxeprel(self, taxeprel: str) -> Optional[float]:
        response = (
            self.supabase
            .table("calculation_trappsteg")
            .select("km")
            .eq("taxeprel", taxeprel)
            .not_.is_("km", "null")
            .limit(1)
            .execute()
        )

        rows = response.data or []
        if not rows:
            return None

        km = rows[0]["km"]
        return float(km) if km is not None else None

    def fetch_medelse_rows_by_vkl(self, vklfgrv: int) -> List[MedelseRow]:
        response = (
            self.supabase
            .table("calculation_medelse")
            .select("km_bucket, vklfgrv, kndnto_medelse")
            .eq("vklfgrv", vklfgrv)
            .order("km_bucket")
            .execute()
        )

        rows = response.data or []
        result: List[MedelseRow] = []

        for row in rows:
            result.append(
                MedelseRow(
                    km_bucket=float(row["km_bucket"]),
                    vklfgrv=int(row["vklfgrv"]),
                    kndnto_medelse=float(row["kndnto_medelse"]),
                )
            )

        return result