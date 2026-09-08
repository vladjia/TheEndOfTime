
window.EndOfTimeAdventure = (() => {
  const STORAGE_KEY = 'theEndOfTime.timeMark';
  const SESSION_PROMPT_KEY = 'theEndOfTime.timeMark.prompted';
  const SAVED_CARD_KEY = 'theEndOfTime.timeMark.savedCardToken';
  const FIRST_GUIDE_KEY = 'theEndOfTime.timeMark.firstGuideSeen';
  const ENTRY_COACH_KEY = 'theEndOfTime.timeMark.entryCoachSeen';
  let configCache = null;
  let progressCache = null;
  let progressRefreshPromise = null;
  const PROGRESS_SESSION_PREFIX = 'tet:progress:v01839:';
  const PROGRESS_SESSION_TTL = 3 * 60 * 1000;
  let stoneLayoutsCache = null;
  let stoneLayoutsPromise = null;
  let ensurePromise = null;
  let timeMarkBusy = false;
  let criticalAction = '';
  let criticalTimer = null;
  const ENGAGEMENT_IDLE_MS = 120000;
  const ENGAGEMENT_HEARTBEAT_MS = 30000;
  const ENGAGEMENT_TICK_MS = 10000;
  let engagementTracker = null;

  function rootPrefix(){
    return location.pathname.includes('/story/') || location.pathname.includes('/characters/') || location.pathname.includes('/world/') || location.pathname.includes('/journey/') || location.pathname.includes('/timemark/') ? '../' : '';
  }

  async function getConfig(){
    if(configCache) return configCache;
    const r = await fetch(`${rootPrefix()}data/config.json?v=0.18.31`, {cache:'force-cache'});
    if(!r.ok) throw new Error('config load failed');
    configCache = await r.json();
    return configCache;
  }

  // ══════════════════════════════════════════════════════════
  //  時印格式：前綴「時印」＋ 八組六十甲子
  //
  //    時印甲子乙丑丙寅丁卯戊辰己巳庚午辛未
  //
  //  十天干咬十二地支，只有同奇偶才成立 —— 所以「甲丑」不存在。
  //  可用組合六十種，八組即 5×60⁷ ≈ 14 兆（第一組被時辰鎖住，只剩五種）。
  //
  //  第一組的地支＝進站時辰，與母石型號是同一個真相。
  //  後端可以直接從時印讀出母石，不必另外傳 hour。
  //
  //  舊格式 TET-XXXX-XXXX-XXXX-XXXX 永遠繼續接受，不做資料遷移。
  // ══════════════════════════════════════════════════════════
  const TM_GAN = '甲乙丙丁戊己庚辛壬癸';
  const TM_ZHI = '子丑寅卯辰巳午未申酉戌亥';
  const TM_PREFIX = '時印';
  const TM_PAIRS = 8;
  const TM_LEGACY = /^TET-[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/;

  // 十二時辰：子 23-01 ／ 丑 01-03 ／ … ／ 亥 21-23
  function stoneTypeFromHour(hour){
    const h = Number(hour);
    if(!isFinite(h) || h < 0 || h > 23) return 0;
    return Math.floor(((Math.floor(h) + 1) % 24) / 2) + 1;
  }

  // 密碼學等級的亂數；時印是全權憑證，不能用 Math.random。
  function tmRandInt(max){
    const a = new Uint32Array(1);
    const limit = Math.floor(0xFFFFFFFF / max) * max;   // 去掉模數偏差
    let v;
    do{ crypto.getRandomValues(a); v = a[0]; }while(v >= limit);
    return v % max;
  }

  // 給定地支，回傳咬得到的五個天干（同奇偶）
  function tmStemsFor(zi){
    const out = [];
    for(let g = 0; g < 10; g++) if((g % 2) === (zi % 2)) out.push(g);
    return out;
  }

  function generateToken(hour){
    const type = stoneTypeFromHour(hour == null ? new Date().getHours() : hour) || 1;
    const zi0 = type - 1;                       // 第一組的地支＝進站時辰
    const stems = tmStemsFor(zi0);
    let out = TM_PREFIX + TM_GAN[stems[tmRandInt(stems.length)]] + TM_ZHI[zi0];
    for(let i = 1; i < TM_PAIRS; i++){
      const n = tmRandInt(60);                  // 六十甲子的第 n 格
      out += TM_GAN[n % 10] + TM_ZHI[n % 12];
    }
    return out;
  }

  // 從時印讀出母石型號（1–12）。舊格式沒有這個資訊，回 0。
  function stoneTypeFromToken(value){
    const t = String(value || '').trim();
    if(!t.startsWith(TM_PREFIX)) return 0;
    const zi = TM_ZHI.indexOf(t[TM_PREFIX.length + 1]);
    return zi < 0 ? 0 : zi + 1;
  }

  // 把使用者貼進來的東西正規化。
  // 允許空白、全形空白、中間號；前綴可有可無；不合六十甲子的組合一律拒絕。
  function normalizeTimeMarkInput(value){
    const raw = String(value || '').trim();
    if(TM_LEGACY.test(raw.toUpperCase())) return raw.toUpperCase();

    const chars = [...raw].filter(c => TM_GAN.includes(c) || TM_ZHI.includes(c));
    if(chars.length !== TM_PAIRS * 2) return '';
    let out = TM_PREFIX;
    for(let i = 0; i < TM_PAIRS; i++){
      const g = TM_GAN.indexOf(chars[i * 2]);
      const z = TM_ZHI.indexOf(chars[i * 2 + 1]);
      if(g < 0 || z < 0) return '';
      if((g % 2) !== (z % 2)) return '';        // 不存在的干支組合
      out += TM_GAN[g] + TM_ZHI[z];
    }
    return out;
  }

  function isValidTimeMark(value){ return !!normalizeTimeMarkInput(value); }

  // 顯示用：八組之間留空，看得出是八個字對
  function formatTimeMark(value){
    const t = String(value || '').trim();
    if(!t.startsWith(TM_PREFIX)) return t;
    const body = t.slice(TM_PREFIX.length);
    const pairs = [];
    for(let i = 0; i < body.length; i += 2) pairs.push(body.slice(i, i + 2));
    return `${TM_PREFIX}　${pairs.join(' ')}`;
  }

  // 時印等同帳號憑證：拿到的人就能取回整段旅程。
  // 畫面上一律只顯示遮蔽形式，避免隨截圖外流。
  function maskToken(value){
    const t = String(value || '').trim();
    if(!t) return '';

    if(t.startsWith(TM_PREFIX)){
      const body = t.slice(TM_PREFIX.length);
      const pairs = [];
      for(let i = 0; i < body.length; i += 2) pairs.push(body.slice(i, i + 2));
      if(pairs.length < 3) return `${TM_PREFIX}　●● ●● ●● ●● ●● ●● ●● ●●`;
      // 第一組等於母石，石片本來就公開展示，露出來不損失任何祕密。
      const mid = pairs.slice(1, -1).map(() => '●●').join(' ');
      return `${TM_PREFIX}　${pairs[0]} ${mid} ${pairs[pairs.length - 1]}`;
    }

    const parts = t.split('-');
    if(parts.length !== 5) return 'TET-••••-••••-••••-••••';
    return `${parts[0]}-••••-••••-••••-${parts[4]}`;
  }

  // 綁定「顯示／隱藏完整時印」；顯示後 20 秒自動收回，避免忘了關就截圖。
  function bindTokenReveal(codeEl, toggleBtn){
    if(!codeEl || !toggleBtn) return;
    let revealed = false;
    let timer = null;

    const paint = () => {
      const t = token();
      codeEl.textContent = revealed ? t : maskToken(t);
      codeEl.classList.toggle('is-revealed', revealed);
      toggleBtn.textContent = revealed ? '隱藏時印' : '顯示完整時印';
      toggleBtn.setAttribute('aria-pressed', revealed ? 'true' : 'false');
    };

    const hide = () => {
      revealed = false;
      clearTimeout(timer);
      timer = null;
      paint();
    };

    toggleBtn.onclick = () => {
      revealed = !revealed;
      paint();
      clearTimeout(timer);
      timer = revealed ? setTimeout(hide, 20000) : null;
    };

    paint();
  }

  function token(){ return localStorage.getItem(STORAGE_KEY) || ''; }
  function savedCardToken(){ return localStorage.getItem(SAVED_CARD_KEY) || ''; }
  function hasSavedCurrentCard(){ const t=token(); return !!t && savedCardToken()===t; }
  function markCurrentCardSaved(){ const t=token(); if(t) localStorage.setItem(SAVED_CARD_KEY,t); }
  function setToken(value){
    const raw = String(value || '').trim();
    // 舊格式要轉大寫；干支沒有大小寫，原樣存。
    localStorage.setItem(STORAGE_KEY, TM_LEGACY.test(raw.toUpperCase()) ? raw.toUpperCase() : raw);
  }
  function clearToken(){ localStorage.removeItem(STORAGE_KEY); progressCache = null; }

  function normalizeHexColor(value){
    const v=String(value||'').trim();
    return /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : '#7F1521';
  }

  function hexToRgb(hex){
    const n=parseInt(normalizeHexColor(hex).slice(1),16);
    return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};
  }

  function clampRgb(n){
    n=Number(n);
    return Number.isFinite(n) ? Math.max(0,Math.min(255,Math.round(n))) : 0;
  }

  function rgbToHex(r,g,b){
    const part=n=>clampRgb(n).toString(16).padStart(2,'0');
    return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
  }

  function parseRgbInput(value){
    const m=String(value||'').trim().match(/^\s*(\d{1,3})\s*[,，]\s*(\d{1,3})\s*[,，]\s*(\d{1,3})\s*$/);
    if(!m) return null;
    const rgb={r:Number(m[1]),g:Number(m[2]),b:Number(m[3])};
    if(Object.values(rgb).some(v=>v<0||v>255)) return null;
    return rgb;
  }

  function formatRgb(hex){
    const {r,g,b}=hexToRgb(hex);
    return `${r}, ${g}, ${b}`;
  }

  function stoneTypeNumber(value){
    const n=Number(value||0);
    return Number.isInteger(n) && n>=1 && n<=12 ? n : 0;
  }


  const SHICHEN_GLYPHS = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const SHARD_GLYPH_FONT = '"TheEndOfTimeDisplay","Noto Serif TC","DFKai-SB","KaiTi",serif';
  let shardGlyphFontPromise = null;

  function shichenGlyph(type){
    const n = stoneTypeNumber(type);
    return n ? SHICHEN_GLYPHS[n-1] : '';
  }

  // canvas 不會自動載入字體，畫之前必須先確認字體已就緒。
  function ensureShardGlyphFont(){
    if(shardGlyphFontPromise) return shardGlyphFontPromise;
    shardGlyphFontPromise = document.fonts
      ? document.fonts.load('700 180px "TheEndOfTimeDisplay"').catch(()=>null)
      : Promise.resolve(null);
    return shardGlyphFontPromise;
  }

  function stoneVisualOffset(type){
    // 依每顆母石實際透明 PNG 的可見像素重心量測。
    // 目的：不是把「PNG 畫布」置中，而是把「真正看得到的石片本體」置中。
    const offsets={
      1:{x:-2.34,y: 1.56},
      2:{x:-3.92,y: 1.41},
      3:{x:-6.15,y: 2.24},
      4:{x:-4.48,y: 0.49},
      5:{x:-0.11,y: 0.09},
      6:{x:-6.03,y: 0.66},
      7:{x:-4.75,y:-0.34},
      8:{x:-3.82,y: 1.51},
      9:{x:-2.03,y: 0.65},
      10:{x:-5.29,y:-0.04},
      11:{x:-1.33,y: 1.09},
      12:{x:-1.96,y:-0.17}
    };
    return offsets[stoneTypeNumber(type)] || {x:0,y:0};
  }

  function stoneAspectRatio(type){
    const ratios={
      1:1254/1254,
      2:1236/1272,
      3:1312/1199,
      4:1236/1272,
      5:1236/1272,
      6:1254/1254,
      7:1212/1298,
      8:1226/1283,
      9:1236/1272,
      10:1230/1278,
      11:1254/1254,
      12:1254/1254
    };
    return ratios[stoneTypeNumber(type)] || 1;
  }

  function stoneAssetUrl(type){
    const n=stoneTypeNumber(type);
    if(!n) return '';
    // 一律先用「頁面網址」解析成絕對 URL。
    // 不能把 assets/... 相對路徑直接丟進 CSS mask，
    // 否則瀏覽器會以 /app/adventure.css 為基準，錯誤變成 /app/assets/...。
    const rel = `${rootPrefix()}assets/images/timemark/stones/stone-${String(n).padStart(2,'0')}.png?v=0.18.10`;
    return new URL(rel, document.baseURI).href;
  }

  function rgbToHsl({r,g,b}){
    r/=255;g/=255;b/=255;
    const max=Math.max(r,g,b),min=Math.min(r,g,b);
    let h=0,s=0,l=(max+min)/2;
    if(max!==min){
      const d=max-min;
      s=l>.5?d/(2-max-min):d/(max+min);
      switch(max){
        case r:h=(g-b)/d+(g<b?6:0);break;
        case g:h=(b-r)/d+2;break;
        default:h=(r-g)/d+4;
      }
      h*=60;
    }
    return {h,s:s*100,l:l*100};
  }

  function shardPalette(hex){
    const base=rgbToHsl(hexToRgb(hex));
    const clamp=(n,a,b)=>Math.min(Math.max(n,a),b);
    const h=(x)=>((x%360)+360)%360;
    const css=(o,a=1)=>`hsla(${Math.round(o.h)},${Math.round(o.s)}%,${Math.round(o.l)}%,${a})`;
    return {
      base:normalizeHexColor(hex),
      dark:css({h:base.h,s:clamp(base.s+8,24,100),l:clamp(base.l-27,8,40)}),
      deep:css({h:h(base.h-7),s:clamp(base.s+14,30,100),l:clamp(base.l-38,5,24)}),
      light:css({h:h(base.h+4),s:clamp(base.s-8,18,92),l:clamp(base.l+19,45,82)}),
      edge:css({h:h(base.h+11),s:clamp(base.s+5,22,100),l:clamp(base.l+8,35,70)}),
      glow:css({h:h(base.h+8),s:clamp(base.s-24,12,70),l:clamp(base.l+34,66,92)},.56),
      mist:css({h:h(base.h-4),s:clamp(base.s-30,10,65),l:clamp(base.l+22,55,86)},.20)
    };
  }


  async function loadStoneLayouts(){
    if(stoneLayoutsCache) return stoneLayoutsCache;
    if(stoneLayoutsPromise) return stoneLayoutsPromise;

    stoneLayoutsPromise=(async()=>{
      try{
        const url=new URL(`${rootPrefix()}data/timemark/stone-layouts.json?v=0.18.16`,document.baseURI).href;
        const r=await fetch(url,{cache:'force-cache'});
        if(!r.ok) throw new Error(`stone layouts ${r.status}`);
        const data=await r.json();
        stoneLayoutsCache=data?.stones||{};
      }catch(err){
        console.warn('母石刻紋座標載入失敗，使用中央安全區。',err);
        stoneLayoutsCache={};
      }finally{
        stoneLayoutsPromise=null;
      }
      return stoneLayoutsCache;
    })();

    return stoneLayoutsPromise;
  }

  function seedHash32(text){
    let h=2166136261>>>0;
    const s=String(text||'');
    for(let i=0;i<s.length;i++){
      h^=s.charCodeAt(i);
      h=Math.imul(h,16777619);
    }
    h^=h>>>16;
    h=Math.imul(h,0x7feb352d);
    h^=h>>>15;
    h=Math.imul(h,0x846ca68b);
    h^=h>>>16;
    return h>>>0;
  }

  function seededRandom(seed){
    let a=seedHash32(seed)||0x6d2b79f5;
    return ()=>{
      a|=0;
      a=(a+0x6D2B79F5)|0;
      let t=a;
      t=Math.imul(t^(t>>>15),1|t);
      t^=t+Math.imul(t^(t>>>7),61|t);
      return ((t^(t>>>14))>>>0)/4294967296;
    };
  }

  function engravingLayoutFor(layouts,type){
    const key=`stone-${String(stoneTypeNumber(type)||1).padStart(2,'0')}`;
    return layouts?.[key] || {
      centerX:.50,
      centerY:.50,
      width:.38,
      height:.34,
      rotation:0,
      padding:.10,
      maskAlphaThreshold:24
    };
  }

  function drawBrokenEllipse(ctx,cx,cy,rx,ry,start,end,rotation){
    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(rotation);
    ctx.scale(1,ry/rx);
    ctx.beginPath();
    ctx.arc(0,0,rx,start,end);
    ctx.stroke();
    ctx.restore();
  }

  function drawPersonalEngravingGeometry(ctx,w,h,layout,seed,hex){
    const rand=seededRandom(seed);
    const cx=Number(layout.centerX||.5)*w;
    const cy=Number(layout.centerY||.5)*h;
    const safeW=Number(layout.width||.38)*w;
    const safeH=Number(layout.height||.34)*h;
    const rotation=(Number(layout.rotation||0)*Math.PI)/180;

    const baseR=Math.min(safeW,safeH)*.42;
    const sx=safeW/(baseR*2);
    const sy=safeH/(baseR*2);

    const chosen=hexToRgb(hex);
    const pale={
      r:Math.round(chosen.r+(255-chosen.r)*.68),
      g:Math.round(chosen.g+(255-chosen.g)*.68),
      b:Math.round(chosen.b+(255-chosen.b)*.68)
    };

    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(rotation);
    ctx.scale(sx,sy);

    const line=Math.max(1.25,Math.min(w,h)*.00165/Math.max(sx,sy));
    ctx.lineWidth=line;
    ctx.lineCap='round';
    ctx.lineJoin='round';

    const stroke=`rgba(${pale.r},${pale.g},${pale.b},0.82)`;
    const strokeSoft=`rgba(${pale.r},${pale.g},${pale.b},0.44)`;
    ctx.shadowColor=`rgba(${chosen.r},${chosen.g},${chosen.b},0.62)`;
    ctx.shadowBlur=line*4.5;

    // 每個人的「骨架」固定：3～6 軸，但不做完全對稱的制式徽章。
    const axes=3+Math.floor(rand()*4);
    const phase=rand()*Math.PI*2;
    const hubR=baseR*(.12+rand()*.05);
    const ringCount=2+Math.floor(rand()*3);

    // 中央核心：不閉合，保留「時間裂縫」感。
    ctx.strokeStyle=stroke;
    ctx.beginPath();
    ctx.arc(0,0,hubR,phase+.32,phase+Math.PI*1.72);
    ctx.stroke();

    // 內外環：每環缺口位置、長度皆由 seed 決定。
    for(let r=0;r<ringCount;r++){
      const rr=baseR*(.34+r*(.16+rand()*.035));
      const gap=.28+rand()*.55;
      const start=phase+rand()*Math.PI*2;
      ctx.strokeStyle=r%2?strokeSoft:stroke;
      ctx.beginPath();
      ctx.arc(0,0,rr,start+gap,start+Math.PI*2-gap*.42);
      ctx.stroke();

      if(rand()>.42){
        const a=start-gap*.10;
        const len=baseR*(.045+rand()*.055);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a)*(rr-len),Math.sin(a)*(rr-len));
        ctx.lineTo(Math.cos(a)*(rr+len),Math.sin(a)*(rr+len));
        ctx.stroke();
      }
    }

    // 放射骨線：長度不一，部分線段被刻意截斷。
    for(let i=0;i<axes;i++){
      const a=phase+(i/axes)*Math.PI*2+(rand()-.5)*.14;
      const inner=hubR*(1.15+rand()*.55);
      const outer=baseR*(.62+rand()*.28);
      ctx.strokeStyle=rand()>.30?stroke:strokeSoft;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a)*inner,Math.sin(a)*inner);
      ctx.lineTo(Math.cos(a)*outer,Math.sin(a)*outer);
      ctx.stroke();

      // 分支
      if(rand()>.38){
        const anchor=inner+(outer-inner)*(.42+rand()*.30);
        const side=rand()>.5?1:-1;
        const branchA=a+side*(.45+rand()*.34);
        const branchL=baseR*(.11+rand()*.10);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a)*anchor,Math.sin(a)*anchor);
        ctx.lineTo(
          Math.cos(a)*anchor+Math.cos(branchA)*branchL,
          Math.sin(a)*anchor+Math.sin(branchA)*branchL
        );
        ctx.stroke();
      }
    }

    // 個人節點：數量與位置固定於 seed。
    const nodes=2+Math.floor(rand()*5);
    ctx.fillStyle=`rgba(${pale.r},${pale.g},${pale.b},0.88)`;
    for(let i=0;i<nodes;i++){
      const a=phase+rand()*Math.PI*2;
      const rr=baseR*(.30+rand()*.56);
      const nr=Math.max(line*1.15,baseR*(.010+rand()*.010));
      ctx.beginPath();
      ctx.arc(Math.cos(a)*rr,Math.sin(a)*rr,nr,0,Math.PI*2);
      ctx.fill();
    }

    // 一條偏離對稱軸的「本命時痕」，避免每枚看起來只像普通魔法陣。
    const scarA=phase+(rand()-.5)*1.15;
    const scarR=baseR*(.28+rand()*.12);
    const scarL=baseR*(.32+rand()*.16);
    ctx.strokeStyle=stroke;
    ctx.beginPath();
    ctx.moveTo(Math.cos(scarA)*scarR,Math.sin(scarA)*scarR);
    ctx.quadraticCurveTo(
      Math.cos(scarA+.55)*scarR*.55,
      Math.sin(scarA+.55)*scarR*.55,
      Math.cos(scarA+.18)*scarL,
      Math.sin(scarA+.18)*scarL
    );
    ctx.stroke();

    ctx.restore();
  }

  function drawShichenGlyph(ctx,w,h,layout,type,hex,pick){
    const glyph=shichenGlyph(type);
    if(!glyph) return;

    const cx=Number(layout.centerX||.5)*w;
    const cy=Number(layout.centerY||.5)*h;
    const safeW=Number(layout.width||.38)*w;
    const safeH=Number(layout.height||.34)*h;
    const rotation=(Number(layout.rotation||0)*Math.PI)/180;

    const chosen=hexToRgb(hex);

    // 字比石片暗 → 沉下去（暗刻）；比石片亮 → 浮起來（透光）。
    // 判斷依據是「字色與石片的明度差」，不是石片自己亮不亮 ——
    // 玩家可以自選字色，只看石片會讓深色字在深石片上整個消失。
    const res=resolveGlyphInk(hex,pick);
    const ink=hexToRgb(res.hex);
    const dark=res.dark;

    // 暗刻用暗光暈做出凹陷深度；亮刻用主色光暈做出透光感。
    const halo=dark
      ? {r:0,g:0,b:0,a:.45}
      : {r:chosen.r,g:chosen.g,b:chosen.b,a:.85};

    // 暗刻的刻痕邊緣會反光，補一道白邊讓字更立體。
    const rim=dark
      ? {r:255,g:255,b:255,a:.42}
      : {r:ink.r,g:ink.g,b:ink.b,a:.55};

    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(rotation);
    ctx.textAlign='center';
    ctx.textBaseline='middle';

    // 先估字級，再用實際字面量測校正，確保不會超出安全區。
    let size=Math.min(safeW,safeH)*.62;
    ctx.font=`700 ${size}px ${SHARD_GLYPH_FONT}`;
    const m=ctx.measureText(glyph);
    const gw=Math.abs(m.actualBoundingBoxLeft)+Math.abs(m.actualBoundingBoxRight);
    const gh=Math.abs(m.actualBoundingBoxAscent)+Math.abs(m.actualBoundingBoxDescent);
    if(gw>0 && gh>0){
      size*=Math.min((safeW*.78)/gw,(safeH*.78)/gh);
      ctx.font=`700 ${size}px ${SHARD_GLYPH_FONT}`;
    }

    // 光暈讓字看起來是從石片內部透出來，而不是貼在表面。
    ctx.shadowColor=`rgba(${halo.r},${halo.g},${halo.b},${halo.a})`;
    ctx.shadowBlur=size*.20;
    ctx.fillStyle=`rgba(${ink.r},${ink.g},${ink.b},0.90)`;
    ctx.fillText(glyph,0,0);

    ctx.shadowBlur=0;
    ctx.lineWidth=Math.max(1,size*.012);
    ctx.strokeStyle=`rgba(${rim.r},${rim.g},${rim.b},${rim.a})`;
    ctx.strokeText(glyph,0,0);

    ctx.restore();
  }


  // ══════════════════════════════════════════════════════════
  //  時痕刻印
  //
  //  一條時痕 ＝ 一個人生，不是一個選擇。
  //  同一個人生裡的每一個選擇，是那條裂縫上的一節、一個轉折、一個結。
  //  遠看是幾個人生，近看是每一步。
  //
  //  條數被角色數綁住（最多四條），不會隨選擇數變成一團亂。
  //  走完的人生收束到同一個終點；沒走完的斷在半路，而且沒有光。
  //
  //  參數由 dev/scar-lab.html 調定（v0.18.61），不要憑感覺改這裡的數字。
  // ══════════════════════════════════════════════════════════

  const SCAR = {
    thickness:6.2, spread:0.52, turn:0.46, decay:0.900,
    branch:0.30, branchLen:0.62, originR:1.10,
    brightness:0.90, glow:1.60, carve:1.05, node:0.55,
    breathSpeed:0.60, breathAmp:0.30,
    pulse:0.60, pulseSpeed:0.34, pulseWidth:0.22,
    converge:0.75, hueSpread:0.45, offsetRange:25,
    jitter:0.10, unfinished:0.45
  };

  // 四個角色的固定方位。跨玩家一致 —— 別人看你分享出去的石片，
  // 一眼就知道左上那條是誰。刻意不用正 90 度等分，太對稱會變成徽章。
  const SCAR_LIVES = [
    {key:'yeshenxing', base:  8},
    {key:'baiji',      base:103},
    {key:'anyanxiu',   base:191},
    {key:'jiashi',     base:284}
  ];

  // ── 母石輪廓遮罩：裂縫靠它自己找路，不會長到石片外面被切掉一半 ──
  function scarMask(img,w,h){
    const MW=160, MH=Math.max(1,Math.round(160*h/w));
    const c=document.createElement('canvas');
    c.width=MW;c.height=MH;
    const ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(img,0,0,MW,MH);
    const d=ctx.getImageData(0,0,MW,MH).data;
    const a=new Uint8Array(MW*MH);
    for(let i=0;i<a.length;i++) a[i]=d[i*4+3]>40?1:0;
    return {MW,MH,a,w,h};
  }
  function maskSolid(mask,x,y){
    if(!mask) return true;
    const mx=Math.round(x/mask.w*mask.MW), my=Math.round(y/mask.h*mask.MH);
    if(mx<0||my<0||mx>=mask.MW||my>=mask.MH) return false;
    return mask.a[my*mask.MW+mx]===1;
  }
  // 端點在石片內，而且四周留得下線寬 —— 才算走得過去
  function maskWalkable(mask,x,y,margin){
    if(!maskSolid(mask,x,y)) return false;
    for(let k=0;k<8;k++){
      const a=k/8*Math.PI*2;
      if(!maskSolid(mask,x+Math.cos(a)*margin,y+Math.sin(a)*margin)) return false;
    }
    return true;
  }

  // 收束點：石片上離安全區中心最遠、而且還放得下線寬的那個點。
  // 十二顆母石形狀都不同，所以每個時辰天生就有自己的終點方向 —— 不用另外定座標。
  // 你從哪個時辰來，決定你走向終點的路長什麼樣；終點本身，十二個時辰都一樣。
  function scarAnchor(mask,cx,cy,margin){
    let best=null,bestD=-1;
    for(let my=0;my<mask.MH;my++){
      for(let mx=0;mx<mask.MW;mx++){
        if(mask.a[my*mask.MW+mx]!==1) continue;
        const x=(mx+.5)/mask.MW*mask.w, y=(my+.5)/mask.MH*mask.h;
        const d=(x-cx)*(x-cx)+(y-cy)*(y-cy);
        if(d<=bestD) continue;
        if(!maskWalkable(mask,x,y,margin)) continue;
        bestD=d;best={x,y};
      }
    }
    return best||{x:cx,y:cy};
  }

  const angWrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

  function buildScarPath(seq,layout,w,h,mask,opt){
    const {baseAngle=0,seedOffset=0,completed=true,anchor=null,key=''}=opt||{};
    const rand=seededRandom('scar:'+key+':'+seq+':'+baseAngle);
    const cx=Number(layout.centerX||.5)*w, cy=Number(layout.centerY||.5)*h;
    const safeW=Number(layout.width||.38)*w, safeH=Number(layout.height||.34)*h;
    const rot=(Number(layout.rotation||0)*Math.PI)/180;

    const a0=((baseAngle+seedOffset)*Math.PI)/180+rot;

    // 起點：安全區橢圓邊界往外推。
    // 中央留給時辰字（你從哪裡來）與本命刻紋（你是誰），走過的路不能壓掉它們。
    const er=Math.min(safeW,safeH)*.5;
    const ox=cx+Math.cos(a0)*er*SCAR.originR;
    const oy=cy+Math.sin(a0)*er*SCAR.originR;

    // 前重後輕：頭幾步把骨架撐開，之後越來越細。
    // 真實的裂縫是這樣裂的，而且早期的選擇本來就決定一個人生的形狀。
    const step0=Math.min(w,h)*.5*SCAR.spread*.34;
    const margin=Math.max(4,Math.min(w,h)*.018);

    const TRIES=[0,.28,-.28,.6,-.6,1.0,-1.0,1.5,-1.5,2.1,-2.1,2.7,-2.7];
    function advance(x,y,a,len){
      for(let st=0;st<4;st++){
        const l=len*Math.pow(.62,st);
        for(let ti=0;ti<TRIES.length;ti++){
          const na=a+TRIES[ti];
          const nx=x+Math.cos(na)*l, ny=y+Math.sin(na)*l;
          if(maskWalkable(mask,nx,ny,margin)) return {x:nx,y:ny,a:na,len:l};
        }
      }
      return null;
    }

    const segs=[];
    // 真實的裂縫沒有直線。每一節切成小段、左右微抖，看起來才是裂的不是畫的。
    const SUB=3;
    function push(x1,y1,x2,y2,meta){
      const dx=x2-x1, dy=y2-y1, L=Math.hypot(dx,dy)||1;
      const px=-dy/L, py=dx/L;
      let ax=x1, ay=y1;
      for(let k=1;k<=SUB;k++){
        const t=k/SUB;
        const j=(k===SUB)?0:(rand()-.5)*L*SCAR.jitter;
        const bx=x1+dx*t+px*j, by=y1+dy*t+py*j;
        segs.push(Object.assign({x1:ax,y1:ay,x2:bx,y2:by},meta));
        ax=bx;ay=by;
      }
    }

    let x=ox, y=oy, a=a0, len=step0;
    const n=seq.length;

    for(let i=0;i<n;i++){
      const dir = seq[i]==='L' ? -1 : 1;
      let want = a + dir*SCAR.turn*(0.55+rand()*0.9);

      // 走完的人生，後段會被終點拉過去；沒走完的不會，它就斷在半路。
      if(completed && anchor && SCAR.converge>0 && n>2){
        const prog=i/(n-1);
        const pull=Math.pow(Math.max(0,(prog-.55)/.45),1.4)*SCAR.converge;
        if(pull>0){
          const toA=Math.atan2(anchor.y-y,anchor.x-x);
          want += angWrap(toA-want)*pull;
        }
      }

      const next=advance(x,y,want,len);
      if(!next) break;
      push(x,y,next.x,next.y,{depth:0,order:i,tip:true});

      // 分岔：往轉折的反側甩出去，像應力釋放。那是走得特別重的一步。
      if(rand()<SCAR.branch){
        let bx=next.x, by=next.y, ba=next.a-dir*(0.75+rand()*0.7), bl=next.len*SCAR.branchLen;
        const steps=1+Math.floor(rand()*3);
        for(let k=0;k<steps;k++){
          const bn=advance(bx,by,ba+(rand()-.5)*.7,bl);
          if(!bn) break;
          push(bx,by,bn.x,bn.y,{depth:1+k,order:i});
          bx=bn.x;by=bn.y;ba=bn.a;bl=bn.len*0.66;
        }
      }

      x=next.x;y=next.y;a=next.a;
      len=next.len*SCAR.decay;
    }

    // 走完了，就一定接得上終點。差最後一段的話補上去。
    if(completed && anchor && SCAR.converge>0 && segs.length){
      const d=Math.hypot(anchor.x-x,anchor.y-y);
      if(d>1 && d<step0*3.2) push(x,y,anchor.x,anchor.y,{depth:0,order:n,arrival:true});
    }
    return segs;
  }

  const scarWidth=(sg,base)=>Math.max(0.8, base*Math.pow(0.62,sg.depth)*(1-Math.min(0.42, sg.order*0.012)));

  // ── 第一層：裂口。石頭真的裂開了。走 multiply，任何顏色都吃得住 ──
  function paintScarDark(ctx,segs,hex,w,h,fade){
    if(!segs.length||SCAR.carve<=0) return;
    fade = (fade==null?1:fade);
    const base=SCAR.thickness*(w/768)*(fade<1?.82:1);
    const c=hexToRgb(hex);
    // 帶一點主色的暗，不是純黑；純黑會像貼上去的墨線。
    const d={r:Math.round(c.r*.22),g:Math.round(c.g*.22),b:Math.round(c.b*.22)};
    const cl=(n)=>Math.min(1,Math.max(0,n));

    ctx.save();
    ctx.lineCap='round';ctx.lineJoin='round';
    ctx.strokeStyle=`rgba(${d.r},${d.g},${d.b},${cl(.30*SCAR.carve*fade)})`;
    ctx.shadowColor=`rgba(0,0,0,${.55*SCAR.carve*fade})`;
    ctx.shadowBlur=base*3.2;
    segs.forEach(sg=>{
      ctx.lineWidth=scarWidth(sg,base)*2.4;
      ctx.beginPath();ctx.moveTo(sg.x1,sg.y1);ctx.lineTo(sg.x2,sg.y2);ctx.stroke();
    });
    ctx.shadowBlur=0;
    ctx.strokeStyle=`rgba(${d.r},${d.g},${d.b},${cl(.86*SCAR.carve*fade)})`;
    segs.forEach(sg=>{
      ctx.lineWidth=scarWidth(sg,base)*1.15;
      ctx.beginPath();ctx.moveTo(sg.x1,sg.y1);ctx.lineTo(sg.x2,sg.y2);ctx.stroke();
    });
    ctx.restore();
  }

  // ── 第二層：光。裂口裡透出來的東西，會呼吸的就是它 ──
  function paintScarLight(ctx,segs,hex,w,h){
    if(!segs.length) return;
    const base=SCAR.thickness*(w/768);
    const c=hexToRgb(hex);
    const core={
      r:Math.round(c.r+(255-c.r)*.88),
      g:Math.round(c.g+(255-c.g)*.88),
      b:Math.round(c.b+(255-c.b)*.88)
    };
    const cl=(n)=>Math.min(1,Math.max(0,n));

    ctx.save();
    ctx.lineCap='round';ctx.lineJoin='round';
    if(SCAR.glow>0){
      ctx.shadowColor=`rgba(${c.r},${c.g},${c.b},${cl(.85*SCAR.brightness)})`;
      ctx.shadowBlur=base*4.6*SCAR.glow;
      ctx.strokeStyle=`rgba(${c.r},${c.g},${c.b},${cl(.42*SCAR.brightness)})`;
      segs.forEach(sg=>{
        ctx.lineWidth=scarWidth(sg,base)*1.9;
        ctx.beginPath();ctx.moveTo(sg.x1,sg.y1);ctx.lineTo(sg.x2,sg.y2);ctx.stroke();
      });
    }
    ctx.shadowColor=`rgba(${c.r},${c.g},${c.b},${cl(.9*SCAR.brightness)})`;
    ctx.shadowBlur=base*1.5*SCAR.glow;
    ctx.strokeStyle=`rgba(${core.r},${core.g},${core.b},${cl(.98*SCAR.brightness)})`;
    segs.forEach(sg=>{
      ctx.lineWidth=scarWidth(sg,base)*.62;
      ctx.beginPath();ctx.moveTo(sg.x1,sg.y1);ctx.lineTo(sg.x2,sg.y2);ctx.stroke();
    });
    // 每一個選擇的落點：一顆小小的結
    if(SCAR.node>0){
      ctx.shadowBlur=base*2.4*SCAR.glow;
      ctx.fillStyle=`rgba(${core.r},${core.g},${core.b},${cl(.92*SCAR.brightness)})`;
      segs.forEach(sg=>{
        if(sg.depth!==0||!sg.tip) return;
        ctx.beginPath();ctx.arc(sg.x2,sg.y2,Math.max(.6,scarWidth(sg,base)*.58*SCAR.node),0,Math.PI*2);ctx.fill();
      });
    }
    ctx.restore();
  }

  // ── 流動：一道更亮的光沿著主幹跑。只跑主幹不跑分岔 ──
  // 主幹是時間線，讓光只走時間線，看起來像記憶在往前推。
  function paintScarPulse(ctx,segs,hex,w,h,t){
    if(SCAR.pulse<=0) return;
    const trunk=segs.filter(sg=>sg.depth===0);
    if(!trunk.length) return;
    const c=hexToRgb(hex);
    const base=SCAR.thickness*(w/768);
    const head=(t*SCAR.pulseSpeed)%1.35;   // 留一段暗場，才有「一口一口」的感覺
    const width=SCAR.pulseWidth;

    ctx.save();
    ctx.lineCap='round';ctx.lineJoin='round';
    ctx.shadowColor=`rgba(${c.r},${c.g},${c.b},.9)`;
    trunk.forEach((sg,i)=>{
      const pos=i/Math.max(1,trunk.length-1);
      const d=Math.abs(pos-head);
      if(d>width) return;
      const k=Math.pow(1-d/width,1.6)*SCAR.pulse;
      ctx.shadowBlur=base*3.4*SCAR.glow*k;
      ctx.lineWidth=Math.max(0.8,base*(1+k*1.5));
      ctx.strokeStyle=`rgba(255,255,255,${Math.min(1,k*0.95)})`;
      ctx.beginPath();ctx.moveTo(sg.x1,sg.y1);ctx.lineTo(sg.x2,sg.y2);ctx.stroke();
    });
    ctx.restore();
  }

  // ── 時痕資料：目前後端還沒有「選擇」，所以正常情況下這裡是空的，
  //    整套時痕就安靜地不畫任何東西。等選擇系統上線，它會自己長出來。
  //    DEV 預覽：?scar=RLRLLRR&scar2=LRLR&scarDone=1  或
  //             localStorage['tet.devScar'] = 'RLRLLRR|LRLR|RRLL'（| 分隔人生）
  //             localStorage['tet.devScarDone'] = '2'
  function scarSequences(el){
    const raw=String(el?.dataset?.scar||'').trim();
    let list = raw ? raw.split('|') : [];
    let done = Number(el?.dataset?.scarDone);

    if(!list.length){
      try{
        const q=new URLSearchParams(location.search);
        const dev=q.get('scar') || localStorage.getItem('tet.devScar') || '';
        if(dev) list=String(dev).split('|');
        const dd=q.get('scarDone') || localStorage.getItem('tet.devScarDone');
        if(dd!=null && dd!=='') done=Number(dd);
      }catch(_){}
    }

    list=list.map(x=>String(x||'').toUpperCase().replace(/[^LR]/g,'')).filter(Boolean).slice(0,SCAR_LIVES.length);
    if(!list.length) return null;
    if(!Number.isFinite(done)) done=list.length;   // 沒指定就當作全部走完
    return {list, done:Math.max(0,Math.min(list.length,done))};
  }

  // 每個人生的起點：角色固定方位 + engraveSeed 決定的偏移。
  // 跨玩家看得出哪條是誰，同一個人的石片又獨一無二。
  function scarLifeAngles(seed){
    const rand=seededRandom('origin:'+String(seed||''));
    return SCAR_LIVES.map(c=>({key:c.key, base:c.base, offset:(rand()*2-1)*SCAR.offsetRange}));
  }

  async function renderShardEngraving(el,hex){
    if(!el || !el.classList?.contains('time-shard-asset')) return;

    const seed=String(el.dataset.engraveSeed||'').trim();
    const type=stoneTypeNumber(el.dataset.stoneType);
    const img=el.querySelector('.time-shard-image');
    const canvas=el.querySelector('.time-shard-engraving');
    const glyphCanvas=el.querySelector('.time-shard-glyph');
    const scarDark=el.querySelector('.time-shard-scar-dark');
    const scarLight=el.querySelector('.time-shard-scar');

    // 時辰字是「出身」，鑄印前就該顯現；刻紋幾何才需要等種子誕生。
    if(!type || !img || !canvas){
      if(canvas) canvas.style.opacity='0';
      if(glyphCanvas) glyphCanvas.style.opacity='0';
      return;
    }

    const run=async()=>{
      try{
        const nw=img.naturalWidth||0;
        const nh=img.naturalHeight||0;
        if(!nw || !nh) return;
        const size=shardWorkSize(nw,nh);
        const w=size.w, h=size.h;

        [canvas,glyphCanvas,scarDark,scarLight].forEach(c=>{
          if(c && (c.width!==w || c.height!==h)){ c.width=w; c.height=h; }
        });

        const layouts=await loadStoneLayouts();
        const layout=engravingLayoutFor(layouts,type);
        const color=normalizeHexColor(hex);
        const pick=String(el.dataset.glyphColor||'').trim();

        // ── 時辰字：獨立一層。
        // 玩家可以自選字色，混合模式要跟著「字 vs 石片」走；
        // 本命刻紋永遠是淡色，跟著石片明暗走。兩者混在同一張畫布上會互相殺死。
        await ensureShardGlyphFont();
        if(glyphCanvas){
          const gx=glyphCanvas.getContext('2d');
          gx.clearRect(0,0,w,h);
          drawShichenGlyph(gx,w,h,layout,type,color,pick);
          gx.globalCompositeOperation='destination-in';
          gx.drawImage(img,0,0,w,h);
          gx.globalCompositeOperation='source-over';
          glyphCanvas.style.opacity='1';
        }

        // ── 本命刻紋 ──
        const ctx=canvas.getContext('2d');
        ctx.clearRect(0,0,w,h);
        if(!glyphCanvas) drawShichenGlyph(ctx,w,h,layout,type,color,pick);
        if(seed) drawPersonalEngravingGeometry(ctx,w,h,layout,seed,color);

        // 最後一道保護：真正以母石透明區域裁切。
        // 即使將來刻紋演算法變得更複雜，也絕不會畫到石片之外。
        ctx.globalCompositeOperation='destination-in';
        ctx.drawImage(img,0,0,w,h);
        ctx.globalCompositeOperation='source-over';

        canvas.dataset.seed=seed;
        canvas.dataset.stoneType=String(type);
        canvas.style.opacity='1';

        // ── 時痕 ──
        renderScar(el,{img,layout,w,h,color,seed,scarDark,scarLight});
      }catch(err){
        console.warn('個人時印刻紋繪製失敗。',err);
        canvas.style.opacity='0';
      }
    };

    if(img.complete && img.naturalWidth) run();
    else img.addEventListener('load',run,{once:true});
  }

  // 時痕：裂口烘一次（靜的），光烘一次（每幀只做透明度與流動）。
  function renderScar(el,{img,layout,w,h,color,seed,scarDark,scarLight}){
    if(!scarDark || !scarLight) return;
    const data=scarSequences(el);
    el._scar=null;

    const dk=scarDark.getContext('2d');
    dk.clearRect(0,0,w,h);
    const lt=scarLight.getContext('2d');
    lt.clearRect(0,0,w,h);

    if(!data){
      // 還沒有任何選擇 —— 石片上什麼都不該有。
      scarDark.style.opacity='0';
      scarLight.style.opacity='0';
      return;
    }

    if(!el._scarMask || el._scarMaskKey!==`${el.dataset.stoneType}:${w}x${h}`){
      el._scarMask=scarMask(img,w,h);
      el._scarMaskKey=`${el.dataset.stoneType}:${w}x${h}`;
      el._scarAnchor=null;
    }
    const mask=el._scarMask;
    const cx=Number(layout.centerX||.5)*w, cy=Number(layout.centerY||.5)*h;
    if(!el._scarAnchor){
      el._scarAnchor=scarAnchor(mask,cx,cy,Math.max(4,Math.min(w,h)*.018));
    }

    const angles=scarLifeAngles(seed);
    const lives=data.list.map((seq,i)=>{
      const c=angles[i]||angles[0];
      const completed=i<data.done;
      // 同一道光的不同溫度，不是四支蠟筆。
      const deg=(i-(data.list.length-1)/2)*SCAR.hueSpread*22;
      return {
        completed,
        hex:shiftHue(color,deg),
        segs:buildScarPath(seq,layout,w,h,mask,{
          baseAngle:c.base, seedOffset:c.offset, completed,
          anchor:el._scarAnchor, key:c.key+':'+String(seed||'')
        })
      };
    });

    // 裂口：沒走完的一樣有裂口 —— 路是走過的。
    lives.forEach(L=>paintScarDark(dk,L.segs,L.hex,w,h,L.completed?1:SCAR.unfinished));
    // 以母石 alpha 裁切即可。mix-blend-mode 會尊重 alpha，
    // 透明的地方等於不參與混色 —— 千萬不要為了 multiply 去填白底，
    // 那會在石片外面留下一個白方塊。
    dk.globalCompositeOperation='destination-in';
    dk.drawImage(img,0,0,w,h);
    dk.globalCompositeOperation='source-over';
    scarDark.style.opacity='1';

    // 光只給走完的人生。沒走完 = 沒有理解 = 沒有光。
    const layer=document.createElement('canvas');
    layer.width=w;layer.height=h;
    const lx=layer.getContext('2d');
    lives.forEach(L=>{ if(L.completed) paintScarLight(lx,L.segs,L.hex,w,h); });
    lx.globalCompositeOperation='destination-in';
    lx.drawImage(img,0,0,w,h);
    lx.globalCompositeOperation='source-over';

    el._scar={lives,layer,img,w,h};
    scarLight.style.opacity='1';
    registerScar(el);
  }

  // ── 呼吸與流動：全站共用一支 rAF，不是每片石頭各開一支 ──
  const scarShards=new Set();
  let scarRaf=0, scarT0=0;
  const scarReduced=()=>{
    try{ return window.matchMedia('(prefers-reduced-motion:reduce)').matches; }catch(_){ return false; }
  };

  function registerScar(el){
    scarShards.add(el);
    if(scarReduced()){ scarPaint(el,0); return; }
    if(!scarRaf){
      scarT0=performance.now();
      scarRaf=requestAnimationFrame(scarLoop);
    }
  }

  function scarPaint(el,t){
    const S=el._scar;
    if(!S) return;
    const canvas=el.querySelector('.time-shard-scar');
    if(!canvas || !canvas.isConnected){ scarShards.delete(el); return; }
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,S.w,S.h);
    // 1 → 1-amp → 1，正弦來回，沒有「啪」的一下
    const breathe=1-SCAR.breathAmp*(1-Math.cos(t*SCAR.breathSpeed*Math.PI*2))*0.5;
    ctx.globalAlpha=Math.min(1,Math.max(.05,breathe));
    ctx.drawImage(S.layer,0,0);
    ctx.globalAlpha=1;
    if(SCAR.pulse>0){
      // 相位錯開，幾條不會同時亮成一片
      S.lives.forEach((L,i)=>{
        if(L.completed) paintScarPulse(ctx,L.segs,L.hex,S.w,S.h,t+i*0.37);
      });
      ctx.globalCompositeOperation='destination-in';
      ctx.drawImage(S.img,0,0,S.w,S.h);
      ctx.globalCompositeOperation='source-over';
    }
  }

  function scarLoop(now){
    scarRaf=0;
    if(document.hidden){ return; }        // 分頁沒在看就不燒電
    const t=(now-scarT0)/1000;
    let alive=false;
    scarShards.forEach(el=>{
      if(!el.isConnected || !el._scar){ scarShards.delete(el); return; }
      alive=true;
      try{ scarPaint(el,t); }catch(_){}
    });
    if(alive && !scarReduced()) scarRaf=requestAnimationFrame(scarLoop);
  }

  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden && scarShards.size && !scarRaf && !scarReduced()){
      scarRaf=requestAnimationFrame(scarLoop);
    }
  });

  // 母石原圖約 1254px，但螢幕預覽與 OG 圖都用不到那麼大。
  // 上色是逐像素運算，解析度砍半＝運算量降到 1/3，肉眼看不出差別。
  const SHARD_WORK_MAX = 768;

  function shardWorkSize(w,h){
    const m=Math.max(w,h);
    if(m<=SHARD_WORK_MAX) return {w:w,h:h};
    const k=SHARD_WORK_MAX/m;
    return {w:Math.round(w*k), h:Math.round(h*k)};
  }

  function recolorShardCanvas(el,hex){
    if(!el || !el.classList?.contains('time-shard-asset')) return;
    const img=el.querySelector('.time-shard-image');
    const canvas=el.querySelector('.time-shard-canvas');
    if(!img || !canvas) return;

    const run=()=>{
      try{
        const nw=img.naturalWidth||0, nh=img.naturalHeight||0;
        if(!nw || !nh) return;
        const size=shardWorkSize(nw,nh);
        const w=size.w, h=size.h;

        if(canvas.width!==w || canvas.height!==h){
          canvas.width=w;
          canvas.height=h;
        }

        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        ctx.clearRect(0,0,w,h);
        ctx.drawImage(img,0,0,w,h);

        const data=ctx.getImageData(0,0,w,h);
        const px=data.data;
        const chosen=hexToRgb(hex);
        const baseHsl=rgbToHsl(chosen);

        const clamp=(n,a,b)=>Math.min(Math.max(n,a),b);
        const hwrap=n=>((n%360)+360)%360;
        const hslToRgb=(h,s,l)=>{
          h=hwrap(h)/360; s=clamp(s,0,100)/100; l=clamp(l,0,100)/100;
          if(s===0){
            const v=Math.round(l*255);
            return {r:v,g:v,b:v};
          }
          const hue2rgb=(p,q,t)=>{
            if(t<0)t+=1;if(t>1)t-=1;
            if(t<1/6)return p+(q-p)*6*t;
            if(t<1/2)return q;
            if(t<2/3)return p+(q-p)*(2/3-t)*6;
            return p;
          };
          const q=l<.5?l*(1+s):l+s-l*s;
          const p=2*l-q;
          return {
            r:Math.round(hue2rgb(p,q,h+1/3)*255),
            g:Math.round(hue2rgb(p,q,h)*255),
            b:Math.round(hue2rgb(p,q,h-1/3)*255)
          };
        };

        const nearCool=hslToRgb(baseHsl.h+24, clamp(baseHsl.s+6,28,92), clamp(baseHsl.l+10,34,74));
        const nearWarm=hslToRgb(baseHsl.h-18, clamp(baseHsl.s+10,32,96), clamp(baseHsl.l+8,32,72));
        const pale=hslToRgb(baseHsl.h+5, clamp(baseHsl.s-34,8,46), 88);
        const deep=hslToRgb(baseHsl.h-6, clamp(baseHsl.s+8,28,96), clamp(baseHsl.l-25,7,30));

        const mix=(a,b,t)=>({
          r:a.r*(1-t)+b.r*t,
          g:a.g*(1-t)+b.g*t,
          b:a.b*(1-t)+b.b*t
        });

        const mix3=(a,b,c,t1,t2)=>{
          const base=mix(a,b,t1);
          return mix(base,c,t2);
        };

        for(let i=0;i<px.length;i+=4){
          const a=px[i+3];
          if(a===0) continue;

          const pIndex=i/4;
          const x=(pIndex%w)/Math.max(1,w-1);
          const y=Math.floor(pIndex/w)/Math.max(1,h-1);

          const or=px[i], og=px[i+1], ob=px[i+2];
          const lum=(0.2126*or + 0.7152*og + 0.0722*ob)/255;

          // 主色仍是核心，但增加兩組鄰近色折射，不需要玩家多選顏色。
          const diagonal=clamp((x*.72 + (1-y)*.28),0,1);
          const facetWave=(Math.sin((x*2.4+y*1.7)*Math.PI)+1)/2;
          const coolAmt=clamp((diagonal-.48)*1.25,0,.42) * (.55+.45*facetWave);
          const warmAmt=clamp((.56-diagonal)*1.15,0,.34) * (.55+.45*(1-facetWave));

          let col={
            r:chosen.r,
            g:chosen.g,
            b:chosen.b
          };

          // 深部先壓暗，保持玻璃厚度。
          const depth=Math.pow(1-lum,1.15);
          col=mix(col,deep,depth*.48);

          // 切面折色。
          col=mix3(col,nearCool,nearWarm,coolAmt,warmAmt);

          // 保留一點原母石虹彩與材質資訊。
          const original={r:or,g:og,b:ob};
          col=mix(col,original,.18);

          // 亮面往銀白 / 淡色高光走。
          if(lum>.58){
            const hi=clamp((lum-.58)/.42,0,1);
            col=mix(col,pale,hi*.68);
          }

          // 不讓暗部整片死黑，保留通透感。
          const glassLift=.22 + lum*.90;
          col.r*=glassLift;
          col.g*=glassLift;
          col.b*=glassLift;

          px[i]=clamp(Math.round(col.r),0,255);
          px[i+1]=clamp(Math.round(col.g),0,255);
          px[i+2]=clamp(Math.round(col.b),0,255);
        }

        ctx.putImageData(data,0,0);

        // 靜態折射層：不改母圖，只在 Canvas 上增加柔和亮帶。
        ctx.save();
        ctx.globalCompositeOperation='screen';

        const g1=ctx.createLinearGradient(w*.12,h*.85,w*.86,h*.08);
        g1.addColorStop(0,'rgba(255,255,255,0)');
        g1.addColorStop(.42,`rgba(${nearWarm.r},${nearWarm.g},${nearWarm.b},0.08)`);
        g1.addColorStop(.56,`rgba(${pale.r},${pale.g},${pale.b},0.20)`);
        g1.addColorStop(.70,`rgba(${nearCool.r},${nearCool.g},${nearCool.b},0.10)`);
        g1.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=g1;
        ctx.fillRect(0,0,w,h);

        const rg=ctx.createRadialGradient(w*.47,h*.44,0,w*.47,h*.44,Math.max(w,h)*.45);
        rg.addColorStop(0,`rgba(${pale.r},${pale.g},${pale.b},0.12)`);
        rg.addColorStop(.38,`rgba(${chosen.r},${chosen.g},${chosen.b},0.05)`);
        rg.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=rg;
        ctx.fillRect(0,0,w,h);

        // 仍然以原 PNG alpha 裁切，所有折光都留在石片裡。
        ctx.globalCompositeOperation='destination-in';
        ctx.drawImage(img,0,0,w,h);
        ctx.restore();

        canvas.dataset.tinted=normalizeHexColor(hex);
        canvas.style.opacity='1';
        img.style.opacity='0';
      }catch(err){
        console.warn('時印石片本體上色失敗，保留原圖顯示。',err);
        canvas.style.opacity='0';
        img.style.opacity='1';
      }
    };

    if(img.complete && img.naturalWidth) run();
    else img.addEventListener('load',run,{once:true});
  }

  function hexOf({r,g,b}){
    const t=n=>Math.min(255,Math.max(0,Math.round(n))).toString(16).padStart(2,'0').toUpperCase();
    return `#${t(r)}${t(g)}${t(b)}`;
  }
  function hslToRgbObj(h,s,l){
    const cl=(n,a,b)=>Math.min(Math.max(n,a),b);
    h=(((h%360)+360)%360)/360; s=cl(s,0,100)/100; l=cl(l,0,100)/100;
    if(s===0){const v=Math.round(l*255);return{r:v,g:v,b:v};}
    const hue2rgb=(p,q,t)=>{
      if(t<0)t+=1;if(t>1)t-=1;
      if(t<1/6)return p+(q-p)*6*t;
      if(t<1/2)return q;
      if(t<2/3)return p+(q-p)*(2/3-t)*6;
      return p;
    };
    const q=l<.5?l*(1+s):l+s-l*s, pp=2*l-q;
    return {r:Math.round(hue2rgb(pp,q,h+1/3)*255),g:Math.round(hue2rgb(pp,q,h)*255),b:Math.round(hue2rgb(pp,q,h-1/3)*255)};
  }
  function shiftHue(hex,deg){
    const c=rgbToHsl(hexToRgb(hex));
    return hexOf(hslToRgbObj(c.h+deg,c.s,c.l));
  }

  // 上色演算法會把石片提得比 base 色亮很多，判斷對比要用「提亮後」的明度。
  function stoneLightness(hex){
    const l=rgbToHsl(hexToRgb(hex)).l*.55+34;
    return Math.min(100,Math.max(0,l));
  }

  // 時辰字最後用什麼顏色畫、要走亮刻還是暗刻。
  //   pick 為空 → 沿用原本的自動配色（依石片明暗決定深字或淺字）
  //   pick 有值 → 玩家自選；只保證一件事：與石片的明度差不得小於 GLYPH_MIN_CONTRAST，
  //              否則會出現「白字白石片」這種等於沒畫的組合，而且是玩家自己選的，事後救不了。
  const GLYPH_MIN_CONTRAST=22;
  function resolveGlyphInk(stoneHex,pick){
    const stoneL=stoneLightness(stoneHex);
    const picked=/^#?[0-9a-f]{6}$/i.test(String(pick||'').trim()) ? normalizeHexColor(pick) : '';
    if(!picked){
      const c=hexToRgb(stoneHex);
      const light=isLightShard(stoneHex);
      const ink=light
        ? {r:Math.round(c.r*.20),g:Math.round(c.g*.20),b:Math.round(c.b*.20)}
        : {r:Math.round(c.r+(255-c.r)*.78),g:Math.round(c.g+(255-c.g)*.78),b:Math.round(c.b+(255-c.b)*.78)};
      return {hex:hexOf(ink),dark:light,auto:true,adjusted:false};
    }
    const g=rgbToHsl(hexToRgb(picked));
    let dark=g.l<stoneL, L=g.l, adjusted=false;
    if(Math.abs(g.l-stoneL)<GLYPH_MIN_CONTRAST){
      const down=stoneL-GLYPH_MIN_CONTRAST, up=stoneL+GLYPH_MIN_CONTRAST;
      dark = (down>=4) ? (up>96 ? true : (g.l<=stoneL)) : false;
      L = dark ? Math.max(4,down) : Math.min(96,up);
      adjusted=true;
    }
    return {hex:hexOf(hslToRgbObj(g.h,g.s,L)),dark,auto:false,adjusted};
  }

  // 石片明暗判定的唯一真相：刻紋顏色與 CSS 混合模式都以它為準。
  // 門檻調低 → 更多顏色會被視為亮石片（走暗刻 + multiply）。
  //
  // 60 的取法：上色演算法會把石片提得比 base 色亮很多，所以不能用直覺的中間值。
  // 實測飽和色（紅紫藍，明度 25～50）亮刻仍清楚；粉彩與米白（60 以上）就撐不住。
  function isLightShard(hex){
    return rgbToHsl(hexToRgb(hex)).l>60;
  }

  // 拖色盤會連續觸發，用 rAF 合併成每幀最多一次重畫。
  function applyShardPalette(el,hex){
    if(!el) return;
    el._paletteNext = hex;
    if(el._paletteQueued) return;
    el._paletteQueued = true;
    requestAnimationFrame(() => {
      el._paletteQueued = false;
      applyShardPaletteNow(el, el._paletteNext);
    });
  }

  function applyShardPaletteNow(el,hex){
    if(!el) return;
    const p=shardPalette(hex);
    // 亮石片必須改用 multiply，否則刻紋 CSS 的 mix-blend-mode:screen
    // 會把暗色的字整個吃掉（screen 只能變亮，不能變暗）。
    el.classList.toggle('is-light-shard',isLightShard(p.base));
    // 時辰字可由玩家自選顏色，混合模式要看「字 vs 石片」，不是石片自己亮不亮。
    el.classList.toggle('glyph-dark',resolveGlyphInk(p.base,el.dataset.glyphColor).dark);
    el.style.setProperty('--shard-main',p.base);
    el.style.setProperty('--shard-dark',p.dark);
    el.style.setProperty('--shard-deep',p.deep);
    el.style.setProperty('--shard-light',p.light);
    el.style.setProperty('--shard-edge',p.edge);
    el.style.setProperty('--shard-glow',p.glow);
    el.style.setProperty('--shard-mist',p.mist);
    recolorShardCanvas(el,p.base);
    renderShardEngraving(el,p.base);
  }

  function serialLabel(value){
    const raw=String(value??'').trim().toUpperCase();
    if(/^DEV-\d+$/.test(raw)) return raw;
    const n=Number(raw||0);
    return n>0 ? `No.${String(n).padStart(6,'0')}` : '';
  }

  function beginCritical(name, timeout=12000){
    if(criticalAction) return false;
    criticalAction = name || 'busy';
    document.documentElement.classList.add('adventure-critical');
    clearTimeout(criticalTimer);
    criticalTimer = setTimeout(()=>{
      console.warn('Adventure critical lock timeout:', criticalAction);
      endCritical();
    }, timeout);
    return true;
  }

  function endCritical(){
    criticalAction = '';
    clearTimeout(criticalTimer);
    criticalTimer = null;
    document.documentElement.classList.remove('adventure-critical');
  }

  function isCritical(){ return !!criticalAction; }

  async function api(action, params={}){
    const config = await getConfig();
    const endpoint = config.gasApiEndpoint;
    if(!endpoint) throw new Error('No GAS endpoint');

    // 十二時辰母石依讀者當地時間決定，所以小時數必須由前端送出。
    const q = new URLSearchParams({action, hour:String(new Date().getHours()), ...params});
    const r = await fetch(`${endpoint}?${q.toString()}`, {cache:'no-store'});
    if(!r.ok) throw new Error(`Adventure API ${r.status}`);
    const data = await r.json();
    if(data?.ok === false) throw new Error(data.error || 'Adventure API failed');
    return data;
  }

  // ============================================================
  // 網站有效停留統計
  // - 以時印為匿名識別，不收姓名、帳號或 IP
  // - 在前景且未閒置時才累計
  // - 每 30 秒送一次心跳；切出、閒置、離頁時結束目前一段
  // ============================================================
  function engagementSegmentId(){
    if(typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `tet${Date.now().toString(36)}${Math.random().toString(36).slice(2,16)}`;
  }

  function engagementPage(){
    try{
      const url=new URL(location.href);
      const storyId=String(url.searchParams.get('id')||'').trim();
      return storyId ? `${url.pathname}?id=${storyId}` : (url.pathname||'/');
    }catch(_){
      return location.pathname||'/';
    }
  }

  function engagementDeviceInfo(){
    const ua=String(navigator.userAgent||'');
    const platform=String(navigator.userAgentData?.platform||navigator.platform||'');
    const touchPoints=Number(navigator.maxTouchPoints||0);
    const isIPad=/iPad/i.test(ua)||(/Mac/i.test(platform)&&touchPoints>1);
    const isIOS=isIPad||/iPhone|iPod/i.test(ua);
    const isAndroid=/Android/i.test(ua)||/Android/i.test(platform);
    const isTablet=isIPad||/Tablet|PlayBook|Silk/i.test(ua)||(isAndroid&&!/Mobile|Mobi/i.test(ua));
    const isMobile=!isTablet&&(
      navigator.userAgentData?.mobile===true||
      /iPhone|iPod|Mobile|Mobi/i.test(ua)||
      isAndroid
    );

    let operatingSystem='OTHER';
    if(isAndroid) operatingSystem='ANDROID';
    else if(isIOS) operatingSystem='IOS';
    else if(/CrOS|Chrome OS/i.test(`${ua} ${platform}`)) operatingSystem='CHROMEOS';
    else if(/Windows|Win32|Win64/i.test(`${ua} ${platform}`)) operatingSystem='WINDOWS';
    else if(/Macintosh|MacIntel|Mac OS X|macOS/i.test(`${ua} ${platform}`)) operatingSystem='MACOS';
    else if(/Linux/i.test(`${ua} ${platform}`)) operatingSystem='LINUX';

    let deviceType='OTHER';
    if(isTablet) deviceType='TABLET';
    else if(isMobile) deviceType='MOBILE';
    else if(['WINDOWS','MACOS','CHROMEOS','LINUX'].includes(operatingSystem)) deviceType='DESKTOP';

    return {deviceType,operatingSystem};
  }

  function queueEngagementUntil(at){
    const tracker=engagementTracker;
    if(!tracker || !tracker.active) return;
    const end=Math.max(tracker.lastCountedAt,Number(at)||Date.now());
    tracker.fractionMs+=end-tracker.lastCountedAt;
    tracker.lastCountedAt=end;
    const seconds=Math.floor(tracker.fractionMs/1000);
    if(seconds>0){
      tracker.totalSeconds+=seconds;
      tracker.fractionMs-=seconds*1000;
    }
  }

  function engagementParams(event){
    const tracker=engagementTracker;
    if(!tracker || !tracker.segmentId) return null;
    const t=token();
    if(!t) return null;
    return {
      token:t,
      sessionId:tracker.segmentId,
      page:tracker.page,
      deviceType:tracker.deviceType,
      operatingSystem:tracker.operatingSystem,
      event,
      // 同一工作階段永遠上傳累積秒數，重送或亂序抵達都不會重複計時。
      seconds:String(Math.max(0,Math.floor(Number(tracker.totalSeconds)||0)))
    };
  }

  async function sendEngagement(event){
    const params=engagementParams(event);
    if(!params) return;
    try{
      await api('adventureEngagement',params);
    }catch(err){
      console.warn('網站停留紀錄未同步，下一次心跳會自動補回。',err);
    }
  }

  function sendEngagementBeacon(event){
    const tracker=engagementTracker;
    const params=engagementParams(event);
    if(!tracker?.endpoint || !params) return;
    try{
      const q=new URLSearchParams({action:'adventureEngagement',...params});
      fetch(`${tracker.endpoint}?${q.toString()}`,{
        method:'GET',
        mode:'no-cors',
        cache:'no-store',
        keepalive:true
      }).catch(()=>{});
    }catch(_){ }
  }

  function flushEngagement(event,{beacon=false}={}){
    const tracker=engagementTracker;
    if(!tracker) return;
    if(beacon) sendEngagementBeacon(event);
    else void sendEngagement(event);
  }

  function startEngagementSegment(){
    const tracker=engagementTracker;
    if(!tracker || tracker.active || document.visibilityState!=='visible') return;
    const now=Date.now();
    tracker.active=true;
    tracker.segmentId=engagementSegmentId();
    tracker.page=engagementPage();
    tracker.lastCountedAt=now;
    tracker.lastInteractionAt=now;
    tracker.lastHeartbeatAt=now;
    tracker.fractionMs=0;
    tracker.totalSeconds=0;
    void sendEngagement('START');
  }

  function finishEngagementSegment(event,{at=Date.now(),beacon=false}={}){
    const tracker=engagementTracker;
    if(!tracker || !tracker.active) return;
    queueEngagementUntil(at);
    tracker.active=false;
    flushEngagement(event,{beacon});
  }

  function markEngagementActivity(){
    const tracker=engagementTracker;
    if(!tracker || document.visibilityState!=='visible') return;
    if(!tracker.active){
      startEngagementSegment();
      return;
    }
    tracker.lastInteractionAt=Date.now();
  }

  function checkEngagement(){
    const tracker=engagementTracker;
    if(!tracker || !tracker.active || document.visibilityState!=='visible') return;
    const now=Date.now();
    const idleAt=tracker.lastInteractionAt+ENGAGEMENT_IDLE_MS;

    if(now>=idleAt){
      finishEngagementSegment('IDLE',{at:idleAt});
      return;
    }

    if(now-tracker.lastHeartbeatAt>=ENGAGEMENT_HEARTBEAT_MS){
      queueEngagementUntil(now);
      tracker.lastHeartbeatAt=now;
      flushEngagement('HEARTBEAT');
    }
  }

  async function startEngagementTracking(){
    if(engagementTracker) return;
    const t=token();
    if(!t) return;

    try{
      const config=await getConfig();
      const endpoint=String(config?.gasApiEndpoint||'').trim();
      if(!endpoint) return;
      const device=engagementDeviceInfo();

      engagementTracker={
        endpoint,
        deviceType:device.deviceType,
        operatingSystem:device.operatingSystem,
        active:false,
        segmentId:'',
        page:engagementPage(),
        lastCountedAt:0,
        lastInteractionAt:0,
        lastHeartbeatAt:0,
        fractionMs:0,
        totalSeconds:0,
        hiddenTimer:null
      };

      const pauseAt=()=>{
        const tracker=engagementTracker;
        if(!tracker || tracker.hiddenTimer) return;
        const hiddenAt=Date.now();
        tracker.hiddenTimer=setTimeout(()=>{
          if(!engagementTracker) return;
          engagementTracker.hiddenTimer=null;
          finishEngagementSegment('PAUSE',{at:hiddenAt,beacon:true});
        },250);
      };

      document.addEventListener('visibilitychange',()=>{
        if(document.visibilityState==='hidden') pauseAt();
        else{
          const tracker=engagementTracker;
          if(tracker?.hiddenTimer){
            clearTimeout(tracker.hiddenTimer);
            tracker.hiddenTimer=null;
          }
          markEngagementActivity();
        }
      });

      window.addEventListener('pagehide',()=>{
        const tracker=engagementTracker;
        if(tracker?.hiddenTimer){
          clearTimeout(tracker.hiddenTimer);
          tracker.hiddenTimer=null;
        }
        finishEngagementSegment('LEAVE',{beacon:true});
      });

      window.addEventListener('pageshow',event=>{
        if(event.persisted && document.visibilityState==='visible') markEngagementActivity();
      });

      ['pointerdown','keydown','scroll','touchstart','mousemove'].forEach(type=>{
        window.addEventListener(type,markEngagementActivity,{passive:type!=='keydown'});
      });

      setInterval(checkEngagement,ENGAGEMENT_TICK_MS);
      startEngagementSegment();
    }catch(err){
      console.warn('網站停留統計尚未啟動。',err);
    }
  }

  async function ensure(){
    if(ensurePromise) return ensurePromise;

    ensurePromise=(async()=>{
      let t=token();

      if(!t){
        t=generateToken(new Date().getHours());
        setToken(t);
        try{
          await api('adventureCreate',{token:t});
          clearProgressSession(t);
        }catch(err){
          console.warn('時印建立暫時離線',err);
        }
        toast('時印已建立。');
        return {token:t,isNew:true};
      }

      // 已有 TOKEN 時，跨頁不再每次阻塞等待 GAS。
      // 有 session 快取就直接使用，背景再同步最新資料。
      const stored=readProgressSession(t);
      if(stored){
        progressCache=stored;
        renderDevPreviewBadge(stored);
        setTimeout(()=>refreshProgressInBackground(),0);
        return {token:t,isNew:false,cached:true};
      }

      // 只有沒有任何本地資料時，才真正等待一次後端。
      try{
        const loaded=await load(true);
        if(!loaded?.exists){
          await api('adventureCreate',{token:t});
          clearProgressSession(t);
        }
      }catch(err){
        console.warn('時印確認暫時離線',err);
      }

      return {token:t,isNew:false,cached:false};
    })();

    try{
      return await ensurePromise;
    }finally{
      ensurePromise=null;
    }
  }


  function renderDevPreviewBadge(data){
    const old=document.getElementById('devPreviewBadge');
    if(old) old.remove();

    const mode=String(data?.player?.devPreviewMode||'OFF').trim().toUpperCase();
    if(mode!=='FULL') return;

    const badge=document.createElement('div');
    badge.id='devPreviewBadge';
    badge.className='dev-preview-badge';
    badge.textContent='DEV · FULL';
    badge.title='目前為 DEV 完整版預覽，不代表真實玩家進度';
    document.body.appendChild(badge);
  }

  function progressSessionKey(t){
    return `${PROGRESS_SESSION_PREFIX}${String(t||'')}`;
  }

  function readProgressSession(t,{allowStale=false}={}){
    if(!t) return null;
    try{
      const raw=sessionStorage.getItem(progressSessionKey(t));
      if(!raw) return null;
      const entry=JSON.parse(raw);
      if(!entry?.data) return null;
      const age=Date.now()-Number(entry.savedAt||0);
      if(!allowStale && age>PROGRESS_SESSION_TTL) return null;
      return entry.data;
    }catch(_){
      return null;
    }
  }

  function writeProgressSession(t,data){
    if(!t || !data?.ok) return;
    try{
      sessionStorage.setItem(
        progressSessionKey(t),
        JSON.stringify({savedAt:Date.now(),data})
      );
    }catch(_){}
  }

  function clearProgressSession(t=token()){
    if(!t) return;
    try{ sessionStorage.removeItem(progressSessionKey(t)); }catch(_){}
  }

  function applyTimeMarkEntryState(data){
    if(!data) return;
    const stone=data?.stone||{};
    const forged=!!stone.forged;
    const traceCount=visibleTimeTraceCount(data);

    document.querySelectorAll('[data-time-mark]').forEach(btn=>{
      const label=btn.querySelector('.time-mark-orb-label');

      if(!forged){
        if(label) label.textContent='時印在此';
        btn.setAttribute('aria-label','時印在此，留下我的時印');
        btn.dataset.timeMarkState='unforged';
      }else{
        if(label) label.textContent=`時痕・${traceCount}`;
        btn.setAttribute('aria-label',`開啟時印，目前留下 ${traceCount} 道時痕`);
        btn.dataset.timeMarkState=traceCount>0?'traced':'forged';
      }

      btn.classList.toggle('is-unforged',!forged);
      btn.classList.toggle('has-time-traces',forged && traceCount>0);
    });
  }

  async function refreshProgressInBackground(){
    const t=token();
    if(!t || progressRefreshPromise) return progressRefreshPromise;

    progressRefreshPromise=(async()=>{
      try{
        const fresh=await api('adventureLoad',{token:t});
        progressCache=fresh;
        writeProgressSession(t,fresh);
        renderDevPreviewBadge(fresh);
        applyTimeMarkEntryState(fresh);
        window.dispatchEvent(new CustomEvent('tet:progress-updated',{detail:fresh}));
        return fresh;
      }catch(err){
        console.warn('背景同步旅程失敗',err);
        return null;
      }finally{
        progressRefreshPromise=null;
      }
    })();

    return progressRefreshPromise;
  }

  async function load(force=false){
    const t = token();
    if(!t) return null;

    if(progressCache && !force) return progressCache;

    if(!force){
      const stored=readProgressSession(t);
      if(stored){
        progressCache=stored;
        renderDevPreviewBadge(stored);
        return stored;
      }
    }

    try{
      const fresh=await api('adventureLoad',{token:t});
      progressCache=fresh;
      writeProgressSession(t,fresh);
      renderDevPreviewBadge(fresh);
      return fresh;
    }catch(err){
      console.warn('旅程讀取失敗',err);

      // 網路失敗時，即使快取過期也比全空畫面好。
      const stale=readProgressSession(t,{allowStale:true});
      if(stale){
        progressCache=stale;
        renderDevPreviewBadge(stale);
        return stale;
      }

      return {ok:false, exists:true, token:t, progress:[], storyRead:[], charactersUnlocked:[], worldUnlocked:[]};
    }
  }

  // 公開展示：以接力碼讀取他人時印（後端不會回傳 TOKEN）
  async function relayLoad(relay){
    const code = String(relay || '').trim().toUpperCase();
    if(!/^RIFT-[A-Z2-9]{8}$/.test(code)) throw new Error('這枚接力碼的格式不正確。');
    return api('adventureRelayLoad', {relay: code});
  }

  // 分享連結指向靜態卡片頁（帶個人化 OG meta），它會再轉到分享頁。
  function shareUrlFor(relay){
    const code = String(relay || '').trim().toUpperCase();
    if(!code) return '';
    return new URL(`${rootPrefix()}share/${encodeURIComponent(code)}.html`, location.href).href;
  }

  async function copyShareUrl(relay){
    const url = shareUrlFor(relay);
    if(!url) throw new Error('這枚時印尚未完成鑄印，還沒有分享連結。');
    await navigator.clipboard.writeText(url);
    toast('分享連結已複製。');
  }

  // 預覽圖 base64 約 150KB，超過網址長度上限，必須改用 POST。
  // Content-Type 用 text/plain 是為了避開 CORS preflight（GAS 不處理 OPTIONS）。
  async function apiPost(action, params={}){
    const config = await getConfig();
    const endpoint = config.gasApiEndpoint;
    if(!endpoint) throw new Error('No GAS endpoint');

    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify({action, hour: new Date().getHours(), ...params}),
      redirect: 'follow'
    });
    if(!r.ok) throw new Error(`Adventure POST ${r.status}`);
    const data = await r.json();
    if(data?.ok === false) throw new Error(data.error || 'Adventure POST failed');
    return data;
  }

  // ============================================================
  // 分享卡片：把石片合成 1200×630 的 OG 預覽圖
  // 直接沿用畫面上那組 canvas，確保分享圖與玩家看到的完全一致。
  // ============================================================
  const SHARE_W = 1200, SHARE_H = 630;

  function waitForShardPaint(el, timeout = 6000){
    return new Promise(resolve => {
      const started = Date.now();
      const tick = () => {
        const body = el.querySelector('.time-shard-canvas');
        const carve = el.querySelector('.time-shard-engraving');
        const bodyReady = body && body.width > 0 && body.dataset.tinted;
        const carveReady = !carve || carve.width > 0;
        if((bodyReady && carveReady) || Date.now() - started > timeout) return resolve();
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  async function buildShareCard(stone){
    const color = normalizeHexColor(stone.color || '#7F1521');
    const type = stoneTypeNumber(stone.stoneType);
    if(!type) throw new Error('石片型號不完整。');

    // 離屏渲染一份石片
    const holder = document.createElement('div');
    holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText = 'position:fixed;left:-99999px;top:0;width:520px;height:520px;pointer-events:none;opacity:0';
    holder.innerHTML = shardPreviewMarkup({
      color,
      serial: '',
      relay: '',
      level: stone.resonanceLevel || 0,
      stoneType: type,
      engraveSeed: stone.engraveSeed || '',
      glyphColor: stone.glyphColor || '',
      scar: stone.scar || '',
      scarDone: stone.scarDone ?? ''
    });
    document.body.appendChild(holder);
    const shard = holder.firstElementChild;

    try{
      applyShardPalette(shard, color);
      await ensureShardGlyphFont();
      await waitForShardPaint(shard);

      const cv = document.createElement('canvas');
      cv.width = SHARE_W; cv.height = SHARE_H;
      const ctx = cv.getContext('2d');
      const rgb = hexToRgb(color);

      // 背景：品牌暗底 + 主色暈光
      ctx.fillStyle = '#07090d';
      ctx.fillRect(0, 0, SHARE_W, SHARE_H);
      const glow = ctx.createRadialGradient(330, 300, 0, 330, 300, 520);
      glow.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0.28)`);
      glow.addColorStop(1, 'rgba(7,9,13,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, SHARE_W, SHARE_H);
      const wash = ctx.createLinearGradient(0, 0, SHARE_W, SHARE_H);
      wash.addColorStop(0, 'rgba(149,26,43,.16)');
      wash.addColorStop(.55, 'rgba(7,9,13,0)');
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, SHARE_W, SHARE_H);

      // 石片（左側）
      const bodyCv = shard.querySelector('.time-shard-canvas');
      const carveCv = shard.querySelector('.time-shard-engraving');
      if(bodyCv && bodyCv.width){
        const box = 430;
        const scale = Math.min(box / bodyCv.width, box / bodyCv.height);
        const w = bodyCv.width * scale, h = bodyCv.height * scale;
        const x = 120 + (box - w) / 2, y = (SHARE_H - h) / 2;

        ctx.save();
        ctx.shadowColor = `rgba(${rgb.r},${rgb.g},${rgb.b},0.55)`;
        ctx.shadowBlur = 60;
        ctx.drawImage(bodyCv, x, y, w, h);
        ctx.restore();

        if(carveCv && carveCv.width){
          ctx.save();
          // 與 CSS 的 mix-blend-mode 對齊：亮石片用 multiply，暗石片用 screen
          ctx.globalCompositeOperation = isLightShard(color) ? 'multiply' : 'screen';
          ctx.drawImage(carveCv, x, y, w, h);
          ctx.restore();
        }
      }

      // 右側文字
      const L = 620;
      const disp = '"TheEndOfTimeDisplay","Noto Serif TC","DFKai-SB","KaiTi",serif';
      const sans = '"Noto Sans TC","Microsoft JhengHei",sans-serif';

      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      ctx.fillStyle = 'rgba(193,58,77,.92)';
      ctx.font = `800 20px ${sans}`;
      ctx.letterSpacing && (ctx.letterSpacing = '6px');
      ctx.fillText('THE END OF TIME', L, 196);
      ctx.letterSpacing && (ctx.letterSpacing = '0px');

      ctx.fillStyle = '#f1f3f6';
      ctx.font = `700 96px ${disp}`;
      ctx.fillText('時盡', L, 300);

      ctx.strokeStyle = 'rgba(255,255,255,.14)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L, 336); ctx.lineTo(L + 420, 336); ctx.stroke();

      ctx.fillStyle = 'rgba(238,241,245,.94)';
      ctx.font = `700 40px ${sans}`;
      ctx.fillText(serialLabel(stone.serial) || '時印', L, 396);

      const glyph = shichenGlyph(type);
      ctx.fillStyle = 'rgba(199,204,214,.82)';
      ctx.font = `500 26px ${sans}`;
      ctx.fillText(`${glyph}時　·　第 ${Number(stone.resonanceLevel || 0)} 階共鳴`, L, 444);

      ctx.fillStyle = 'rgba(199,204,214,.55)';
      ctx.font = `500 24px ${disp}`;
      ctx.fillText('過程可以改變，結果不能。', L, 506);

      return cv.toDataURL('image/jpeg', 0.86);
    }finally{
      holder.remove();
    }
  }

  // 鑄印或改色後，在背景更新分享卡片；失敗不影響主流程。
  async function syncShareCard(stone){
    try{
      if(!stone || !stone.forged || !stone.relayCode) return;
      const image = await buildShareCard(stone);
      await apiPost('adventureShareCard', {token: token(), image: image});
      console.info('分享卡片已更新。');
    }catch(err){
      console.warn('分享卡片更新失敗（不影響鑄印）。', err);
    }
  }

  async function restore(value){
    const normalized = normalizeTimeMarkInput(value);
    if(!normalized){
      throw new Error('這枚時印的格式不正確。');
    }
    const data = await api('adventureLoad',{token:normalized});
    if(!data?.exists) throw new Error('找不到這枚時印留下的旅程。');
    clearProgressSession();
    setToken(normalized);
    progressCache = data;
    sessionStorage.removeItem(SESSION_PROMPT_KEY);
    return data;
  }

  async function forgeShard(color,glyphColor){
    const t=token() || (await ensure()).token;
    const params={token:t,color:normalizeHexColor(color)};
    // 空字串代表「自動配色」，後端照收，玩家之後還能改回來。
    params.glyphColor = /^#?[0-9a-f]{6}$/i.test(String(glyphColor||'').trim()) ? normalizeHexColor(glyphColor) : '';
    const data=await api('adventureForge',params);
    // 記憶體與 sessionStorage 都要清，否則 ensure() 會把鑄印前的舊狀態撈回來覆蓋。
    progressCache=null;
    clearProgressSession(t);
    return data;
  }

  async function completeStory(storyId, extra={}){
    const t = token() || (await ensure()).token;
    const params = {
      token:t,
      storyId,
      lastUrl:extra.lastUrl || location.href,
      lastScroll:String(Math.max(0, Math.round(extra.lastScroll ?? window.scrollY ?? 0)))
    };
    const data = await api('adventureComplete',params);
    progressCache = null;
    clearProgressSession(t);
    toast('此刻，已被時印記下。');
    return data;
  }

  async function touchPosition(storyId){
    const t = token();
    if(!t || !storyId) return;
    try{
      await api('adventureTouch',{
        token:t,
        storyId,
        lastUrl:location.href,
        lastScroll:String(Math.max(0,Math.round(window.scrollY || 0)))
      });
    }catch(err){ console.warn('時間裂縫位置未同步',err); }
  }

  function toast(message){
    let el = document.getElementById('adventureToast');
    if(!el){
      el=document.createElement('div');el.id='adventureToast';el.className='adventure-toast';document.body.appendChild(el);
    }
    el.textContent=message;
    el.classList.add('is-visible');
    clearTimeout(el._timer);
    el._timer=setTimeout(()=>el.classList.remove('is-visible'),2400);
  }

  async function copyToken(){
    const t = token() || (await ensure()).token;
    await navigator.clipboard.writeText(t);
    toast('時印已複製。');
  }

  function downloadTimeMarkCard(){
    openForge();
  }

  function closeOverlay(force=false){
    if(isCritical() && !force) return;
    const o=document.getElementById('timeMarkOverlay');
    if(!o) return;
    o.classList.remove('is-open');
    setTimeout(()=>o.remove(),220);
  }

  function overlay(html,{lockClose=false}={}){
    closeOverlay(true);
    const o=document.createElement('div');
    o.id='timeMarkOverlay';
    o.className='time-mark-overlay';
    if(lockClose) o.dataset.lockClose='1';
    o.innerHTML=`<section class="time-mark-panel" role="dialog" aria-modal="true">${html}</section>`;
    document.body.appendChild(o);
    requestAnimationFrame(()=>o.classList.add('is-open'));
    o.addEventListener('click',e=>{
      const wantsClose = e.target===o || e.target.closest('[data-time-close]');
      if(!wantsClose) return;
      if(o.dataset.lockClose==='1' || isCritical()) return;
      closeOverlay();
    });
    return o;
  }

  function setTimeMarkButtonsBusy(busy){
    document.querySelectorAll('[data-time-mark]').forEach(btn=>{
      btn.disabled = !!busy;
      btn.setAttribute('aria-busy', busy ? 'true' : 'false');
    });
  }

  function showTimeMarkLoading(message='正在讀取時印……'){
    return overlay(`
      <div class="time-mark-loading" role="status" aria-live="polite">
        <span class="time-mark-loading-ring" aria-hidden="true"></span>
        <div>
          <div class="time-mark-kicker">TIME MARK</div>
          <strong>${message}</strong>
        </div>
      </div>
    `,{lockClose:true});
  }

  function shardPreviewMarkup({color='#7F1521',serial='',relay='',level=0,stoneType=0,engraveSeed='',glyphColor='',scar='',scarDone='',showEngraving=true,awaiting=false}={}){
    const type=stoneTypeNumber(stoneType);
    if(awaiting || !type){
      return `
        <div class="time-shard-awaiting" data-shard-preview>
          <span class="time-shard-awaiting-core" aria-hidden="true"></span>
          <strong>等待時印回應</strong>
          <small>石片會在時空鑄印完成後顯現。</small>
        </div>`;
    }
    const levelClass=`resonance-${Math.max(0,Math.min(5,Number(level||0)))}`;
    const url=stoneAssetUrl(type);
    const aspect=stoneAspectRatio(type);
    const visualOffset=stoneVisualOffset(type);
    const safeSeed=showEngraving ? String(engraveSeed||'') : '';
    return `
      <div class="time-shard-asset ${levelClass}" data-shard-preview data-stone-type="${type}" data-engrave-seed="${safeSeed.replace(/"/g,'&quot;')}" data-glyph-color="${String(glyphColor||'').replace(/"/g,'&quot;')}" data-scar="${String(scar||'').replace(/"/g,'&quot;')}" data-scar-done="${String(scarDone??'')}" style="--stone-image:url('${url}');--stone-aspect:${aspect};--stone-shift-x:${visualOffset.x}%;--stone-shift-y:${visualOffset.y}%">
        <img class="time-shard-image" src="${url}" alt="你的時印石片" crossorigin="anonymous">
        <canvas class="time-shard-canvas" aria-hidden="true"></canvas>
        <canvas class="time-shard-engraving" aria-hidden="true"></canvas>
        <canvas class="time-shard-glyph" aria-hidden="true"></canvas>
        <canvas class="time-shard-scar-dark" aria-hidden="true"></canvas>
        <canvas class="time-shard-scar" aria-hidden="true"></canvas>
        <span class="time-shard-colorwash" aria-hidden="true"></span>
        <span class="time-shard-light" aria-hidden="true"></span>
        <span class="time-shard-refraction refraction-a" aria-hidden="true"></span>
        <span class="time-shard-refraction refraction-b" aria-hidden="true"></span>
        <span class="time-shard-orbit-field" aria-hidden="true">
          <i class="time-shard-orbit-particle p1"></i>
          <i class="time-shard-orbit-particle p2"></i>
          <i class="time-shard-orbit-particle p3"></i>
        </span>
        <span class="time-shard-crack crack-a" aria-hidden="true"></span>
        <span class="time-shard-crack crack-b" aria-hidden="true"></span>
        <div class="time-shard-inscription">
          ${serial ? `<small>時印序 ${serial}</small>` : ''}
          ${relay ? `<span>${relay}</span>` : ''}
        </div>
      </div>`;
  }

  function showForgeSuccess(result){
    const stone=result?.stone||{};
    const serial=stone.serial?serialLabel(stone.serial):'';
    const color=normalizeHexColor(stone.color||'#7F1521');
    const o=overlay(`
      <div class="time-mark-kicker">TIME FORGING</div>
      <h2>時印已成。</h2>
      <p>時之沙漏的殘片已回應你的存在。從此，它會記住你走過的時間。</p>
      <div class="time-forge-reveal">
        ${shardPreviewMarkup({
          color,
          serial,
          relay:stone.relayCode||'',
          level:stone.resonanceLevel||0,
          stoneType:stone.stoneType,
          engraveSeed:stone.engraveSeed||'',
          glyphColor:stone.glyphColor||'',
          scar:stone.scar||'',
          scarDone:stone.scarDone??''
        })}
      </div>
      <div class="time-mark-actions">
        <button class="time-mark-btn primary" type="button" data-forge-view>查看我的時印</button>
        <button class="time-mark-btn" type="button" data-time-close>繼續前行</button>
      </div>
    `);
    const shard=o.querySelector('[data-shard-preview]');
    applyShardPalette(shard,color);
    const view=o.querySelector('[data-forge-view]');
    if(view) view.onclick=()=>{ closeOverlay(true); openManager(); };
  }

  async function openForge(){
    if(document.body.classList.contains('pre-entry')) return;
    if(isCritical()) return;
    const data=await load(false);
    let existing=data?.stone||{};
    if(!stoneTypeNumber(existing.stoneType)){
      const retry=await load(true);
      existing=retry?.stone||existing;
    }
    const initial=normalizeHexColor(existing.color||'#7F1521');
    // 色盤一定要有值；沒自選過就先擺自動配色算出來的顏色當起點。
    const glyphInitial=normalizeHexColor(existing.glyphColor||resolveGlyphInk(initial,'').hex);
    const isForged=!!existing.forged;
    const existingType=stoneTypeNumber(existing.stoneType);
    const o=overlay(`
      <div class="time-mark-kicker">TIME FORGING</div>
      <h2>${isForged ? '調整你的光源色' : '時空鑄印專屬石片'}</h2>
      <p>進入時空裂縫前，選擇一個代表自己的光源色。眼前的石片已回應你的存在；你所選的光，會即時在它的琉璃切面中留下折光。</p>
      <div class="time-forge-layout">
        <div class="time-forge-preview">
          ${shardPreviewMarkup({
            color:initial,
            serial:existing.serial ? serialLabel(existing.serial) : '',
            relay:existing.relayCode||'',
            level:existing.resonanceLevel||0,
            stoneType:existingType,
            engraveSeed:existing.engraveSeed||'',
            glyphColor:existing.glyphColor||'',
            scar:existing.scar||'',
            scarDone:existing.scarDone??'',
            showEngraving:isForged,
            awaiting:!existingType
          })}
        </div>
        <div class="time-forge-controls">
          <label class="time-color-label" for="timeShardColor">選擇你的光源色</label>
          <input id="timeShardColor" class="time-color-picker" type="color" value="${initial}">

          <div class="time-color-fields">
            <label class="time-color-field">
              <span>HEX 色碼</span>
              <input id="timeShardHex" class="time-color-text" type="text" inputmode="text" autocomplete="off" spellcheck="false" value="${initial}" maxlength="7">
            </label>
            <label class="time-color-field">
              <span>RGB</span>
              <input id="timeShardRgb" class="time-color-text" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" value="${formatRgb(initial)}">
            </label>
          </div>
          <p class="time-color-help">可直接使用色盤，也可以輸入 HEX 或 RGB。三者會彼此同步。</p>

          <label class="time-color-label" for="timeGlyphColor" style="margin-top:18px">時辰字的顏色</label>
          <div class="time-color-fields">
            <label class="time-color-field">
              <span>字色</span>
              <input id="timeGlyphColor" class="time-color-picker" type="color" value="${glyphInitial}">
            </label>
            <label class="time-color-field time-glyph-auto">
              <span>自動配色</span>
              <input id="timeGlyphAuto" type="checkbox" ${existing.glyphColor?'':'checked'}>
            </label>
          </div>
          <p class="time-color-help" data-glyph-note></p>
        </div>
      </div>
      <div class="time-mark-actions">
        <button class="time-mark-btn primary" type="button" data-forge-confirm>${isForged ? '重新定下光源色' : '開始時空鑄印'}</button>
        <button class="time-mark-btn" type="button" data-time-close>稍後再決定</button>
      </div>
      <p class="time-mark-status" data-forge-status></p>
    `);

    const picker=o.querySelector('#timeShardColor');
    const hexInput=o.querySelector('#timeShardHex');
    const rgbInput=o.querySelector('#timeShardRgb');
    const glyphPicker=o.querySelector('#timeGlyphColor');
    const glyphAuto=o.querySelector('#timeGlyphAuto');
    const glyphNote=o.querySelector('[data-glyph-note]');
    const shard=o.querySelector('[data-shard-preview]');
    const status=o.querySelector('[data-forge-status]');
    const confirmBtn=o.querySelector('[data-forge-confirm]');
    let current=initial;
    let currentGlyph=existing.glyphColor||'';

    // 時辰字是「你從哪裡來」，跟光源色本來就是兩件事，沒道理綁在一起。
    // 唯一的規矩：字色跟石片的明度差不夠時自動推開，
    // 否則會出現白字白石片這種等於沒畫的組合，而且是玩家自己選的，事後救不了。
    const syncGlyph=()=>{
      shard.dataset.glyphColor=currentGlyph;
      const res=resolveGlyphInk(current,currentGlyph);
      glyphNote.textContent = res.auto
        ? `自動：依石片明暗決定深字或淺字（目前為${res.dark?'暗刻':'亮刻'}）。`
        : (res.adjusted
            ? `這個顏色跟石片太接近，已自動拉開對比，實際會畫成 ${res.hex}。`
            : `${res.dark?'暗刻':'亮刻'}．${res.hex}`);
      applyShardPalette(shard,current);
    };

    const commitColor=(hex,source)=>{
      current=normalizeHexColor(hex);
      if(source!=='picker') picker.value=current;
      if(source!=='hex') hexInput.value=current;
      if(source!=='rgb') rgbInput.value=formatRgb(current);
      hexInput.classList.remove('is-invalid');
      rgbInput.classList.remove('is-invalid');
      status.textContent='';
      syncGlyph();
    };

    glyphPicker.addEventListener('input',()=>{
      glyphAuto.checked=false;
      currentGlyph=normalizeHexColor(glyphPicker.value);
      syncGlyph();
    });
    glyphAuto.addEventListener('change',()=>{
      currentGlyph = glyphAuto.checked ? '' : normalizeHexColor(glyphPicker.value);
      syncGlyph();
    });

    syncGlyph();

    picker.addEventListener('input',()=>commitColor(picker.value,'picker'));

    hexInput.addEventListener('input',()=>{
      let raw=String(hexInput.value||'').trim().toUpperCase();
      if(raw && !raw.startsWith('#')) raw='#'+raw;
      if(/^#[0-9A-F]{6}$/.test(raw)){
        hexInput.value=raw;
        commitColor(raw,'hex');
      }else{
        hexInput.classList.add('is-invalid');
      }
    });

    rgbInput.addEventListener('input',()=>{
      const rgb=parseRgbInput(rgbInput.value);
      if(rgb){
        commitColor(rgbToHex(rgb.r,rgb.g,rgb.b),'rgb');
      }else{
        rgbInput.classList.add('is-invalid');
      }
    });

    confirmBtn.onclick=async()=>{
      if(confirmBtn.disabled || isCritical()) return;
      const hexRaw=String(hexInput.value||'').trim().toUpperCase();
      const rgbRaw=parseRgbInput(rgbInput.value);
      let chosen='';
      if(/^#[0-9A-F]{6}$/.test(hexRaw)) chosen=hexRaw;
      else if(rgbRaw) chosen=rgbToHex(rgbRaw.r,rgbRaw.g,rgbRaw.b);
      else{
        status.textContent='請確認色碼格式。HEX 需為 #RRGGBB，RGB 需為 0～255 的三組數值。';
        return;
      }

      if(!beginCritical('time-shard-forge',18000)) return;
      confirmBtn.disabled=true;
      confirmBtn.setAttribute('aria-busy','true');
      confirmBtn.textContent='鑄印中……';
      status.textContent=isForged?'正在重新凝聚你的光源色。':'時空正在回應你的存在……';

      try{
        const result=await forgeShard(chosen,currentGlyph);
        // 鑄印回傳只有 stone，不是完整進度結構，塞進快取會讓後續讀到殘缺資料。
        void syncShareCard(result?.stone);   // 背景更新分享卡片，失敗不影響鑄印
        endCritical();
        closeOverlay(true);

        if(isForged){
          toast('光源色已重新留下。');
          openManager();
        }else{
          const started=playTimeRiftTransition({
            mode:'forge',
            onDone:()=>showForgeSuccess(result)
          });
          if(!started) showForgeSuccess(result);
        }
      }catch(err){
        endCritical();
        confirmBtn.disabled=false;
        confirmBtn.removeAttribute('aria-busy');
        confirmBtn.textContent=isForged?'重新定下光源色':'開始時空鑄印';
        status.textContent=err?.message||'鑄印暫時失敗，請稍後再試。';
      }
    };
  }

  function openRestoreDialog(){
    if(isCritical()) return;
    const o=overlay(`
      <div data-restore-form>
        <div class="time-mark-kicker">RESTORE TIME MARK</div>
        <h2>取回其他時印</h2>
        <p>只有需要切換另一段旅程時，才需要在這裡輸入時印。<br>整枚貼上即可，空白與前綴都可以省略。</p>
        <div class="time-mark-field">
          <label for="restoreTimeMark">輸入另一枚時印</label>
          <input id="restoreTimeMark" autocomplete="off" placeholder="時印　甲子 乙丑 丙寅 丁卯 戊辰 己巳 庚午 辛未">
        </div>
        <p class="time-mark-status" id="restoreTimeMarkStatus"></p>
        <div class="time-mark-actions">
          <button class="time-mark-btn primary" type="button" data-restore-time>取回時印</button>
          <button class="time-mark-btn" type="button" data-time-close>返回</button>
        </div>
      </div>

      <div class="time-mark-restore-confirm" data-restore-confirmation hidden aria-live="polite">
        <div class="time-mark-kicker">CONFIRM RESTORE</div>
        <h2>切換這段旅程？</h2>
        <p>取回另一枚時印後，這台裝置會切換到另一段旅程。</p>
        <div class="time-mark-confirm-code" data-restore-confirm-code></div>
        <div class="time-mark-device-state">
          <span class="time-mark-device-dot" aria-hidden="true"></span>
          <div>
            <strong>目前的時印會被保留。</strong>
            <span>它不會被刪除；之後仍可隨時再取回。</span>
          </div>
        </div>
        <p class="time-mark-confirm-note">確定後，這台裝置會暫時切換至上方這枚時印的旅程。</p>
        <p class="time-mark-status" data-restore-confirm-status></p>
        <div class="time-mark-actions">
          <button class="time-mark-btn primary" type="button" data-restore-confirm>確認取回</button>
          <button class="time-mark-btn" type="button" data-restore-back>返回修改</button>
        </div>
      </div>
    `);
    const form=o.querySelector('[data-restore-form]');
    const confirmation=o.querySelector('[data-restore-confirmation]');
    const field=o.querySelector('#restoreTimeMark');
    const status=o.querySelector('#restoreTimeMarkStatus');
    const restoreBtn=o.querySelector('[data-restore-time]');
    const confirmCode=o.querySelector('[data-restore-confirm-code]');
    const confirmStatus=o.querySelector('[data-restore-confirm-status]');
    const confirmBtn=o.querySelector('[data-restore-confirm]');
    const backBtn=o.querySelector('[data-restore-back]');

    const showForm=()=>{
      confirmation.hidden=true;
      form.hidden=false;
      requestAnimationFrame(()=>field.focus());
    };

    // 畫面顯示排版過的樣子，實際要送出的是正規化後的字串。
    // 別再從 textContent 讀回來 —— 那是給人看的，不是資料。
    let pendingToken='';

    const showConfirmation=(wanted)=>{
      pendingToken=wanted;
      confirmCode.textContent=formatTimeMark(wanted);
      confirmStatus.textContent='';
      form.hidden=true;
      confirmation.hidden=false;
      requestAnimationFrame(()=>confirmBtn.focus());
    };

    const startRestore=async(wanted)=>{
      if(!beginCritical('time-mark-restore',15000)) return;
      restoreBtn.disabled=true;
      restoreBtn.setAttribute('aria-busy','true');
      restoreBtn.textContent='確認中……';
      confirmBtn.disabled=true;
      confirmBtn.setAttribute('aria-busy','true');
      confirmBtn.textContent='確認中……';
      field.disabled=true;
      status.textContent='確認時印中……';
      confirmStatus.textContent='確認時印中……';
      try{
        const data=await restore(wanted);
        closeOverlay(true);
        endCritical();
        showRestoreSuccess(data);
      }catch(err){
        endCritical();
        restoreBtn.disabled=false;
        restoreBtn.removeAttribute('aria-busy');
        restoreBtn.textContent='取回時印';
        confirmBtn.disabled=false;
        confirmBtn.removeAttribute('aria-busy');
        confirmBtn.textContent='確認取回';
        field.disabled=false;
        showForm();
        status.textContent=err?.message||'時印確認失敗。';
      }
    };

    restoreBtn.onclick=()=>{
      if(restoreBtn.disabled || isCritical()) return;
      const wanted=normalizeTimeMarkInput(field.value);
      if(wanted && wanted===token()){
        status.textContent='這枚時印已經在這台裝置上使用中。';
        field.select();return;
      }
      if(!wanted){
        status.textContent='這枚時印的格式不正確。';
        field.focus();return;
      }
      const current=token();
      if(current && current!==wanted){
        showConfirmation(wanted);
        return;
      }
      startRestore(wanted);
    };

    confirmBtn.onclick=()=>{
      if(confirmBtn.disabled || isCritical()) return;
      if(!pendingToken) return;
      startRestore(pendingToken);
    };
    backBtn.onclick=()=>showForm();
  }

  async function openManager(){
    if(document.body.classList.contains('pre-entry')) return;
    if(timeMarkBusy || isCritical()) return;
    timeMarkBusy=true;
    beginCritical('time-mark-open',10000);
    setTimeMarkButtonsBusy(true);
    showTimeMarkLoading('正在讀取時印……');

    try{
      await ensure();
      const data=await load(false);
      const stone=data?.stone||{};
      const forged=!!stone.forged;
      endCritical();
      const serial=stone.serial?serialLabel(stone.serial):'';
      const relay=stone.relayCode||'';
      const color=normalizeHexColor(stone.color||'#7F1521');
      const o=overlay(`
        <div class="time-mark-kicker">TIME MARK</div>
        <h2>你的時印</h2>
        <p>${forged ? '此裝置已記住你的旅程。你的時印石片也會隨著故事產生新的共鳴。' : '此裝置已記住你的旅程。現在，你可以為它鑄造一枚真正屬於自己的時印石片。'}</p>

        ${forged ? `
          <div class="time-mark-mini-shard">
            ${shardPreviewMarkup({
              color,
              serial,
              relay,
              level:stone.resonanceLevel||0,
              stoneType:stone.stoneType,
              engraveSeed:stone.engraveSeed||'',
              glyphColor:stone.glyphColor||'',
              scar:stone.scar||'',
              scarDone:stone.scarDone??''
            })}
            <div class="time-mark-mini-copy">
              <small>時印序</small>
              <strong>${serial}</strong>
              <span>共鳴 ${Number(stone.resonanceLevel||0)}</span>
            </div>
          </div>
        ` : ''}

        <div class="time-mark-credential">
          <div class="time-mark-code" data-token-display></div>
          <button class="time-mark-link-btn" type="button" data-token-toggle aria-pressed="false">顯示完整時印</button>
        </div>
        <p class="time-mark-note">時印等同你的鑰匙——任何拿到它的人都能取回這段旅程。平常保持隱藏就好，需要時直接用「複製時印」，不必顯示在畫面上。</p>

        <div class="time-mark-actions">
          ${forged
            ? `<a class="time-mark-btn primary" href="${rootPrefix()}timemark/index.html">進入時印幻境</a>
               <button class="time-mark-btn" type="button" data-forge-open>調整石片色彩</button>`
            : `<button class="time-mark-btn primary" type="button" data-forge-open>時空鑄印專屬石片</button>`}
          <button class="time-mark-btn" type="button" data-copy-time>複製時印</button>
          ${forged ? `<button class="time-mark-btn" type="button" data-copy-share>複製分享連結</button>` : ''}
          <a class="time-mark-btn" href="${rootPrefix()}journey/index.html">查看目前旅程</a>
        </div>

        <div class="time-mark-secondary">
          <button class="time-mark-link-btn" type="button" data-restore-open>取回其他時印</button>
        </div>

        <div class="time-mark-actions">
          <button class="time-mark-btn" type="button" data-time-close>關閉</button>
        </div>
      `);

      // v0.18.29：管理器縮圖必須顯示玩家真正的本命石片主色，
      // 不能只顯示母石原始 PNG。
      const managerShard=o.querySelector('.time-mark-mini-shard [data-shard-preview]');
      if(managerShard){
        applyShardPalette(managerShard,color);
      }

      bindTokenReveal(
        o.querySelector('[data-token-display]'),
        o.querySelector('[data-token-toggle]')
      );

      o.querySelector('[data-copy-time]').onclick=copyToken;
      const shareBtn=o.querySelector('[data-copy-share]');
      if(shareBtn) shareBtn.onclick=()=>copyShareUrl(relay).catch(e=>toast(e.message||'複製失敗。'));
      const forgeBtn=o.querySelector('[data-forge-open]');
      if(forgeBtn) forgeBtn.onclick=()=>openForge();
      o.querySelector('[data-restore-open]').onclick=()=>openRestoreDialog();
    }catch(err){
      endCritical();
      closeOverlay(true);
      toast(err?.message||'時印讀取失敗，請稍後再試。');
    }finally{
      timeMarkBusy=false;
      setTimeMarkButtonsBusy(false);
      endCritical();
    }
  }

  function playTimeRiftTransition({mode='restore', onDone}={}){
    if(isCritical()) return null;
    beginCritical(`time-rift-${mode}`,7000);
    const copy = mode==='resume'
      ? {kicker:'TIME RIFT', title:'正在回到時間裂縫……', text:'時間正在重新接合。'}
      : mode==='forge'
        ? {kicker:'TIME FORGING', title:'時空正在回應你的存在……', text:'一枚沙漏殘片正在穿過裂縫，尋找與你共鳴的位置。'}
        : {kicker:'TIME MARK RESTORED', title:'正在尋回你的時間痕跡……', text:'散落的時間正在重新聚合。'};

    const o=overlay(`
      <div class="time-rift-video-scene" role="status" aria-live="polite">
        <video class="time-rift-video" muted playsinline preload="auto" aria-hidden="true">
          <source src="${rootPrefix()}assets/video/time-rift.mp4?v=0.17.3" type="video/mp4">
        </video>
        <div class="time-rift-video-vignette" aria-hidden="true"></div>
        <div class="time-rift-video-copy">
          <div class="time-mark-kicker">${copy.kicker}</div>
          <h2>${copy.title}</h2>
          <p>${copy.text}</p>
        </div>
      </div>
    `,{lockClose:true});

    const video=o.querySelector('.time-rift-video');
    let finished=false;
    const finish=()=>{
      if(finished) return;
      finished=true;
      o.classList.add('is-rift-finishing');
      setTimeout(()=>{
        endCritical();
        if(typeof onDone==='function') onDone();
      }, 420);
    };
    const timer=setTimeout(finish,4600);
    video.addEventListener('ended',()=>{ clearTimeout(timer); finish(); },{once:true});
    video.addEventListener('error',()=>{ clearTimeout(timer); finish(); },{once:true});
    video.play().catch(()=>{ clearTimeout(timer); finish(); });
    return o;
  }

  function showRestoreSuccess(data){
    const hasLast = !!data?.player?.lastStoryId;
    playTimeRiftTransition({
      mode:'restore',
      onDone:()=>{
        if(hasLast) showResumePrompt(data,true);
        else showNoRiftPrompt(data);
      }
    });
  }

  function showNoRiftPrompt(data){
    overlay(`
      <div class="time-mark-kicker">TIME MARK VERIFIED</div>
      <h2>時印已確認。</h2>
      <p>這枚時印目前還沒有留下可返回的時間裂縫。</p>
      <div class="resume-place no-rift">
        <small>目前的旅程</small>
        <strong>尚未完成第一段故事</strong>
        <span>當你完成一節故事後，離開的位置就會被時印記下。</span>
      </div>
      <div class="time-mark-actions">
        <a class="time-mark-btn primary" href="${rootPrefix()}journey/index.html">查看目前旅程</a>
        <a class="time-mark-btn" href="${rootPrefix()}story/index.html">開始前行</a>
        <button class="time-mark-btn" type="button" data-time-close>回到《時盡》入口</button>
      </div>
    `);
  }

  function friendlyLast(data){
    const s=data?.lastStory || {};
    return {
      chapter: s.chapterNumber ? `第${toChinese(s.chapterNumber)}章${s.chapterTitle ? `｜${s.chapterTitle}`:''}` : '',
      section: s.sectionNumber ? `第${toChinese(s.sectionNumber)}節${s.sectionTitle ? `｜${s.sectionTitle}`:''}` : '',
      url: data?.player?.lastUrl || (s.id ? `${rootPrefix()}story/read.html?id=${encodeURIComponent(s.id)}` : `${rootPrefix()}story/index.html`),
      scroll: Number(data?.player?.lastScroll || 0)
    };
  }

  function toChinese(n){
    n=Number(n);const d=['零','一','二','三','四','五','六','七','八','九','十'];
    if(n<=10)return d[n]||String(n);if(n<20)return '十'+d[n-10];if(n<100){const t=Math.floor(n/10),o=n%10;return d[t]+'十'+(o?d[o]:'')}return String(n);
  }

  function showResumePrompt(data, force=false){
    if(!data?.exists) return;
    if(!data?.player?.lastStoryId){
      if(force) showNoRiftPrompt(data);
      return;
    }
    if(!force && sessionStorage.getItem(SESSION_PROMPT_KEY)==='1') return;
    sessionStorage.setItem(SESSION_PROMPT_KEY,'1');
    const last=friendlyLast(data);
    const o=overlay(`
      <div class="time-mark-kicker">TIME MARK VERIFIED</div>
      <h2>時印已確認。</h2>
      <p>是否回到上次停留的時間裂縫？</p>
      <div class="resume-place">
        <small>上一次，你停在——</small>
        <strong>${last.chapter || '故事之中'}</strong>
        ${last.section ? `<span>${last.section}</span>` : ''}
      </div>
      <div class="time-mark-actions">
        <button class="time-mark-btn primary" type="button" data-resume>回到時間裂縫</button>
        <a class="time-mark-btn" href="${rootPrefix()}journey/index.html">查看目前旅程</a>
        <button class="time-mark-btn" type="button" data-time-close>回到《時盡》入口</button>
      </div>
    `);
    o.querySelector('[data-resume]').onclick=(e)=>{
      const btn=e.currentTarget;
      if(btn.disabled || isCritical()) return;
      btn.disabled=true;
      btn.setAttribute('aria-busy','true');
      btn.textContent='正在接合時間……';
      sessionStorage.setItem('theEndOfTime.resumeScroll',String(last.scroll||0));
      const started=playTimeRiftTransition({mode:'resume',onDone:()=>{ location.href=last.url; }});
      if(!started){
        btn.disabled=false;
        btn.removeAttribute('aria-busy');
        btn.textContent='回到時間裂縫';
      }
    };
  }

  function boolish(value){
    if(value===true || value===1) return true;
    const s=String(value??'').trim().toUpperCase();
    return s==='TRUE' || s==='1' || s==='YES' || s==='Y';
  }

  function hasSeenFirstGuide(data){
    // 只要後端回傳了這個欄位，就以試算表為唯一真相。
    if(data?.player && Object.prototype.hasOwnProperty.call(data.player,'firstGuideSeen')){
      return boolish(data.player.firstGuideSeen);
    }
    // 舊後端 / 暫時離線時才退回 localStorage。
    return localStorage.getItem(FIRST_GUIDE_KEY)==='1';
  }

  function markFirstGuideSeen(){
    localStorage.setItem(FIRST_GUIDE_KEY,'1');
    const t=token();
    if(progressCache?.player){
      progressCache.player.firstGuideSeen=true;
    }
    if(t){
      api('adventureGuideSeen',{token:t})
        .catch(err=>console.warn('首次導覽狀態未同步',err));
    }
  }

  function showTimeMarkEntryCoach(){
    const btn=document.querySelector('[data-time-mark]');
    if(!btn) return;

    const oldCoach=document.querySelector('.time-mark-entry-coach');
    if(oldCoach) oldCoach.remove();

    const coach=document.createElement('div');
    coach.className='time-mark-entry-coach';
    coach.innerHTML=`
      <div class="time-mark-entry-coach-card">
        <strong>想留下旅程時，點這枚時印石片。</strong>
        <p>之後無論逛到哪裡，都可以從這裡回來進行時空鑄印、查看旅程或取回其他時印。</p>
        <button class="time-mark-link-btn" type="button" data-entry-coach-close>知道了</button>
      </div>
    `;
    document.body.appendChild(coach);
    btn.classList.add('is-coach-highlight');

    const place=()=>{
      const rect=btn.getBoundingClientRect();
      const gap=10;
      const margin=12;
      const width=Math.min(360,window.innerWidth-margin*2);

      let left=rect.right-width;
      left=Math.max(margin,Math.min(left,window.innerWidth-width-margin));

      let top=rect.bottom+gap;
      const estimatedH=coach.offsetHeight||170;
      if(top+estimatedH>window.innerHeight-margin){
        top=Math.max(margin,rect.top-estimatedH-gap);
        coach.classList.add('is-above');
      }else{
        coach.classList.remove('is-above');
      }

      coach.style.width=`${width}px`;
      coach.style.left=`${Math.round(left)}px`;
      coach.style.top=`${Math.round(top)}px`;

      const arrowX=Math.max(24,Math.min(width-24,rect.left+rect.width/2-left));
      coach.style.setProperty('--coach-arrow-x',`${Math.round(arrowX)}px`);
    };

    place();
    requestAnimationFrame(()=>{
      place();
      coach.classList.add('is-visible');
    });

    const close=()=>{
      btn.classList.remove('is-coach-highlight');
      coach.classList.remove('is-visible');
      window.removeEventListener('resize',place);
      window.removeEventListener('scroll',place,true);
      setTimeout(()=>coach.remove(),220);
    };

    window.addEventListener('resize',place,{passive:true});
    window.addEventListener('scroll',place,{passive:true,capture:true});
    coach.querySelector('[data-entry-coach-close]').onclick=close;
    setTimeout(close,9000);
  }

  function showFirstTimeGuide(data){
    if(hasSeenFirstGuide(data)) return;
    if(document.getElementById('timeMarkFirstGuide')) return;

    const guide=document.createElement('div');
    guide.id='timeMarkFirstGuide';
    guide.className='time-mark-first-guide';
    guide.innerHTML=`
      <div class="time-mark-guide-backdrop" aria-hidden="true"></div>
      <section class="time-mark-guide-card" role="dialog" aria-modal="true" aria-labelledby="timeMarkGuideTitle">
        <div class="time-mark-kicker">TIME MARK</div>
        <h2 id="timeMarkGuideTitle">讓時間記住你走過的路。</h2>
        <p>時印會保存你讀過的故事、遇見的人，以及已理解的世界。</p>
        <div class="time-mark-guide-actions">
          <button class="time-mark-btn primary" type="button" data-guide-open>留下我的時印</button>
          <button class="time-mark-btn" type="button" data-guide-skip>先進入看看</button>
        </div>
      </section>
    `;
    document.body.appendChild(guide);
    document.documentElement.classList.add('time-mark-guide-open');
    requestAnimationFrame(()=>guide.classList.add('is-visible'));

    const close=()=>{
      markFirstGuideSeen();
      guide.classList.remove('is-visible');
      document.documentElement.classList.remove('time-mark-guide-open');
      setTimeout(()=>guide.remove(),260);
    };

    guide.querySelector('[data-guide-open]').onclick=()=>{
      close();
      setTimeout(()=>openForge(),280);
    };
    guide.querySelector('[data-guide-skip]').onclick=()=>{
      close();
      setTimeout(showTimeMarkEntryCoach,420);
    };
  }

  function bindButtons(){
    document.querySelectorAll('[data-time-mark]').forEach(btn=>{
      if(btn.dataset.timeMarkBound==='1') return;
      btn.dataset.timeMarkBound='1';
      btn.addEventListener('click',e=>{e.preventDefault();openManager();});
    });
  }

  async function maybePromptReturning(){
    if(!document.body.classList.contains('home-page') && !document.body.classList.contains('pre-entry')) return;
    if(!token()) return;
    try{
      const data=await load(false);
      if(!data?.player?.lastStoryId) return;
      const show=()=>showResumePrompt(data,false);
      if(document.body.classList.contains('pre-entry')){
        const ob=new MutationObserver(()=>{if(!document.body.classList.contains('pre-entry')){ob.disconnect();setTimeout(show,350)}});
        ob.observe(document.body,{attributes:true,attributeFilter:['class']});
      }else setTimeout(show,500);
    }catch(_){ }
  }

  function visibleTimeTraceCount(data){
    const story=Array.isArray(data?.storyRead) ? data.storyRead.length : 0;
    const chars=Array.isArray(data?.charactersUnlocked) ? data.charactersUnlocked.length : 0;
    const world=Array.isArray(data?.worldUnlocked) ? data.worldUnlocked.length : 0;
    return story + chars + world;
  }

  async function refreshTimeMarkEntryState(){
    try{
      const cached=progressCache || readProgressSession(token());
      if(!cached){
        document.querySelectorAll('[data-time-mark]').forEach(btn=>{
          const label=btn.querySelector('.time-mark-orb-label');
          if(label) label.textContent='讀取時印…';
        });
      }

      const data=cached || await load(false);
      applyTimeMarkEntryState(data);

      // UI 已經可以用了，再背景更新，不阻塞換頁。
      setTimeout(()=>refreshProgressInBackground(),0);
    }catch(_){
      document.querySelectorAll('[data-time-mark]').forEach(btn=>{
        const label=btn.querySelector('.time-mark-orb-label');
        if(label) label.textContent='時印';
        btn.setAttribute('aria-label','開啟時印');
        btn.dataset.timeMarkState='unknown';
      });
    }
  }

  async function init(){
    bindButtons();
    await ensure();
    void startEngagementTracking();
    await refreshTimeMarkEntryState();
    maybePromptReturning();

    if(document.body.classList.contains('home-page')){
      let guideData=null;
      try{ guideData=await load(false); }catch(_){}
      const showGuide=()=>{
        if(!hasSeenFirstGuide(guideData)){
          setTimeout(()=>showFirstTimeGuide(guideData),700);
        }
      };
      if(document.body.classList.contains('pre-entry')){
        const ob=new MutationObserver(()=>{
          if(!document.body.classList.contains('pre-entry')){
            ob.disconnect();
            showGuide();
          }
        });
        ob.observe(document.body,{attributes:true,attributeFilter:['class']});
      }else{
        showGuide();
      }
    }
  }

  document.addEventListener('DOMContentLoaded',init);
  return {token, maskToken, formatTimeMark, normalizeTimeMarkInput, isValidTimeMark,
          stoneTypeFromToken, stoneTypeFromHour, generateToken,
          bindTokenReveal, resolveGlyphInk, stoneLightness, SCAR, relayLoad, shareUrlFor, copyShareUrl, isLightShard, buildShareCard, ensure, load, restore, forgeShard, completeStory, touchPosition, openManager, openForge, openRestoreDialog, showResumePrompt, showRestoreSuccess, playTimeRiftTransition, copyToken, downloadTimeMarkCard, shardPalette, applyShardPalette, renderShardEngraving, serialLabel, shardPreviewMarkup, stoneAssetUrl, stoneAspectRatio, stoneVisualOffset, refreshProgressInBackground, normalizeHexColor};
})();
