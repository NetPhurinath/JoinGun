import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../database.js';
import { createApp } from '../app.js';

async function fixture(t) {
  const store = openDatabase(':memory:');
  const server = createApp(store).listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));store.close();});
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = body => fetch(`${url}/api/posts`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  return {store,url,post};
}
const activity = () => ({type:'activity',content:'Play badminton together',locationConsent:true,activity:{title:'Badminton',startsAt:new Date(Date.now()+86400000).toISOString(),location:'Campus sports hall',capacity:8}});

test('text and activity posts round-trip through HTTP and SQLite with private audit records',async t=>{
  const {store,url,post}=await fixture(t);
  const first=await post({type:'text',content:" Hello '); DROP TABLE posts; -- <script>alert(1)</script> "});
  assert.equal(first.status,201);const text=await first.json();
  assert.equal(text.author.id,'demo-student');assert.equal(text.activity,null);
  assert.equal(first.headers.get('location'),`/api/posts/${text.id}`);
  assert.equal((await (await fetch(url+first.headers.get('location'))).json()).content,text.content);
  const second=await post(activity());assert.equal(second.status,201);const a=await second.json();
  assert.equal(a.activity.capacity,8);
  const feed=await (await fetch(`${url}/api/posts`)).json();
  assert.deepEqual(feed.items.map(p=>p.id),[a.id,text.id]);
  assert.equal(JSON.stringify(feed).includes('ip_address'),false);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM audit_logs').get().n,2);
  const consent=store.db.prepare('SELECT * FROM consent_records').get();
  assert.equal(consent.terms_version,'location-v1');assert.equal(consent.post_id,a.id);
});
test('invalid requests do not create posts, consent or audit records',async t=>{
  const {post,store}=await fixture(t);
  const bad=[null,[],{type:'other',content:'x'},{type:'text',content:'   '},{type:'text',content:'x'.repeat(5001)}, {type:'text',content:'x',authorId:'admin'}, {type:'text',content:'x',activity:{}}, {...activity(),locationConsent:false}, {...activity(),activity:{...activity().activity,capacity:2.5}}, {...activity(),activity:{...activity().activity,startsAt:'2020-01-01T12:00:00Z'}}, {...activity(),activity:{...activity().activity,startsAt:'2099-02-30T12:00:00Z'}}, {...activity(),activity:{...activity().activity,startsAt:'2099-01-01T24:00:00Z'}}, {...activity(),activity:{...activity().activity,startsAt:'2099-01-01T12:00:00'}}, {...activity(),activity:{...activity().activity,location:''}}];
  for(const body of bad) assert.equal((await post(body)).status,400,JSON.stringify(body));
  for(const table of ['posts','activities','consent_records','audit_logs'])assert.equal(store.db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n,0);
});
test('feed pagination is stable when a newer post arrives',async t=>{
  const {url,post}=await fixture(t);
  const ids=[];for(let i=0;i<3;i++)ids.push((await (await post({type:'text',content:`post ${i}`})).json()).id);
  const first=await (await fetch(`${url}/api/posts?limit=2`)).json();
  assert.deepEqual(first.items.map(p=>p.id),[ids[2],ids[1]]);
  await post({type:'text',content:'new arrival'});
  const second=await (await fetch(`${url}/api/posts?limit=2&before=${first.nextCursor}`)).json();
  assert.deepEqual(second.items.map(p=>p.id),[ids[0]]);assert.equal(second.nextCursor,null);
  for(const query of ['limit=0','limit=101','limit=abc','before=-1','before=1.5','limit=2&limit=3'])assert.equal((await fetch(`${url}/api/posts?${query}`)).status,400);
});
test('JSON errors, body limits, unknown routes and private file paths are handled',async t=>{
  const {url}=await fixture(t);
  assert.equal((await fetch(`${url}/api/posts`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
  assert.equal((await fetch(`${url}/api/posts`,{method:'POST',body:'hello'})).status,415);
  assert.equal((await fetch(`${url}/api/posts`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:'x'.repeat(40000)})})).status,413);
  for(const path of ['/api/posts/missing','/rule.md','/data/joingun.sqlite','/.git/config'])assert.equal((await fetch(url+path)).status,404);
  assert.equal((await fetch(url)).status,200);
  assert.equal((await fetch(url+'/api/health')).status,200);
});
test('failed audit write rolls back post and activity atomically',async t=>{
  const {store,post}=await fixture(t);
  store.db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT, 'test failure'); END;");
  assert.equal((await post(activity())).status,500);
  for(const table of ['posts','activities','consent_records','audit_logs'])assert.equal(store.db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n,0);
});
test('posts persist after closing and reopening the database',()=>{
  const dir=mkdtempSync(join(tmpdir(),'joingun-test-'));let store;
  try {
    const file=join(dir,'test.sqlite');store=openDatabase(file);
    const post=store.create({type:'text',content:'persistent',activity:null},{userId:'demo-student',ip:'127.0.0.1'});
    store.close();store=openDatabase(file);assert.equal(store.get(post.id).content,'persistent');
    assert.equal(store.db.prepare('SELECT count(*) AS n FROM audit_logs').get().n,1);
  } finally {
    store?.close();
    const target = resolve(dir);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('joingun-test-'));
    rmSync(target,{recursive:true,force:true});
  }
});
test('original UI routes load and new activity fields round-trip',async t=>{
  const {url,post}=await fixture(t);
  const root=await (await fetch(url)).text();assert.match(root,/\.docs\/02-design\/prototype\/index.html/);
  const html=await (await fetch(`${url}/.docs/02-design/prototype/index.html`)).text();
  assert.match(html,/id="post-type"/);assert.match(html,/id="location-consent"/);
  for(const asset of ['app.js','styles.css'])assert.equal((await fetch(`${url}/.docs/02-design/prototype/${asset}`)).status,200);
  assert.equal((await fetch(`${url}/.docs/01-requirements/backlog.md`)).status,404);
  const body=activity();Object.assign(body.activity,{category:'study',meeting:'Front door',lat:20.04,lng:99.89});
  const response=await post(body);assert.equal(response.status,201);const saved=await response.json();
  assert.equal(saved.activity.category,'study');assert.equal(saved.activity.meeting,'Front door');assert.equal(saved.activity.lat,20.04);
  const again=await (await fetch(`${url}/api/posts/${saved.id}`)).json();assert.deepEqual(again,saved);
  for(const invalid of [{lat:91,lng:99},{lat:20},{category:'bad'},{meeting:'x'.repeat(1001)}]) {
    const a=activity();Object.assign(a.activity,invalid);assert.equal((await post(a)).status,400);
  }
});
test('additive schema migration preserves earlier activity data',()=>{
  const dir=mkdtempSync(join(tmpdir(),'joingun-test-'));let store;
  try {
    const filename=join(dir,'legacy.sqlite');const db=new DatabaseSync(filename);
    db.exec(`CREATE TABLE posts(sequence INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE,author_id TEXT,type TEXT,content TEXT,created_at TEXT);
      CREATE TABLE activities(post_id TEXT PRIMARY KEY,title TEXT,starts_at TEXT,location TEXT,capacity INTEGER);
      INSERT INTO posts VALUES(1,'old','demo-student','activity','Keep me','2026-10-01T00:00:00Z');
      INSERT INTO activities VALUES('old','Existing','2099-01-01T00:00:00Z','Library',5);`);
    db.close();store=openDatabase(filename);
    assert.equal(store.get('old').content,'Keep me');assert.equal(store.get('old').activity.location,'Library');assert.equal(store.get('old').activity.lat,null);
    store.close();store=openDatabase(filename);assert.equal(store.get('old').activity.category,'sport');
  }finally{store?.close();const target=resolve(dir);assert.ok(target.startsWith(resolve(tmpdir())+sep));rmSync(target,{recursive:true,force:true});}
});
