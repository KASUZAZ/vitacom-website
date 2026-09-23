(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  const draftKey = 'vitacom-studio-draft-v1';
  let state, saved, session, page = 'index', selected = null, group = null, kind = 'all', schema = null;
  let undo = [], redo = [], media = [], history = [], imageTarget = null, saving = false, draftTimer, loaded = false, pendingDraft = false;
  const titles = {dashboard:'Dashboard',settings:'Tetapan website',activity:'Rekod aktiviti',health:'Site Health',account:'Akaun & keselamatan',editor:'Editor website',theme:'Reka bentuk',media:'Pustaka gambar',history:'Sejarah versi',backup:'Sandaran'};
  let activities = [], healthData = null;
  function node(tag, props={}, ...children) {
    const el=document.createElement(tag);
    for(const [key,value] of Object.entries(props)) {
      if(key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(),value);
      else if(key==='class') el.className=value;
      else if(key==='text') el.textContent=value;
      else if(value!==undefined) el.setAttribute(key,value);
    }
    children.flat().forEach(child=>{if(child!==null && child!==undefined) el.append(child);});
    return el;
  }
  function notice(message, error=false) {
    $('notice').textContent=message; $('notice').classList.toggle('error',error); $('notice').hidden=false;
  }
  async function api(path, body) {
    let response;
    try {response=await fetch(`/api/${path}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});}
    catch {throw new Error('Admin perlu dibuka melalui http://127.0.0.1:8766/admin.html dan admin-server.py mesti sedang berjalan.');}
    let data;
    try {data=await response.json();} catch {throw new Error('Buka admin melalui server admin, bukan Live Server atau fail HTML terus.');}
    if(!response.ok) {
      if(response.status===401 && path!=='login') { $('studio').hidden=true; $('loginScreen').hidden=false; $('loginError').textContent='Sesi tamat. Draf anda masih disimpan dalam browser.'; }
      throw new Error(data.error || 'Permintaan gagal.');
    }
    return data;
  }
  function config() {return state.pages[page] ||= {};}
  function isDirty() {return state && saved && JSON.stringify(state)!==JSON.stringify(saved);}
  function sync() {
    const dirty=isDirty();
    $('saveStatus').textContent=dirty?'Draf · Belum disimpan':'Semua perubahan disimpan';
    $('save').disabled=saving || !dirty;
    $('undo').disabled=!undo.length; $('redo').disabled=!redo.length;
    updateNotifications();
    if(loaded) $('preview').contentWindow.postMessage({type:'cms-apply',state},location.origin);
    if(schema) renderFields();
    clearTimeout(draftTimer);
    draftTimer=setTimeout(()=>{
      try {if(dirty) localStorage.setItem(draftKey,JSON.stringify(state)); else if(!pendingDraft) localStorage.removeItem(draftKey);}
      catch {notice('Draf browser tidak dapat disimpan. Tekan Simpan website lokal atau eksport sandaran.',true);}
    },200);
  }
  function mutate(callback) {
    undo.push(clone(state)); if(undo.length>70) undo.shift(); redo=[];
    callback(); sync();
  }
  function patch(id, values) {mutate(()=>{const p=config(); p.fields ||= {};p.fields[id]={...p.fields[id],...values};});}
  function fieldValue(field) {const p=config().fields?.[field.id] || {}; return p.text ?? p.src ?? p.href ?? field.value;}
  function focus(id) {$('preview').contentWindow.postMessage({type:'cms-focus',id},location.origin);}
  function selectField(id, scroll=true) {
    selected=id;const field=schema?.fields.find(f=>f.id===id);
    if(!field) return;
    group=field.group; renderSections();renderInspector();renderFields();if(scroll) focus(id);
  }
  function label(text, input) {return node('label',{text},input);}
  function input(value, callback, props={}) {
    const el=node('input',{type:'text',...props});el.value=value ?? '';
    el.addEventListener('input',()=>callback(el.type==='checkbox'?el.checked:el.value));return el;
  }
  function textarea(value, callback) {const el=node('textarea');el.value=value ?? '';el.addEventListener('input',()=>callback(el.value));return el;}
  function check(text, checked, callback) {
    const el=input('',callback,{type:'checkbox'});el.checked=!!checked;return node('label',{class:'check-label'},el,text);
  }
  function button(text, callback, className='secondary') {return node('button',{type:'button',class:className,text,onClick:callback});}
  function openPicker(callback) {imageTarget=callback;renderMedia('pickerGrid',true);$('mediaDialog').showModal();}
  function imageEditor(container, value, onChange, hidden, onHidden, alt, onAlt) {
    if(value) container.append(node('img',{class:'image-preview',src:value,alt:'Pratonton gambar semasa'}));
    container.append(node('div',{class:'image-actions'},button('Pilih dari pustaka',()=>openPicker(onChange)),button('Muat naik',()=>{imageTarget=onChange;$('imageUpload').click();},'primary')));
    container.append(label('Pautan gambar',input(value,onChange,{placeholder:'assets/… atau https://…'})));
    container.append(label('Penerangan gambar (alt)',input(alt,onAlt)));
    if(onHidden) container.append(check('Sembunyikan / buang gambar daripada paparan',hidden,onHidden));
  }
  function renderInspector() {
    const box=$('inspectorContent');box.replaceChildren();
    if(selected==='page') {
      box.append(node('h3',{text:'Tetapan halaman'}),label('Tajuk tab browser',input(config().title ?? schema.title,v=>mutate(()=>config().title=v))),label('Penerangan carian / SEO',textarea(config().description ?? schema.description,v=>mutate(()=>config().description=v))),node('p',{text:'Tetapan ini hanya untuk halaman yang dipilih.'}));return;
    }
    if(selected?.startsWith('custom:')) {
      const block=config().custom?.find(b=>b.id===selected.slice(7));if(!block) return;
      const update=(key,value)=>mutate(()=>{config().custom.find(b=>b.id===block.id)[key]=value;});
      box.append(node('h3',{text:'Seksyen tambahan'}),label('Tajuk',input(block.title,v=>update('title',v))),label('Teks',textarea(block.text,v=>update('text',v))));
      imageEditor(box,block.image,v=>update('image',v),false,null,block.alt,v=>update('alt',v));
      box.append(button('Buang gambar',()=>{update('image','');renderInspector();}),label('Teks butang (pilihan)',input(block.button,v=>update('button',v))),label('Pautan butang',input(block.href,v=>update('href',v))),check('Sembunyikan seksyen',block.hidden,v=>update('hidden',v)));
      box.append(node('div',{class:'custom-actions'},button('↑',()=>moveCustom(block.id,-1)),button('↓',()=>moveCustom(block.id,1)),button('Duplikasi seksyen',()=>{if(config().custom.length>=30)return notice('Maksimum 30 seksyen tambahan.',true);const copy={...clone(block),id:crypto.randomUUID(),title:(block.title || 'Seksyen')+' (salinan)'};mutate(()=>config().custom.push(copy));selected='custom:'+copy.id;renderInspector();renderSections();}),button('Buang seksyen',()=>{mutate(()=>config().custom=config().custom.filter(b=>b.id!==block.id));selected=null;renderInspector();renderSections();})));
      return;
    }
    const field=schema?.fields.find(f=>f.id===selected);
    if(!field){box.append(node('div',{class:'empty-inspector',text:'Klik teks atau gambar dalam pratonton, atau pilih kandungan daripada senarai di bawah.'}));return;}
    const p=config().fields?.[field.id] || {};
    box.append(node('h3',{text:({text:'Edit teks',image:'Edit gambar',link:'Edit pautan'})[field.type]}));
    if(field.type==='text') {
      box.append(label('Kandungan teks',textarea(p.text ?? field.value,v=>patch(field.id,{text:v}))));
      box.append(node('div',{class:'form-row'},label('Warna teks',input(p.color || '#17191d',v=>patch(field.id,{color:v}),{type:'color'})),label('Saiz (px)',input(p.size || '',v=>{if(!v || (Number(v)>=10 && Number(v)<=120)) patch(field.id,{size:v?Number(v):null});},{type:'number',min:'10',max:'120',placeholder:'Asal'}))));
      box.append(node('p',{text:'Teks dikendalikan sebagai teks biasa. Susunan dan pautan lain dikekalkan.'}));
    } else if(field.type==='image') imageEditor(box,p.src ?? field.value,v=>patch(field.id,{src:v}),p.hidden,v=>patch(field.id,{hidden:v}),p.alt ?? field.alt,v=>patch(field.id,{alt:v}));
    else box.append(label('Destinasi pautan',input(p.href ?? field.value,v=>patch(field.id,{href:v}),{placeholder:'https://… / mailto:… / tel:…'})),check('Sembunyikan pautan / butang',p.hidden,v=>patch(field.id,{hidden:v})),node('p',{text:'Untuk tukar label butang, pilih teks butang dalam tab Teks.'}));
    box.append(button('Pulihkan elemen asal',()=>{mutate(()=>{if(config().fields) delete config().fields[field.id];});renderInspector();renderFields();},'quiet'));
  }
  function renderFields() {
    const list=$('fieldList');list.replaceChildren();if(!schema) return;
    const query=$('fieldSearch').value.toLowerCase();
    schema.fields.filter(f=>(!group || f.group===group) && (kind==='all' || f.type===kind) && `${f.label} ${fieldValue(f)}`.toLowerCase().includes(query)).forEach(f=>{
      const edited=!!config().fields?.[f.id];
      list.append(node('button',{class:`field-item ${selected===f.id?'selected':''}`,onClick:()=>selectField(f.id)},node('span',{text:{text:'T',image:'▧',link:'↗'}[f.type]}),node('em',{text:f.type==='text'?fieldValue(f):f.label}),edited?node('small',{text:'•'}):null));
    });
    if(!list.children.length) list.append(node('p',{text:'Tiada kandungan dalam pilihan ini.',class:'empty-inspector'}));
  }
  function sectionOrder() {return [...new Set([...(config().order || []),...(schema?.sections || []).map(s=>s.id)])];}
  function moveSection(id,delta) {
    const order=sectionOrder(),index=order.indexOf(id),target=index+delta;
    if(target<0 || target>=order.length) return;
    [order[index],order[target]]=[order[target],order[index]];mutate(()=>config().order=order);renderSections();
  }
  function moveCustom(id,delta) {
    const blocks=config().custom,index=blocks.findIndex(b=>b.id===id),target=index+delta;
    if(target<0 || target>=blocks.length) return;
    mutate(()=>{const list=config().custom;[list[index],list[target]]=[list[target],list[index]];});renderSections();
  }
  function renderSections() {
    const list=$('sectionList');list.replaceChildren();if(!schema) return;
    function simple(name,id) {list.append(node('div',{class:`section-row ${group===id?'active':''}`},button(name,()=>{group=id;selected=null;renderInspector();renderFields();renderSections();},'quiet')));}
    simple('Semua kandungan',null);simple('Header & navigasi','header');
    sectionOrder().forEach((id,i)=>{
      const s=schema.sections.find(s=>s.id===id);if(!s)return;
      const hidden=config().sections?.[id]?.hidden;
      const row=node('div',{class:`section-row ${group===id?'active':''} ${hidden?'is-hidden':''}`});
      row.append(node('button',{onClick:()=>{group=id;selected=null;renderInspector();renderFields();renderSections();const first=schema.fields.find(f=>f.group===id);if(first) focus(first.id);}},node('small',{text:`${String(i+1).padStart(2,'0')} / SEKSYEN`}),s.name));
      row.append(node('div',{class:'row-controls'},button('↑',()=>moveSection(id,-1)),button('↓',()=>moveSection(id,1)),button(hidden?'Tunjuk':'Sembunyi',()=>{mutate(()=>{const p=config();p.sections||={};p.sections[id]={hidden:!hidden};});renderSections();})));
      list.append(row);
    });
    (config().custom || []).forEach(b=>list.append(node('div',{class:'section-row'},button(`＋ ${b.title || 'Seksyen baharu'}`,()=>{selected=`custom:${b.id}`;renderInspector();},'quiet'))));
    simple('Footer','footer');simple('Butang terapung & lain-lain','other');
    $('sectionCount').textContent=`${schema.sections.length+(config().custom?.length || 0)}`;
  }
  function refresh() {renderSections();renderInspector();renderFields();$('themeAccent').value=state.theme.accent || '#ed161b';$('themeFont').value=state.theme.font || 'Inter';sync();}
  function loadPage(value) {
    page=value;schema=null;selected=null;group=null;loaded=false;$('fieldSearch').value='';
    $('preview').src=`${page}.html?editor=1`;$('visitWebsite').href=`${page}.html`;
    $('inspectorContent').textContent='Memuatkan halaman…';$('fieldList').replaceChildren();
  }
  function renderMedia(id,picker=false) {
    const grid=$(id);grid.replaceChildren();
    const query=$(picker?'pickerSearch':'mediaSearch').value.toLowerCase();
    let items=media.filter(item=>`${item.name} ${item.src}`.toLowerCase().includes(query) && (picker || $('mediaType').value==='all' || item.src.toLowerCase().endsWith('.'+$('mediaType').value) || ($('mediaType').value==='jpg' && item.src.toLowerCase().endsWith('.jpeg'))));
    const sort=picker?'name':$('mediaSort').value;
    items.sort((a,b)=>sort==='newest'?b.modified-a.modified:sort==='size'?b.size-a.size:a.name.localeCompare(b.name));
    if(!picker) $('mediaCount').textContent=`${items.length} daripada ${media.length} gambar`;
    if(!items.length) grid.append(node('p',{text:'Tiada gambar sepadan. Cuba kata carian atau jenis fail lain.'}));
    items.forEach(item=>grid.append(node('button',{class:'media-item',title:`${item.src} · ${Math.ceil((item.size || 0)/1024)} KB`,onClick:()=>{
      if(picker){const callback=imageTarget;imageTarget=null;callback?.(item.src);$('mediaDialog').close();renderInspector();}
      else {navigator.clipboard?.writeText(item.src).then(()=>notice('Pautan gambar disalin: '+item.src)).catch(()=>notice('Pautan gambar: '+item.src));}
    }},node('img',{src:item.src,alt:item.name,loading:'lazy'}),node('span',{text:item.name}),node('small',{text:`${Math.ceil((item.size || 0)/1024)} KB`}))));
  }
  async function loadMedia() {media=await api('media');renderMedia('mediaGrid');renderMedia('pickerGrid',true);}
  async function showView(view) {
    document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==`${view}View`);
    document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
    $('viewTitle').textContent=titles[view];
    try {
      if(view==='dashboard') await renderDashboard();
      if(view==='activity') {activities=await api('activity');renderActivity();}
      if(view==='account') await renderAccount();
      if(view==='health') await renderHealth();
      if(view==='settings') renderSettings();
      if(view==='media') await loadMedia();
      if(view==='history') {
        history=await api('history');const box=$('historyList');box.replaceChildren();
        if(!history.length) box.append(node('p',{text:'Belum ada versi terdahulu. Sejarah akan muncul selepas simpanan pertama.'}));
        history.forEach(entry=>box.append(node('div',{class:'history-item'},node('div',{},node('strong',{text:`Versi ${entry.state.revision}`}),node('p',{text:entry.at})),button('Pulihkan sebagai draf',()=>{mutate(()=>{state={...clone(entry.state),revision:saved.revision};});refresh();notice('Versi dipulihkan sebagai draf. Semak pratonton dan tekan Simpan untuk menggunakan versi ini.');showView('editor');}))));
      }
    } catch(error){notice(error.message,true);}
  }
  async function start() {
    state=await api('state');
    for(const name of ['index','products','services']) state.pages[name] ||= {};
    saved=clone(state);undo=[];redo=[];
    $('loginScreen').hidden=true;$('studio').hidden=false;
    $('username').value='admin';$('password').value='';$('confirmPassword').value='';
    try {pendingDraft=!!localStorage.getItem(draftKey);$('draftNotice').hidden=!pendingDraft;}catch{}
    await loadMedia();loadPage(page);sync();await refreshNotifications();await showView('dashboard');
  }
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin || event.source!==$('preview').contentWindow) return;
    if(event.data.type==='cms-ready' && event.data.page===page) {schema=event.data;loaded=true;refresh();}
    if(event.data.type==='cms-select') selectField(event.data.id,false);
  });
  $('loginForm').addEventListener('submit',async event=>{
    event.preventDefault();$('loginError').textContent='';$('loginButton').disabled=true;
    try {
      if(session.setup && $('password').value!==$('confirmPassword').value) throw new Error('Kata laluan tidak sepadan.');
      await api(session.setup?'setup':'login',{username:$('username').value,password:$('password').value});session.setup=false;await start();
    }catch(error){$('loginError').textContent=error.message;}finally{$('loginButton').disabled=false;}
  });
  $('save').addEventListener('click',async()=>{
    if(saving)return;saving=true;sync();
    const snapshot=clone(state);
    try {
      const result=await api('save',{state:snapshot,revision:saved.revision});
      saved=clone(result);state.revision=result.revision;
      notice(isDirty()?'Versi disimpan. Perubahan yang dibuat semasa menyimpan masih dalam draf.':`Versi ${result.revision} disimpan ke website lokal. Buka atau refresh website untuk melihat hasil.`);
    }catch(error){notice(error.message,true);}finally{saving=false;sync();}
  });
  $('logout').addEventListener('click',async()=>{try{await api('logout',{});location.reload();}catch(error){notice(error.message,true);}});
  $('pageSelect').addEventListener('change',event=>loadPage(event.target.value));
  $('pageSettings').addEventListener('click',()=>{selected='page';renderInspector();});
  $('fieldSearch').addEventListener('input',renderFields);
  document.querySelectorAll('[data-kind]').forEach(el=>el.addEventListener('click',()=>{kind=el.dataset.kind;document.querySelectorAll('[data-kind]').forEach(b=>b.classList.toggle('active',b===el));renderFields();}));
  document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>showView(el.dataset.view)));
  $('undo').addEventListener('click',()=>{if(!undo.length)return;redo.push(clone(state));state=undo.pop();state.revision=saved.revision;refresh();});
  $('redo').addEventListener('click',()=>{if(!redo.length)return;undo.push(clone(state));state=redo.pop();state.revision=saved.revision;refresh();});
  for(const mode of ['desktop','mobile']) $(mode).addEventListener('click',()=>{$('frameShell').classList.toggle('mobile',mode==='mobile');$('desktop').classList.toggle('active',mode==='desktop');$('mobile').classList.toggle('active',mode==='mobile');});
  new ResizeObserver(()=>{
    const shell=$('frameShell'), frame=$('preview'), width=shell.classList.contains('mobile')?390:1280;
    const scale=shell.clientWidth/width;
    if(!scale)return;
    frame.style.width=`${width}px`;frame.style.height=`${shell.clientHeight/scale}px`;
    frame.style.transform=`scale(${scale})`;frame.style.transformOrigin='top left';
  }).observe($('frameShell'));
  $('themeAccent').addEventListener('input',event=>mutate(()=>state.theme.accent=event.target.value));
  $('themeFont').addEventListener('change',event=>mutate(()=>state.theme.font=event.target.value));
  $('resetTheme').addEventListener('click',()=>{mutate(()=>state.theme={});refresh();});
  $('addSection').addEventListener('click',()=>{
    const id=crypto.randomUUID();mutate(()=>{const p=config();p.custom||=[];p.custom.push({id,title:'Seksyen baharu',text:'Tulis cerita, pengumuman atau promosi anda di sini.',image:'',button:'',href:'',alt:''});});
    selected=`custom:${id}`;renderSections();renderInspector();notice('Seksyen ditambah di bahagian akhir halaman, sebelum footer. Anda boleh ubah kandungannya di panel edit.');
  });
  $('closeMedia').addEventListener('click',()=>{$('mediaDialog').close();imageTarget=null;});
  $('uploadLibrary').addEventListener('click',()=>{imageTarget=null;$('imageUpload').click();});
  $('uploadPicker').addEventListener('click',()=>$('imageUpload').click());
  $('imageUpload').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    try {
      if(file.size>5*1024*1024) throw new Error('Gambar terlalu besar. Maksimum 5 MB.');
      if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)) throw new Error('Gunakan JPG, PNG, WebP atau GIF.');
      notice('Memuat naik gambar…');
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});
      const result=await api('upload',{data});
      imageTarget?.(result.src);imageTarget=null;await loadMedia();$('mediaDialog').close();renderInspector();
      notice('Gambar dimuat naik. Jika digunakan dalam halaman, tekan Simpan untuk menggunakan perubahan.');
    }catch(error){notice(error.message,true);}finally{event.target.value='';}
  });
  $('export').addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));
    const a=node('a',{href:url,download:`vitacom-content-${new Date().toISOString().slice(0,10)}.json`});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  async function importDraft(value) {const result=await api('validate',{state:value});mutate(()=>state={...result,revision:saved.revision});refresh();notice('Kandungan dimuatkan sebagai draf. Semak dan Simpan apabila bersedia.');}
  $('import').addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>2*1024*1024)throw new Error('Fail sandaran terlalu besar.');await importDraft(JSON.parse(await file.text()));}catch(error){notice(error.message,true);}finally{event.target.value='';}});
  $('restoreDraft').addEventListener('click',async()=>{try{await importDraft(JSON.parse(localStorage.getItem(draftKey)));pendingDraft=false;$('draftNotice').hidden=true;}catch(error){notice(error.message,true);}});
  $('discardDraft').addEventListener('click',()=>{pendingDraft=false;localStorage.removeItem(draftKey);$('draftNotice').hidden=true;});
  // Extra admin tools share the existing draft/save pipeline.
  function activityRows(container, entries) {
    container.replaceChildren();
    if(!entries.length) container.append(node('p',{text:'Tiada aktiviti untuk dipaparkan.'}));
    entries.forEach(entry=>container.append(node('div',{class:'activity-row'},node('time',{text:entry.at}),node('div',{},node('strong',{text:entry.action}),node('p',{text:entry.detail || ''})))));
  }
  function renderActivity() {
    const query=$('activitySearch').value.toLowerCase();
    activityRows($('activityList'),activities.filter(entry=>`${entry.at} ${entry.action} ${entry.detail}`.toLowerCase().includes(query)));
  }
  async function renderDashboard() {
    const [account, entries, versions, files, live]=await Promise.all([api('account'),api('activity'),api('history'),api('media'),api('state')]);
    $('welcomeName').textContent=`Selamat datang, ${account.name}.`;
    const stats=[['3','Halaman website'],[files.length,'Gambar dalam pustaka'],[live.revision,'Versi tersimpan'],[versions.length,'Versi boleh dipulihkan']];
    $('dashboardStats').replaceChildren(...stats.map(([value,text])=>node('div',{class:'stat-card'},node('strong',{text:String(value)}),node('span',{text}))));
    const last=entries.find(entry=>entry.action==='Website disimpan');
    $('dashboardSaved').textContent=(last?`Simpanan terakhir: ${last.at}. `:'Belum ada simpanan direkodkan. ')+(isDirty()?'Ada perubahan draf yang belum disimpan.':'Draf ini sepadan dengan versi yang dimuatkan.')+(live.revision!==saved.revision?' Versi server telah berubah. Eksport draf sebelum memuat semula.':'');
    $('dashboardPages').replaceChildren(...Object.entries({index:'Laman utama',products:'Products',services:'Service & Troubleshooting'}).map(([key,name])=>node('div',{class:'page-summary'},node('div',{},node('strong',{text:name}),node('small',{text:`${Object.keys(state.pages[key]?.fields || {}).length} elemen diubah dalam draf`})),button('Edit',()=>{$('pageSelect').value=key;loadPage(key);showView('editor');}))));
    activityRows($('dashboardActivity'),entries.slice(0,5));
  }
  const bytes=value=>{const units=['B','KB','MB','GB','TB'];let size=Number(value)||0,index=0;while(size>=1024&&index<units.length-1){size/=1024;index++;}return `${size.toFixed(index?1:0)} ${units[index]}`;};
  async function renderHealth() {
    $('runHealth').disabled=true;
    try {healthData=await api('site-health');
      const errors=healthData.issues.filter(issue=>issue.level==='error').length,warnings=healthData.issues.filter(issue=>issue.level==='warning').length;
      const summary=[[`${healthData.score}/100`,'Skor kesihatan'],[healthData.status,'Status'],[errors,'Ralat'],[warnings,'Amaran']];
      $('healthSummary').replaceChildren(...summary.map(([value,labelText])=>node('div',{class:'stat-card'},node('strong',{text:String(value)}),node('span',{text:labelText}))));
      const issues=$('healthIssues');issues.replaceChildren();
      if(!healthData.issues.length) issues.append(node('div',{class:'health-empty'},node('strong',{text:'✓ Semuanya kelihatan baik'}),node('p',{text:'Tiada isu asas ditemui dalam halaman semasa.'})));
      healthData.issues.forEach(issue=>issues.append(node('div',{class:`health-issue ${issue.level}`},node('span',{text:issue.level==='error'?'!':'△'}),node('div',{},node('strong',{text:issue.title}),node('small',{text:`${issue.page} · ${issue.detail}`})))));
      $('systemInfo').replaceChildren(...[["Versi server",healthData.server],["Versi kandungan",healthData.revision],["Gambar diperiksa",healthData.checkedImages],["Pautan/fail dalaman",healthData.checkedLinks],["Upload admin",`${healthData.uploads} fail · ${bytes(healthData.uploadBytes)}`],["Ruang cakera bebas",bytes(healthData.diskFree)]].map(([labelText,value])=>node('div',{class:'system-row'},node('span',{text:labelText}),node('strong',{text:String(value)}))));
      $('healthPages').replaceChildren(...healthData.pages.map(item=>node('div',{class:'page-summary'},node('div',{},node('strong',{text:item.title}),node('small',{text:`${item.images} gambar · ${item.links} pautan · ${item.descriptionLength} aksara penerangan`})),button('Buka SEO',()=>{$('pageSelect').value=item.slug;loadPage(item.slug);showView('editor');setTimeout(()=>$('pageSettings').click(),300);}))));
      updateNotifications();
    } finally {$('runHealth').disabled=false;}
  }
  async function refreshNotifications(){try{healthData=await api('site-health');updateNotifications();}catch{}}
  function currentNotifications(){const items=[];if(isDirty())items.push({title:'Draf belum disimpan',text:'Ada perubahan website yang belum disimpan.',view:'editor'});if(pendingDraft)items.push({title:'Draf lama tersedia',text:'Sambung atau abaikan draf daripada sesi terdahulu.',view:'editor'});const errors=healthData?.issues.filter(issue=>issue.level==='error').length||0,warnings=healthData?.issues.filter(issue=>issue.level==='warning').length||0;if(errors||warnings)items.push({title:'Site Health perlukan perhatian',text:`${errors} ralat dan ${warnings} amaran dijumpai.`,view:'health'});return items;}
  function updateNotifications(){if(!$('notificationCount'))return;const items=currentNotifications();$('notificationCount').textContent=String(items.length);$('notificationButton').classList.toggle('has-items',!!items.length);const list=$('notificationList');if(!list)return;list.replaceChildren();if(!items.length)list.append(node('div',{class:'health-empty'},node('strong',{text:'✓ Tiada notifikasi baharu'}),node('p',{text:'Website dan draf anda tidak memerlukan tindakan sekarang.'})));items.forEach(item=>list.append(node('button',{class:'notification-item',onClick:()=>{$('notificationDialog').close();showView(item.view);}},node('strong',{text:item.title}),node('span',{text:item.text}))));}
  function renderSettings() {
    const settings=state.settings || {};
    for(const key of ['announcement','announcementLabel','announcementLink']) $(key).value=settings[key] || '';
    $('announcementEnabled').checked=!!settings.announcementEnabled;
  }
  for(const key of ['announcement','announcementLabel','announcementLink','announcementEnabled']) $(key).addEventListener('input',event=>mutate(()=>{state.settings ||= {};state.settings[key]=event.target.type==='checkbox'?event.target.checked:event.target.value;}));
  async function renderAccount() {
    const account=await api('account');$('profileName').value=account.name;
    $('sessionInfo').textContent=`${account.sessions} sesi aktif. Sesi ini tamat pada ${new Date(account.expiresAt*1000).toLocaleString('ms-MY')}.`;
    $('passwordInfo').textContent=account.passwordChangedAt?`Kata laluan terakhir ditukar: ${account.passwordChangedAt}.`:'Kata laluan asal akaun masih digunakan.';
  }
  async function submitAccount(event, task) {
    event.preventDefault();const submit=event.target.querySelector('button');submit.disabled=true;
    try{await task();await renderAccount();}catch(error){notice(error.message,true);}finally{submit.disabled=false;}
  }
  $('profileForm').addEventListener('submit',event=>submitAccount(event,async()=>{await api('profile',{name:$('profileName').value});notice('Profil admin disimpan.');}));
  $('passwordForm').addEventListener('submit',event=>submitAccount(event,async()=>{
    if($('newPassword').value!==$('repeatPassword').value) throw new Error('Kata laluan baharu tidak sepadan.');
    await api('password',{currentPassword:$('currentPassword').value,newPassword:$('newPassword').value});
    $('passwordForm').reset();notice('Kata laluan dikemas kini. Semua sesi lama telah ditamatkan.');
  }));
  $('revokeSessions').addEventListener('click',async()=>{try{await api('revoke-sessions',{});await renderAccount();notice('Semua sesi lain telah ditamatkan.');}catch(error){notice(error.message,true);}});
  $('activitySearch').addEventListener('input',renderActivity);
  $('refreshActivity').addEventListener('click',()=>showView('activity'));
  $('runHealth').addEventListener('click',renderHealth);
  const mediaFilters=node('div',{class:'filter-bar'},label('Cari gambar',node('input',{id:'mediaSearch',type:'search',placeholder:'Nama fail atau folder…'})),label('Jenis fail',node('select',{id:'mediaType'},...['all','png','jpg','webp','gif'].map(type=>node('option',{value:type,text:type==='all'?'Semua jenis':type.toUpperCase()})))),label('Susunan',node('select',{id:'mediaSort'},node('option',{value:'name',text:'Nama A–Z'}),node('option',{value:'newest',text:'Terbaharu'}),node('option',{value:'size',text:'Saiz terbesar'}))),node('span',{id:'mediaCount',role:'status'}));
  $('mediaGrid').before(mediaFilters);
  $('pickerGrid').before(label('Cari gambar dalam pustaka',node('input',{id:'pickerSearch',type:'search',placeholder:'Nama fail atau folder…'})));
  for(const id of ['mediaSearch','mediaType','mediaSort']) $(id).addEventListener('input',()=>renderMedia('mediaGrid'));
  $('pickerSearch').addEventListener('input',()=>renderMedia('pickerGrid',true));
  document.addEventListener('keydown',event=>{if((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='s' && !$('studio').hidden){event.preventDefault();if(!$('save').disabled)$('save').click();}});
  const commands=[
    ['Dashboard','Ringkasan dan akses pantas','dashboard'],['Editor website','Edit teks, gambar dan seksyen','editor'],['Reka bentuk','Warna dan font','theme'],['Pustaka gambar','Cari, tapis dan muat naik gambar','media'],['Sejarah versi','Pulihkan kandungan terdahulu','history'],['Sandaran','Eksport atau import JSON','backup'],['Tetapan website','Bar pengumuman global','settings'],['Rekod aktiviti','Jejak simpanan dan log masuk','activity'],['Site Health','Semak SEO, pautan dan gambar','health'],['Akaun & keselamatan','Profil, kata laluan dan sesi','account']
  ];
  function renderAdminSearch(){const query=$('adminSearch').value.toLowerCase();const results=$('adminSearchResults');results.replaceChildren();commands.filter(item=>item.join(' ').toLowerCase().includes(query)).forEach(([name,description,view])=>results.append(node('button',{onClick:()=>{$('adminSearchDialog').close();showView(view);}},node('strong',{text:name}),node('span',{text:description}))));if(!results.children.length)results.append(node('p',{text:'Tiada alat yang sepadan.'}));}
  function openAdminSearch(){$('adminSearch').value='';renderAdminSearch();$('adminSearchDialog').showModal();setTimeout(()=>$('adminSearch').focus(),0);}
  $('adminSearchButton').addEventListener('click',openAdminSearch);$('closeAdminSearch').addEventListener('click',()=>$('adminSearchDialog').close());$('adminSearch').addEventListener('input',renderAdminSearch);
  $('notificationButton').addEventListener('click',()=>{updateNotifications();$('notificationDialog').showModal();});$('closeNotifications').addEventListener('click',()=>$('notificationDialog').close());
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!$('studio').hidden){event.preventDefault();openAdminSearch();}if(event.key==='Escape')document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());});
  window.addEventListener('beforeunload',event=>{if(isDirty()){try{localStorage.setItem(draftKey,JSON.stringify(state));}catch{}event.preventDefault();event.returnValue='';}});
  (async()=>{
    try {
      session=await api('session');
      if(session.authenticated) return await start();
      if(session.setup){$('loginTitle').textContent='Sediakan admin anda.';$('loginDescription').textContent='Username admin anda ialah admin. Cipta kata laluan untuk mengurus website Vitacom.';$('loginButton').textContent='Cipta akaun admin →';$('confirmPasswordLabel').hidden=false;$('confirmPassword').required=true;$('password').autocomplete='new-password';}
    }catch(error){$('loginError').textContent=error.message;$('loginButton').disabled=true;}
  })();
})();
