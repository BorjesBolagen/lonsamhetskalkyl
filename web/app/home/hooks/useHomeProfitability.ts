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
import { getBestNameMatch } from "@/lib/api";
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

                    // Feed recommended name into profitability calculation
                    const response = await getBestNameMatch(consignment.customerName);
                    if (!response.status || !response.data) {
                      console.warn(response.message);
                      return {
                        ...consignment,
                        profitabilityValue: null,
                      };
                    }

                    const { best_name, best_score } = response.data!;
                    const useEntireName = best_score >= DEFAULT_NAME_SIMILARITY_THRESHOLD;
                    const resolvedConsignment =
                      useEntireName
                        ? { ...consignment, customerName: best_name }
                        : consignment;


                    const profitabilityValue =
                      await calculateConsignmentProfitabilityPrice(resolvedConsignment, useEntireName);

                    return {
                      ...consignment,
                      profitabilityValue,
                      best_name: response.data.best_name,
                      best_score: response.data.best_score,
                    };
                  } catch {
                    return {
                      ...consignment,
                      profitabilityValue: null,
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
