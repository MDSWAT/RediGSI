import { sourceLoader } from "./helpers/load-typescript.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
const read = file => fs.readFileSync(new URL(file,import.meta.url),'utf8');
const catalog=JSON.parse(read('../src/data/catalog-2026.json'));
const manifest=JSON.parse(read('../src/data/catalog-boundaries-2026.json'));
const compile=file=>ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const helpers=sourceLoader()(new URL('../src/lib/boundaries.ts',import.meta.url));

test('boundary database upgrade resumes safely, preserves edits/custom shapes/deletions and protects concurrent edits',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create table redi_records(collection text,id text,data jsonb,primary key(collection,id));create table redi_summaries(id text primary key,report jsonb,original_csv text);');
  const originals=catalog.communities.slice(0,6),summaryId='a'.repeat(64);
  for(let i=0;i<6;i++){
   if(i===2)continue;
   const record=structuredClone(originals[i]);
   if(i===0){record.name='User edited name';record.status='validat';}
   if(i===1)record.geometry={type:'Polygon',coordinates:[[[20,40],[21,40],[21,41],[20,40]]]};
   if(i===3)record.geometry.coordinates=[19,39];
   await db.query('insert into redi_records values($1,$2,$3)',['communities',record.id,JSON.stringify(record)]);
  }
  await db.query('insert into redi_summaries values($1,$2,$3)',[summaryId,JSON.stringify({warnings:['Original source warning','610 poziții orientative']}),'original CSV']);
  let fail=true,concurrent=true;
  const client={
   async rpc(){return {data:{communities:(await db.query('select data from redi_records')).rows.map(r=>r.data)}};},
   from(table){
    let fields,id,changes;const filters={};
    const query={select(value){fields=value;return query;},eq(key,value){filters[key]=value;if(key==='id')id=value;return query;},
     async maybeSingle(){return {data:(await db.query(`select ${fields} from ${table} where id=$1`,[id])).rows[0]??null};},
     update(value){changes=value;return query;},
     async upsert(value){await db.query('insert into redi_summaries values($1,$2,$3) on conflict do nothing',[value.id,JSON.stringify(value.report),value.original_csv]);return {error:null};},
     then(resolve,reject){(async()=>{
      if(table==='redi_records'){
       if(id===originals[4].id&&fail){fail=false;return {error:new Error('Interrupted boundary update')};}
       if(id===originals[5].id&&concurrent){concurrent=false;await db.query("update redi_records set data=jsonb_set(data,'{notes}','\"Concurrent user notes\"') where id=$1",[id]);}
       await db.query('update redi_records set data=$1 where collection=$2 and id=$3 and data=$4',[JSON.stringify(changes.data),filters.collection,id,filters.data]);
      }else await db.query('update redi_summaries set report=$1 where id=$2',[JSON.stringify(changes.report),id]);
      return {error:null};
     })().then(resolve,reject);},
    };return query;
   },
  };
  const load=()=>{const exports={};vm.runInNewContext(compile('../src/lib/boundaryImport.ts'),{exports,require:name=>{
   if(name==='server-only')return {};
   if(name==='crypto')return crypto;
   if(name.includes('catalog-boundaries'))return manifest;
   if(name.includes('catalog-2026'))return catalog;
   if(name==='./boundaries')return helpers;
   if(name==='./catalogSeed')return {CATALOG_ID:summaryId,ensureCatalog:async()=>{}};
   if(name==='./database')return {database:()=>client,storageError:e=>{throw e;}};
   throw new Error(name);
  }});return exports;};
  const importer=load();await assert.rejects(importer.ensureBoundaries(),/Interrupted boundary/);
  await importer.ensureBoundaries();
  const records=(await db.query('select data from redi_records')).rows.map(r=>r.data);
  const first=records.find(r=>r.id===originals[0].id);
  assert.equal(first.name,'User edited name');assert.equal(first.status,'validat');assert.equal(first.locationAccuracy,'administrative');
  assert.equal(records.find(r=>r.id===originals[1].id).boundary,undefined);
  assert.equal(records.find(r=>r.id===originals[3].id).boundary,undefined);
  assert.equal(records.find(r=>r.id===originals[5].id).notes,'Concurrent user notes');
  assert.equal(records.filter(r=>r.boundary).length,3);assert.equal(records.length,5);
  const report=(await db.query('select report from redi_summaries where id=$1',[summaryId])).rows[0].report;
  assert.ok(report.warnings.includes('Original source warning'));assert.ok(!report.warnings.includes('610 poziții orientative'));
  await db.query('delete from redi_summaries where id<>$1',[summaryId]);
  await load().ensureBoundaries(); // A concurrent worker may revisit the source-summary note.
  const latestReport=(await db.query('select report from redi_summaries where id=$1',[summaryId])).rows[0].report;
  assert.equal(latestReport.warnings.filter(note=>note.startsWith('Contururi administrative:')).length,1);
  await db.query('delete from redi_records where id=$1',[originals[0].id]);
  await load().ensureBoundaries();assert.equal((await db.query('select count(*)::int n from redi_records')).rows[0].n,4);
 }finally{await db.close();}
});
