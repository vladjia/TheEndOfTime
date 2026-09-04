
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
  const title = document.querySelector('.welcome-title');
  if(!canvas || !title) return;

  const ctx = canvas.getContext('2d');
  if(!ctx) return;

  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let particles = [];
  let edgePoints = [];
  let spawnAccumulator = 0;
  let last = performance.now();

  function setupCanvas(){
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    buildGlyphEdgeMap();
  }

  function buildGlyphEdgeMap(){
    const w = Math.max(1, Math.floor(canvas.clientWidth));
    const h = Math.max(1, Math.floor(canvas.clientHeight));
    const off = document.createElement('canvas');
    const scale = 2;
    off.width = w * scale;
    off.height = Math.max(140, Math.floor(h * .8)) * scale;

    const o = off.getContext('2d');
    if(!o) return;

    const fontSize = Math.min(220, Math.max(100, canvas.clientWidth * .31));
    const family = getComputedStyle(title).fontFamily || 'serif';

    o.scale(scale,scale);
    o.clearRect(0,0,off.width/scale,off.height/scale);
    o.font = `${fontSize}px ${family}`;
    o.textAlign = 'center';
    o.textBaseline = 'alphabetic';
    o.fillStyle = '#fff';

    // 使用跟迎賓標題一致的「時」「盡」間距感，而不是中央單點漏沙
    const cx = w/2;
    const gap = fontSize * .18;
    const y = Math.min(h*.52, fontSize*.78);
    o.fillText('時', cx - fontSize*.42 - gap/2, y);
    o.fillText('盡', cx + fontSize*.42 + gap/2, y);

    const img = o.getImageData(0,0,w,h);
    const data = img.data;
    const candidates = [];

    // 只找字體下緣的像素，讓沙從真正的筆畫底部脫落。
    for(let x=2;x<w-2;x+=2){
      let lowest = -1;
      for(let y0=2;y0<Math.min(h-3, Math.floor(h*.66));y0++){
        const a = data[(y0*w + x)*4 + 3];
        if(a > 80) lowest = y0;
      }
      if(lowest > 0){
        candidates.push({x, y:Math.max(0, lowest-1)});
      }
    }

    // 降採樣，避免形成一道連續白牆
    edgePoints = candidates.filter((_,i)=>i%2===0);
  }

  function spawn(){
    if(!edgePoints.length) return;
    const p0 = edgePoints[Math.floor(Math.random()*edgePoints.length)];

    // 95% 超細沙，5% 稍大的碎屑；不再出現雪粒感
    const large = Math.random() < .05;
    particles.push({
      x:p0.x + (Math.random()-.5)*1.8,
      y:Math.max(0, p0.y - 2 + Math.random()*4),
      vx:(Math.random()-.5)*.010,
      vy:.020 + Math.random()*.020,
      ay:.00017 + Math.random()*.00011,
      r:large ? (.72 + Math.random()*.42) : (.22 + Math.random()*.46),
      alpha:large ? (.30 + Math.random()*.16) : (.18 + Math.random()*.26),
      red:Math.random() < .035,
      twinkle:Math.random() < .08
    });
  }

  function drawParticle(p, h){
    const fadeStart = h*.68;
    const fade = p.y < fadeStart ? 1 : Math.max(0,1-(p.y-fadeStart)/(h-fadeStart));
    const a = p.alpha * fade;

    if(p.r > .7){
      ctx.beginPath();
      ctx.moveTo(p.x, p.y-1.5);
      ctx.lineTo(p.x, p.y+1.5);
      ctx.strokeStyle = p.red
        ? `rgba(126,28,42,${a*.38})`
        : `rgba(224,228,234,${a*.30})`;
      ctx.lineWidth=.35;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fillStyle = p.red
      ? `rgba(132,31,45,${a*.72})`
      : `rgba(225,229,235,${a})`;
    ctx.fill();
  }

  function draw(now){
    const dt = Math.min(32, now-last);
    last = now;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0,0,w,h);

    if(!reduceMotion){
      // 密而細，不追求「看見顆粒」，追求整體像風化落沙
      spawnAccumulator += dt * .40;
      while(spawnAccumulator >= 1 && particles.length < 520){
        spawn();
        spawnAccumulator -= 1;
      }
    }else if(particles.length===0){
      for(let i=0;i<120;i++){
        spawn();
        if(particles[i]) particles[i].y += Math.random()*h*.55;
      }
    }

    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];

      if(!reduceMotion){
        p.vy += p.ay*dt;
        p.x += p.vx*dt;
        p.y += p.vy*dt;

        // 非常輕的空氣偏移，不讓沙筆直掉成雨
        p.vx += Math.sin((p.y+i)*.045)*.000025*dt;
      }

      drawParticle(p,h);

      if(p.y>h+3) particles.splice(i,1);
    }

    // 極淡的細霧，不做任何中央束口或明顯光柱
    const g = ctx.createLinearGradient(0,h*.60,0,h);
    g.addColorStop(0,'rgba(95,18,30,0)');
    g.addColorStop(.7,'rgba(95,18,30,.010)');
    g.addColorStop(1,'rgba(220,224,230,.006)');
    ctx.fillStyle=g;
    ctx.fillRect(0,h*.58,w,h*.42);

    if(!reduceMotion) requestAnimationFrame(draw);
  }

  Promise.resolve(document.fonts ? document.fonts.ready : null).then(()=>{
    setupCanvas();

    // 預填少量，而且全都很細，第一眼就有「正在流」而不是突然噴砂。
    for(let i=0;i<160;i++){
      spawn();
      if(particles[i]) particles[i].y += Math.random()*canvas.clientHeight*.54;
    }

    if(reduceMotion){
      draw(performance.now());
    }else{
      requestAnimationFrame(draw);
    }
  });

  window.addEventListener('resize', setupCanvas, {passive:true});
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', initWelcomeSand);
}else{
  initWelcomeSand();
}
