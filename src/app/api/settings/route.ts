import { NextResponse } from "next/server";

import { setAppSetting } from "@/lib/db";
import { settingsInputSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = settingsInputSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Payload inválido.",
        },
        { status: 400 },
      );
    }

    setAppSetting("benchmarkSymbol", parsed.data.benchmarkSymbol);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el benchmark." }, { status: 500 });
  }
}
