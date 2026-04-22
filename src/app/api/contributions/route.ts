import { NextResponse } from "next/server";

import { getDatabase } from "@/lib/db";
import { getLiveMarketQuote, refreshMarketData } from "@/lib/market";
import { createInstrumentFlow } from "@/lib/portfolio";
import { contributionInputSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = contributionInputSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Payload invalido.",
        },
        { status: 400 },
      );
    }

    const db = getDatabase();
    const instrument = db
      .prepare("SELECT symbol FROM tracked_instruments WHERE id = ?")
      .get(parsed.data.trackedInstrumentId) as { symbol: string } | undefined;

    if (!instrument) {
      return NextResponse.json({ error: "No existe el instrumento indicado." }, { status: 404 });
    }

    const liveMarket = await getLiveMarketQuote(instrument.symbol);
    const liveQuote = {
      currentPriceEur: liveMarket.priceEur,
      currentPriceNative: liveMarket.price,
      fetchedAt: new Date().toISOString(),
      changePercent: liveMarket.changePercent,
    };

    const id = createInstrumentFlow(parsed.data, liveQuote);
    await refreshMarketData();

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo registrar la aportacion.",
      },
      { status: 500 },
    );
  }
}
