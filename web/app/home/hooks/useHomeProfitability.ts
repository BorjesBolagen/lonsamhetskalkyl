"use client";

import { useState } from "react";
import type { MutableRefObject } from "react";
import {
  calculateConsignmentProfitabilityPrice,
  chunkArray,
  ConsignmentWithProfitability,
  EquipageWithConsignments,
  toBarPercent,
} from "./homeTypesAndUtils";
import { getBestNameMatch, getNameTranslations } from "@/lib/api";
import { DEFAULT_NAME_SIMILARITY_THRESHOLD } from "@/lib/constants";
import { NameSource } from "@/components/Dropdown";

type UseHomeProfitabilityParams = {
  latestLoadIdRef: MutableRefObject<number>;
  profitabilityReferenceValue: number;
  updateEquipageInState: (
    equipageId: number,
    updater: (equipage: EquipageWithConsignments) => EquipageWithConsignments,
  ) => void;
};

/**
 * Hydrates consignments with profitability values and tracks pending calculation count.
 */
export function useHomeProfitability({
  latestLoadIdRef,
  profitabilityReferenceValue,
  updateEquipageInState,
}: UseHomeProfitabilityParams) {
  const [loadingProfitabilityCount, setLoadingProfitabilityCount] = useState(0);

  async function hydrateProfitabilityForEquipages(
    loadId: number,
    equipages: EquipageWithConsignments[],
  ): Promise<void> {
    // Skip empty equipages to avoid unnecessary profitability requests.
    const equipagesToHydrate = equipages.filter(
      (equipage) => equipage.consignments.length > 0,
    );

    setLoadingProfitabilityCount(equipagesToHydrate.length);

    // Process small batches to avoid request spikes against downstream services.
    for (const equipageBatch of chunkArray(equipagesToHydrate, 4)) {
      await Promise.allSettled(
        equipageBatch.map(async (equipage) => {
          if (latestLoadIdRef.current !== loadId) {
            return;
          }

          updateEquipageInState(equipage.id, (current) => ({
            ...current,
            profitabilityStatus: "loading",
          }));

          try {
            const enrichedConsignments: ConsignmentWithProfitability[] =
              await Promise.all(
                equipage.consignments.map(async (consignment) => {
                  try {

                    // Fetch best name match and name translations in parallel
                    
                    const [bestNameResponse, translationsResponse] = await Promise.all([
                      getBestNameMatch(consignment.customerName),
                      getNameTranslations(consignment.customerName),
                    ]);

                    const translations =
                      translationsResponse.status && translationsResponse.data
                        ? translationsResponse.data.translations
                        : [];

                    let selectedNameForProfitability = consignment.customerName;
                    let selectedNameSource: "translation" | "jaro" | "base" = "base";
                    let best_name: string | undefined;
                    let best_score: number | undefined;

                    if (translations.length > 0) {
                      selectedNameForProfitability = translations[0];
                      selectedNameSource = "translation";
                    }

                    if (bestNameResponse.status && bestNameResponse.data) {
                      best_name = bestNameResponse.data.best_name;
                      best_score = bestNameResponse.data.best_score;

                      if (selectedNameSource === "base" && best_score >= DEFAULT_NAME_SIMILARITY_THRESHOLD) {
                        selectedNameForProfitability = best_name;
                        selectedNameSource = "jaro";
                      }
                    } else {
                      console.warn(bestNameResponse.message);
                    }

                    const resolvedConsignment = {
                      ...consignment,
                      customerName: selectedNameForProfitability,
                    };

                    const profitabilityValue =
                      await calculateConsignmentProfitabilityPrice(resolvedConsignment);

                    return {
                      ...consignment,
                      profitabilityValue,
                      best_name,
                      best_score,
                      translationOptions: translations,
                      selectedNameForProfitability,
                      selectedNameSource,
                    };
                  } catch (error) {
                    console.log("gets in here ", error);
                    return {
                      ...consignment,
                      profitabilityValue: null,
                      translationOptions: [],
                      selectedNameForProfitability: consignment.customerName,
                      selectedNameSource: "base" as const,
                    };
                  }
                }),
              );

            if (latestLoadIdRef.current !== loadId) {
              return;
            }

            const totalProfitabilityPrice = enrichedConsignments.reduce(
              (sum, consignment) =>
                sum + (consignment.profitabilityValue?.estimated_revenue ?? 0),
              0,
            );

            updateEquipageInState(equipage.id, (current) => ({
              ...current,
              consignments: enrichedConsignments,
              totalProfitabilityPrice,
              profitabilityBarPercent: toBarPercent(
                totalProfitabilityPrice,
                profitabilityReferenceValue,
              ),
              profitabilityStatus: "done",
            }));
          } catch {
            if (latestLoadIdRef.current !== loadId) {
              return;
            }

            updateEquipageInState(equipage.id, (current) => ({
              ...current,
              profitabilityStatus: "error",
            }));
          } finally {
            if (latestLoadIdRef.current === loadId) {
              setLoadingProfitabilityCount((current) => Math.max(0, current - 1));
            }
          }
        }),
      );
    }
  }

  return {
    loadingProfitabilityCount,
    setLoadingProfitabilityCount,
    hydrateProfitabilityForEquipages,
  };
}
