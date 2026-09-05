const $ = s => document.querySelector(s);

async function getJSON(path){
  const r = await fetch(path,{cache:'no-store'});
  if(!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

function copyText(copy,key,fallback=''){
  return window.EndOfTimeMode?.copyText?.(copy,key,fallback) ?? fallback;
}

function applyCopy(copy){
  document.querySelectorAll('[data-copy]').forEach(el=>{
    const value = copyText(copy,el.dataset.copy,el.textContent);
    if(value) el.textContent=value;
  });
}

function renderCharacters(chars){
  const box = $('#characterArchiveGrid');
  if(!box) return;

  const pages = {
    jiashi:'jiashi.html',
    baiji:'baiji.html',
    yeshenxing:'yeshenxing.html',
    anyanxiu:'anyanxiu.html'
  };

  box.innerHTML='';

  [...(chars || [])]
    .sort((a,b)=>(Number(a.order)||9999)-(Number(b.order)||9999))
    .forEach(c=>{
      const a = document.createElement('a');
      a.className='archive-character';
      a.dataset.character=c.id || '';
      a.href=pages[c.id] || '#';
      a.innerHTML=`
        <div class="archive-character-seal">${c.seal || ''}</div>
        <small>${c.role || ''}</small>
        <h2>${c.fullName || c.name || ''}</h2>
        <p>${c.publicIntro || ''}</p>
        ${c.spoilerIntro ? `<div class="archive-spoiler">${c.spoilerIntro}</div>` : ''}
        <span>VIEW FILE →</span>`;
      box.appendChild(a);
    });

  window.EndOfTimeSealEffects?.bindArchive?.(box);
}

function renderWorld(items){
  const box = $('#worldArchiveList');
  if(!box) return;

  box.innerHTML='';

  [...(items || [])]
    .sort((a,b)=>(Number(a.order)||9999)-(Number(b.order)||9999))
    .forEach((item,i)=>{
      const article=document.createElement('article');
      article.className='world-archive-item';
      article.innerHTML=`
        <div class="world-archive-number">${String(i+1).padStart(2,'0')}</div>
        <div>
          <small>${item.category || 'WORLD'}</small>
          <h2>${item.title || ''}</h2>
          <p>${item.publicContent || ''}</p>
          ${item.spoilerContent ? `<div class="archive-spoiler">${item.spoilerContent}</div>` : ''}
        </div>`;
      box.appendChild(article);
    });
}

async function initArchive(){
  try{
    const config=await getJSON('../data/config.json');
    const mode=window.EndOfTimeMode?.current?.() || 'public';
    const data=await getJSON(`${config.gasApiEndpoint}?type=${encodeURIComponent(mode)}&_=${Date.now()}`);

    applyCopy(data.copy || {});
    window.EndOfTimeMode?.bind?.(data.copy || {});

    if(document.body.classList.contains('archive-characters')){
      renderCharacters(data.characters || []);
    }
    if(document.body.classList.contains('archive-world')){
      renderWorld(data.world || []);
    }
  }catch(err){
    console.error(err);
  }finally{
    window.SiteLoading?.hide?.();
  }
}

initArchive();