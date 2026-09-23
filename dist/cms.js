(() => {
  const page = location.pathname.split('/').pop().replace('.html', '') || 'index';
  if (!['index', 'products', 'services'].includes(page)) return;
  const preview = new URLSearchParams(location.search).has('editor') && parent !== window;
  const fields = [], nodes = new Map(), sections = [], originals = new Map();
  const sectionNodes = [...document.querySelectorAll('main > section')];
  sectionNodes.forEach((el, i) => {
    const id = `s${i}`;
    el.dataset.cmsSection = id;
    sections.push({id, name: (el.querySelector('h1,h2,.eyebrow')?.textContent || el.getAttribute('aria-label') || `Seksyen ${i+1}`).trim().replace(/\s+/g, ' ').slice(0, 65)});
  });
  function group(el) { return el.closest('[data-cms-section]')?.dataset.cmsSection || (el.closest('header') ? 'header' : el.closest('footer') ? 'footer' : 'other'); }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let text, n = 0;
  while ((text = walker.nextNode())) {
    const el = text.parentElement;
    if (!text.textContent.trim() || el.closest('script,style,svg,[aria-hidden="true"],.noise,.menu-btn')) continue;
    const id = `t${n++}`;
    const value = el.classList.contains('counter') ? (el.dataset.target || text.textContent) + '+' : text.textContent.trim();
    fields.push({id, type:'text', value, group:group(el), label:value.slice(0, 70)});
    nodes.set(id, text); originals.set(id, {text:text.textContent, style:el.getAttribute('style'), counter:el.dataset.target});
  }
  document.querySelectorAll('img').forEach((el, i) => {
    const id = `i${i}`;
    fields.push({id,type:'image',value:el.getAttribute('src'),alt:el.alt,group:group(el),label:el.alt || el.getAttribute('src').split('/').pop()});
    nodes.set(id,el); originals.set(id,{src:el.getAttribute('src'),alt:el.alt,hidden:el.hidden});
  });
  document.querySelectorAll('a,.floating-whatsapp').forEach((el,i) => {
    const id = `l${i}`;
    const href = el.getAttribute('href') || el.getAttribute('onclick')?.match(/window.open\('([^']+)'/)?.[1] || '';
    fields.push({id,type:'link',value:href,group:group(el),label:el.textContent.trim() || el.getAttribute('aria-label') || 'Pautan'});
    nodes.set(id,el); originals.set(id,{href,onclick:el.getAttribute('onclick'),hidden:el.hidden});
  });
  const baseTitle = document.title, baseDescription = document.querySelector('meta[name="description"]')?.content || '';
  const safeURL = (url, image=false) => typeof url === 'string' && !/[\x00-\x1f\\]/.test(url) && !url.startsWith('//') && (()=>{try {return (image ? ['http:','https:'] : ['http:','https:','mailto:','tel:']).includes(new URL(url,location.href).protocol);}catch{return false;}})();
  const style = document.createElement('style');
  style.textContent = '[data-cms-hidden]{display:none!important}.cms-custom{padding:80px 0}.cms-custom h2{font:700 clamp(28px,4vw,48px)/1.2 Orbitron,Arial,sans-serif;margin-bottom:24px}.cms-custom p{white-space:pre-line;line-height:1.8;max-width:850px;margin:20px 0}.cms-custom img{max-height:480px;object-fit:contain;margin:24px 0}.cms-custom .btn{margin-top:15px}' + (preview ? '.reveal{opacity:1!important;transform:none!important}html{scroll-behavior:auto!important}[data-cms-picked]{outline:3px solid #ed161b!important;outline-offset:4px;cursor:pointer}body{cursor:crosshair}' : '');
  document.head.append(style);
  // Created after field registration so existing editor IDs stay stable.
  const announcement = document.createElement('aside');
  announcement.className='cms-announcement';announcement.setAttribute('aria-label','Pengumuman website');announcement.hidden=true;
  document.querySelector('header')?.after(announcement);
  const positionAnnouncement=()=>{const header=document.querySelector('header');announcement.style.marginTop=header && getComputedStyle(header).position==='fixed'?`${header.getBoundingClientRect().height}px`:'0';};
  if(document.querySelector('header')) new ResizeObserver(positionAnnouncement).observe(document.querySelector('header'));
  const announcementStyle=document.createElement('style');
  announcementStyle.textContent='.cms-announcement:not([hidden]){display:flex;gap:14px;flex-wrap:wrap;justify-content:center;align-items:center;padding:16px 24px;background:#17191d;color:white;text-align:center;font:500 14px/1.6 Arial,sans-serif;overflow-wrap:anywhere}.cms-announcement a{color:white;text-decoration:underline;font-weight:700}';
  document.head.append(announcementStyle);
  function apply(state) {
    const settings=state.settings || {};
    announcement.hidden=!(settings.announcementEnabled && settings.announcement);
    positionAnnouncement();
    announcement.replaceChildren(document.createTextNode(settings.announcement || ''));
    if(settings.announcementLabel && settings.announcementLink && safeURL(settings.announcementLink)) {
      const link=document.createElement('a');link.textContent=settings.announcementLabel;link.href=settings.announcementLink;announcement.append(link);
    }
    const config = state.pages?.[page] || {};
    const theme = state.theme || {};
    document.documentElement.style.setProperty('--red', /^#[\da-f]{6}$/i.test(theme.accent) ? theme.accent : '#ed161b');
    document.documentElement.style.setProperty('--red2', /^#[\da-f]{6}$/i.test(theme.accent) ? theme.accent : '#ff3438');
    document.body.style.fontFamily = ['Inter','Arial','Georgia'].includes(theme.font) ? `${theme.font}, sans-serif` : '';
    document.title = config.title ?? baseTitle;
    const meta = document.querySelector('meta[name="description"]');
    if(meta) meta.content = config.description ?? baseDescription;
    const resetParents = new Set();
    fields.forEach(field => {
      const target = nodes.get(field.id), original = originals.get(field.id), patch = config.fields?.[field.id] || {};
      if(field.type === 'text') {
        const el = target.parentElement;
        const counterDefault = original.counter ? (Number(original.counter)>=1000 ? `${(Number(original.counter)/1000).toFixed(1)}k+` : `${original.counter}+`) : null;
        target.textContent = patch.text ?? counterDefault ?? original.text;
        if('text' in patch || (preview && original.counter)) el.dataset.cmsEdited = 'true'; else delete el.dataset.cmsEdited;
        if(!resetParents.has(el)) {
          if(original.style === null) el.removeAttribute('style'); else el.setAttribute('style',original.style);
          resetParents.add(el);
        }
        if(/^#[\da-f]{6}$/i.test(patch.color || '')) el.style.color = patch.color;
        if(Number(patch.size)>=10 && Number(patch.size)<=120) el.style.fontSize = `${patch.size}px`;
      } else if(field.type === 'image') {
        target.src = safeURL(patch.src,true) ? patch.src : original.src;
        target.alt = patch.alt ?? original.alt;
        target.toggleAttribute('data-cms-hidden', patch.hidden === true);
      } else {
        const href = safeURL(patch.href) ? patch.href : original.href;
        if(target.tagName === 'A') target.setAttribute('href',href);
        else { target.removeAttribute('onclick'); target.onclick=()=>{if(!preview) window.open(href,'_blank','noopener');}; }
        target.toggleAttribute('data-cms-hidden', patch.hidden === true);
      }
    });
    sectionNodes.forEach((el,i)=>el.toggleAttribute('data-cms-hidden',config.sections?.[`s${i}`]?.hidden === true));
    const order = [...new Set([...(config.order || []),...sections.map(s=>s.id)])];
    order.forEach(id=>{const el=sectionNodes[Number(id.slice(1))]; if(el) document.querySelector('main').append(el);});
    document.querySelectorAll('.cms-custom').forEach(el=>el.remove());
    (config.custom || []).forEach(block=>{
      if(block.hidden) return;
      const section=document.createElement('section'); section.className='cms-custom';
      const container=document.createElement('div');container.className='container'; section.append(container);
      const heading=document.createElement('h2'); heading.textContent=block.title || '';container.append(heading);
      const p=document.createElement('p');p.textContent=block.text || '';container.append(p);
      if(block.image && safeURL(block.image,true)){const img=document.createElement('img');img.src=block.image;img.alt=block.alt || '';container.append(img);}
      if(block.button && safeURL(block.href)){const a=document.createElement('a');a.className='btn btn-primary';a.textContent=block.button;a.href=block.href;container.append(a);}
      document.querySelector('main').append(section);
    });
  }
  const announce = () => parent.postMessage({type:'cms-ready',page,fields,sections,title:baseTitle,description:baseDescription},location.origin);
  if(preview) {
    document.addEventListener('click', event=>{
      event.preventDefault();event.stopPropagation();
      const image=event.target.closest('img');
      let entry=image ? fields.find(f=>f.type==='image' && nodes.get(f.id)===image) : fields.find(f=>f.type==='text' && nodes.get(f.id).parentElement===event.target);
      if(!entry) entry=fields.find(f=>f.type==='link' && nodes.get(f.id)===event.target.closest('a,button'));
      if(entry) parent.postMessage({type:'cms-select',id:entry.id},location.origin);
    },true);
    window.addEventListener('message',event=>{
      if(event.origin!==location.origin || event.source!==parent) return;
      if(event.data.type==='cms-apply') apply(event.data.state);
      if(event.data.type==='cms-focus') {
        document.querySelectorAll('[data-cms-picked]').forEach(el=>el.removeAttribute('data-cms-picked'));
        const target=nodes.get(event.data.id), el=target?.nodeType===3 ? target.parentElement : target;
        if(el){el.setAttribute('data-cms-picked','');el.scrollIntoView({block:'center',behavior:'smooth'});}
      }
    });
    announce();
  } else {
    const online=window.VITACOM_SUPABASE;
    const load=online ? fetch(`${online.url}/rest/v1/vitacom_content?select=state&id=eq.site`,{headers:{apikey:online.key}}).then(r=>r.ok?r.json():[]).then(rows=>rows[0]?.state || {}) : fetch('content.json',{cache:'no-store'}).then(r=>r.ok?r.json():{});
    load.then(apply).catch(()=>fetch('content.json',{cache:'no-store'}).then(r=>r.ok?r.json():{}).then(apply).catch(()=>{}));
  }
})();
