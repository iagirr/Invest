import { NextResponse } from "next/server";

import { getAssetDetail } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await context.params;
  return NextResponse.json(await getAssetDetail(symbol));
}
