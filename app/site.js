
const $ = s => document.querySelector(s);

const LOCAL_FALLBACK = {
  config: 'data/config.json',
  characters: 'data/characters.json',
  world: 'data/world.json',
  story: 'data/story.json'
};

async function getJSON(path){
  const r = await fetch(path, {cache:'no-store'});
  if(!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

async function getLocalConfig(){
  return getJSON(LOCAL_FALLBACK.config);
}

function renderCharacters(chars){
  const box = $('#characterCards');
  box.innerHTML = '';

  const seals = {
    jiashi: { text:'家', cls:'sig-jiashi' },
    baiji: { text:'白', cls:'sig-baiji' },
    yeshenxing: { text:'月半', cls:'sig-yeshenxing' },
    anyanxiu: { text:'蝶', cls:'sig-anyanxiu' }
  };

  (chars || [])
    .sort((a,b)=>(Number(a.order)||999)-(Number(b.order)||999))
    .forEach(c=>{
      const seal = seals[c.id] || { text:(c.name || '').slice(-1), cls:'' };
      const el = document.createElement('article');
      el.className='card';
      el.dataset.character = c.id || '';
      el.innerHTML = `
        <div class="role">${c.role || ''}</div>
        <h3>${c.fullName || `${c.title || ''}・${c.name || ''}`}</h3>
        <p>${c.publicIntro || ''}</p>
        <div class="sig ${seal.cls}" data-sig="${seal.text}" aria-hidden="true">${seal.text}</div>`;
      box.appendChild(el);
    });
}

function renderWorld(items){
  const first = [...(items || [])].sort((a,b)=>(Number(a.order)||999)-(Number(b.order)||999))[0];
  if(first){
    $('#worldName').textContent = first.title || '世界觀';
    $('#worldIntro').textContent = first.publicContent || '';
  }
}

function renderHero(site){
  if(site?.site_title) document.title = `${site.site_title}｜世界觀・角色資料站`;
}

function renderImages(images){
  // 先用規則挑主視覺。之後會再做完整圖庫頁。
  const normal = (images || []).find(x =>
    x.group === '人物' &&
    x.target === '家式' &&
    x.category === '主視覺' &&
    /常體/.test(x.name || '')
  ) || (images || []).find(x =>
    x.group === '人物' && x.target === '家式' && x.category === '主視覺'
  );

  if(normal){
    const hero = $('#hero');
    const img = document.createElement('img');
    img.src = normal.url;
    img.alt = '時盡・家式';
    hero.appendChild(img);
  }
}

async function loadFromGas(endpoint){
  const url = `${endpoint}?type=public&_=${Date.now()}`;
  const data = await getJSON(url);
  if(!data?.ok) throw new Error('GAS API returned ok=false');
  return data;
}

async function loadFallback(){
  const [config, chars, world, story] = await Promise.all([
    getJSON(LOCAL_FALLBACK.config),
    getJSON(LOCAL_FALLBACK.characters),
    getJSON(LOCAL_FALLBACK.world),
    getJSON(LOCAL_FALLBACK.story)
  ]);
  return {
    ok:true,
    site:config,
    characters:chars.characters || [],
    world:[{
      title: world.world?.name || '世界觀',
      publicContent: world.world?.publicIntro || '',
      order:1
    }],
    story:[],
    images:[]
  };
}

async function init(){
  let data;
  try{
    const config = await getLocalConfig();
    if(!config.gasApiEndpoint) throw new Error('No GAS endpoint');
    data = await loadFromGas(config.gasApiEndpoint);
    console.info('《時盡》資料來源：Google Sheet / GAS');
  }catch(e){
    console.warn('GAS 載入失敗，改用 GitHub 本機備援資料。', e);
    data = await loadFallback();
  }

  renderHero(data.site);
  renderCharacters(data.characters);
  renderWorld(data.world);
  renderImages(data.images);

  const version = data.site?.site_version || data.site?.siteVersion || '';
  const dataVersion = data.site?.data_version || '';
  const footer = document.querySelector('.footer');
  if(footer && (version || dataVersion)){
    footer.textContent = `《時盡》WORLD / CHARACTER ARCHIVE · Core ${version ? 'v'+version : ''}${dataVersion ? ' · Data '+dataVersion : ''}`;
  }
}

init();


function initWelcomeGate(){
  const gate = document.getElementById('welcomeGate');
  const start = document.getElementById('welcomeStart');
  if(!gate || !start) return;

  const enter = () => {
    gate.classList.add('is-leaving');
    document.body.classList.remove('pre-entry');
    document.body.classList.add('site-entered');

    window.setTimeout(() => {
      gate.remove();
    }, 900);
  };

  start.addEventListener('click', enter);
  start.addEventListener('keydown', (e) => {
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      enter();
    }
  });
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', initWelcomeGate);
}else{
  initWelcomeGate();
}
