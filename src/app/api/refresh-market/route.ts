import { NextResponse } from "next/server";

import { refreshMarketData } from "@/lib/market";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const summary = await refreshMarketData();
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo refrescar mercado.",
      },
      { status: 500 },
    );
  }
}
