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
    const editingSQL = migration("202611270002_geometry_editing.sql");
    await db.exec(editingSQL);
    await db.exec(editingSQL);
    const managementSQL = migration("202611270003_data_management.sql");
    await db.exec(managementSQL);
    await db.exec(managementSQL);
    const exportPrivacySQL = migration("202611270004_export_privacy.sql");
    await db.exec(exportPrivacySQL);
    await db.exec(exportPrivacySQL);
    const censusSQL = migration("202611270005_public_census_figures.sql");
    await db.exec(censusSQL);
    await db.exec(censusSQL);
    const speedSQL = migration("202611270006_workspace_data_speed.sql");
    await db.exec(speedSQL);
    await db.exec(speedSQL);
    const publicViewSQL = migration("202611270007_stored_public_view.sql");
    await db.exec(publicViewSQL);
    await db.exec(publicViewSQL);
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
    await t.test(
      "geometry edits require editor scope, explicit valid coordinates and the exact previous version",
      async () => {
        await actor(ADMIN);
        await rpc("redi_set_member", [
          EDITOR,
          "gis_editor",
          '[{"country":"RO","county":"Cluj"}]',
          true,
          true,
          true,
        ]);
        const original = { type: "Point", coordinates: [23, 46] },
          changed = { type: "Point", coordinates: [23.5, 46.5] };
        await actor(null);
        await assert.rejects(
          rpc("redi_update_geometry", [
            "ro",
            JSON.stringify(changed),
            JSON.stringify(original),
          ]),
          /permission denied/,
        );
        await actor(VIEWER);
        await assert.rejects(
          rpc("redi_update_geometry", [
            "ro",
            JSON.stringify(changed),
            JSON.stringify(original),
          ]),
          /GIS editor/,
        );
        await actor(EDITOR);
        await assert.rejects(
          rpc("redi_update_geometry", [
            "md",
            JSON.stringify(changed),
            JSON.stringify(original),
          ]),
          /Outside geographic scope/,
        );
        await assert.rejects(
          rpc("redi_update_geometry", [
            "ro",
            JSON.stringify({ type: "Point", coordinates: [999, 46] }),
            JSON.stringify(original),
          ]),
          /Invalid geometry/,
        );
        await assert.rejects(
          rpc("redi_mutate_records", [
            "communities",
            "update",
            JSON.stringify([{ id: "ro", geometry: changed }]),
            [],
            false,
          ]),
          /version-checked geometry editor/,
        );
        const saved = await rpc("redi_update_geometry", [
          "ro",
          JSON.stringify(changed),
          JSON.stringify(original),
        ]);
        assert.deepEqual(saved.geometry, changed);
        assert.equal(saved.geometrySource, "manual_correction");
        assert.equal(saved.notes, "private");
        await assert.rejects(
          rpc("redi_update_geometry", [
            "ro",
            JSON.stringify(original),
            JSON.stringify(original),
          ]),
          /Geometry changed/,
        );
        await assert.rejects(
          rpc("redi_mutate_records", [
            "communities",
            "update",
            JSON.stringify([{ id: "ro", geometry: original }]),
            [],
            false,
          ]),
          /version-checked geometry editor/,
        );
        await actor(ADMIN);
        const history = await rpc("redi_record_history", ["communities", "ro"]);
        assert.ok(
          history.some(
            (e) =>
              e.before_data?.geometry?.coordinates?.[0] === 23 &&
              e.after_data?.geometry?.coordinates?.[0] === 23.5,
          ),
        );
      },
    );
    await t.test(
      "public records remain frozen across editor changes until explicit administrator republication",
      async () => {
        const recordId = "proposal-" + id;
        await actor(EDITOR);
        const before = (await rpc("redi_workspace_data")).communities.find(
          (c) => c.id === recordId,
        );
        await rpc("redi_mutate_records", [
          "communities",
          "update",
          JSON.stringify([{ id: recordId, name: "Pending editor change" }]),
          [],
          false,
        ]);
        await actor(null);
        assert.equal(
          (await rpc("redi_workspace_data")).communities.find(
            (c) => c.id === recordId,
          ).name,
          "Proposal",
        );
        await actor(EDITOR);
        await assert.rejects(
          rpc("redi_mutate_records", [
            "communities",
            "update",
            JSON.stringify([
              { id: recordId, publicRecord: { id: recordId, name: "bypass" } },
            ]),
            [],
            false,
          ]),
          /reviewed publication workflow/,
        );
        await assert.rejects(
          rpc("redi_publish_community_assessed", [
            recordId,
            JSON.stringify(before),
            true,
            false,
            JSON.stringify({ level: "low", factors: [] }),
          ]),
          /permission denied|Administrator required/,
        );
        await actor(ADMIN);
        await assert.rejects(
          rpc("redi_publish_community_assessed", [
            recordId,
            JSON.stringify(before),
            true,
            false,
            JSON.stringify({ level: "low", factors: [] }),
          ]),
          /Record changed/,
        );
        const current = (await rpc("redi_workspace_data")).communities.find(
          (c) => c.id === recordId,
        );
        await assert.rejects(
          rpc("redi_publish_community_assessed", [
            recordId,
            JSON.stringify(current),
            true,
            false,
            "{}",
          ]),
          /Privacy assessment required/,
        );
        await assert.rejects(
          rpc("redi_publish_community", [
            recordId,
            JSON.stringify(current),
            true,
            false,
            true,
          ]),
          /permission denied/,
        );
        const stored = await rpc("redi_publish_community_assessed", [
          recordId,
          JSON.stringify(current),
          true,
          false,
          JSON.stringify({ level: "low", factors: [] }),
        ]);
        assert.equal(stored.privacyAssessment.level, "low");
        assert.equal(stored.privacyAssessment.assessedBy, ADMIN);
        await actor(null);
        const published = (await rpc("redi_workspace_data")).communities.find(
          (c) => c.id === recordId,
        );
        assert.equal(published.name, "Pending editor change");
        assert.equal(published.geometry, null);
        assert.equal(published.notes, undefined);
        assert.equal(published.geocoding, undefined);
      },
    );
    await t.test(
      "classification administration is versioned, public names are reduced and archival preserves legacy values",
      async () => {
        await actor(EDITOR);
        await assert.rejects(
          rpc("redi_classification_save", [
            null,
            "Rural",
            "internal description",
            true,
            null,
          ]),
          /Administrator required/,
        );
        await actor(ADMIN);
        const category = await rpc("redi_classification_save", [
          null,
          "Rural",
          "internal description",
          true,
          null,
        ]);
        await actor(null);
        const publicList = await rpc("redi_classification_list");
        assert.equal(publicList[0].name, "Rural");
        assert.equal(publicList[0].description, undefined);
        await actor(ADMIN);
        const archived = await rpc("redi_classification_save", [
          category.id,
          "Rural",
          "internal description",
          false,
          category.updated_at,
        ]);
        await assert.rejects(
          rpc("redi_classification_save", [
            category.id,
            "New name",
            "",
            true,
            category.updated_at,
          ]),
          /Classification changed/,
        );
        assert.equal(archived.active, false);
        assert.ok(
          (await rpc("redi_record_history", ["classification", category.id]))
            .length >= 2,
        );
        await actor(null);
        assert.deepEqual(await rpc("redi_classification_list"), []);
      },
    );
    await t.test(
      "export field groups are granted per member and audited; exact-geometry publication needs a justified risk assessment",
      async () => {
        await db.exec("reset role");
        await db.query(
          "insert into public.redi_records(collection,id,data) values('clients','fin',$1),('communities','privacy-pt',$2)",
          [
            JSON.stringify({ id: "fin", partner: "Partner", amount: 100, currency: "RON", year: "2025", lat: 46, lng: 23, country: "RO", county: "Cluj" }),
            JSON.stringify({ id: "privacy-pt", name: "Point", kind: "punct", status: "validat", country: "RO", county: "Cluj", population: 900, notes: "private", geometry: { type: "Point", coordinates: [23, 46] }, extra: { "Romi recens.": "1,236", "Prag REDI": "150", "Observatii / validare": "internal", contact: "private" } }),
          ],
        );
        await actor(ADMIN);
        await rpc("redi_set_member", [VIEWER, "authorized_viewer", '[{"country":"RO"}]', true, false, true]);
        await actor(VIEWER);
        assert.deepEqual((await rpc("redi_access_profile")).exportGroups, []);
        let row = (await rpc("redi_export_data", ["clients"])).find((r) => r.id === "fin");
        assert.equal(row.year, "2025");
        for (const field of ["amount", "currency", "partner", "lat", "lng"])
          assert.equal(row[field], undefined);
        await assert.rejects(rpc("redi_set_export_groups", [VIEWER, ["financial"]]), /Administrator required/);
        await actor(ADMIN);
        await assert.rejects(rpc("redi_set_export_groups", [VIEWER, ["everything"]]), /Invalid export groups/);
        await rpc("redi_set_export_groups", [VIEWER, ["financial"]]);
        assert.deepEqual((await rpc("redi_export_groups_overview"))[VIEWER], ["financial"]);
        await actor(VIEWER);
        row = (await rpc("redi_export_data", ["clients"])).find((r) => r.id === "fin");
        assert.equal(row.amount, 100);
        assert.equal(row.currency, "RON");
        assert.equal(row.partner, undefined);
        assert.equal(row.lat, undefined);
        await actor(ADMIN);
        const audit = (await rpc("redi_admin_overview")).audit;
        assert.ok(audit.some((a) => a.action === "export_fields_changed" && a.entity_id === VIEWER));
        const current = (await rpc("redi_workspace_data")).communities.find((c) => c.id === "privacy-pt");
        await assert.rejects(
          rpc("redi_publish_community_assessed", ["privacy-pt", JSON.stringify(current), true, true, JSON.stringify({ level: "low", factors: [] })]),
          /Privacy justification required/,
        );
        const published = await rpc("redi_publish_community_assessed", [
          "privacy-pt",
          JSON.stringify(current),
          true,
          true,
          JSON.stringify({ level: "low", factors: ["exact_point"], justification: "Community consented to a public marker." }),
        ]);
        assert.equal(published.privacyAssessment.level, "high");
        assert.equal(published.privacyAssessment.sharedGeometry, true);
        await actor(null);
        const visible = (await rpc("redi_workspace_data")).communities.find((c) => c.id === "privacy-pt");
        assert.equal(visible.population, 900);
        assert.equal(visible.extra["Romi recens."], "1,236");
        assert.equal(visible.extra["Prag REDI"], "150");
        assert.equal(visible.extra["Observatii / validare"], undefined);
        assert.equal(visible.extra.contact, undefined);
        assert.equal(visible.notes, undefined);
        await actor(EDITOR);
        await assert.rejects(
          rpc("redi_mutate_records", ["communities", "update", JSON.stringify([{ id: "privacy-pt", privacyAssessment: { level: "low" } }]), [], false]),
          /reviewed publication workflow/,
        );
      },
    );
    await t.test(
      "geocoding requires an editable in-scope record and enforces an application-wide request budget",
      async () => {
        await actor(VIEWER);
        await assert.rejects(rpc("redi_geocode_permit"), /GIS editor/);
        await actor(EDITOR);
        await assert.rejects(
          rpc("redi_geocode_target", ["md"]),
          /Outside geographic scope/,
        );
        const area = await rpc("redi_geocode_target", ["ro"]);
        assert.equal(area.country, "RO");
        assert.equal(area.county, "Cluj");
        assert.equal(area.name, undefined);
        await rpc("redi_geocode_permit");
        await assert.rejects(
          rpc("redi_geocode_permit"),
          /Geocoder request limit/,
        );
        await actor(ADMIN);
        await assert.rejects(
          rpc("redi_geocode_permit"),
          /Geocoder request limit/,
        );
      },
    );
  } finally {
    await db.close();
  }
});
