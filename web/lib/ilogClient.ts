/**
 * iLogClient — Centraliserad HTTP-klient för all kommunikation med iLog REST API.
 * 
 * Ansvar:
 * - Hanterar HTTP Basic Auth med iLog-specifikt format (username/transporterNumber:password)
 * - Bygger URL:er med query-parametrar
 * - Handskar tidsgränser och nätverkfel
 * - Mappar iLog's HTTP-fel till lämpliga interna statuskoder
 * - Extraherar value från iLog's envelope-format { success, value }
 * 
 * Användning:
 *   const result = await ilogGet<MyType>("/ilog-api-web/endpoint", { param: "value" });
 */

// iLog svarar alltid med ett envelope-format: { success: boolean, value: T }
// Vi extraherar bara value-delen för att route-koden ska bli enklare.
type IlogEnvelope<T> = {
  success: boolean;
  value: T;
};

// Egen error-klass så route-filerna kan skilja mellan iLog-fel och andra server-fel.
// Sparar HTTP-status så vi kan returnera lämpliga fel till frontend.
export class IlogHttpError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Type-säkerhet för query-parametrar i URL.
type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue>;

// Tidsgräns för externa iLog-anrop (10 sekunder).
// Förhindrar hängande requests om iLog är långsam eller nere.
const ILOG_TIMEOUT_MS = 10_000;

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];

  if (!value) {
    throw new IlogHttpError(`Missing environment variable: ${key}`, 500);
  }

  return value;
};

/**
 * Bygger HTTP Basic Auth-header exakt enligt iLog-format:
 * Basic base64(username/transporterNumber:password)
 */
const createAuthHeader = (): string => {
  const username = getRequiredEnv("ILOG_USERNAME");
  const transporterNumber = getRequiredEnv("ILOG_TRANSPORTER_NUMBER");
  const password = getRequiredEnv("ILOG_PASSWORD");
  const authString = `${username}/${transporterNumber}:${password}`;
  return `Basic ${Buffer.from(authString).toString("base64")}`;
};

/**
 * Skapar full URL till iLog-endpoint med query-parametrar.
 * Ignorerar null/undefined värden.
 */
const createUrl = (path: string, query?: QueryParams): URL => {
  const baseUrl = getRequiredEnv("ILOG_BASE_URL");
  const url = new URL(path, baseUrl);

  if (!query) {
    return url;
  }

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url;
};

/**
 * Generisk GET-funktion för alla iLog-anrop.
 * 
 * Gör följande:
 * 1. Bygger URL + autentisering
 * 2. Skickar GET-request med timeout
 * 3. Hanterar nätverkfel och icke-2xx svar
 * 4. Tolkar JSON och kontrollerar success-flagga
 * 5. Extraherar value-delen från envelope
 * 
 * TypeError: ilogGet<T> låter anroparen ange vilken datatyp T ska tolkas som.
 */
export const ilogGet = async <T>(path: string, query?: QueryParams): Promise<T> => {
  const url = createUrl(path, query);

  let response: Response;

  try {
    // Gör själva HTTP-anropet till iLog.
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: createAuthHeader(),
      },
      signal: AbortSignal.timeout(ILOG_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    // Nätverksfel, timeout, DNS-fel, etc.
    throw new IlogHttpError("Failed to reach iLog API", 502);
  }

  // Icke-2xx status = något gick fel.
  const responseText = await response.text();

  if (!response.ok) {
    if (responseText) {
      console.error(`iLog API responded with status ${response.status}: ${responseText}`);
    }
    throw new IlogHttpError(
      `iLog API responded with status ${response.status}`,
      // Mappar 401 från extern tjänst till 502 internt,
      // eftersom frontend pratar med vår API, inte direkt med iLog.
      // 401 från iLog = felaktig/saknad auth → vi presenterar det som iLog är ned.
      response.status === 401 ? 502 : response.status
    );
  }

  let data: IlogEnvelope<T>;

  try {
    // Försöker tolka svaret som JSON.
    data = JSON.parse(responseText) as IlogEnvelope<T>;
  } catch {
    throw new IlogHttpError("iLog API returned invalid JSON", 502);
  }

  // iLog kan svara 200 OK men success=false → då är något fel på iLog's sida.
  // Vi behandlar det som serverfel (502).
  if (!data.success) {
    throw new IlogHttpError("iLog API call was not successful", 502);
  }

  // Returnerar bara value-delen så route-koden blir enkel och rydlig.
  // Alla klienter förväntar sig att få rätt datatyp direkt.
  return data.value;
};
