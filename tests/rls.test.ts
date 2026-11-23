import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Boundary test for DIRECT database access: assert the migration's RLS posture
// denies anon and authenticated clients. All access must go through the server
// (service role), so NO policy may grant the anon or authenticated role access
// to these tables. This fails if a permissive policy is reintroduced.

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(here, "..", "supabase", "migrations", "0001_init.sql"),
  "utf8"
);

const TABLES = ["site", "room", "asset", "ticket", "coordinator"];

describe("RLS posture (migration)", () => {
  it("enables row level security on every data table", () => {
    for (const t of TABLES) {
      expect(sql).toMatch(
        new RegExp(`alter table ${t} enable row level security`)
      );
    }
  });

  it("defines NO policy granting the anon role table access", () => {
    expect(sql).not.toMatch(/create policy[^;]*to anon/i);
  });

  it("defines NO policy granting the authenticated role table access", () => {
    expect(sql).not.toMatch(/create policy[^;]*to authenticated/i);
  });

  it("defines no table policies at all (service-role-only access)", () => {
    expect(sql).not.toMatch(/create policy/i);
  });
});
