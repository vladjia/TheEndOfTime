
const $ = s => document.querySelector(s);

async function getJSON(path){
  const r = await fetch(path,{cache:'no-store'});
  if(!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

function pickImage(images, matcher){
  return (images || []).find(matcher);
}

function mountImage(target, item, alt){
  if(!target || !item?.url) return;
  const old = target.querySelector('img');
  if(old) old.remove();
  const img = document.createElement('img');
  img.src = item.url;
  img.alt = alt;
  img.loading = 'eager';
  target.appendChild(img);
}

async function initJiashi(){
  try{
    const config = await getJSON('../data/config.json');
    const endpoint = config.gasApiEndpoint;
    if(!endpoint) throw new Error('No GAS endpoint');

    const data = await getJSON(`${endpoint}?type=public&_=${Date.now()}`);
    const char = (data.characters || []).find(x=>x.id==='jiashi');

    if(char?.publicIntro){
      $('#jiashiIntro').textContent = char.publicIntro;
    }

    const images = data.images || [];

    const normal = pickImage(images,x =>
      x.group === '人物' &&
      x.target === '家式' &&
      x.category === '主視覺' &&
      /常體/.test(x.name || '')
    ) || pickImage(images,x =>
      x.group === '人物' && x.target === '家式' && x.category === '主視覺'
    );

    const zero = pickImage(images,x =>
      x.group === '人物' &&
      x.target === '家式' &&
      x.category === '主視覺' &&
      /(殺體|零式)/.test(x.name || '')
    ) || pickImage(images,x =>
      x.group === '人物' &&
      x.target === '家式' &&
      /(殺體|零式)/.test(x.name || '')
    );

    const weaponOpen = pickImage(images,x =>
      x.group === '武器' &&
      x.target === '斷刻' &&
      /(展開)/.test(x.name || '')
    );

    const weaponClosed = pickImage(images,x =>
      x.group === '武器' &&
      x.target === '斷刻' &&
      /(收攏)/.test(x.name || '')
    );

    mountImage($('#jiashiHero'), normal, '時盡・家式 常體主視覺');
    mountImage($('#zeroVisual'), zero, '時盡・家式 零式主視覺');
    mountImage($('#weaponOpen'), weaponOpen, '斷刻 展開');
    mountImage($('#weaponClosed'), weaponClosed, '斷刻 收攏');

  }catch(err){
    console.warn('家式角色頁資料載入失敗，保留靜態公開內容。',err);
  }
}

initJiashi();
