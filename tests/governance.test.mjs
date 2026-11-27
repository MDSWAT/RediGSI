import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const migration = (name) =>
  readFileSync(
    new URL(`../supabase/migrations/${name}`, import.meta.url),
    "utf8",
  );
const ADMIN = "00000000-0000-4000-8000-000000000001",
  EDITOR = "00000000-0000-4000-8000-000000000002",
  VIEWER = "00000000-0000-4000-8000-000000000003";
test("governance enforces roles, geography, privacy, proposal transitions, audit and restoration in PostgreSQL", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
 insert into auth.users values ('${ADMIN}','admin@example.test'),('${EDITOR}','editor@example.test'),('${VIEWER}','viewer@example.test');`);
    await db.exec(migration("202611240001_database_storage.sql"));
    const sql = migration("202611270001_governance.sql");
    await db.exec(sql);
    await db.exec(sql);
    await db.query(
      `insert into public.redi_memberships(user_id,role,scopes,can_review) values ($1,'administrator','[]',true),($2,'gis_editor','[{"country":"RO","county":"Cluj"}]',true),($3,'authorized_viewer','[{"country":"RO"}]',false)`,
      [ADMIN, EDITOR, VIEWER],
    );
    for (const [id, country, county, visibility] of [
      ["ro", "RO", "Cluj", "restricted"],
      ["md", "MD", "Chisinau", "restricted"],
      ["secret", "RO", "Cluj", "confidential"],
    ]) {
      await db.query(
        "insert into public.redi_records(collection,id,data) values('communities',$1,$2)",
        [
          id,
          JSON.stringify({
            id,
            name: id,
            country,
            county,
            visibility,
            notes: "private",
            geometry: { type: "Point", coordinates: [23, 46] },
          }),
        ],
      );
    }
    const actor = async (id) => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id ?? "",
      ]);
      await db.exec(`set role ${id ? "authenticated" : "anon"}`);
    };
    const rpc = async (name, args = []) =>
      (
        await db.query(
          `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as result`,
          args,
        )
      ).rows[0].result;
    await t.test(
      "public cannot read restricted records, raw tables or legacy RPCs",
      async () => {
        await actor(null);
        await assert.rejects(
          rpc("redi_bootstrap_admin", ["admin@example.test"]),
          /permission denied/,
        );
        const data = await rpc("redi_workspace_data");
        assert.equal(data.communities.length, 0);
        assert.equal(data.clients.length, 0);
        await assert.rejects(
          db.query("select * from public.redi_records"),
          /permission denied/,
        );
        await assert.rejects(rpc("redi_read_data"), /permission denied/);
        await assert.rejects(
          rpc("redi_mutate_records", [
            "communities",
            "create",
            "[]",
            [],
            false,
          ]),
          /permission denied/,
        );
      },
    );
    await t.test(
      "viewer geography excludes other countries and confidential data; writes and export revocation are enforced",
      async () => {
        await actor(VIEWER);
        let data = await rpc("redi_workspace_data");
        assert.deepEqual(
          data.communities.map((r) => r.id),
          ["ro"],
        );
        await assert.rejects(
          rpc("redi_mutate_records", [
            "communities",
            "update",
            '[{"id":"ro","name":"hacked"}]',
            [],
            false,
          ]),
          /Editing requires/,
        );
        await actor(ADMIN);
        await rpc("redi_set_member", [
          VIEWER,
          "authorized_viewer",
          '[{"country":"RO"}]',
          true,
          false,
          false,
        ]);
        await actor(VIEWER);
        await assert.rejects(
          rpc("redi_export_data", ["communities"]),
          /Export permission/,
        );
      },
    );
    await t.test(
      "editor cannot update outside scope, move records outside scope, publish or modify permissions",
      async () => {
        await actor(EDITOR);
        await assert.rejects(
          rpc("redi_mutate_records", [
            "communities",
            "update",
            '[{"id":"md","name":"hacked"}]',
            [],
            false,
          ]),
          /Outside geographic scope/,
        );
        await assert.rejects(
          rpc("redi_mutate_records", [
            "communities",
            "update",
            '[{"id":"ro","county":"Brasov"}]',
            [],
            false,
          ]),
          /Outside geographic scope/,
        );
        await assert.rejects(
          rpc("redi_mutate_records", [
            "communities",
            "update",
            '[{"id":"ro","visibility":"public"}]',
            [],
            false,
          ]),
          /Publication requires/,
        );
        await assert.rejects(
          rpc("redi_set_member", [
            EDITOR,
            "administrator",
            "[]",
            true,
            true,
            true,
          ]),
          /Administrator required/,
        );
        await rpc("redi_mutate_records", [
          "communities",
          "update",
          '[{"id":"ro","classification":"rural"}]',
          [],
          false,
        ]);
      },
    );
    let id;
    await t.test(
      "public submission ignores injected publication metadata and stays outside map records",
      async () => {
        await actor(null);
        await assert.rejects(
          rpc("redi_submit_proposal", [
            JSON.stringify({
              name: "Proposal",
              country: "RO",
              geometry: { type: "Point", coordinates: [999, 45] },
              consent: true,
            }),
          ]),
          /Invalid proposal/,
        );
        const result = await rpc("redi_submit_proposal", [
          JSON.stringify({
            name: "Proposal",
            country: "RO",
            county: "Cluj",
            classification: "rural",
            notes: "private note",
            geometry: { type: "Point", coordinates: [23, 46] },
            consent: true,
            status: "published",
            visibility: "public",
          }),
        ]);
        id = result.id;
        assert.equal(result.status, "submitted");
        assert.equal((await rpc("redi_workspace_data")).communities.length, 0);
      },
    );
    await t.test(
      "state machine rejects skipped/stale states and reviewer cannot approve",
      async () => {
        await actor(EDITOR);
        assert.equal((await rpc("redi_list_proposals")).length, 1);
        await assert.rejects(
          rpc("redi_transition_proposal", [
            id,
            "published",
            "submitted",
            "",
            false,
            false,
            true,
          ]),
          /Invalid status transition/,
        );
        await assert.rejects(
          rpc("redi_transition_proposal", [
            id,
            "pending_review",
            null,
            "",
            false,
            false,
            false,
          ]),
          /Proposal changed/,
        );
        await rpc("redi_transition_proposal", [
          id,
          "pending_review",
          "submitted",
          "",
          false,
          false,
          false,
        ]);
        await assert.rejects(
          rpc("redi_transition_proposal", [
            id,
            "under_validation",
            "submitted",
            "",
            false,
            false,
            false,
          ]),
          /Proposal changed/,
        );
        await rpc("redi_transition_proposal", [
          id,
          "under_validation",
          "pending_review",
          "",
          false,
          false,
          false,
        ]);
        await assert.rejects(
          rpc("redi_transition_proposal", [
            id,
            "approved",
            "under_validation",
            "",
            false,
            false,
            false,
          ]),
          /Invalid status transition/,
        );
      },
    );
    await t.test(
      "publication requires privacy review; public projection omits private notes and exact geometry by default",
      async () => {
        await actor(ADMIN);
        await rpc("redi_transition_proposal", [
          id,
          "approved",
          "under_validation",
          "Checked",
          false,
          false,
          false,
        ]);
        await assert.rejects(
          rpc("redi_transition_proposal", [
            id,
            "published",
            "approved",
            "",
            true,
            false,
            false,
          ]),
          /Privacy review/,
        );
        await assert.rejects(
          rpc("redi_transition_proposal", [
            id,
            "published",
            "approved",
            "",
            true,
            true,
            null,
          ]),
          /Privacy review/,
        );
        await rpc("redi_transition_proposal", [
          id,
          "published",
          "approved",
          "Approved for publication",
          true,
          false,
          true,
        ]);
        await actor(null);
        const rows = (await rpc("redi_workspace_data")).communities;
        assert.equal(rows.length, 1);
        assert.equal(rows[0].geometry, null);
        assert.equal(rows[0].notes, undefined);
        assert.equal(rows[0].classification, "rural");
      },
    );
    await t.test(
      "soft deletion restores original records; audit is protected and final administrator cannot be removed",
      async () => {
        await actor(ADMIN);
        await rpc("redi_mutate_records", [
          "communities",
          "delete",
          "[]",
          ["ro"],
          false,
        ]);
        assert.ok(
          !(await rpc("redi_workspace_data")).communities.some(
            (r) => r.id === "ro",
          ),
        );
        let overview = await rpc("redi_admin_overview");
        assert.ok(overview.deleted.some((r) => r.id === "ro"));
        assert.ok(overview.audit.some((e) => e.action === "delete"));
        assert.ok(
          overview.audit.some((e) => e.action === "permissions_changed"),
        );
        const history = await rpc("redi_record_history", ["communities", "ro"]);
        assert.ok(history.some((v) => v.before_data?.notes === "private"));
        await rpc("redi_mutate_records", [
          "communities",
          "restore",
          "[]",
          ["ro"],
          false,
        ]);
        assert.equal(
          (await rpc("redi_workspace_data")).communities.find(
            (r) => r.id === "ro",
          ).classification,
          "rural",
        );
        await assert.rejects(
          rpc("redi_set_member", [
            ADMIN,
            "public_viewer",
            "[]",
            true,
            false,
            false,
          ]),
          /final administrator/,
        );
        await actor(EDITOR);
        await assert.rejects(
          rpc("redi_admin_overview"),
          /Administrator required/,
        );
        await assert.rejects(
          db.query("select * from public.redi_audit_events"),
          /permission denied/,
        );
      },
    );
    await t.test(
      "export excludes contacts, personal names, notes and arbitrary imported columns",
      async () => {
        await actor(ADMIN);
        await db.exec("reset role");
        await db.query(
          "insert into public.redi_records(collection,id,data) values('entrepreneurs','business-private',$1)",
          [
            JSON.stringify({
              id: "business-private",
              country: "RO",
              county: "Cluj",
              name: "Person",
              business: "Company",
              email: "person@example.test",
              phone: "private",
              notes: "private",
              extra: { contact: "private" },
            }),
          ],
        );
        await actor(ADMIN);
        const rows = await rpc("redi_export_data", ["entrepreneurs"]);
        assert.equal(rows[0].business, "Company");
        for (const field of ["name", "email", "phone", "notes", "extra"])
          assert.equal(rows[0][field], undefined);
      },
    );
    await t.test(
      "global summary import enforces roles, is idempotent and records the verified actor",
      async () => {
        const id = createHash("sha256").update("original").digest("hex");
        const report = JSON.stringify({
          title: "Synthetic summary",
          countries: [],
          totals: { localities: 1 },
        });
        await actor(EDITOR);
        await assert.rejects(
          rpc("redi_import_summary", [id, report, "original"]),
          /Global editor access/,
        );
        await actor(VIEWER);
        await assert.rejects(
          rpc("redi_summary_source", [id]),
          /Administrator required/,
        );
        await actor(ADMIN);
        assert.equal(
          (await rpc("redi_import_summary", [id, report, "original"]))
            .duplicate,
          false,
        );
        assert.equal(
          (await rpc("redi_import_summary", [id, report, "original"]))
            .duplicate,
          true,
        );
        assert.equal(await rpc("redi_summary_source", [id]), "original");
        assert.ok(
          (await rpc("redi_record_history", ["summary", id])).some(
            (e) => e.actor_id === ADMIN && e.action === "import",
          ),
        );
        await actor(EDITOR);
        assert.deepEqual(await rpc("redi_workspace_summaries"), []);
      },
    );
    await t.test(
      "multiple territories unite while batches and both previous and next scope remain atomic",
      async () => {
        await actor(ADMIN);
        await rpc("redi_set_member", [
          EDITOR,
          "gis_editor",
          JSON.stringify([
            { country: "RO", county: "Cluj" },
            { country: "MD", county: "Chisinau" },
          ]),
          true,
          true,
          true,
        ]);
        await actor(EDITOR);
        assert.ok(
          (await rpc("redi_workspace_data")).communities.some(
            (c) => c.id === "md",
          ),
        );
        await assert.rejects(
          rpc("redi_mutate_records", [
            "communities",
            "update",
            JSON.stringify([
              { id: "ro", name: "This must roll back" },
              { id: "md", county: "Outside grant" },
            ]),
            [],
            false,
          ]),
          /Outside geographic scope/,
        );
        assert.equal(
          (await rpc("redi_workspace_data")).communities.find(
            (c) => c.id === "ro",
          ).name,
          "ro",
        );
      },
    );
  } finally {
    await db.close();
  }
});
