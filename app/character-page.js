
const $ = s => document.querySelector(s);

async function getJSON(path,{cache='default'}={}){
  const r = await fetch(path,{cache});
  if(!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

const CHARACTER_API_CACHE_TTL = 3 * 60 * 1000;

function characterApiCacheKey(mode){
  return `tet:character-api:v01840:${mode}`;
}

function readCharacterApiCache(mode){
  try{
    const raw=sessionStorage.getItem(characterApiCacheKey(mode));
    if(!raw) return null;
    const entry=JSON.parse(raw);
    if(!entry?.data) return null;
    if(Date.now()-Number(entry.savedAt||0)>CHARACTER_API_CACHE_TTL) return null;
    return entry.data;
  }catch(_){
    return null;
  }
}

function writeCharacterApiCache(mode,data){
  if(!data?.ok) return;
  try{
    sessionStorage.setItem(
      characterApiCacheKey(mode),
      JSON.stringify({savedAt:Date.now(),data})
    );
  }catch(_){}
}

async function loadCharacterApi(endpoint,mode){
  const cached=readCharacterApiCache(mode);
  if(cached){
    // 跨角色頁先立即用快取；背景更新供下一頁使用。
    setTimeout(async()=>{
      try{
        const fresh=await getJSON(`${endpoint}?type=${encodeURIComponent(mode)}`,{cache:'no-store'});
        writeCharacterApiCache(mode,fresh);
      }catch(_){}
    },0);
    return cached;
  }

  const fresh=await getJSON(`${endpoint}?type=${encodeURIComponent(mode)}`,{cache:'no-store'});
  writeCharacterApiCache(mode,fresh);
  return fresh;
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


function isVideoMedia(item){
  return String(item?.mediaType || '').toLowerCase() === 'video'
    || String(item?.mimeType || '').toLowerCase().startsWith('video/');
}

function isImageMedia(item){
  return !isVideoMedia(item);
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
    .filter(isImageMedia)
    .map(img => ({img, score:scoreCharacterImage(img,id,opts)}))
    .filter(x => x.score > 0)
    .sort((a,b)=>b.score-a.score);

  const picked = ranked[0]?.img || null;
  if(picked) console.info(`[圖片配對] ${id} →`, picked.name || picked.url);
  else console.warn(`[圖片配對失敗] ${id}`);
  return picked;
}

function characterContentImage(data,characterId,adventureData){
  const fields=adventureData?.characterContent?.[characterId] || {};
  const imageId = [
    fields?.portrait?.imageId,
    fields?.portrait?.imageID,
    fields?.publicIntro?.imageId,
    fields?.publicIntro?.imageID,
    fields?.profile?.imageId,
    fields?.profile?.imageID
  ].map(value=>String(value || '').trim()).find(Boolean);

  if(!imageId) return null;

  return (data?.images || []).find(item=>[
    item?.id,item?.assetId,item?.assetID,item?.driveId,item?.driveID,item?.fileId,item?.fileID
  ].some(value=>String(value || '').trim()===imageId)) || null;
}

function getWeaponImages(images, weaponId){
  return (images || [])
    .filter(img => isImageMedia(img) && img.targetId === weaponId)
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


function scoreCharacterVideo(item,id,opts={}){
  if(!isVideoMedia(item)) return -999;
  const text=haystack(item);
  const aliases=CHARACTER_ALIASES[id] || [];
  let score=0;

  if(item.targetId === id) score += 30;
  if(hasAny(text,aliases)) score += 18;
  if(hasAny(text,['人物'])) score += 4;

  if(opts.zero){
    if(hasAny(text,['零式','殺體','杀体','家皇歿式零','家皇歿式・零'])) score += 40;
    if(hasAny(text,['招式'])) score += 12;
  }

  return score;
}

function bestCharacterVideo(items,id,opts={}){
  const ranked=(items || [])
    .filter(isVideoMedia)
    .map(item=>({item,score:scoreCharacterVideo(item,id,opts)}))
    .filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score);

  const picked=ranked[0]?.item || null;
  if(picked) console.info(`[影片配對] ${id} →`,picked.name || picked.url);
  return picked;
}

function mountVideo(target,item,title,poster=''){
  if(!target || !item) return false;

  target.querySelectorAll('img,video,iframe').forEach(el=>el.remove());
  target.classList.add('has-video','media-natural-fit');

  const video=document.createElement('video');
  video.className='character-video';
  video.controls=true;
  video.playsInline=true;
  video.preload='metadata';
  video.src=item.url || '';
  if(poster) video.poster=poster;
  video.setAttribute('aria-label',title || '角色招式影片');

  video.addEventListener('loadedmetadata',()=>{
    if(video.videoWidth && video.videoHeight){
      target.style.aspectRatio=`${video.videoWidth} / ${video.videoHeight}`;
      target.style.setProperty('--media-ratio',`${video.videoWidth} / ${video.videoHeight}`);
    }
  },{once:true});

  const fallbackToDrivePreview=()=>{
    if(!item.previewUrl) return;
    video.remove();

    const iframe=document.createElement('iframe');
    iframe.className='character-video-drive';
    iframe.src=item.previewUrl;
    iframe.title=title || '角色招式影片';
    iframe.allow='autoplay; fullscreen';
    iframe.allowFullscreen=true;
    iframe.loading='lazy';
    target.appendChild(iframe);
  };

  video.addEventListener('error',fallbackToDrivePreview,{once:true});
  target.appendChild(video);
  return true;
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
  img.dataset.viewer = 'true';
  img.dataset.viewerLabel = alt || '';

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
      target.classList.add('media-hero-fill');
      // 角色主視覺展示框直接跟著原圖比例走，不再硬塞進寬卡片。
      target.style.aspectRatio = `${w} / ${h}`;
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

function parseZeroSteps(summary){
  const raw=String(summary||'')
    .replace(/[→＞>]/g,' ')
    .replace(/\s+/g,' ')
    .trim();

  const steps=[];
  const rx=/([1-8])[\.．、]\s*([\s\S]*?)(?=(?:\s+[1-8][\.．、]\s*)|$)/g;
  let m;
  while((m=rx.exec(raw))){
    const text=String(m[2]||'').trim();
    if(text) steps.push({no:Number(m[1]),text});
  }

  if(steps.length>=4) return steps.slice(0,8);

  // 舊資料若沒有完整編號，仍保留可讀性
  return String(summary||'')
    .split(/[→＞>]/)
    .map(x=>x.trim())
    .filter(Boolean)
    .slice(0,8)
    .map((text,i)=>({no:i+1,text}));
}

function zeroStepTitle(no,text){
  const t=norm(text);
  if(no===1 || t.includes('家皇歿式')) return '宣告';
  if(no===2 || t.includes('彈指') || t.includes('停止')) return '止刻';
  if(no===3 || t.includes('斷界移影') || t.includes('時空裂隙')) return '斷界移影';
  if(no===4 || t.includes('髮色') || t.includes('白髮') || t.includes('銀白')) return '零式轉化';
  if(no===5 || t.includes('再現') || t.includes('身後')) return '再現';
  if(no===6 || t.includes('血迴') || t.includes('絕脈') || t.includes('取命')) return '取命';
  if(no===7 || t.includes('收攏') || t.includes('收扇')) return '收扇';
  if(no===8 || t.includes('時間恢復') || t.includes('恢復')) return '時間恢復';
  return `第 ${String(no).padStart(2,'0')} 段`;
}

function zeroPhaseMarkup(summary){
  const text=String(summary||'');
  const known=['黑髮染霜','銀白向上蔓延','全髮化白'];
  const found=known.filter(x=>text.includes(x));
  if(!found.length) return '';
  return `
    <div class="zero-phase-strip" aria-label="零式髮色轉化">
      ${found.map((x,i)=>`
        ${i?'<i aria-hidden="true">→</i>':''}
        <span>${x}</span>
      `).join('')}
    </div>`;
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

  const steps=parseZeroSteps(zero.effectSummary);
  const image=bestCharacterImage(images,id,{zero:true});
  const video=bestCharacterVideo(images,id,{zero:true});

  section.hidden=false;
  section.classList.add('zero-dossier');

  section.innerHTML=`
    <div class="zero-dossier-head">
      <div class="character-section-title">
        <small>04 / SIGNATURE</small>
        <h2>${zero.name || '家皇歿式・零'}</h2>
      </div>
      <p class="zero-dossier-lead">${zero.publicDescription || ''}</p>
      <div class="zero-four-laws" aria-label="零式四系">
        <span>時字訣</span>
        <span>空字訣</span>
        <span>血字訣</span>
        <span>弒字訣</span>
      </div>
    </div>

    <div class="zero-dossier-grid">
      <div class="zero-flow-panel">
        <div class="zero-subhead">
          <small>SEQUENCE</small>
          <h3>施展流程</h3>
        </div>
        <ol class="zero-timeline">
          ${steps.map(step=>`
            <li class="zero-timeline-step ${step.no===4?'is-transform':''}">
              <div class="zero-step-index">${String(step.no).padStart(2,'0')}</div>
              <div class="zero-step-body">
                <h4>${zeroStepTitle(step.no,step.text)}</h4>
                <p>${step.text}</p>
                ${step.no===4 ? zeroPhaseMarkup(zero.effectSummary) : ''}
              </div>
            </li>
          `).join('')}
        </ol>
      </div>

      <aside class="zero-observe-panel">
        <div class="zero-subhead">
          <small>COMBAT RECORD</small>
          <h3>戰鬥影像</h3>
        </div>
        <div class="zero-media-frame" id="zeroVisual">
          <div class="zero-label" id="zeroLabel">${video?'家皇歿式・零｜戰鬥影像':'零式・主視覺'}</div>
          <div class="zero-glyph" aria-hidden="true">零</div>
        </div>

        <div class="zero-state-card">
          <div class="zero-state-title">零式狀態</div>
          <dl class="zero-state-grid">
            <div><dt>狀態</dt><dd>零式</dd></div>
            <div><dt>髮色</dt><dd>銀白</dd></div>
            <div><dt>最長維持</dt><dd>半個時辰</dd></div>
            <div><dt>解除後</dt><dd>時蝕</dd></div>
          </dl>
          <p>時蝕期間，時間、位移、極速、恢復與血族異能皆停止運作。</p>
        </div>
      </aside>
    </div>

    <div class="zero-rule-panel">
      <div class="zero-subhead">
        <small>CORE RULE</small>
        <h3>核心規則</h3>
      </div>
      <div class="zero-rule-grid">
        <article>
          <span>01</span>
          <p>零式發動時，家式仍維持黑髮與深紅漸層。真正的白髮轉化，是在「斷界移影」穿越時空裂隙的過程中完成。</p>
        </article>
        <article>
          <span>02</span>
          <p>「血迴」與「絕脈」並非額外停頓施招，而是在斷喉之後完成零式最後的取命流程。</p>
        </article>
      </div>
    </div>
  `;

  const visual=$('#zeroVisual');
  if(video){
    const mounted=mountVideo(
      visual,
      video,
      `${char.fullName || char.name}｜家皇歿式・零`,
      image?.url || ''
    );
    if(!mounted && image){
      mountImage(visual,image,`${char.fullName || char.name} 零式主視覺`);
    }
  }else if(image){
    mountImage(visual,image,`${char.fullName || char.name} 零式主視覺`);
  }
}

function applyCopy(copy){
  setText('#siteSubtitle',copyText(copy,'site.brand.subtitle','WORLD / CHARACTER ARCHIVE'));
  setText('#backCharacters',copyText(copy,'site.back.characters','← 返回角色'));
  setText('#coreLabel',copyText(copy,'site.character.core_label','CORE LINE'));
  setText('#profileTitle',copyText(copy,'site.character.profile_title','角色簡介'));
  setText('#weaponTitle',copyText(copy,'site.character.weapon_title','武器'));
  setText('#skillsTitle',copyText(copy,'site.character.skills_title','招式／能力'));
  setText('#relationsTitle',copyText(copy,'site.character.relation_title','關係'));
  setText('#poemTitle',copyText(copy,'site.character.poem_title','詩號'));
}

function galleryMedia(items,id,adventureData){
  const field=adventureData?.characterContent?.[id]?.gallery;
  const records=Array.isArray(field) ? field : (field ? [field] : []);

  return records
    .map(record=>{
      const imageId=String(record?.imageId || record?.imageID || '').trim();
      if(!imageId) return null;

      const asset=(items || []).find(item=>[
        item?.id,item?.assetId,item?.assetID,item?.driveId,item?.driveID,item?.fileId,item?.fileID
      ].some(value=>String(value || '').trim()===imageId));

      return {
        ...(asset || {}),
        id:imageId,
        imageId,
        url:asset?.url || `https://drive.google.com/thumbnail?id=${encodeURIComponent(imageId)}&sz=w2000`,
        caption:String(record?.value || '').trim(),
        stageId:String(record?.stageId || '').trim(),
        versionId:String(record?.versionId || '').trim(),
        sortOrder:Number(record?.sortOrder || 0)
      };
    })
    .filter(Boolean)
    .sort((a,b)=>
      Number(a.sortOrder || 0)-Number(b.sortOrder || 0)
      || String(a.name || '').localeCompare(String(b.name || ''),'zh-Hant',{
        numeric:true,
        sensitivity:'base'
      })
    );
}

function galleryCaption(item){
  const caption=String(item?.caption || '').trim();
  if(caption) return caption;

  let name=String(item?.name||'').trim();
  if(!name) return '';
  name=name.replace(/\.[^.]+$/,'');
  name=name.replace(/[_-]\d+$/,'');
  name=name.replace(/^(?:時盡[・\-_\s]*)?/,'');
  return name.replace(/_/g,' ').trim();
}

function ensureGallerySection(copy){
  let section=document.getElementById('gallerySection');
  if(section) return section;

  section=document.createElement('section');
  section.className='character-section character-gallery-section';
  section.id='gallerySection';
  section.hidden=true;
  section.innerHTML=`
    <div class="character-section-title character-gallery-heading">
      <small>${copyText(copy,'site.character.gallery_kicker','VISUAL JOURNAL')}</small>
      <h2>${copyText(copy,'site.character.gallery_title','角色圖誌')}</h2>
    </div>
    <div class="character-gallery-grid" id="characterGalleryGrid"></div>
  `;

  const profile=document.getElementById('profileSection');
  if(profile){
    profile.insertAdjacentElement('afterend',section);
  }else{
    document.querySelector('.character-main')?.appendChild(section);
  }
  return section;
}

function renderCharacterGallery(items,id,char,adventureData,copy){
  const media=galleryMedia(items,id,adventureData);
  const section=ensureGallerySection(copy);
  const grid=section.querySelector('#characterGalleryGrid');

  if(!media.length){
    section.hidden=true;
    grid.replaceChildren();
    return;
  }

  const frag=document.createDocumentFragment();

  media.forEach((item,index)=>{
    const figure=document.createElement('figure');
    figure.className='character-gallery-item';
    if(index===0 && media.length>=3) figure.classList.add('is-featured');

    const label=galleryCaption(item) || `${char.fullName || char.name} 圖誌`;

    if(isVideoMedia(item)){
      figure.classList.add('is-video');

      const video=document.createElement('video');
      video.className='character-gallery-video';
      video.controls=true;
      video.playsInline=true;
      video.preload='metadata';
      video.src=item.url || '';
      video.setAttribute('aria-label',label);

      video.addEventListener('error',()=>{
        if(!item.previewUrl) return;
        const iframe=document.createElement('iframe');
        iframe.className='character-gallery-video character-gallery-drive';
        iframe.src=item.previewUrl;
        iframe.title=label;
        iframe.allow='autoplay; fullscreen';
        iframe.allowFullscreen=true;
        iframe.loading='lazy';
        video.replaceWith(iframe);
      },{once:true});

      figure.appendChild(video);
    }else{
      const img=document.createElement('img');
      img.className='character-gallery-image';
      img.src=item.url || '';
      img.alt=label;
      img.loading='lazy';
      img.decoding='async';
      img.dataset.viewer='true';
      img.dataset.viewerLabel=label;
      figure.appendChild(img);
    }

    const caption=document.createElement('figcaption');
    caption.textContent=label;
    figure.appendChild(caption);
    frag.appendChild(figure);
  });

  grid.replaceChildren(frag);
  section.hidden=false;
}


const CHARACTER_SECTION_IDS = [
  'overview',
  'profile',
  'gallery',
  'weapon',
  'skills',
  'signature',
  'relations',
  'poem'
];

function characterKnowledgeSet(adventureData,characterId){
  const devFull =
    String(adventureData?.player?.devPreviewMode || '')
      .trim()
      .toUpperCase() === 'FULL';

  if(devFull){
    return new Set(CHARACTER_SECTION_IDS);
  }

  const map=adventureData?.characterSectionUnlocks || {};
  return new Set(Array.isArray(map?.[characterId]) ? map[characterId] : []);
}

function applyCharacterContent(char,characterId,adventureData){
  const fields=adventureData?.characterContent?.[characterId] || {};
  const value=fieldId=>String(fields?.[fieldId]?.value || '').trim();

  const publicIntro=value('publicIntro');
  const coreLine=value('coreLine');
  const publicDetail=value('publicDetail');

  if(publicIntro) char.publicIntro=publicIntro;
  if(coreLine) char.coreLine=coreLine;
  if(publicDetail) char.publicDetail=publicDetail;

  [1,2,3].forEach(index=>{
    const title=value(`introField${index}Title`);
    const content=value(`introField${index}`);
    if(!Array.isArray(char.introFields)) char.introFields=[];
    if(title || content){
      char.introFields[index-1]={title:title,value:content};
    }
  });
}

function setKnowledgeVisible(target,visible){
  if(!target) return;
  target.classList.toggle('character-knowledge-hidden',!visible);
  if(!visible) target.setAttribute('aria-hidden','true');
  else target.removeAttribute('aria-hidden');
}

function applyCharacterKnowledge(characterId,knowledge){
  const has=id=>knowledge.has(id);

  // 身分層：主視覺、稱號、角色名永遠屬於「角色已存在」本身。
  // overview 才控制玩家目前知道的公開介紹 / 核心句 / 三欄資料 / strip。
  setKnowledgeVisible(document.getElementById('characterIntro'),has('overview'));
  setKnowledgeVisible(document.querySelector('.character-rule'),has('overview'));
  setKnowledgeVisible(document.getElementById('characterMeta'),has('overview'));
  setKnowledgeVisible(document.getElementById('characterStrip'),has('overview'));

  setKnowledgeVisible(document.getElementById('profileSection'),has('profile'));
  setKnowledgeVisible(document.getElementById('gallerySection'),has('gallery'));
  setKnowledgeVisible(document.getElementById('weaponSection'),has('weapon'));
  setKnowledgeVisible(document.getElementById('skillsSection'),has('skills'));
  setKnowledgeVisible(document.getElementById('specialVisualSection'),has('signature'));
  setKnowledgeVisible(document.getElementById('relationsSection'),has('relations'));
  setKnowledgeVisible(document.getElementById('poemSection'),has('poem'));

}

function renderCharacter(char,id,data,adventureData){
  if(!char) return;

  document.body.dataset.character = id || char.id || '';
  const order = String(Number(char.order || 0)).padStart(2,'0');

  setText('#siteTitle',data.site?.site_title || '時盡');
  setText('#characterKicker',`CHARACTER FILE ${order}`);
  setText('#characterNumber',order);
  setText('#characterTitle',char.title);
  setText('#characterName',char.name);
  setText('#breadcrumbCurrent',char.name || char.fullName || '角色');
  setText('#characterIntro',char.publicIntro);
  setText('#characterCore',char.coreLine);
  setText('#characterSeal',char.seal);
  setText('#heroPlaceholder',`${char.fullName || char.name}｜主視覺載入中`);

  renderMeta(char);
  renderStrip(char);
  renderParagraphs($('#profileContent'),char.publicDetail || char.publicIntro);
  renderCharacterGallery(data.images || [],id,char,adventureData,data.copy || {});
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
  if(!id){
    window.SiteLoading?.hide?.();
    return;
  }

  try{
    const config = await getJSON('../data/config.json?v=0.18.32',{cache:'force-cache'});
    const endpoint = config.gasApiEndpoint;
    if(!endpoint) throw new Error('No GAS endpoint');

    const apiType = 'public';

    // 角色頁的「資料內容」與「玩家目前理解到哪裡」分開讀。
    const [data,adventureData] = await Promise.all([
      loadCharacterApi(endpoint,apiType),
      (async()=>{
        const A=window.EndOfTimeAdventure;
        if(!A) return null;
        await A.ensure();
        return A.load(false);
      })()
    ]);

    if(!data?.ok) throw new Error('GAS API returned ok=false');

    // 正常玩家若尚未遇見這個角色，直接回角色索引。
    // DEV FULL 不受此限制。
    const devFull =
      String(adventureData?.player?.devPreviewMode || '')
        .trim()
        .toUpperCase() === 'FULL';

    if(!devFull){
      const unlocked=Array.isArray(adventureData?.charactersUnlocked)
        ? adventureData.charactersUnlocked
        : [];
      if(!unlocked.includes(id)){
        location.replace('index.html');
        return;
      }
    }

    const char = (data.characters || []).find(x=>x.id===id);
    if(!char) throw new Error(`Character not found: ${id}`);

    applyCharacterContent(char,id,adventureData);
    applyCopy(data.copy || {});
    renderCharacter(char,id,data,adventureData);

    const knowledge=characterKnowledgeSet(adventureData,id);
    applyCharacterKnowledge(id,knowledge);

    window.EndOfTimeSealEffects?.bindCharacterVisual?.(document,id);

    const main = characterContentImage(data,id,adventureData)
      || bestCharacterImage(data.images || [],id,{zero:false});
    mountImage($('#characterHero'), main, `${char.fullName || char.name} 主視覺`);

    console.info(
      `《時盡》角色認知：${id} →`,
      devFull ? 'DEV FULL' : [...knowledge]
    );
  }catch(err){
    console.warn('角色頁 GAS / 認知資料載入失敗，保留 HTML SEO / fallback。',err);
  }finally{
    window.SiteLoading?.hide?.();
  }
}

initCharacterPage();
