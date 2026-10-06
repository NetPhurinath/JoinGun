/* Existing JoinGun UI, backed by the posting API. Auth/joining are outside this MVP. */
const $ = id => document.getElementById(id);
const main = $('main');
const categories = {all:'ทุกโพสต์',text:'ข้อความทั่วไป',sport:'กีฬา',study:'อ่านหนังสือ',cafe:'คาเฟ่'};
const state = {posts:[],query:'',category:'all',day:'',busy:false,loading:false,error:''};
const campus = {lat:20.0436,lng:99.8954};
let createLocation=null, createMap=null, detailMap=null, opener=null, routeVersion=0;
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const formatDate = value => new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(new Date(value));
const dayKey = value => new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Bangkok'}).format(new Date(value));
function toast(message) { $('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,5000); }
async function api(path,options) {
  if(location.protocol==='file:')throw new Error('กรุณารัน npm start แล้วเปิด http://127.0.0.1:3000');
  const response=await fetch(path,options);
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('ไม่พบ backend กรุณาเปิดผ่าน http://127.0.0.1:3000');
  const body=await response.json();if(!response.ok)throw new Error(body.error || 'Request failed');return body;
}
function filtered() {
  const query=state.query.trim().toLowerCase();
  return state.posts.filter(p=>{
    const a=p.activity;
    return (state.category==='all'||(state.category==='text'?!a:a?.category===state.category)) && (!state.day||dayKey(a?.startsAt||p.createdAt)===state.day) && `${p.content} ${a?.title||''} ${a?.location||''}`.toLowerCase().includes(query);
  });
}
function card(p,index) {
  const a=p.activity;
  return `<article class="card card-${a?escapeHTML(a.category):'text'}"><div class="card-top"><h2>${escapeHTML(a?.title||p.author.name)}</h2><span class="activity-number">${String(index+1).padStart(2,'0')}</span></div><span class="badge">${escapeHTML(a?categories[a.category]:'ข้อความทั่วไป')}</span><p class="caption muted">${escapeHTML(p.author.name)} · ${formatDate(p.createdAt)}</p><p class="post-content">${escapeHTML(p.content)}</p>${a?`<p class="meta">◷ ${formatDate(a.startsAt)}</p><p class="meta">⌖ ${escapeHTML(a.location)}</p><p class="muted">รับทั้งหมด ${a.capacity} คน (รวมผู้จัด)</p><a class="button secondary" href="#activity/${encodeURIComponent(p.id)}">ดูรายละเอียด</a>`:''}</article>`;
}
function renderResults() {
  if(!$('results'))return;
  const items=filtered();
  $('result-count').textContent=`${items.length} โพสต์ · ${categories[state.category]}`;
  $('active-date').textContent=state.day?`วันที่ ${state.day}`:'โพสต์ล่าสุดจากชุมชนของคุณ';
  if(state.loading){$('results').innerHTML='<p role="status">กำลังโหลดโพสต์…</p>';return;}
  if(state.error){$('results').innerHTML=`<div class="card"><p class="error-text" role="alert">${escapeHTML(state.error)}</p><button class="button secondary" data-action="refresh">ลองอีกครั้ง</button></div>`;return;}
  $('results').innerHTML=items.length?items.map(card).join(''):`<div class="card"><h2>${state.posts.length?'ไม่พบโพสต์ที่ตรงกัน':'ยังไม่มีโพสต์'}</h2><p class="muted">${state.posts.length?'ลองเปลี่ยนคำค้นหาหรือตัวกรอง':'เริ่มแบ่งปันเรื่องราวหรือชวนเพื่อนทำกิจกรรมได้เลย'}</p><button class="button secondary" data-action="${state.posts.length?'clear':'create'}">${state.posts.length?'ล้างตัวกรอง':'สร้างโพสต์แรก'}</button></div>`;
}
function renderFeed() {
  main.innerHTML=`<section><div class="heading"><h1 tabindex="-1">กิจกรรมและเรื่องราว</h1><p class="muted">หาเพื่อนทำสิ่งที่ชอบไปด้วยกัน</p></div><div class="week-overview"><div><span class="caption">JOIN OUR COMMUNITY</span><strong>แบ่งปันเรื่องราวของคุณ</strong><p>โพสต์ข้อความ หรือชวนกันทำกิจกรรม</p></div><div class="week-total"><strong>${state.posts.length}</strong><span>โพสต์</span></div><button class="button secondary create-activity-button" data-action="create">+ สร้างโพสต์</button></div><div class="search"><label for="search">ค้นหาโพสต์</label><input id="search" type="search" placeholder="ข้อความ ชื่อกิจกรรม หรือสถานที่" autocomplete="off"><button class="button secondary" data-action="filters">ตัวกรอง</button></div><p id="active-date" class="caption muted"></p><div class="result-bar"><span id="result-count" class="caption" role="status"></span><button class="text-button" data-action="refresh">รีเฟรช</button><button class="text-button" data-action="clear">ล้างตัวกรอง</button></div><div id="results" class="stack"></div></section>`;
  $('search').value=state.query;$('search').addEventListener('input',e=>{state.query=e.target.value;renderResults();});renderResults();
}
function addTiles(map,container) {
  L.tileLayer('https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19}).addTo(map).once('tileerror',()=>{
    container.insertAdjacentHTML('afterend','<p class="caption muted">โหลดภาพแผนที่ไม่สำเร็จ ใช้ชื่อสถานที่และรายละเอียดจุดนัดพบแทนได้</p>');
  });
}
function renderDetail(p) {
  const a=p.activity;
  main.innerHTML=`<a class="text-button back" href="#feed">← กลับหน้าฟีด</a><div class="heading"><p class="caption muted">รายละเอียดกิจกรรม</p><h1 tabindex="-1">${escapeHTML(a.title)}</h1></div><div class="stack"><span class="badge">${escapeHTML(categories[a.category])}</span><p class="post-content">${escapeHTML(p.content)}</p></div><section class="section stack"><div class="host"><span class="avatar" aria-hidden="true">D</span><div><p>จัดโดย ${escapeHTML(p.author.name)}</p><span class="caption muted">บัญชีทดลอง · ยังไม่มีระบบยืนยันตัวตน</span></div></div><p class="notice">นัดพบในพื้นที่สาธารณะ และตรวจสอบรายละเอียดก่อนเข้าร่วม</p></section><section class="section card"><h2>รายละเอียดนัดหมาย</h2><p>◷ ${formatDate(a.startsAt)}</p><p>⌖ ${escapeHTML(a.location)}</p><p>จำนวนทั้งหมด ${a.capacity} คน (รวมผู้จัด)</p></section><section class="section stack"><h2>จุดนัดหมาย</h2><div id="detail-map" class="map real-map"></div><p>${escapeHTML(a.meeting||a.location)}</p></section><div class="action-bar"><p class="caption muted">MVP นี้รองรับการโพสต์ ยังไม่เปิดรับการเข้าร่วมผ่านระบบ</p><a class="button secondary" href="#feed">กลับหน้าฟีด</a></div>`;
  if(window.L && a.lat!==null && a.lng!==null){detailMap=L.map('detail-map',{scrollWheelZoom:false}).setView([a.lat,a.lng],16);addTiles(detailMap,$('detail-map'));L.marker([a.lat,a.lng]).addTo(detailMap);}
  else $('detail-map').textContent=a.lat===null?'กิจกรรมนี้ระบุจุดนัดพบเป็นข้อความ':'แผนที่ไม่พร้อมใช้งาน กรุณาดูสถานที่และรายละเอียดจุดนัดพบ';
}
async function route() {
  const version=++routeVersion;
  detailMap?.remove();detailMap=null;
  const [page,id]=location.hash.slice(1).split('/');
  if(page==='activity'&&id){
    main.innerHTML='<h1 tabindex="-1">รายละเอียดกิจกรรม</h1><p role="status">กำลังโหลด…</p>';
    try {const p=await api(`/api/posts/${encodeURIComponent(id)}`);if(version!==routeVersion)return;if(!p.activity)throw new Error('โพสต์นี้ไม่ใช่กิจกรรม');renderDetail(p);}
    catch(error){if(version!==routeVersion)return;main.innerHTML=`<h1 tabindex="-1">ไม่สามารถเปิดกิจกรรม</h1><p class="error-text">${escapeHTML(error.message)}</p><a href="#feed">กลับหน้าฟีด</a>`;}
  }else renderFeed();
  main.querySelector('h1')?.focus({preventScroll:true});document.title='JoinGun · โพสต์';window.scrollTo(0,0);
}
async function loadPosts() {
  if(state.loading)return;state.loading=true;state.error='';renderResults();
  try {
    // Fetch every cursor page so existing client-side category/date filters are complete.
    let cursor=null,posts=[];
    do {const page=await api(`/api/posts?limit=100${cursor?`&before=${encodeURIComponent(cursor)}`:''}`);posts.push(...page.items);cursor=page.nextCursor;}while(cursor);
    state.posts=posts;
  }catch(error){state.error=error.message;}
  finally {state.loading=false;if(!location.hash.startsWith('#activity/'))renderFeed();}
}
function openDialog(id){opener=document.activeElement;$(id).showModal();}
function syncType() {
  const activity=$('post-type').value==='activity';$('activity-fields').hidden=!activity;$('activity-fields').disabled=!activity;
  if(activity && !createMap){
    if(window.L){
      createMap=L.map('create-map',{scrollWheelZoom:false}).setView([campus.lat,campus.lng],16);addTiles(createMap,$('create-map'));let marker=null;
      const select=latlng=>{createLocation={lat:latlng.lat,lng:latlng.lng};$('selected-coordinates').textContent=`พิกัดจุดนัดหมาย: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;};
      createMap.on('click',e=>{if(!marker){marker=L.marker(e.latlng,{draggable:true}).addTo(createMap);marker.on('dragend',()=>select(marker.getLatLng()));}else marker.setLatLng(e.latlng);select(e.latlng);});
    }else $('create-map').textContent='แผนที่ไม่พร้อมใช้งาน ระบุจุดนัดหมายเป็นข้อความได้';
  }
  if(activity)setTimeout(()=>createMap?.invalidateSize(),50);
}
function openCreate(){
  createMap?.remove();createMap=null;createLocation=null;
  $('create-form').reset();$('create-error').hidden=true;$('selected-coordinates').textContent='กดบนแผนที่เพื่อเลือกหมุด หรือระบุสถานที่เป็นข้อความ';
  $('activity-date').min=dayKey(new Date());openDialog('create-dialog');syncType();
}
main.addEventListener('click',e=>{
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(action==='create')openCreate();
  if(action==='refresh')loadPosts();
  if(action==='clear'){state.query='';state.category='all';state.day='';renderFeed();$('search').focus();}
  if(action==='filters'){$('category').value=state.category;$('date').value=state.day;openDialog('filters');}
});
$('post-type').addEventListener('change',syncType);
$('filter-form').addEventListener('submit',e=>{e.preventDefault();state.category=$('category').value;state.day=$('date').value;$('filters').close();renderResults();});
$('reset-filters').addEventListener('click',()=>{state.query='';state.category='all';state.day='';$('filters').close();renderFeed();});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>{if(!state.busy)$(button.dataset.close).close();}));
document.querySelectorAll('dialog').forEach(dialog=>{dialog.addEventListener('cancel',e=>{if(state.busy)e.preventDefault();});dialog.addEventListener('close',()=>{if(opener?.isConnected)opener.focus();});});
$('create-form').addEventListener('submit',async e=>{
  e.preventDefault();if(state.busy)return;
  const payload={type:$('post-type').value,content:$('post-content').value};
  if(payload.type==='activity'){
    payload.locationConsent=$('location-consent').checked;
    payload.activity={title:$('activity-title').value,startsAt:`${$('activity-date').value}T${$('activity-time').value}:00+07:00`,location:$('activity-place').value,capacity:Number($('activity-capacity').value),category:$('activity-category').value,meeting:$('activity-meeting').value};
    if(createLocation)Object.assign(payload.activity,createLocation);
  }
  state.busy=true;$('create-error').hidden=true;
  const controls=[...$('create-form').querySelectorAll('input,textarea,select,button')];const disabled=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);
  $('publish-post').textContent='กำลังเผยแพร่…';
  try {
    const saved=await api('/api/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    state.posts=[saved,...state.posts.filter(p=>p.id!==saved.id)];state.query='';state.category='all';state.day='';state.error='';
    $('create-dialog').close();history.replaceState(null,'','#feed');renderFeed();toast('เผยแพร่โพสต์แล้ว');
    // Wait out an older feed request before refreshing to avoid hiding a newly saved post.
    while(state.loading)await new Promise(resolve=>setTimeout(resolve,50));await loadPosts();
  }catch(error){$('create-error').textContent=`โพสต์ไม่สำเร็จ: ${error.message}`;$('create-error').hidden=false;}
  finally{state.busy=false;controls.forEach((c,i)=>c.disabled=disabled[i]);$('publish-post').textContent='เผยแพร่โพสต์';}
});
window.addEventListener('hashchange',()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());route();});
route();loadPosts();
