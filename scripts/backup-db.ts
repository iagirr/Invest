import { createDatabaseBackup } from "../src/lib/db";

async function main() {
  const backup = await createDatabaseBackup();
  console.log(JSON.stringify(backup, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
