import { NextResponse } from "next/server";

import { searchAssets } from "@/lib/market";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";

    if (!query.trim()) {
      return NextResponse.json({ results: [] });
    }

    const results = await searchAssets(query);
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo buscar activos.",
      },
      { status: 500 },
    );
  }
}
