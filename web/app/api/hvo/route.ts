import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/authHelpers";
import { DEFAULT_HVO_PERCENTAGE } from "@/lib/constants";
import type { Json } from "@/lib/supabaseServerSchema";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseHvoPercentage(filters: unknown): number {
  if (
    isPlainObject(filters) &&
    typeof filters.hvoPercentage === "number" &&
    Number.isFinite(filters.hvoPercentage) &&
    filters.hvoPercentage >= 0
  ) {
    return filters.hvoPercentage;
  }

  return DEFAULT_HVO_PERCENTAGE;
}

function mergeHvoPercentageIntoFilters(
  filters: Json | null,
  hvoPercentage: number,
): Json {
  if (isPlainObject(filters)) {
    return {
      ...filters,
      hvoPercentage,
    } as Json;
  }

  return {
    hvoPercentage,
  } as Json;
}

async function requireAdmin() {
  const { error: userError } = await requireUser();
  if (userError) return { supabase: null, userId: null, error: userError };

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      supabase,
      userId: null,
      error: NextResponse.json(
        { status: false, message: "Ej autentiserad" },
        { status: 401 },
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("User")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      supabase,
      userId: user.id,
      error: NextResponse.json(
        {
          status: false,
          message:
            "Kunde inte kontrollera adminbehörighet: " + profileError.message,
        },
        { status: 500 },
      ),
    };
  }

  if (profile?.role !== "admin") {
    return {
      supabase,
      userId: user.id,
      error: NextResponse.json(
        { status: false, message: "Saknar behörighet" },
        { status: 403 },
      ),
    };
  }

  return { supabase, userId: user.id, error: null };
}

export async function GET() {
  const { supabase, userId, error } = await requireAdmin();
  if (error) return error;

  const { data, error: fetchError } = await supabase!
    .from("User")
    .select("filters")
    .eq("id", userId!)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      {
        status: false,
        message: "Kunde inte hämta HVO-inställning: " + fetchError.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    status: true,
    message: "HVO-inställning hämtad",
    data: {
      hvoPercentage: parseHvoPercentage(data?.filters),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const { supabase, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const hvoPercentage = body?.hvoPercentage;

  if (
    typeof hvoPercentage !== "number" ||
    !Number.isFinite(hvoPercentage) ||
    hvoPercentage < 0
  ) {
    return NextResponse.json(
      { status: false, message: "HVO-procent måste vara ett positivt tal." },
      { status: 400 },
    );
  }

  const { data: users, error: fetchError } = await supabase!
    .from("User")
    .select("id, filters");

  if (fetchError) {
    return NextResponse.json(
      {
        status: false,
        message:
          "Kunde inte hämta användarinställningar: " + fetchError.message,
      },
      { status: 500 },
    );
  }

  const updates = (users ?? []).map((user) => {
    const nextFilters = mergeHvoPercentageIntoFilters(
      user.filters,
      hvoPercentage,
    );

    return supabase!
      .from("User")
      .update({ filters: nextFilters })
      .eq("id", user.id);
  });

  const results = await Promise.all(updates);
  const updateError = results.find((result) => result.error)?.error;

  if (updateError) {
    return NextResponse.json(
      {
        status: false,
        message: "Kunde inte spara HVO-inställning: " + updateError.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    status: true,
    message: "HVO-inställning sparad",
    data: { hvoPercentage },
  });
}
