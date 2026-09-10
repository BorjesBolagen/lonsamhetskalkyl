/**
 * Delad mappning från linjetyp till iLog-endpoint för bokningar på en linje.
 *
 * Används av /api/ilog/unassigned-consignments (simulatorn) och
 * /api/ilog/line-consignments (Home, nytt linjeval).
 */

export const LINE_TYPES = new Set(["ZONE", "ZONEFILTER", "ZONEGROUP"]);

export type SupportedLineType = "ZONE" | "ZONEFILTER" | "ZONEGROUP";

/**
 * Returnerar rätt iLog-endpoint beroende på linjetyp.
 */
export function getIlogEndpoint(lineType: SupportedLineType, lineId: string) {
  switch (lineType) {
    case "ZONE":
      return {
        path: "/ilog-api-web/zone/consignments",
        query: { zoneId: lineId },
      };

    case "ZONEFILTER":
      return {
        path: "/ilog-api-web/zonefilter/consignments",
        query: { zoneFilterId: lineId },
      };

    case "ZONEGROUP":
      return {
        path: "/ilog-api-web/zonegroup/consignments",
        query: { zoneGroupId: lineId },
      };
  }
}
