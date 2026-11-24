import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { parseCountrySummary } from '../src/lib/countrySummary.ts';

test('catalog import retries partial failures, preserves edits and does not recreate deleted rows', async () => {
  const catalog = JSON.parse(readFileSync(new URL('../src/data/catalog-2026.json', import.meta.url)));
  const source = readFileSync(new URL('../src/lib/catalogSeed.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const db = new PGlite();
  try {
    await db.exec('create table redi_records(collection text,id text,data jsonb,primary key(collection,id)); create table redi_summaries(id text primary key,report jsonb,original_csv text);');
    let failSecondBatch = true, batches = 0;
    const client = { from(table) { return {
      select() { return { eq(_column, id) { return { async maybeSingle() { return { data: (await db.query('select id from redi_summaries where id=$1', [id])).rows[0] ?? null }; } }; } }; },
      async upsert(input) {
        if (table === 'redi_records') {
          if (++batches === 2 && failSecondBatch) { failSecondBatch = false; return { error: new Error('Interrupted import') }; }
          for (const row of input) await db.query('insert into redi_records values($1,$2,$3) on conflict do nothing', [row.collection, row.id, JSON.stringify(row.data)]);
        } else await db.query('insert into redi_summaries values($1,$2,$3) on conflict do nothing', [input.id, JSON.stringify(input.report), input.original_csv]);
        return { error: null };
      },
    }; } };
    const load = () => {
      const exports = {};
      vm.runInNewContext(compiled, { exports, require: (name) => {
        if (name === 'server-only') return {};
        if (name === 'crypto') return crypto;
        if (name.includes('catalog-2026.json')) return catalog;
        if (name === './countrySummary') return { parseCountrySummary };
        if (name === './database') return { database: () => client, storageError: error => { throw error; } };
        throw new Error(name);
      } });
      return exports;
    };
    const seed = load();
    await assert.rejects(seed.ensureCatalog(), /Interrupted import/);
    assert.equal((await db.query('select count(*)::int as n from redi_records')).rows[0].n, 200);
    await db.query("update redi_records set data=jsonb_set(data,'{name}','\"Edited by user\"') where id=$1", [catalog.communities[0].id]);
    await seed.ensureCatalog();
    assert.equal((await db.query('select count(*)::int as n from redi_records')).rows[0].n, 628);
    assert.equal((await db.query('select data from redi_records where id=$1', [catalog.communities[0].id])).rows[0].data.name, 'Edited by user');
    assert.equal((await db.query('select report from redi_summaries')).rows[0].report.sourceSheets.length, 11);
    await db.query('delete from redi_records where id=$1', [catalog.communities[1].id]);
    await load().ensureCatalog(); // Simulate a new cold server instance.
    assert.equal((await db.query('select count(*)::int as n from redi_records')).rows[0].n, 627);
  } finally { await db.close(); }
});
