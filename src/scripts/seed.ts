import { ensureWorkspaceSeeded } from "../lib/seed-workspace";

async function main() {
  const result = await ensureWorkspaceSeeded();
  console.log("Workspace seed check complete:", result);
}

main().catch((err) => {
  console.error("Failed to seed workspace:", err);
  process.exit(1);
});
