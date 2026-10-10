import { ensureLedgerFixtureOnDisk } from "../lib/ledger-fixture";

async function main() {
  const filePath = await ensureLedgerFixtureOnDisk();
  console.log(`Generated Global E-Commerce Lead Ledger fixture at: ${filePath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
