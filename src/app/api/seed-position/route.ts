import { NextResponse } from "next/server";

import { getLiveMarketQuote, refreshMarketData } from "@/lib/market";
import { createTrackedInstrument, updateTrackedInstrument } from "@/lib/portfolio";
import { trackedInstrumentInputSchema, trackedInstrumentUpdateInputSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = trackedInstrumentInputSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Payload invalido.",
        },
        { status: 400 },
      );
    }

    const marketQuote = parsed.data.isActive ? await getLiveMarketQuote(parsed.data.symbol) : null;
    const liveQuote = marketQuote
      ? {
          currentPriceEur: marketQuote.priceEur,
          currentPriceNative: marketQuote.price,
          fetchedAt: new Date().toISOString(),
          changePercent: marketQuote.changePercent,
        }
      : null;
    const id = createTrackedInstrument(parsed.data, liveQuote);

    if (parsed.data.isActive) {
      await refreshMarketData();
    }

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo registrar el seguimiento inicial.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json();
    const parsed = trackedInstrumentUpdateInputSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Payload invalido.",
        },
        { status: 400 },
      );
    }

    const marketQuote = parsed.data.isActive ? await getLiveMarketQuote(parsed.data.symbol) : null;
    const liveQuote = marketQuote
      ? {
          currentPriceEur: marketQuote.priceEur,
          currentPriceNative: marketQuote.price,
          fetchedAt: new Date().toISOString(),
          changePercent: marketQuote.changePercent,
        }
      : null;

    const id = updateTrackedInstrument(parsed.data, liveQuote);

    if (parsed.data.isActive) {
      await refreshMarketData();
    }

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo actualizar el seguimiento inicial.",
      },
      { status: 500 },
    );
  }
}
