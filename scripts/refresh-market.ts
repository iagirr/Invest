import { refreshMarketData } from "../src/lib/market";

async function main() {
  const summary = await refreshMarketData();
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
