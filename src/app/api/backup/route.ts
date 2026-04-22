import { NextResponse } from "next/server";

import { createDatabaseBackup } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const backup = await createDatabaseBackup();
    return NextResponse.json({ ok: true, ...backup });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo crear el backup.",
      },
      { status: 500 },
    );
  }
}
