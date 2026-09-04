
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
  if(picked){
    console.info(`[圖片配對] ${id} →`, picked.name || picked.url);
  }else{
    console.warn(`[圖片配對失敗] ${id}`, (images || []).map(x => ({
      name:x.name, target:x.target, category:x.category, path:x.path
    })));
  }
  return picked;
}

function bestWeaponImage(images, keyword){
  const ranked = (images || [])
    .map(img => {
      const text = haystack(img);
      let score = 0;
      if(hasAny(text,['斷刻','断刻'])) score += 20;
      if(hasAny(text,['武器'])) score += 5;
      if(hasAny(text,[keyword])) score += 14;
      return {img,score};
    })
    .filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score);

  return ranked[0]?.img || null;
}

function mountImage(target, item, alt){
  if(!target || !item?.url) return;

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
    const isWeapon = target.id === 'weaponOpen' || target.id === 'weaponClosed';

    target.style.setProperty('--media-ratio', `${w} / ${h}`);

    if(isHero){
      /* 人物圖：優先完整角色。
         直圖 / 方圖使用 contain；
         很寬的橫圖才使用 cover，避免畫面出現過多空白。 */
      target.classList.remove('media-cover','media-contain','media-natural-fit');

      if(ratio < 1.35){
        target.classList.add('media-contain');
      }else{
        target.classList.add('media-cover');
      }
    }

    if(isZero || isWeapon){
      /* 零式 / 武器：無條件完整顯示，容器直接跟原圖比例 */
      target.classList.add('media-natural-fit','media-contain');
      target.style.aspectRatio = `${w} / ${h}`;
    }
  });

  target.appendChild(img);
}

async function initCharacterPage(){
  const body = document.body;
  const id = body.dataset.character;
  const name = body.dataset.characterName || '';
  if(!id) return;

  try{
    const config = await getJSON('../data/config.json');
    const endpoint = config.gasApiEndpoint;
    if(!endpoint) throw new Error('No GAS endpoint');

    const data = await getJSON(`${endpoint}?type=public&_=${Date.now()}`);
    const char = (data.characters || []).find(x=>x.id===id);

    const intro = $('#characterIntro');
    if(char?.publicIntro && intro) intro.textContent = char.publicIntro;

    const images = data.images || [];

    const main = bestCharacterImage(images,id,{zero:false});
    mountImage($('#characterHero'), main, `${name} 主視覺`);

    if(id === 'jiashi'){
      const zero = bestCharacterImage(images,'jiashi',{zero:true});
      const weaponOpen = bestWeaponImage(images,'展開');
      const weaponClosed = bestWeaponImage(images,'收攏');

      mountImage($('#zeroVisual'), zero, '時盡・家式 零式主視覺');
      mountImage($('#weaponOpen'), weaponOpen, '斷刻 展開');
      mountImage($('#weaponClosed'), weaponClosed, '斷刻 收攏');
    }
  }catch(err){
    console.warn('角色頁資料載入失敗，保留靜態公開內容。',err);
  }
}

initCharacterPage();
