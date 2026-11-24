import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../supabase/migrations/202611240001_database_storage.sql", import.meta.url), "utf8");

test("database migration preserves complete data, atomic patches, scoped deletes and source originals", async () => {
  const db = new PGlite(); // In-memory PostgreSQL, no application data files.
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(migration);
    await db.exec(migration); // Safe to apply again.
    await db.exec("set role service_role;");
    const empty = (await db.query("select public.redi_read_data() as data")).rows[0].data;
    assert.deepEqual(empty, { communities: [], entrepreneurs: [], clients: [], localities: [] });
    await db.query(`insert into public.redi_records(collection,id,data)
      select 'localities', 'locality-' || n, jsonb_build_object('id', 'locality-' || n, 'siruta', n, 'extra', jsonb_build_object('original', 'păstrat'))
      from generate_series(1, 1501) as n`);
    const community = { id: "community-a", name: "Test", status: "propus", country: "RO", geometry: { type: "Point", coordinates: [25, 45] }, extra: { original: "sursă" } };
    await db.query("insert into public.redi_records(collection,id,data) values ('communities',$1,$2)", [community.id, JSON.stringify(community)]);
    const snapshot = (await db.query("select public.redi_read_data() as data")).rows[0].data;
    assert.equal(snapshot.localities.length, 1501);
    assert.deepEqual(snapshot.communities[0], community);
    const patches = [{ id: community.id, status: "validat" }, { id: "missing", name: "Ignore" }, { id: community.id, status: "propus", name: "Updated" }];
    const updated = (await db.query("select public.redi_update_records($1,$2) as data", ["communities", JSON.stringify(patches)])).rows[0].data;
    assert.deepEqual(updated, [{ ...community, name: "Updated" }]);
    await db.query("select public.redi_update_records($1,$2)", ["communities", JSON.stringify([{ id: community.id, population: 0 }])]);
    const latest = (await db.query("select public.redi_read_data() as data")).rows[0].data.communities[0];
    assert.equal(latest.name, "Updated");
    assert.equal(latest.population, 0);
    assert.deepEqual(latest.geometry, community.geometry);
    assert.deepEqual(latest.extra, community.extra);
    assert.equal((await db.query("select public.redi_delete_records('localities', array['locality-1'], false) as n")).rows[0].n, 1);
    assert.equal((await db.query("select public.redi_delete_records('communities', '{}', true) as n")).rows[0].n, 1);
    assert.equal((await db.query("select public.redi_read_data() as data")).rows[0].data.localities.length, 1500);
    const id = "a".repeat(64);
    const source = '\uFEFFȚară,Observație\r\nRO,"text, original"\r\n';
    await db.query("insert into public.redi_summaries(id,report,original_csv) values ($1,$2,$3)", [id, JSON.stringify({ title: "Test", notes: ["original"] }), source]);
    await assert.rejects(db.query("insert into public.redi_summaries(id,report,original_csv) values ($1,'{}','duplicate')", [id]), /duplicate key/);
    // Compare database bytes, including BOM; avoid the test driver's text decoder normalization.
    assert.equal((await db.query("select encode(convert_to(original_csv, 'UTF8'), 'hex') as bytes from public.redi_summaries where id=$1", [id])).rows[0].bytes, Buffer.from(source, "utf8").toString("hex"));
    await db.exec("reset role; set role anon;");
    await assert.rejects(db.query("select * from public.redi_records"), /permission denied/);
    await assert.rejects(db.query("select * from public.redi_summaries"), /permission denied/);
    await assert.rejects(db.query("select public.redi_read_data()"), /permission denied/);
    await assert.rejects(db.query("select public.redi_delete_records('communities','{}',true)"), /permission denied/);
  } finally { await db.close(); }
});
