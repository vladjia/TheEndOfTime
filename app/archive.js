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

// 角色列表卡片上的每一格，都要能被「角色認知內容」按階段覆蓋。
// 這份清單必須跟 character-page.js 的 CHARACTER_OVERRIDABLE 完全一致，
// 少一個欄位就是少一個爆雷點——列表頁曾經只蓋三格，
// 結果嬰兒階段的檔案頁寫「那個孩子」，列表卡片卻直接寫「家式」。
const CHARACTER_OVERRIDABLE = [
  'name',          // 角色名（卡片大標）
  'title',         // 正式稱號
  'fullName',      // 完整稱呼
  'role',          // 角色定位
  'coreLine',      // 核心句
  'publicIntro',   // 公開介紹
  'publicDetail',  // 公開詳述
  'seal',          // 印記
  'poem'           // 詩號
];

function applyCharacterContent(chars,progress){
  const map=progress?.characterContent || {};
  (chars || []).forEach(char=>{
    const fields=map[char.id] || {};
    const value=fieldId=>String(fields?.[fieldId]?.value || '').trim();

    // 跟角色頁同一條規則：看那一列在不在，不是看內容空不空。
    // 「這個階段就是沒有稱號」和「這個階段沒設定，沿用預設」是兩件事。
    const 有覆蓋=fieldId=>!!fields && Object.prototype.hasOwnProperty.call(fields,fieldId);

    CHARACTER_OVERRIDABLE.forEach(key=>{
      if(有覆蓋(key)) char[key]=value(key);
    });
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
