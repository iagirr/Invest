import { NextResponse } from "next/server";

import { createTransaction } from "@/lib/portfolio";
import { transactionInputSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = transactionInputSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Payload invalido.",
        },
        { status: 400 },
      );
    }

    const id = createTransaction(parsed.data);

    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json({ error: "No se pudo registrar la operacion." }, { status: 500 });
  }
}
