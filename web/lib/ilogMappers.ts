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
  LineItem,
  ZoneTreeNode,
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


// Delar linjenamn till from/to, t.ex. "Gavle - Nybro" eller "Gavle-Nybro".
const parseLineAreas = (lineName: string): { fromArea: string; toArea: string } => {
  const trimmed = lineName.trim();
  if (!trimmed) {
    return { fromArea: "", toArea: "" };
  }

  const parts = trimmed
    .split(/\s*-\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return { fromArea: "", toArea: "" };
  }

  if (parts.length === 1) {
    return { fromArea: parts[0], toArea: "" };
  }

  return {
    fromArea: parts[0],
    toArea: parts.slice(1).join(" - "),
  };
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

const parseFlmFromEstimatedProperties = (
  value: string
): number | null => {
  const match = value.match(/(\d+(?:[.,]\d+)?)\s*flm/i);
  if (!match) {
    return null;
  }

  const normalized = match[1].replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeCustomerName = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed.includes("*")) {
    return trimmed;
  }

  const suffix = trimmed
    .split("*")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .at(-1);

  return suffix ?? trimmed;
};

const readPostalCodePart = (
  record: Record<string, unknown>,
  keys: string[]
): string => {
  const stringValue = readString(record, keys);
  if (stringValue.length > 0) {
    const digitsOnly = stringValue.replace(/\D/g, "");
    return digitsOnly.length > 0 ? digitsOnly : stringValue.trim();
  }

  const numberValue = readNumber(record, keys);
  if (numberValue === null) {
    return "";
  }

  return String(Math.trunc(numberValue));
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
 * Extraherar id och name (registreringsnummer).
 * Filter bort items utan ID.
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

      const linkedLineIds = new Set<number>();
      const linkedLineNames = new Set<string>();

      const rawLines = Array.isArray(row.lines)
        ? row.lines
        : Array.isArray(row.line)
          ? row.line
          : [];

      for (const rawLine of rawLines) {
        const lineRow = asRecord(rawLine);
        const lineId = readNumber(lineRow, ["id", "lineId", "publicId"]);
        const lineName = readString(lineRow, ["name", "lineName"]);

        if (lineId !== null) {
          linkedLineIds.add(lineId);
        }

        if (lineName) {
          linkedLineNames.add(lineName);
        }
      }

      return {
        id,
        name,
        linkedLineIds: Array.from(linkedLineIds),
        linkedLineNames: Array.from(linkedLineNames),
      };
    })
    .filter((item): item is EquipageItem => item !== null);
};

/**
 * Mappning: iLog raw lines -> LineItem[]
 *
 * Visar alla tillgangliga linjer och extraherar from/to-omraden
 * for enkel filtrering pa hemskarmen.
 */
export const mapLines = (raw: unknown[]): LineItem[] => {
  return raw
    .map((item) => {
      const row = asRecord(item);
      const id = readNumber(row, ["id"]);

      if (id === null) {
        return null;
      }

      const name = readString(row, ["name"]);
      const { fromArea, toArea } = parseLineAreas(name);

      return {
        id,
        name,
        fromArea,
        toArea,
        mine: typeof row.mine === "boolean" ? row.mine : null,
        type: readString(row, ["type"]),
        publicId: readNumber(row, ["publicId"]),
      };
    })
    .filter((item): item is LineItem => item !== null);
};

const ZONE_CHILD_KEYS = [
  "children",
  "zones",
  "zoneFilters",
  "zonefilters",
  "zoneGroups",
  "zonegroups",
  "distributionZones",
  "items",
  "nodes",
] as const;

const mapZoneNode = (value: unknown): ZoneTreeNode | null => {
  const row = asRecord(value);

  if (Object.keys(row).length === 0) {
    return null;
  }

  const id = readNumber(row, ["id"]);
  const name = readString(row, ["name"]);
  const type = readString(row, ["type"]);
  const publicId = readNumber(row, ["publicId"]);
  const mine = typeof row.mine === "boolean" ? row.mine : null;

  const equipagesRaw = Array.isArray(row.equipages) ? row.equipages : [];
  const equipages = mapEquipages(equipagesRaw);

  const children: ZoneTreeNode[] = [];

  for (const key of ZONE_CHILD_KEYS) {
    const childRaw = row[key];
    if (!Array.isArray(childRaw)) {
      continue;
    }

    for (const child of childRaw) {
      const mapped = mapZoneNode(child);
      if (mapped !== null) {
        children.push(mapped);
      }
    }
  }

  const hasNodeSignal =
    id !== null ||
    name.length > 0 ||
    type.length > 0 ||
    publicId !== null ||
    equipages.length > 0 ||
    children.length > 0;

  if (!hasNodeSignal) {
    return null;
  }

  return {
    id,
    name,
    type,
    mine,
    publicId,
    equipages,
    children,
  };
};

/**
 * Mappning: iLog raw zones/distributionZones → ZoneTreeNode[]
 */
export const mapZones = (raw: unknown): ZoneTreeNode[] => {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => mapZoneNode(item))
      .filter((item): item is ZoneTreeNode => item !== null);
  }

  const single = mapZoneNode(raw);
  return single ? [single] : [];
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

  const mapped = candidates
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

      const senderName =
        readString(row, ["sender", "senderName", "pickupName", "sendername"]) ||
        readNestedString(row, "pickupLocation", ["name", "city"]);

      const receiverName =
        readString(row, ["receiver", "receiverName", "destinationName", "receivername"]) ||
        readNestedString(row, "destinationLocation", ["name", "city"]);

      const destinationCity =
        readNestedString(row, "destinationLocation", ["city"]) ||
        readNestedString(row, "destinationLocation", ["name"]) ||
        receiverName;

      const destinationLocationName =
        readNestedString(row, "destinationLocation", ["name"]) ||
        receiverName;

      const estimatedProperties =
        readNestedString(row, "consignment", ["estimatedProperties"]) ||
        readString(row, ["estimatedProperties"]);

      const weight = parseWeightFromEstimatedProperties(estimatedProperties);

      const flm = parseFlmFromEstimatedProperties(estimatedProperties);

      const customerName = normalizeCustomerName(
        readNestedString(row, "customer", ["name"]) ||
          readString(row, ["customerName", "customer"]),
      );

      const pickupLocationName =
        readNestedString(row, "pickupLocation", ["name"]) ||
        readString(row, ["pickupName"]) ||
        senderName;

      const zoneName =
        readNestedString(row, "zone", ["name"]) || readString(row, ["zoneName"]);

      const equipageName =
        readNestedString(row, "equipage", ["name"]) || readString(row, ["equipageName"]);

      const pickupDate =
        readNestedString(row, "consignment", ["pickupDate"]) || readString(row, ["pickupDate"]);

      const positioning =
        readNestedString(row, "consignment", ["positioning"]) ||
        readString(row, ["positioning"]);

      const pickupLocationStreet =
        readNestedString(row, "pickupLocation", ["street"]) ||
        readNestedString(row, "pickupLocation", ["name"]) ||
        senderName;

      const pickupLocationCity =
        readNestedString(row, "pickupLocation", ["city"]) || readString(row, ["pickupCity"]);

      const pickupLocation = asRecord(row.pickupLocation);
      const destinationLocation = asRecord(row.destinationLocation);

      const pickupPostalCode =
        readPostalCodePart(pickupLocation, ["zip", "postalCode", "postCode", "postnummer"]) ||
        readPostalCodePart(row, ["pickupZip", "pickupPostalCode", "senderZip"]);

      const destinationPostalCode =
        readPostalCodePart(destinationLocation, ["zip", "postalCode", "postCode", "postnummer"]) ||
        readPostalCodePart(row, [
          "destinationZip",
          "destinationPostalCode",
          "receiverZip",
        ]);

      const comment =
        readNestedString(row, "consignment", ["comment"]) || readString(row, ["comment"]);

      const consignmentProperties = readString(row, ["consignmentProperties"]);

      const opalBookingId =
        readNestedNumber(row, "consignment", ["opalBookingId"]) ??
        readNumber(row, ["opalBookingId"]);

      const transporterType =
        readNestedString(row, "consignment", ["transporterType"]) ||
        readString(row, ["transporterType"]);

      const ilogStatus =
        readNestedString(row, "consignment", ["ilogStatus"]) ||
        readString(row, ["ilogStatus"]);

      const goodsDescription = estimatedProperties || comment;

      return {
        consignmentId,
        waybillnumber,
        status,
        taxPointRelation: "",
        pickupPostalCode,
        destinationPostalCode,
        senderName,
        receiverName,
        destinationCity,
        destinationLocationName,
        weight,
        flm,
        customerName,
        pickupLocationName,
        zoneName,
        equipageName,
        pickupDate,
        positioning,
        pickupLocationStreet,
        pickupLocationCity,
        consignmentProperties,
        estimatedProperties,
        goodsDescription,
        opalBookingId,
        transporterType,
        ilogStatus,
        prognosis: "",
        comment,
      };
    })
    .filter((item): item is ConsignmentListItem => {
      if (item === null) return false;
      // Filter bort helt tomma entries - ta bara rader med faktisk data
      // iLog returnera ofta placeholder-objekt utan data
      const hasData =
        item.senderName.length > 0 ||
        item.receiverName.length > 0 ||
        item.destinationCity.length > 0 ||
        item.pickupPostalCode.length > 0 ||
        item.destinationPostalCode.length > 0 ||
        (item.weight ?? 0) > 0 ||
        (item.flm ?? 0) > 0 ||
        item.pickupLocationName.length > 0 ||
        item.pickupLocationStreet.length > 0 ||
        item.pickupLocationCity.length > 0 ||
        item.goodsDescription.length > 0 ||
        item.positioning.length > 0 ||
        item.comment.length > 0;
      return hasData;
    });

  const score = (item: ConsignmentListItem): number => {
    return [
      item.senderName,
      item.receiverName,
      item.destinationCity,
      item.pickupPostalCode,
      item.destinationPostalCode,
      item.destinationLocationName,
      item.customerName,
      item.zoneName,
      item.equipageName,
      item.pickupLocationStreet,
      item.pickupLocationCity,
      item.consignmentProperties,
      item.estimatedProperties,
      item.goodsDescription,
      item.transporterType,
      item.ilogStatus,
      item.positioning,
      item.comment,
    ].reduce(
      (acc, current) => acc + (current.trim().length > 0 ? 1 : 0),
      (item.weight !== null ? 1 : 0) + (item.flm !== null ? 1 : 0)
    );
  };

  const dedupedByConsignment = new Map<number, ConsignmentListItem>();
  for (const item of mapped) {
    const current = dedupedByConsignment.get(item.consignmentId);
    if (!current || score(item) > score(current)) {
      dedupedByConsignment.set(item.consignmentId, item);
    }
  }

  return Array.from(dedupedByConsignment.values());
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