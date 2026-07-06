// lib/errors/supabaseErrorTranslations.ts

/**
 * Kartläggning av vanliga Postgres/PostgREST-felkoder till svenska meddelanden.
 * Se: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */

interface SupabaseErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

interface TranslatedError {
  code: string;
  swedishMessage: string;
  originalMessage: string;
  // Extraherat om möjligt, t.ex. vilket fält eller constraint som orsakade felet
  detail?: string;
}

// Statiska meddelanden som inte beror på detaljer i felet
const STATIC_TRANSLATIONS: Record<string, string> = {
  "23503": "Kan inte slutföra åtgärden eftersom den refererar till en post som inte finns.",
  "23502": "Ett obligatoriskt fält saknas.",
  "23514": "Värdet uppfyller inte de tillåtna villkoren för fältet.",
  "23P01": "Värdet överlappar med en befintlig post (exclusion constraint).",
  "22P02": "Ett fält innehåller fel typ av data (t.ex. text i ett fält som förväntar sig ett tal).",
  "22003": "Värdet är för stort för fältet.",
  "22007": "Ogiltigt datum- eller tidsformat.",
  "42501": "Du saknar behörighet att utföra denna åtgärd.",
  "42703": "Ett fält som efterfrågas finns inte i tabellen (kontrollera stavning/namnbyten).",
  "42P01": "Tabellen som efterfrågas finns inte.",
  "42883": "Funktionen som anropades finns inte, eller anropades med fel typ av parametrar.",
  "PGRST301": "Sessionen har gått ut. Logga in igen.",
  "PGRST116": "Ingen post hittades (förväntade exakt en post).",
  "PGRST204": "Ingen post hittades att uppdatera eller ta bort.",
};

/**
 * 23505 (unique_violation) kräver lite extra parsing för att bli begriplig,
 * eftersom Postgres detail-strängen innehåller constraint-namnet och värdet.
 * Exempel på details: "Key (email)=(test@test.com) already exists."
 */
function translateUniqueViolation(error: SupabaseErrorLike): string {
  const details = error.details ?? "";
  const match = details.match(/Key \(([^)]+)\)=\(([^)]+)\)/);

  if (match) {
    const [, fieldName, value] = match;
    return `Värdet "${value}" finns redan för fältet "${fieldName}". Det måste vara unikt.`;
  }

  return "Angiven primärnyckel eller unikt värde finns redan.";
}

/**
 * Huvudfunktionen: tar emot ett fel från Supabase (t.ex. från { error } i en
 * .insert()/.update()/.rpc()-anrop) och returnerar en översatt version.
 */
export function translateSupabaseError(error: SupabaseErrorLike | null | undefined): TranslatedError {
  if (!error || !error.code) {
    return {
      code: "UNKNOWN",
      swedishMessage: "Ett okänt fel uppstod. Försök igen.",
      originalMessage: error?.message ?? "No error details available",
    };
  }

  const { code, message, details } = error;

  let swedishMessage: string;

  if (code === "23505") {
    swedishMessage = translateUniqueViolation(error);
  } else if (STATIC_TRANSLATIONS[code]) {
    swedishMessage = STATIC_TRANSLATIONS[code];
  } else {
    // Okänd/ny felkod – fall tillbaka på originalmeddelandet men flagga det tydligt
    swedishMessage = `Ett fel uppstod (kod: ${code}).`;
  }

  return {
    code,
    swedishMessage,
    originalMessage: message ?? "",
    detail: details ?? undefined,
  };
}