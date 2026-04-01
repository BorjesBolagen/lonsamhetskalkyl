import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

// TODO: will set the threshold value in the current user
/*
export async function POST(request: Request) {

    try {
        const supabase = await getSupabaseServerClient();
        const { userId, threshold } = await request.json();
}*/