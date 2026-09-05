
const $ = s => document.querySelector(s);

async function getJSON(path){
  const r = await fetch(path,{cache:'no-store'});
  if(!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

function norm(v){
  return String(v ?? '')
    .replace(/\s+/g,'')
    .replace(/[・·．.＿_\-–—]/g,'')
    .toLowerCase();
}

function copyText(copy,key,fallback=''){
  const item = copy?.[key];
  if(item == null) return fallback;
  if(typeof item === 'string') return item || fallback;
  return item.text || fallback;
}

const CHARACTER_ALIASES = {
  jiashi:['家式','時盡家式','時盡・家式'],
  baiji:['白霽','無晝白霽','無晝・白霽'],
  yeshenxing:['葉慎行','月半刀葉慎行','月半刀・葉慎行','月半'],
  anyanxiu:['安言修','蝶君安言修','蝶君・安言修','蝶']
};

function haystack(img){
  return norm([
    img.group, img.target, img.category, img.name,
    img.path, img.folder, img.relativePath
  ].filter(Boolean).join(' '));
}

function hasAny(text, words){
  const n = norm(text);
  return words.some(w => n.includes(norm(w)));
}

function scoreCharacterImage(img, id, opts={}){
  const text = haystack(img);
  const aliases = CHARACTER_ALIASES[id] || [];
  let score = 0;

  if(hasAny(text, aliases)) score += 20;
  if(hasAny(text,['人物'])) score += 5;
  if(hasAny(text,['主視覺','主视觉'])) score += 8;

  if(opts.zero){
    if(hasAny(text,['零式','殺體','杀体'])) score += 16;
    else score -= 8;
  }else{
    if(hasAny(text,['零式','殺體','杀体'])) score -= 14;
    if(hasAny(text,['常體','常体'])) score += 6;
  }

  return score;
}

function bestCharacterImage(images,id,opts={}){
  const ranked = (images || [])
    .map(img => ({img, score:scoreCharacterImage(img,id,opts)}))
    .filter(x => x.score > 0)
    .sort((a,b)=>b.score-a.score);

  const picked = ranked[0]?.img || null;
  if(picked) console.info(`[圖片配對] ${id} →`, picked.name || picked.url);
  else console.warn(`[圖片配對失敗] ${id}`);
  return picked;
}

function getWeaponImages(images, weaponId){
  return (images || [])
    .filter(img => img.targetId === weaponId)
    .sort((a,b) => {
      const aName = String(a.name || '');
      const bName = String(b.name || '');
      return aName.localeCompare(bName,'zh-Hant');
    });
}

function weaponImageLabel(img){
  const name = String(img?.name || '')
    .replace(/\.[^.]+$/,'')
    .trim();

  if(!name) return '';

  const parts = name.split('_').filter(Boolean);

  // 常見命名：武器名_狀態_分類_序號
  if(parts.length >= 2){
    return parts[1];
  }

  return img.category || '';
}

function mountImage(target, item, alt){
  if(!target || !item?.url){
    return;
  }

  const old = target.querySelector('img');
  if(old) old.remove();

  const img = document.createElement('img');
  img.src = item.url;
  img.alt = alt;
  img.loading = 'eager';

  img.addEventListener('load', () => {
    const w = img.naturalWidth || 0;
    const h = img.naturalHeight || 0;

    if(!w || !h) return;

    const ratio = w / h;
    const isHero = target.id === 'characterHero';
    const isZero = target.id === 'zeroVisual';
    const isWeapon = target.classList?.contains('weapon-slot');

    target.style.setProperty('--media-ratio', `${w} / ${h}`);

    if(isHero){
      target.classList.remove('media-cover','media-contain','media-natural-fit');
      target.classList.add(ratio < 1.35 ? 'media-contain' : 'media-cover');
    }

    if(isZero || isWeapon){
      target.classList.add('media-natural-fit','media-contain');
      target.style.aspectRatio = `${w} / ${h}`;
    }
  });

  img.addEventListener('error', () => {
  });

  target.appendChild(img);
}

function setText(selector,value){
  const el = typeof selector === 'string' ? $(selector) : selector;
  if(el && value != null && value !== '') el.textContent = value;
}

function renderParagraphs(target,text){
  if(!target) return;
  target.innerHTML = '';
  const parts = String(text || '')
    .split(/\n\s*\n/)
    .map(s=>s.trim())
    .filter(Boolean);

  parts.forEach(part=>{
    const p = document.createElement('p');
    p.textContent = part;
    target.appendChild(p);
  });
}

function renderMeta(char){
  const box = $('#characterMeta');
  if(!box) return;

  const fields = Array.isArray(char.introFields)
    ? char.introFields.filter(item => item && (item.title || item.value)).slice(0,3)
    : [];

  box.innerHTML = '';

  for(let i = 0; i < 3; i++){
    const item = fields[i] || {title:'', value:''};

    const cell = document.createElement('div');

    if(item.title){
      const small = document.createElement('small');
      small.textContent = item.title;
      cell.appendChild(small);
    }

    if(item.value){
      const strong = document.createElement('strong');
      strong.textContent = item.value;
      cell.appendChild(strong);
    }

    box.appendChild(cell);
  }
}

function renderStrip(char){
  const box = $('#characterStrip');
  if(!box) return;

  const rows = [
    ['IDENTITY',char.role],
    ['SIGNATURE',char.signature],
    ['CORE',char.coreLine]
  ].filter(([,value])=>value);

  box.innerHTML = rows.map(([label,value])=>
    `<div><span>${label}</span><strong>${value}</strong></div>`
  ).join('');
}

function renderSkills(skills,charId){
  const list = $('#skillList');
  const section = $('#skillsSection');
  if(!list || !section) return;

  const items = (skills || [])
    .filter(x=>x.characterId === charId)
    .sort((a,b)=>(Number(a.order)||999)-(Number(b.order)||999));

  if(!items.length){
    section.hidden = true;
    return;
  }

  list.innerHTML = '';

  items.forEach(item=>{
    const article = document.createElement('article');
    article.innerHTML = `
      <div class="skill-code">${item.code || ''}</div>
      <div>
        <small>${item.eyebrow || item.type || ''}</small>
        <h3>${item.name || ''}</h3>
        <p>${item.publicDescription || ''}</p>
        ${item.effectSummary ? `<div class="skill-effect">${item.effectSummary}</div>` : ''}
      </div>`;
    list.appendChild(article);
  });
}

function renderRelations(relations,charId){
  const section = $('#relationsSection');
  const list = $('#relationList');
  if(!section || !list) return;

  const items = (relations || [])
    .filter(x=>x.characterId === charId)
    .sort((a,b)=>(Number(a.order)||999)-(Number(b.order)||999));

  if(!items.length){
    section.hidden = true;
    return;
  }

  section.hidden = false;
  list.innerHTML = '';

  items.forEach(item=>{
    const article = document.createElement('article');
    article.className = 'relation-item';
    article.innerHTML = `
      <h3>${item.title || ''}</h3>
      <p>${item.publicContent || ''}</p>
      ${item.coreLine ? `<blockquote>${item.coreLine}</blockquote>` : ''}`;
    list.appendChild(article);
  });
}

function renderPoem(char){
  const section = $('#poemSection');
  const box = $('#poemContent');
  if(!section || !box) return;

  const lines = String(char.poem || '').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);

  if(!lines.length){
    section.hidden = true;
    return;
  }

  section.hidden = false;
  box.innerHTML = lines.map(line=>`<p>${line}</p>`).join('');
}

function renderWeapon(char,id,weapons,images){
  const section = $('#weaponSection');
  if(!section) return;

  const weapon = (weapons || []).find(w => w.id === char.weaponId);

  if(!weapon){
    section.hidden = true;
    return;
  }

  section.hidden = false;

  setText('#weaponTitle',weapon.name || '武器');
  setText('#weaponTag',weapon.combatSignature || '');
  setText('#weaponDescription',weapon.publicDescription || '');
  setText('#weaponSignatureLine',weapon.signatureLine || '');

  const slots = $('#weaponSlots');
  if(!slots) return;

  const weaponImages = getWeaponImages(images, weapon.id);

  if(!weaponImages.length){
    slots.hidden = true;
    return;
  }

  slots.hidden = false;
  slots.innerHTML = '';

  weaponImages.forEach((item,index) => {
    const slot = document.createElement('div');
    slot.className = 'weapon-slot';
    slot.id = `weaponMedia${index + 1}`;

    const label = document.createElement('span');
    label.textContent = weaponImageLabel(item) || `IMAGE ${String(index + 1).padStart(2,'0')}`;
    slot.appendChild(label);

    slots.appendChild(slot);

    mountImage(
      slot,
      item,
      `${weapon.name || '武器'} ${label.textContent}`
    );
  });
}

function renderSpecialVisual(char,id,skills,images){
  const section = $('#specialVisualSection');
  if(!section) return;

  if(id !== 'jiashi'){
    section.hidden = true;
    return;
  }

  const zero = (skills || []).find(x=>x.characterId === id && /家皇歿式・零/.test(x.name || ''));
  if(!zero){
    section.hidden = true;
    return;
  }

  section.hidden = false;
  setText('#specialVisualTitle',zero.name);
  setText('#specialVisualDescription',zero.publicDescription);

  const steps = String(zero.effectSummary || '')
    .split(/[→＞>]/)
    .map(x=>x.trim())
    .filter(Boolean);

  const stepBox = $('#specialVisualSteps');
  if(stepBox){
    stepBox.innerHTML = steps.map((step,i)=>
      `${i ? '<i>→</i>' : ''}<span>${step}</span>`
    ).join('');
  }

  const image = bestCharacterImage(images,id,{zero:true});
  mountImage($('#zeroVisual'), image, `${char.fullName || char.name} 零式主視覺`);
}

function applyCopy(copy){
  setText('#siteSubtitle',copyText(copy,'site.brand.subtitle','WORLD / CHARACTER ARCHIVE'));
  setText('#publicMode',copyText(copy,'site.mode.public','PUBLIC · 無雷'));
  setText('#backCharacters',copyText(copy,'site.back.characters','← 返回角色'));
  setText('#coreLabel',copyText(copy,'site.character.core_label','CORE LINE'));
  setText('#profileTitle',copyText(copy,'site.character.profile_title','角色簡介'));
  setText('#weaponTitle',copyText(copy,'site.character.weapon_title','武器'));
  setText('#skillsTitle',copyText(copy,'site.character.skills_title','招式／能力'));
  setText('#relationsTitle',copyText(copy,'site.character.relation_title','關係'));
  setText('#poemTitle',copyText(copy,'site.character.poem_title','詩號'));
  setText('#fullArchiveLabel',copyText(copy,'site.character.full_archive','FULL ARCHIVE'));
  setText('#fullArchiveTitle',copyText(copy,'site.character.full_title','完整設定'));
  setText('#fullArchiveDesc',copyText(copy,'site.character.full_desc','完整身世、關係與劇情內容屬於防雷區。公開頁目前僅展示無雷資料。'));
  setText('#fullArchiveButton',copyText(copy,'site.character.full_button','防雷模式・建置中'));
}

function renderCharacter(char,id,data){
  if(!char) return;

  const order = String(Number(char.order || 0)).padStart(2,'0');

  setText('#siteTitle',data.site?.site_title || '時盡');
  setText('#characterKicker',`CHARACTER FILE ${order}`);
  setText('#characterNumber',order);
  setText('#characterTitle',char.title);
  setText('#characterName',char.name);
  setText('#characterIntro',char.publicIntro);
  setText('#characterCore',char.coreLine);
  setText('#characterSeal',char.seal);
  setText('#heroPlaceholder',`${char.fullName || char.name}｜主視覺載入中`);

  renderMeta(char);
  renderStrip(char);
  renderParagraphs($('#profileContent'),char.publicDetail || char.publicIntro);
  renderWeapon(char,id,data.weapons || [],data.images || []);
  renderSkills(data.skills || [],id);
  renderSpecialVisual(char,id,data.skills || [],data.images || []);
  renderRelations(data.relations || [],id);
  renderPoem(char);

  const footer = $('#characterFooter');
  if(footer){
    const version = data.site?.site_version || '0.14.0';
    const dataVersion = data.site?.data_version || '';
    footer.textContent = `《時盡》CHARACTER FILE · ${char.fullName || char.name} · Core v${version}${dataVersion ? ` · Data ${dataVersion}` : ''}`;
  }

  document.title = `${char.fullName || char.name}｜《時盡》角色檔案`;
  const desc = document.querySelector('meta[name="description"]');
  if(desc && char.publicIntro) desc.setAttribute('content',char.publicIntro);
}


async function initCharacterPage(){
  const body = document.body;
  const id = body.dataset.character;
  if(!id) return;

  try{
    const config = await getJSON('../data/config.json');
    const endpoint = config.gasApiEndpoint;
    if(!endpoint) throw new Error('No GAS endpoint');

    const data = await getJSON(`${endpoint}?type=public&_=${Date.now()}`);
    if(!data?.ok) throw new Error('GAS API returned ok=false');

    const char = (data.characters || []).find(x=>x.id===id);
    if(!char) throw new Error(`Character not found: ${id}`);

    applyCopy(data.copy || {});
    renderCharacter(char,id,data);

    const main = bestCharacterImage(data.images || [],id,{zero:false});
    mountImage($('#characterHero'), main, `${char.fullName || char.name} 主視覺`);

    console.info(`《時盡》角色頁資料來源：Google Sheet / GAS · ${id}`);
  }catch(err){
    console.warn('角色頁 GAS 載入失敗，保留 HTML SEO / fallback。',err);
  }
}

initCharacterPage();
