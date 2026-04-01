/**
 * iLogMappers — Transformation av rå iLog JSON → rena TypeScript-typer.
 * 
 * Ansvar:
 * - Extrahera relevanta fält från iLog's komplexa, djupt nestlade struktur
 * - Hantera många möjliga fältnamn (fallback-kedjor) för robusthet
 * - Filtrera bort tom/dummy-data
 * - Parse speciella format (t.ex. vikt från "0.4 flm 1.0 ppl 780 kg 2.8 kbm")
 * - Skapa meningsfull status från flera iLog-fält
 * 
 * Viktigt: iLog-svar är ofta mycket nested och kan innehålla många null/tomma fält.
 * Dessa mapprar letar igenom dessa strukturer för att hitta faktisk data.
 * 
 * Flöde: iLog raw data → [applyCollectConsignmentCandidates] → map fields → filter empty → typed DTO
 */

import type {
  ConsignmentDetail,
  ConsignmentListItem,
  EquipageItem,
} from "@/lib/ilogTypes";

/**
 * Säker konvertering av okänd typ till Record.
 * Returnerar tom object {} om indata inte är ett objekt.
 */
const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }

  return {};
};

/**
 * Läser första icke-tom string från ett objekt med fallback-lista över möjliga fältnamn.
 */
const readString = (record: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return "";
};

/**
 * Läser första tal från ett objekt.
 * Försöker tolka strings som tal (t.ex. "123" → 123).
 * Returnerar null om inget tal hittas.
 * 
 * Fallback-lista över möjliga fältnamn.
 */
const readNumber = (
  record: Record<string, unknown>,
  keys: string[]
): number | null => {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
};

/**
 * Läser string från ett nestnivå-objekt (t.ex. parent.consignment.pickupDate).
 */
const readNestedString = (
  parent: Record<string, unknown>,
  objectKey: string,
  keys: string[]
): string => {
  const nested = asRecord(parent[objectKey]);
  return readString(nested, keys);
};

/**
 * Läser tal från ett nestnivå-objekt (t.ex. parent.consignment.weight).
 */
const readNestedNumber = (
  parent: Record<string, unknown>,
  objectKey: string,
  keys: string[]
): number | null => {
  const nested = asRecord(parent[objectKey]);
  return readNumber(nested, keys);
};

// Exempel på line.name: "Gävle - Nybro" eller "Gävle-Nybro" -> "Gävle"
// Om line.name saknar separator returnerar vi hela strängen.
const extractDepartureLocationFromLineName = (lineName: string): string => {
  const trimmed = lineName.trim();
  if (!trimmed) {
    return "";
  }

  // Tillåt både " - " och "-" som separator mellan avgång och destination.
  const [firstPart] = trimmed.split(/\s*-\s*/);
  return firstPart?.trim() ?? "";
};

const readDepartureLocationFromLines = (row: Record<string, unknown>): string => {
  const lines = row["lines"];
  if (!Array.isArray(lines)) {
    return "";
  }

  for (const line of lines) {
    const lineRecord = asRecord(line);
    const lineName = readString(lineRecord, ["name"]);
    if (!lineName) {
      continue;
    }

    const departure = extractDepartureLocationFromLineName(lineName);
    if (departure) {
      return departure;
    }
  }

  return "";
};

/**
 * Extraherar vikt från iLog's estimatedProperties-fält.
 * 
 * Format: "0.4 flm 1.0 ppl 780 kg 2.8 kbm"
 * Regex hittar "780" och returnerar det som number.
 */
const parseWeightFromEstimatedProperties = (
  value: string
): number | null => {
  const match = value.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (!match) {
    return null;
  }

  const normalized = match[1].replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Skapa en läsbar status-sträng från iLog-data.
 * 
 * iLog har flera sätt att representera status. Denna funktion försöker
 * hitta det bästa tillgängliga:
 * 1. Explicit statusName-fält
 * 2. Sammansatt "statusType:2 ilog:U" om statusName saknas
 */
const formatStatus = (row: Record<string, unknown>): string => {
  const explicit = readString(row, ["statusName", "status", "statusTypeName"]);
  if (explicit) {
    return explicit;
  }

  const statusTypeId =
    readNumber(row, ["statusTypeId"]) ??
    readNestedNumber(row, "statusType", ["id"]);

  const ilogStatus =
    readString(row, ["ilogStatus"]) ||
    readNestedString(row, "consignment", ["ilogStatus"]);

  const statusTypePart = statusTypeId !== null ? `statusType:${statusTypeId}` : "";
  const ilogPart = ilogStatus ? `ilog:${ilogStatus}` : "";

  return [statusTypePart, ilogPart].filter(Boolean).join(" ").trim();
};

/**
 * Rekursiv hjälpfunktion för att hitta consignment-objekt i djup nested struktur.
 * 
 * iLog kan returnerara data på många sätt:
 * - Själva consignment-objektet (flat)
 * - Consignment inuti ett större objekt
 * - Array av consignments
 * - Allt ovan inom varandra flera nivåer
 * 
 * Denna funktion ("the hunter") traverserar hela trädet
 * och samlar alla objekt som ser ut som consignments.
 * 
 * Den använder:
 * - Set<unknown> för att undvika oändlig rekursion (redan besökta objekt)
 * - consignmentId eller waybillnumber som marker för "detta är en konsignment"
 */
const collectConsignmentCandidates = (
  value: unknown,
  seen: Set<unknown>,
  output: Record<string, unknown>[]
): void => {
  if (value === null || value === undefined) {
    return;
  }

  if (seen.has(value)) {
    return;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item) => collectConsignmentCandidates(item, seen, output));
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  const row = asRecord(value);
  // Merge consignment-props in top level för enklare fältläsning senare
  const merged = { ...asRecord(row.consignment), ...row };

  // Checka om detta ser ut som en consignment
  const hasConsignmentSignals =
    readNumber(merged, ["consignmentId", "id", "ilogId", "consignment_id"]) !== null ||
    readString(merged, ["waybillnumber", "waybillNumber"]).length > 0;

  if (hasConsignmentSignals) {
    output.push(merged);
  }

  // Traversera alla barn-objekt rekursivt
  for (const child of Object.values(row)) {
    if (Array.isArray(child) || (typeof child === "object" && child !== null)) {
      collectConsignmentCandidates(child, seen, output);
    }
  }
};

/**
 * Mappning: iLog raw equipages → EquipageItem[]
 * 
 * Extraherar id, name (registreringsnummer) och avgångsort (base location).
 * Filter bort items utan ID.
 * 
 * Avgångsort-fallback-chain:
 *   1. lines[].name (t.ex. "Gavle - Nybro" -> "Gavle")
 *   2. location.name / location.city
 *   3. base.name / base.city
 *   4. homeLocation.name
 *   5. zone.name
 *   6. Tom string om ingenting hittas
 */
export const mapEquipages = (raw: unknown[]): EquipageItem[] => {
  return raw
    .map((item) => {
      const row = asRecord(item);
      const id = readNumber(row, ["id", "equipageId"]);

      if (id === null) {
        return null;
      }

      const name =
        readString(row, ["name", "displayName", "regno", "regNo", "registrationNumber"]) ||
        `Equipage ${id}`;

      // Försök hitta avgångsort/bas-stad från flera möjliga fält
      const departureLocation =
        readDepartureLocationFromLines(row) ||
        readNestedString(row, "location", ["name", "city"]) ||
        readNestedString(row, "base", ["name", "city"]) ||
        readNestedString(row, "homeLocation", ["name"]) ||
        readNestedString(row, "zone", ["name"]) ||
        "";

      return { id, name, departureLocation };
    })
    .filter((item): item is EquipageItem => item !== null);
};

/**
 * Mappning: iLog raw consignment-lista → ConsignmentListItem[]
 * 
 * Steg:
 * 1. Hunt för consignment-objekt i entire nested structure (collectConsignmentCandidates)
 * 2. Mappa varje consignment till { consignmentId, waybillnumber, status, ... }
 * 3. Filter bort helt tomma entries (utan sender, receiver, weight, positioning, eller comment)
 * 
 * Weight-fallback-kedja (in order):
 *   1. consignment.estimatedweight
 *   2. top-level estimatedweight
 *   3. weight | freightWeight
 *   4. consignment.weight
 *   5. Parse från "0.4 flm 1.0 ppl 780 kg" format
 */
export const mapConsignments = (raw: unknown): ConsignmentListItem[] => {
  const candidates: Record<string, unknown>[] = [];
  collectConsignmentCandidates(raw, new Set<unknown>(), candidates);

  return candidates
    .map((item) => {
      const row = asRecord(item);
      const consignmentId = readNumber(row, [
        "consignmentId",
        "id",
        "ilogId",
        "consignment_id",
      ]);

      if (consignmentId === null) {
        return null;
      }

      const waybillnumber =
        readString(row, ["waybillnumber", "waybillNumber"]) ||
        readNestedString(row, "consignment", ["waybillnumber", "waybillNumber"]) ||
        String(
          readNestedNumber(row, "consignment", ["opalBookingId"]) ??
            readNumber(row, ["opalBookingId"]) ??
            consignmentId
        );

      const status = formatStatus(row);

      const sender =
        readString(row, ["sender", "senderName", "pickupName", "sendername"]) ||
        readNestedString(row, "pickupLocation", ["name", "city"]);

      const receiver =
        readString(row, ["receiver", "receiverName", "destinationName", "receivername"]) ||
        readNestedString(row, "destinationLocation", ["name", "city"]);

      const weight =
        readNestedNumber(row, "consignment", ["estimatedweight"]) ??
        readNumber(row, ["estimatedweight"]) ??
        readNumber(row, ["weight", "freightWeight"]) ??
        readNestedNumber(row, "consignment", ["weight"]) ??
        parseWeightFromEstimatedProperties(
          readNestedString(row, "consignment", ["estimatedProperties"])
        );

      const customerName =
        readNestedString(row, "customer", ["name"]) || readString(row, ["customerName"]);

      const zoneName =
        readNestedString(row, "zone", ["name"]) || readString(row, ["zoneName"]);

      const equipageName =
        readNestedString(row, "equipage", ["name"]) || readString(row, ["equipageName"]);

      const pickupDate =
        readNestedString(row, "consignment", ["pickupDate"]) || readString(row, ["pickupDate"]);

      const positioning =
        readNestedString(row, "consignment", ["positioning"]) ||
        readString(row, ["positioning"]);

      const comment =
        readNestedString(row, "consignment", ["comment"]) || readString(row, ["comment"]);

      return {
        consignmentId,
        waybillnumber,
        status,
        sender,
        receiver,
        weight,
        customerName,
        zoneName,
        equipageName,
        pickupDate,
        positioning,
        comment,
      };
    })
    .filter((item): item is ConsignmentListItem => {
      if (item === null) return false;
      // Filter bort helt tomma entries - ta bara rader med faktisk data
      // iLog returnera ofta placeholder-objekt utan data
      const hasData =
        item.sender.length > 0 ||
        item.receiver.length > 0 ||
        (item.weight ?? 0) > 0 ||
        item.positioning.length > 0 ||
        item.comment.length > 0;
      return hasData;
    });
};

/**
 * Mappning: iLog raw consignment-detalj → ConsignmentDetail
 * 
 * Samma som mapConsignments men för ett enskilt objekt.
 * Returnerar ett objekt (inte array) med utökad info.
 * 
 * Innehåller alla ListItem-fält + pickupCity, destinationCity, kolli, 
 * opalBookingId, transporterType, ilogStatus.
 */
export const mapConsignmentDetail = (raw: unknown): ConsignmentDetail => {
  const row = asRecord(raw);

  const consignmentId =
    readNumber(row, ["consignmentId", "id", "ilogId"]) ??
    readNestedNumber(row, "consignment", ["id"]) ??
    0;

  const waybillnumber =
    readString(row, ["waybillnumber", "waybillNumber"]) ||
    readNestedString(row, "consignment", ["waybillnumber", "waybillNumber"]) ||
    String(
      readNestedNumber(row, "consignment", ["opalBookingId"]) ??
        readNumber(row, ["opalBookingId"]) ??
        consignmentId
    );

  const status = formatStatus(row);

  const sender =
    readString(row, ["sender", "senderName", "pickupName"]) ||
    readNestedString(row, "pickupLocation", ["name"]);

  const receiver =
    readString(row, ["receiver", "receiverName", "destinationName"]) ||
    readNestedString(row, "destinationLocation", ["name"]);

  const pickupCity =
    readNestedString(row, "pickupLocation", ["city"]) || readString(row, ["pickupCity"]);

  const destinationCity =
    readNestedString(row, "destinationLocation", ["city"]) ||
    readString(row, ["destinationCity"]);

  const weight =
    readNestedNumber(row, "consignment", ["estimatedweight"]) ??
    readNumber(row, ["estimatedweight"]) ??
    readNumber(row, ["weight", "freightWeight"]) ??
    readNestedNumber(row, "consignment", ["weight"]) ??
    parseWeightFromEstimatedProperties(
      readNestedString(row, "consignment", ["estimatedProperties"])
    );

  const kolli =
    readNumber(row, ["kolli"]) ??
    readNestedNumber(row, "consignment", ["kolli"]);

  const comment =
    readString(row, ["comment", "internalComment"]) ||
    readNestedString(row, "consignment", ["comment"]);

  const customerName =
    readNestedString(row, "customer", ["name"]) || readString(row, ["customerName"]);

  const zoneName =
    readNestedString(row, "zone", ["name"]) || readString(row, ["zoneName"]);

  const equipageName =
    readNestedString(row, "equipage", ["name"]) || readString(row, ["equipageName"]);

  const pickupDate =
    readNestedString(row, "consignment", ["pickupDate"]) || readString(row, ["pickupDate"]);

  const positioning =
    readNestedString(row, "consignment", ["positioning"]) ||
    readString(row, ["positioning"]);

  const opalBookingId =
    readNestedNumber(row, "consignment", ["opalBookingId"]) ??
    readNumber(row, ["opalBookingId"]);

  const transporterType =
    readNestedString(row, "consignment", ["transporterType"]) ||
    readString(row, ["transporterType"]);

  const ilogStatus =
    readNestedString(row, "consignment", ["ilogStatus"]) ||
    readString(row, ["ilogStatus"]);

  return {
    consignmentId,
    waybillnumber,
    status,
    sender,
    receiver,
    pickupCity,
    destinationCity,
    weight,
    kolli,
    comment,
    customerName,
    zoneName,
    equipageName,
    pickupDate,
    positioning,
    opalBookingId,
    transporterType,
    ilogStatus,
  };
};
