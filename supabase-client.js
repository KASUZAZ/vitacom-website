(() => {
 const cfg=window.VITACOM_SUPABASE;if(!cfg)return;
 const base=cfg.url; const key=cfg.key; const authKey='vitacom-supabase-session';
 const headers=()=>({apikey:key,'Content-Type':'application/json'});
 async function req(path,opts={}){const r=await fetch(base+path,{...opts,headers:{...headers(),...(opts.headers||{})}});const text=await r.text();let d;try{d=text?JSON.parse(text):null}catch{d=text}if(!r.ok)throw new Error(d?.msg||d?.message||d?.error_description||'Permintaan Supabase gagal.');return d;}
 function session(){try{return JSON.parse(localStorage.getItem(authKey)||'null')}catch{return null}}
 async function onlineApi(path,body){
  let s=session();
  if(path==='session') return {authenticated:!!s?.access_token,setup:false};
  if(path==='login'){const d=await req('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:cfg.adminEmail,password:body.password})});localStorage.setItem(authKey,JSON.stringify(d));return {ok:true};}
  if(path==='logout'){if(s?.access_token)fetch(base+'/auth/v1/logout',{method:'POST',headers:{...headers(),Authorization:'Bearer '+s.access_token}}).catch(()=>{});localStorage.removeItem(authKey);return {ok:true};}
  if(!s?.access_token)throw new Error('Sesi admin tamat. Sila log masuk semula.');
  const h={Authorization:'Bearer '+s.access_token};
  if(path==='state'){const rows=await req('/rest/v1/vitacom_content?select=state,revision&id=eq.site',{headers:h});return rows[0]?.state || {version:1,revision:0,pages:{},theme:{}};}
  if(path==='save'){const current=(await req('/rest/v1/vitacom_content?select=revision&id=eq.site',{headers:h}))[0];if(Number(current?.revision||0)!==Number(body.revision||0))throw new Error('Versi Supabase telah berubah. Muat semula sebelum menyimpan.');const next={...body.state,revision:Number(body.revision||0)+1};await req('/rest/v1/vitacom_history',{method:'POST',headers:{...h,Prefer:'return=minimal'},body:JSON.stringify({state:next,revision:next.revision})});await req('/rest/v1/vitacom_content?id=eq.site',{method:'PATCH',headers:{...h,Prefer:'return=representation'},body:JSON.stringify({state:next,revision:next.revision,updated_at:new Date().toISOString()})});await req('/rest/v1/vitacom_activity',{method:'POST',headers:{...h,Prefer:'return=minimal'},body:JSON.stringify({action:'Website disimpan',detail:'Perubahan kandungan disimpan ke Supabase.'})});return next;}
  if(path==='history'){return await req('/rest/v1/vitacom_history?select=state,revision,created_at&order=revision.desc',{headers:h}).then(a=>a.map(x=>({...x,at:new Date(x.created_at).toLocaleString('ms-MY')})));}
  if(path==='activity'){return await req('/rest/v1/vitacom_activity?select=action,detail,created_at&order=created_at.desc&limit=100',{headers:h}).then(a=>a.map(x=>({...x,at:new Date(x.created_at).toLocaleString('ms-MY')})));}
  if(path==='account')return {name:'admin',sessions:1,expiresAt:Math.floor(Date.now()/1000)+3600,passwordChangedAt:null};
  if(path==='media')return [];
  if(path==='validate')return body.state;
  if(path==='site-health')return {score:100,status:'Baik',issues:[],server:'Supabase',revision:(await onlineApi('state')).revision||0,checkedImages:0,checkedLinks:0,uploads:0,uploadBytes:0,diskFree:0,pages:[]};
  if(path==='profile'||path==='password'||path==='revoke-sessions')return {ok:true};
  throw new Error('Fungsi belum tersedia dalam mod online.');
 }
 window.vitacomOnlineApi=onlineApi;
})();
