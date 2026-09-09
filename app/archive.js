const $ = s => document.querySelector(s);

async function getJSON(path){
  const r = await fetch(path,{cache:'no-store'});
  if(!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

function copyText(copy,key,fallback=''){
  const item=copy?.[key];
  if(item == null) return fallback;
  if(typeof item === 'string') return item || fallback;
  return item.text || fallback;
}

function applyCopy(copy){
  document.querySelectorAll('[data-copy]').forEach(el=>{
    const value = copyText(copy,el.dataset.copy,el.textContent);
    if(value) el.textContent=value;
  });
}

// 階段覆蓋規則統一放在 app/character-fields.js，角色頁跟這裡共用同一份。
// 以前兩邊各抄一份，結果這裡少覆蓋六個欄位，卡片直接寫出「家式」爆雷。
function applyCharacterContent(chars,progress){
  const 角色欄位=window.EndOfTimeCharacterFields;
  if(!角色欄位) throw new Error('[時盡] 沒載到 app/character-fields.js —— 階段覆蓋會失效，寧可讓頁面空掉也不能爆雷。');
  角色欄位.applyAll(chars,progress);
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
        <h2>${c.name || c.fullName || ''}</h2>
        <p>${c.publicIntro || ''}</p>
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
        </div>`;
      box.appendChild(article);
    });
}

async function initArchive(){
  try{
    const config=await getJSON('../data/config.json');
    const data=await getJSON(`${config.gasApiEndpoint}?type=public&_=${Date.now()}`);

    applyCopy(data.copy || {});
    let progress=null;
    try{ progress=await window.EndOfTimeAdventure?.load?.(); }catch(_){}

    if(document.body.classList.contains('archive-characters')){
      const unlocked=new Set(progress?.charactersUnlocked||[]);
      const chars=(data.characters||[]).filter(c=>unlocked.has(c.id));
      applyCharacterContent(chars,progress);
      renderCharacters(chars);
      if(!chars.length){document.querySelector('#characterArchiveGrid').innerHTML='<div class="story-empty">你還沒有在旅途中真正認識任何人。</div>'}
    }
    if(document.body.classList.contains('archive-world')){
      const unlocked=new Set(progress?.worldUnlocked||[]);
      const worlds=(data.world||[]).filter(w=>unlocked.has(w.id));
      renderWorld(worlds);
      if(!worlds.length){document.querySelector('#worldArchiveList').innerHTML='<div class="story-empty">你尚未理解這個世界留下的真相。</div>'}
    }
  }catch(err){
    console.error(err);
  }finally{
    window.SiteLoading?.hide?.();
  }
}

initArchive();
