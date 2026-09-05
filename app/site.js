
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

function copyText(copy,key,fallback=''){
  const item = copy?.[key];
  if(item == null) return fallback;
  if(typeof item === 'string') return item || fallback;
  return item.text || fallback;
}

function applyCopy(copy){
  document.querySelectorAll('[data-copy]').forEach(el=>{
    const key = el.dataset.copy;
    const value = copyText(copy,key,el.textContent);
    if(value) el.textContent = value;
  });
}

function applyMetaFromCopy(copy,site){
  const title = copyText(copy,'site.home.meta.title','');
  const desc = copyText(copy,'site.home.meta.description','');

  if(title) document.title = title;
  else if(site?.site_title) document.title = `${site.site_title}｜世界觀・角色資料站`;

  if(desc){
    const meta = document.querySelector('meta[name="description"]');
    if(meta) meta.setAttribute('content',desc);
  }

  const brandTitle = document.getElementById('brandTitle');
  if(brandTitle && site?.site_title) brandTitle.textContent = site.site_title;
}

function renderCharacters(chars,copy){
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
      const pageMap = {
        jiashi:'characters/jiashi.html',
        baiji:'characters/baiji.html',
        yeshenxing:'characters/yeshenxing.html',
        anyanxiu:'characters/anyanxiu.html'
      };
      const el = document.createElement(pageMap[c.id] ? 'a' : 'article');
      el.className='card';
      el.dataset.character = c.id || '';
      if(pageMap[c.id]){
        el.href = pageMap[c.id];
        el.classList.add('card-link');
        el.setAttribute('aria-label',`開啟${c.fullName || c.name || '角色'}角色頁`);
      }
      el.innerHTML = `
        <div class="role">${c.role || ''}</div>
        <h3>${c.fullName || `${c.title || ''}・${c.name || ''}`}</h3>
        <p>${c.publicIntro || ''}</p>
        ${pageMap[c.id] ? `<div class="card-enter">${copyText(copy,'site.home.characters.enter','VIEW FILE →')}</div>` : ''}
        <div class="sig ${seal.cls}" data-sig="${seal.text}" aria-hidden="true">${seal.text}${c.id === 'anyanxiu' ? '<span class="butterfly-third"></span>' : ''}</div>`;
      box.appendChild(el);
    });
}


function chineseNumber(n){
  const num = Number(n);
  const digits = ['零','一','二','三','四','五','六','七','八','九','十'];
  if(!Number.isFinite(num) || num <= 0) return String(n || '');
  if(num <= 10) return digits[num];
  if(num < 20) return '十' + digits[num - 10];
  if(num < 100){
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return digits[tens] + '十' + (ones ? digits[ones] : '');
  }
  return String(num);
}

function storyLabel(item){
  const ch = item.chapterNumber ? `第${chineseNumber(item.chapterNumber)}章` : '';
  const sec = item.sectionNumber ? `第${chineseNumber(item.sectionNumber)}節` : '';
  return [ch,sec].filter(Boolean).join('　');
}

function storyReaderHref(item, base=''){
  return `${base}story/read.html?id=${encodeURIComponent(item.id || '')}`;
}

function renderStoryPreview(items,copy){
  const box = $('#storyPreviewList');
  if(!box) return;

  const rows = [...(items || [])]
    .sort((a,b)=>(Number(a.order)||9999)-(Number(b.order)||9999))
    .slice(0,3);

  box.innerHTML = '';

  if(!rows.length){
    const empty = document.createElement('div');
    empty.className = 'story-empty';
    empty.textContent = '故事仍在時間裡成形。';
    box.appendChild(empty);
    return;
  }

  rows.forEach(item=>{
    const el = document.createElement(item.isReadable ? 'a' : 'article');
    el.className = 'story-preview-item';

    if(item.isReadable){
      el.href = storyReaderHref(item,'');
    }else{
      el.classList.add('is-locked');
    }

    el.innerHTML = `
      <div class="story-preview-index">${storyLabel(item)}</div>
      <div class="story-preview-main">
        <h3>${item.sectionTitle || item.chapterTitle || '未命名篇章'}</h3>
        ${item.subtitle ? `<small>${item.subtitle}</small>` : ''}
        <p>${item.publicSummary || ''}</p>
      </div>
      <div class="story-preview-status">
        ${item.isReadable ? 'READ →' : copyText(copy,'site.story.locked','尚未公開')}
      </div>
    `;

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

function renderHero(site,copy){
  applyMetaFromCopy(copy,site);
  applyCopy(copy);
}

function renderImages(images){
  const list = Array.isArray(images) ? images : [];
  const hero = $('#hero');
  if(!hero) return;

  const norm = value => String(value || '')
    .trim()
    .replace(/\s+/g,'')
    .replace(/[・·．.＿_\-–—\/\\]/g,'')
    .toLowerCase();

  const imageUrl = x => {
    const direct = String(x?.url || '').trim();
    if(direct) return direct;
    const id = String(x?.id || '').trim();
    return id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w2000` : '';
  };

  const score = x => {
    const name = norm(x?.name);
    const group = norm(x?.group);
    const target = norm(x?.target);
    const category = norm(x?.category);
    const path = norm(x?.path);
    const hay = `${name}|${group}|${target}|${category}|${path}`;

    let s = 0;

    // 首頁素材：不要過度依賴資料夾解析結果，只要檔名/路徑明確即可。
    if(hay.includes('網站素材')) s += 80;
    if(hay.includes('首頁')) s += 150;
    if(hay.includes('封面')) s += 110;
    if(hay.includes('主視覺')) s += 90;
    if(hay.includes('hero')) s += 70;
    if(hay.includes('cover')) s += 70;

    // 固定品牌資產不可誤抓。
    if(hay.includes('logo')) s -= 400;
    if(hay.includes('favicon')) s -= 400;
    if(hay.includes('ogcover')) s -= 300;
    if(hay.includes('loading')) s -= 300;

    // 家式人物主視覺作最後備援。
    if(hay.includes('人物') && hay.includes('家式') && hay.includes('主視覺')) s += 30;

    if(!imageUrl(x)) s -= 1000;
    return s;
  };

  const ranked = list
    .map(x => ({x,score:score(x)}))
    .filter(item => item.score > 0)
    .sort((a,b) => b.score - a.score);

  const source = ranked[0]?.x || null;

  hero.querySelectorAll('img').forEach(el=>el.remove());
  hero.classList.remove('image-loaded','image-error');
  hero.classList.toggle('has-image',Boolean(source));

  if(!source){
    console.warn('首頁主視覺：GAS images 中找不到首頁素材。', list);
    hero.classList.add('image-error');
    return;
  }

  const src = imageUrl(source);
  const img = document.createElement('img');
  img.src = src;
  img.alt = '時盡｜首頁主視覺';
  img.decoding = 'async';
  img.loading = 'eager';
  img.referrerPolicy = 'no-referrer';

  img.addEventListener('load',()=>{
    hero.classList.add('image-loaded');
    hero.classList.remove('image-error');
  },{once:true});

  img.addEventListener('error',()=>{
    console.warn('首頁主視覺載入失敗：',source,src);
    hero.classList.add('image-error');
  },{once:true});

  hero.appendChild(img);
}

async function loadFromGas(endpoint){
  const mode = window.EndOfTimeMode?.current?.() || 'public';
  const url = `${endpoint}?type=${encodeURIComponent(mode)}&_=${Date.now()}`;
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
    images:[],
    skills:[],
    relations:[],
    copy:{}
  };
}

async function init(){
  try{
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

  renderHero(data.site,data.copy || {});
  window.EndOfTimeMode?.bind?.(data.copy || {});
  renderStoryPreview(data.story || [],data.copy || {});
  renderCharacters(data.characters,data.copy || {});
  renderWorld(data.world);
  renderImages(data.images);

  const version = data.site?.site_version || data.site?.siteVersion || '';
  const dataVersion = data.site?.data_version || '';
  const footer = document.querySelector('.footer');
  if(footer && (version || dataVersion)){
    footer.textContent = `《時盡》WORLD / CHARACTER ARCHIVE · Core ${version ? 'v'+version : ''}${dataVersion ? ' · Data '+dataVersion : ''}`;
  }

  }finally{
    window.SiteLoading?.hide?.();
  }
}

init();


function initWelcomeExperienceV2(){
  const params = new URLSearchParams(window.location.search);
  const skipWelcome = params.get('skipWelcome') === '1';

  const gate = document.getElementById('welcomeGate');

  if(skipWelcome){
    if(gate) gate.remove();
    document.body.classList.remove('pre-entry');
    document.body.classList.add('site-entered');

    // 清掉網址上的暫時參數，保留 hash，例如 #characters
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, '', cleanUrl);
    return;
  }
  const button = document.getElementById('welcomeCanvasButton');
  const canvas = document.getElementById('welcomeTitleCanvas');
  if(!gate || !button || !canvas) return;

  const ctx = canvas.getContext('2d', { alpha:true });
  if(!ctx) return;

  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 核心原則：
     標題與沙粒都在同一張 Canvas。
     粒子來源直接採樣「同一張 Canvas 裡的字」，
     因此不存在 DOM / Canvas 錯位問題。 */

  let dpr = 1;
  let sourceCanvas;
  let workCanvas;
  let sourceCtx;
  let workCtx;
  let points = [];
  let pointIndex = 0;
  let particles = [];
  let titleBounds = null;
  let clicked = false;
  let hovering = false;
  let last = performance.now();
  let dissolveStart = 0;
  let hoverAcc = 0;
  let intro = 0;

  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

  function setup(){
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.max(2, Math.floor(rect.width*dpr));
    canvas.height = Math.max(2, Math.floor(rect.height*dpr));

    sourceCanvas = document.createElement('canvas');
    workCanvas = document.createElement('canvas');
    sourceCanvas.width = workCanvas.width = canvas.width;
    sourceCanvas.height = workCanvas.height = canvas.height;

    sourceCtx = sourceCanvas.getContext('2d');
    workCtx = workCanvas.getContext('2d');

    renderTitle();
    buildDissolvePoints();

    workCtx.clearRect(0,0,workCanvas.width,workCanvas.height);
    workCtx.drawImage(sourceCanvas,0,0);

    particles = [];
    pointIndex = 0;
    intro = 0;
  }

  function renderTitle(){
    const w = canvas.width/dpr;
    const h = canvas.height/dpr;

    sourceCtx.setTransform(dpr,0,0,dpr,0,0);
    sourceCtx.clearRect(0,0,w,h);

    const fontSize = clamp(w*.245, 108, 218);
    const gap = fontSize*.20;

    sourceCtx.font = `700 ${fontSize}px "TheEndOfTimeDisplay","Noto Serif TC","DFKai-SB","KaiTi",serif`;
    sourceCtx.textAlign = 'center';
    sourceCtx.textBaseline = 'middle';

    const y = h*.43;
    const m1 = sourceCtx.measureText('時');
    const m2 = sourceCtx.measureText('盡');
    const total = m1.width + m2.width + gap;
    const leftX = w/2 - total/2 + m1.width/2;
    const rightX = w/2 + total/2 - m2.width/2;

    /* 很輕的暗紅背光，只提供深度，不做發光字 */
    sourceCtx.save();
    sourceCtx.shadowColor='rgba(116,20,34,.12)';
    sourceCtx.shadowBlur=18;
    sourceCtx.fillStyle='rgba(241,243,246,.95)';
    sourceCtx.fillText('時',leftX,y);
    sourceCtx.fillText('盡',rightX,y);
    sourceCtx.restore();

    const ascent = Math.max(
      m1.actualBoundingBoxAscent || fontSize*.78,
      m2.actualBoundingBoxAscent || fontSize*.78
    );
    const descent = Math.max(
      m1.actualBoundingBoxDescent || fontSize*.16,
      m2.actualBoundingBoxDescent || fontSize*.16
    );

    titleBounds = {
      left:leftX-m1.width*.58,
      right:rightX+m2.width*.58,
      top:y-ascent,
      bottom:y+descent,
      height:ascent+descent
    };
  }

  function buildDissolvePoints(){
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    const img = sourceCtx.getImageData(0,0,w,h);
    const data = img.data;
    const result = [];

    /* 每 3 device px 採樣一次。
       每個點的 threshold 依「由下往上」排序，再加入連續隨機擾動。
       所以消失邊界是不規則細砂，而不是橫向方塊。 */
    const step = Math.max(3, Math.round(dpr*2.2));

    const top = Math.max(0, Math.floor(titleBounds.top*dpr));
    const bottom = Math.min(h-1, Math.ceil(titleBounds.bottom*dpr));
    const left = Math.max(0, Math.floor(titleBounds.left*dpr));
    const right = Math.min(w-1, Math.ceil(titleBounds.right*dpr));
    const height = Math.max(1,bottom-top);

    for(let y=top;y<=bottom;y+=step){
      for(let x=left;x<=right;x+=step){
        const a = data[(y*w+x)*4+3];
        if(a < 70) continue;

        const upward = (bottom-y)/height;
        const noise = (Math.random()-.5)*.18;
        const threshold = clamp(upward + noise, 0, 1);

        result.push({
          x:x/dpr,
          y:y/dpr,
          threshold,
          radius:.75 + Math.random()*1.5,
          emit:Math.random()<.42
        });
      }
    }

    result.sort((a,b)=>a.threshold-b.threshold);
    points=result;
  }

  function erasePoint(p){
    workCtx.save();
    workCtx.setTransform(dpr,0,0,dpr,0,0);
    workCtx.globalCompositeOperation='destination-out';

    /* 圓形軟擦除，不會出現馬賽克格 */
    const r=p.radius*(1.2+Math.random()*.8);
    const g=workCtx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*2.15);
    g.addColorStop(0,'rgba(0,0,0,.98)');
    g.addColorStop(.58,'rgba(0,0,0,.78)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    workCtx.fillStyle=g;
    workCtx.beginPath();
    workCtx.arc(p.x,p.y,r*2.2,0,Math.PI*2);
    workCtx.fill();
    workCtx.restore();

    if(p.emit){
      const count=Math.random()<.15 ? 2 : 1;
      for(let i=0;i<count;i++) spawnParticle(p.x,p.y);
    }
  }

  function spawnParticle(x,y,subtle=false){
    const shard=Math.random()<.018;
    const warm=Math.random()<.025;

    particles.push({
      x:x+(Math.random()-.5)*2,
      y:y+(Math.random()-.5)*2,
      vx:(Math.random()-.5)*(subtle?.010:.018),
      vy:(subtle?.018:.026)+Math.random()*(subtle?.012:.022),
      ay:.00018+Math.random()*.00010,
      r:shard ? (.62+Math.random()*.34) : (.16+Math.random()*.34),
      a:subtle ? (.06+Math.random()*.08) :
         (shard ? .23+Math.random()*.09 : .10+Math.random()*.16),
      warm,
      life:0,
      max:1300+Math.random()*1000
    });
  }

  function renderCanvas(now){
    const dt=Math.min(34,now-last);
    last=now;
    const w=canvas.width/dpr;
    const h=canvas.height/dpr;

    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);

    /* 初次顯影：不是跳出來，從暗處慢慢成形 */
    if(!clicked){
      intro=Math.min(1,intro+dt/850);
      ctx.globalAlpha=.25+.75*(1-Math.pow(1-intro,3));
    }else{
      ctx.globalAlpha=1;
    }

    ctx.drawImage(workCanvas,0,0);

    /* hover 只從真正字底掉極少量細砂，提示「這裡可以碰」 */
    if(hovering && !clicked && !reduceMotion){
      hoverAcc+=dt;
      if(hoverAcc>85){
        hoverAcc=0;
        const lower=points.filter(p=>p.threshold<.10);
        if(lower.length){
          const p=lower[(Math.random()*lower.length)|0];
          spawnParticle(p.x,p.y,true);
        }
      }
    }

    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      p.life+=dt;

      if(!reduceMotion){
        p.vy+=p.ay*dt;
        p.x+=p.vx*dt;
        p.y+=p.vy*dt;
        p.vx+=Math.sin((p.y+i)*.037)*.000012*dt;
      }

      const lifeFade=Math.max(0,1-p.life/p.max);
      const bottomFade=p.y<h*.91 ? 1 : Math.max(0,1-(p.y-h*.91)/(h*.09));
      const a=p.a*lifeFade*bottomFade;

      ctx.save();
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=p.warm
        ? `rgba(127,29,43,${a*.72})`
        : `rgba(230,233,238,${a})`;
      ctx.fill();
      ctx.restore();

      if(p.life>p.max || p.y>h+5) particles.splice(i,1);
    }

    requestAnimationFrame(renderCanvas);
  }

  function dissolve(){
    if(clicked) return;
    clicked=true;
    hovering=false;

    if(reduceMotion){
      gate.classList.add('is-leaving');
      document.body.classList.remove('pre-entry');
      document.body.classList.add('site-entered');
      setTimeout(()=>gate.remove(),120);
      return;
    }

    dissolveStart=performance.now();
    gate.classList.add('is-dissolving');

    const tick=()=>{
      const elapsed=performance.now()-dissolveStart;
      const progress=clamp(elapsed/1500,0,1);

      while(pointIndex<points.length && points[pointIndex].threshold<=progress){
        erasePoint(points[pointIndex]);
        pointIndex++;
      }

      if(progress<1){
        requestAnimationFrame(tick);
      }else{
        /* 最後剩下的極少數像素再柔和帶走 */
        workCtx.save();
        workCtx.globalCompositeOperation='destination-out';
        workCtx.fillStyle='rgba(0,0,0,.12)';
        workCtx.fillRect(0,0,workCanvas.width,workCanvas.height);
        workCtx.restore();
      }
    };
    requestAnimationFrame(tick);

    setTimeout(()=>{
      gate.classList.add('is-leaving');
      document.body.classList.remove('pre-entry');
      document.body.classList.add('site-entered');
    },1760);

    setTimeout(()=>gate.remove(),2580);
  }

  button.addEventListener('mouseenter',()=>hovering=true);
  button.addEventListener('mouseleave',()=>hovering=false);
  button.addEventListener('focus',()=>hovering=true);
  button.addEventListener('blur',()=>hovering=false);
  button.addEventListener('click',dissolve);

  Promise.resolve(document.fonts ? document.fonts.load('700 180px "TheEndOfTimeDisplay"') : null)
    .catch(()=>null)
    .then(()=>{
      setup();
      requestAnimationFrame(renderCanvas);
    });

  window.addEventListener('resize',()=>{
    if(clicked) return;
    setup();
  },{passive:true});
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',initWelcomeExperienceV2);
}else{
  initWelcomeExperienceV2();
}
