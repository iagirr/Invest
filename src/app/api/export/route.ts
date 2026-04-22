import { exportJsonFile, exportTransactionsCsvFile } from "@/lib/export";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "json";

  if (format === "csv") {
    const file = await exportTransactionsCsvFile();
    return new Response(file.content, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${file.fileName}"`,
        "X-Export-Path": file.path,
      },
    });
  }

  const file = await exportJsonFile();
  return new Response(file.content, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.fileName}"`,
      "X-Export-Path": file.path,
    },
  });
}
