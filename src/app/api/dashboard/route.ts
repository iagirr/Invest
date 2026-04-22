import { NextResponse } from "next/server";

import { getDashboardData } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getDashboardData());
}
