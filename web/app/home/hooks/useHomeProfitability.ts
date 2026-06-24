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
import { DEFAULT_NAME_SIMILARITY_THRESHOLD } from "@/lib/backend/constants";

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
                      getNameTranslations(consignment.customerName)
                    ]);

                    if (!bestNameResponse.status || !bestNameResponse.data) {
                      console.warn(bestNameResponse.message);
                      const translations =
                        translationsResponse.status && translationsResponse.data
                          ? translationsResponse.data.translations
                          : [];

                      const selectedNameSource: "translation" | "base" =
                        translations.length > 0 ? "translation" : "base";

                      return {
                        ...consignment,
                        profitabilityValue: null,
                        translationOptions: translations,
                        selectedNameForProfitability:
                          translations.length > 0 ? translations[0] : consignment.customerName,
                        selectedNameSource,
                      };
                    }

                    const { best_name, best_score } = bestNameResponse.data!;
                    const translations = translationsResponse.status && translationsResponse.data ? translationsResponse.data.translations : [];
                    
                    // Determine which name to use for initial profitability calculation
                    // Priority: 1. Translation name, 2. Jaro if over threshold, 3. Original
                    let selectedNameForProfitability = consignment.customerName;
                    let selectedNameSource: "translation" | "jaro" | "base" = "base";
                    let useEntireName = false;

                    if (translations.length > 0) {
                      // Use first translation name
                      selectedNameForProfitability = translations[0];
                      selectedNameSource = "translation";
                      useEntireName = true;
                    } else if (best_score >= DEFAULT_NAME_SIMILARITY_THRESHOLD) {
                      // Use jaro name if it meets threshold
                      selectedNameForProfitability = best_name;
                      selectedNameSource = "jaro";
                      useEntireName = true;
                    }
                    // Otherwise use original name (already set as default)

                    const resolvedConsignment = {
                      ...consignment,
                      customerName: selectedNameForProfitability
                    };

                    const profitabilityValue =
                      await calculateConsignmentProfitabilityPrice(resolvedConsignment, useEntireName);

                    return {
                      ...consignment,
                      profitabilityValue,
                      best_name: bestNameResponse.data.best_name,
                      best_score: bestNameResponse.data.best_score,
                      translationOptions: translations,
                      selectedNameForProfitability,
                      selectedNameSource,
                    };
                  } catch {
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
