import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../database.js';
import { fixture } from './helpers.js';

const activity = () => ({type:'activity',content:'Play badminton together',locationConsent:true,activity:{title:'Badminton',startsAt:new Date(Date.now()+86400000).toISOString(),location:'Campus sports hall',capacity:8}});

test('text and activity posts round-trip through HTTP and SQLite with private audit records',async t=>{
  const {store,url,post}=await fixture(t);
  const first=await post({type:'text',content:" Hello '); DROP TABLE posts; -- <script>alert(1)</script> "});
  assert.equal(first.status,201);const text=await first.json();
  assert.equal(text.author.name,'Student One');assert.equal(text.author.username,'student_1');assert.equal(text.activity,null);
  assert.equal(first.headers.get('location'),`/api/posts/${text.id}`);
  assert.equal((await (await fetch(url+first.headers.get('location'))).json()).content,text.content);
  const second=await post(activity());assert.equal(second.status,201);const a=await second.json();
  assert.equal(a.activity.capacity,8);
  const feed=await (await fetch(`${url}/api/posts`)).json();
  assert.deepEqual(feed.items.map(p=>p.id),[a.id,text.id]);
  assert.equal(JSON.stringify(feed).includes('ip_address'),false);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM audit_logs').get().n,2);
  assert.equal(store.db.prepare('SELECT user_id FROM audit_logs LIMIT 1').get().user_id,text.author.id);
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
  const {url,cookie}=await fixture(t);
  assert.equal((await fetch(`${url}/api/posts`,{method:'POST',headers:{'Content-Type':'application/json',cookie},body:'{'})).status,400);
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
test('web UI routes load, private paths stay hidden, and activity fields round-trip',async t=>{
  const {url,post,cookie}=await fixture(t);
  const root=await fetch(url);assert.equal(root.status,200);
  const html=await root.text();assert.match(html,/id="post-type"/);assert.match(html,/id="location-consent"/);
  for(const asset of ['js/main.js','js/api.js','css/tokens.css','css/app.css'])assert.equal((await fetch(`${url}/${asset}`)).status,200,asset);
  for(const path of ['/.docs/02-design/prototype/index.html','/.docs/01-requirements/backlog.md','/index.html/../rule.md','/server/app.js','/package.json'])assert.equal((await fetch(url+path)).status,404,path);
  const body=activity();Object.assign(body.activity,{category:'study',meeting:'Front door',lat:20.04,lng:99.89});
  const response=await post(body);assert.equal(response.status,201);const saved=await response.json();
  assert.equal(saved.activity.category,'study');assert.equal(saved.activity.meeting,'Front door');assert.equal(saved.activity.lat,20.04);
  const again=await (await fetch(`${url}/api/posts/${saved.id}`,{headers:{cookie}})).json();assert.deepEqual(again,saved);
  assert.equal((await (await fetch(`${url}/api/posts/${saved.id}`)).json()).activity.viewerStatus,null,'signed-out viewers have no status');
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
    assert.equal(store.get('old').activity.joinedCount,1,'the earlier host becomes the first participant');
  }finally{store?.close();const target=resolve(dir);assert.ok(target.startsWith(resolve(tmpdir())+sep));rmSync(target,{recursive:true,force:true});}
});
test('feed filters by category, Bangkok calendar day and search text in SQL, with totals',async t=>{
  const {url,post}=await fixture(t);
  const at=iso=>{const body=activity();body.activity.startsAt=iso;return body;};
  const sport=await (await post({...at('2099-03-10T23:30:00+07:00'),content:'Evening run 100%'})).json();
  const study=at('2099-03-11T00:30:00+07:00');study.activity.category='study';study.activity.title='Library group';
  const studyPost=await (await post(study)).json();
  const text=await (await post({type:'text',content:'Anyone_at the cafe?'})).json();
  const get=async query=>(await fetch(`${url}/api/posts?${query}`)).json();
  assert.deepEqual((await get('category=text')).items.map(p=>p.id),[text.id]);
  assert.deepEqual((await get('category=study')).items.map(p=>p.id),[studyPost.id]);
  // 23:30 and 00:30 Bangkok time fall on different local days although both are 10 March in UTC.
  assert.deepEqual((await get('date=2099-03-10')).items.map(p=>p.id),[sport.id]);
  assert.deepEqual((await get('date=2099-03-11')).items.map(p=>p.id),[studyPost.id]);
  assert.deepEqual((await get('q=library')).items.map(p=>p.id),[studyPost.id]);
  assert.deepEqual((await get('q=100%25')).items.map(p=>p.id),[sport.id]);
  assert.deepEqual((await get('q=_at')).items.map(p=>p.id),[text.id]);
  assert.equal((await get('q=%25')).total,1);
  const page=await get('limit=1');assert.equal(page.total,3);assert.equal(page.items.length,1);assert.ok(page.nextCursor);
  const filtered=await get('category=sport&limit=1');assert.equal(filtered.total,1);assert.equal(filtered.nextCursor,null);
  for(const query of ['category=music','date=2099-02-30','date=10-03-2099',`q=${'x'.repeat(101)}`,'category=sport&category=study'])assert.equal((await fetch(`${url}/api/posts?${query}`)).status,400,query);
});
test('activity capacity is limited to 2–50 including the host',async t=>{
  const {post}=await fixture(t);
  for(const capacity of [2,50]){const body=activity();body.activity.capacity=capacity;assert.equal((await post(body)).status,201,String(capacity));}
  for(const capacity of [1,51,1000]){const body=activity();body.activity.capacity=capacity;assert.equal((await post(body)).status,400,String(capacity));}
});
