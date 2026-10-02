import { config } from "dotenv";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
config({ path: [".env.local", ".env"], quiet: true });
if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL before seeding.");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
async function main() {
  for (const id of ["E", "A"] as const)
    await db.child.upsert({ where: { id }, create: { id }, update: {} });
  for (const row of [
    { id: "genesis", source: "GENESIS" as const },
    {
      id: "google-e",
      source: "GOOGLE_CLASSROOM" as const,
      childId: "E" as const,
    },
    {
      id: "google-a",
      source: "GOOGLE_CLASSROOM" as const,
      childId: "A" as const,
    },
  ])
    await db.dataSource.upsert({
      where: { id: row.id },
      create: row,
      update: {},
    });
}
main().finally(() => db.$disconnect());
