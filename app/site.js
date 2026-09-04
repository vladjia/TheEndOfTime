
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


function initWelcomeSand(){
  const canvas = document.getElementById('welcomeSand');
  if(!canvas) return;

  const ctx = canvas.getContext('2d');
  if(!ctx) return;

  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let particles = [];
  let raf = null;
  let last = performance.now();
  let spawnAcc = 0;

  function resize(){
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function spawnParticle(){
    const w = canvas.clientWidth;

    // 不是從中央一點掉，而是從「時」「盡」兩字底部寬區域漏下。
    const left = Math.random() < .5;
    const base = left ? w * .34 : w * .66;
    const spread = w * .18;

    particles.push({
      x: base + (Math.random() - .5) * spread,
      y: -2 + Math.random() * 12,
      vx: (Math.random() - .5) * .018,
      vy: .026 + Math.random() * .025,
      ay: .00022 + Math.random() * .00016,
      r: .7 + Math.random() * 1.5,
      a: .46 + Math.random() * .34,
      warm: Math.random() < .11,
      trail: Math.random() < .28
    });
  }

  function drawParticle(p){
    const h = canvas.clientHeight;
    const fade = p.y < h * .72 ? 1 : Math.max(0, 1 - (p.y - h*.72)/(h*.28));
    const alpha = p.a * fade;

    if(p.trail){
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - Math.max(2, p.vy * 36));
      ctx.lineTo(p.x, p.y + 1);
      ctx.strokeStyle = p.warm
        ? `rgba(151,38,54,${alpha*.38})`
        : `rgba(225,229,235,${alpha*.30})`;
      ctx.lineWidth = Math.max(.45, p.r*.42);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fillStyle = p.warm
      ? `rgba(156,41,58,${alpha})`
      : `rgba(231,234,239,${alpha})`;
    ctx.fill();
  }

  function draw(now){
    const dt = Math.min(34, now-last);
    last = now;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0,0,w,h);

    if(!reduceMotion){
      // 約每幀 3~5 粒，畫面能真的看出「流」。
      spawnAcc += dt * .22;
      while(spawnAcc >= 1 && particles.length < 260){
        spawnParticle();
        spawnAcc -= 1;
      }
    }else if(particles.length === 0){
      for(let i=0;i<70;i++){
        spawnParticle();
        particles[i].y = Math.random()*h*.82;
      }
    }

    for(let i=particles.length-1;i>=0;i--){
      const p = particles[i];

      if(!reduceMotion){
        p.vy += p.ay * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      drawParticle(p);

      if(p.y > h + 6){
        particles.splice(i,1);
      }
    }

    // 英文上方非常淡的積沙霧帶
    const g = ctx.createLinearGradient(0,h*.72,0,h);
    g.addColorStop(0,'rgba(130,28,44,0)');
    g.addColorStop(.65,'rgba(130,28,44,.018)');
    g.addColorStop(1,'rgba(225,229,235,.012)');
    ctx.fillStyle = g;
    ctx.fillRect(0,h*.68,w,h*.32);

    if(!reduceMotion) raf=requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize, {passive:true});

  // 先預填一批粒子，避免使用者第一眼看到空白。
  for(let i=0;i<95;i++){
    spawnParticle();
    particles[i].y = Math.random()*canvas.clientHeight*.82;
  }

  if(reduceMotion){
    draw(performance.now());
  }else{
    raf=requestAnimationFrame(draw);
  }
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', initWelcomeSand);
}else{
  initWelcomeSand();
}
