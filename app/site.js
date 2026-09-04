
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


else{
  initWelcomeGate();
}


else{
  initWelcomeSand();
}


function initWelcomeExperience(){
  const gate = document.getElementById('welcomeGate');
  const titleButton = document.getElementById('welcomeTitle');
  const canvas = document.getElementById('welcomeDissolve');
  const title = document.querySelector('.welcome-title-button');
  if(!gate || !titleButton || !canvas || !title) return;

  const ctx = canvas.getContext('2d');
  if(!ctx) return;

  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let particles = [];
  let sourcePoints = [];
  let dusting = false;
  let clicked = false;
  let last = performance.now();
  let hoverTimer = 0;

  function fitCanvas(){
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    buildSourceMap();
  }

  function buildSourceMap(){
    const w = Math.max(1, Math.floor(canvas.clientWidth));
    const h = Math.max(1, Math.floor(canvas.clientHeight));
    const off = document.createElement('canvas');
    const scale = 2;
    off.width = w * scale;
    off.height = h * scale;
    const o = off.getContext('2d');
    if(!o) return;

    const titleStyle = getComputedStyle(title);
    const titleRect = title.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const spans = [...title.querySelectorAll('span')];

    o.scale(scale,scale);
    o.clearRect(0,0,w,h);
    o.fillStyle='#fff';
    o.textAlign='center';
    o.textBaseline='alphabetic';

    sourcePoints = [];

    spans.forEach(span=>{
      const r=span.getBoundingClientRect();
      const cs=getComputedStyle(span);
      const fs=parseFloat(cs.fontSize)||parseFloat(titleStyle.fontSize)||180;
      const fam=cs.fontFamily||titleStyle.fontFamily||'serif';

      // 將 DOM 上實際字的中心映射到 particle canvas
      const cx=(r.left+r.right)/2-canvasRect.left;
      const baseline=Math.min(h*.42, fs*.78);
      o.font=`${fs}px ${fam}`;
      o.fillText(span.textContent.trim(),cx,baseline);
    });

    const img=o.getImageData(0,0,w,h);
    const data=img.data;

    // 只採樣每個筆畫「下緣」及其附近，避免像整個字爆炸。
    for(let x=1;x<w-1;x+=2){
      let bottom=-1;
      for(let y=1;y<Math.floor(h*.50);y++){
        if(data[(y*w+x)*4+3] > 90) bottom=y;
      }
      if(bottom>0){
        for(let d=0;d<Math.min(12,bottom);d+=3){
          const yy=bottom-d;
          if(data[(yy*w+x)*4+3] > 90 && Math.random()>.35){
            sourcePoints.push({x,y:yy});
          }
        }
      }
    }
  }

  function makeParticle(pt, strength=1){
    const isShard=Math.random()<.025;
    const warm=Math.random()<.035;
    return {
      x:pt.x+(Math.random()-.5)*1.4,
      y:pt.y+(Math.random()-.5)*1.4,
      vx:(Math.random()-.5)*.010*strength,
      vy:(.018+Math.random()*.020)*strength,
      ay:.00016+Math.random()*.00010,
      r:isShard ? (.62+Math.random()*.34) : (.16+Math.random()*.34),
      a:isShard ? (.27+Math.random()*.11) : (.11+Math.random()*.18),
      warm,
      age:0,
      max:1500+Math.random()*900
    };
  }

  function emit(count, strength=1){
    if(!sourcePoints.length) return;
    for(let i=0;i<count;i++){
      const pt=sourcePoints[(Math.random()*sourcePoints.length)|0];
      particles.push(makeParticle(pt,strength));
    }
  }

  function draw(now){
    const dt=Math.min(32,now-last);
    last=now;
    const w=canvas.clientWidth;
    const h=canvas.clientHeight;
    ctx.clearRect(0,0,w,h);

    // hover 時只掉極少量，暗示可以點
    if(dusting && !clicked && !reduceMotion){
      hoverTimer += dt;
      if(hoverTimer > 55){
        emit(1,.72);
        hoverTimer=0;
      }
    }

    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      p.age+=dt;
      if(!reduceMotion){
        p.vy+=p.ay*dt;
        p.x+=p.vx*dt;
        p.y+=p.vy*dt;
        p.vx+=Math.sin((p.y+i)*.036)*.000018*dt;
      }

      const fade=Math.max(0,1-p.age/p.max);
      const verticalFade=p.y<h*.79 ? 1 : Math.max(0,1-(p.y-h*.79)/(h*.21));
      const a=p.a*fade*verticalFade;

      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=p.warm
        ? `rgba(132,30,44,${a*.78})`
        : `rgba(229,232,237,${a})`;
      ctx.fill();

      if(p.age>p.max || p.y>h+4) particles.splice(i,1);
    }

    requestAnimationFrame(draw);
  }

  function enter(){
    if(clicked) return;
    clicked=true;
    dusting=false;

    if(reduceMotion){
      gate.classList.add('is-entering');
      document.body.classList.remove('pre-entry');
      document.body.classList.add('site-entered');
      setTimeout(()=>gate.remove(),120);
      return;
    }

    gate.classList.add('is-dissolving');

    // 分三波沙化：先細粉、再中量、最後把殘餘筆畫帶走。
    emit(150,1.0);
    setTimeout(()=>emit(230,1.14),180);
    setTimeout(()=>emit(310,1.26),420);
    setTimeout(()=>emit(220,1.38),720);

    // 英文聚合完成後，世界打開。
    setTimeout(()=>{
      gate.classList.add('is-entering');
      document.body.classList.remove('pre-entry');
      document.body.classList.add('site-entered');
    },1550);

    setTimeout(()=>gate.remove(),2350);
  }

  titleButton.addEventListener('mouseenter',()=>{ dusting=true; });
  titleButton.addEventListener('mouseleave',()=>{ dusting=false; });
  titleButton.addEventListener('focus',()=>{ dusting=true; });
  titleButton.addEventListener('blur',()=>{ dusting=false; });
  titleButton.addEventListener('click',enter);

  Promise.resolve(document.fonts ? document.fonts.ready : null).then(()=>{
    fitCanvas();
    requestAnimationFrame(draw);
  });

  window.addEventListener('resize',fitCanvas,{passive:true});
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',initWelcomeExperience);
}else{
  initWelcomeExperience();
}
