
window.EndOfTimeAdventure = (() => {
  const STORAGE_KEY = 'theEndOfTime.timeMark';
  const SESSION_PROMPT_KEY = 'theEndOfTime.timeMark.prompted';
  const SAVED_CARD_KEY = 'theEndOfTime.timeMark.savedCardToken';
  const FIRST_GUIDE_KEY = 'theEndOfTime.timeMark.firstGuideSeen';
  const ENTRY_COACH_KEY = 'theEndOfTime.timeMark.entryCoachSeen';
  let configCache = null;
  let progressCache = null;
  let ensurePromise = null;
  let timeMarkBusy = false;
  let criticalAction = '';
  let criticalTimer = null;

  function rootPrefix(){
    return location.pathname.includes('/story/') || location.pathname.includes('/characters/') || location.pathname.includes('/world/') || location.pathname.includes('/journey/') || location.pathname.includes('/timemark/') ? '../' : '';
  }

  async function getConfig(){
    if(configCache) return configCache;
    const r = await fetch(`${rootPrefix()}data/config.json?_=${Date.now()}`, {cache:'no-store'});
    if(!r.ok) throw new Error('config load failed');
    configCache = await r.json();
    return configCache;
  }

  function generateToken(){
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const chunk = (start) => Array.from(bytes.slice(start,start+4), b => alphabet[b % alphabet.length]).join('');
    return `TET-${chunk(0)}-${chunk(4)}-${chunk(8)}-${chunk(12)}`;
  }

  function token(){ return localStorage.getItem(STORAGE_KEY) || ''; }
  function savedCardToken(){ return localStorage.getItem(SAVED_CARD_KEY) || ''; }
  function hasSavedCurrentCard(){ const t=token(); return !!t && savedCardToken()===t; }
  function markCurrentCardSaved(){ const t=token(); if(t) localStorage.setItem(SAVED_CARD_KEY,t); }
  function setToken(value){ localStorage.setItem(STORAGE_KEY, String(value || '').trim().toUpperCase()); }
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

  function stoneAssetUrl(type){
    const n=stoneTypeNumber(type);
    if(!n) return '';
    return `${rootPrefix()}assets/images/timemark/stones/stone-${String(n).padStart(2,'0')}.png?v=0.18.6`;
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

  function recolorShardCanvas(el,hex){
    if(!el || !el.classList?.contains('time-shard-asset')) return;
    const img=el.querySelector('.time-shard-image');
    const canvas=el.querySelector('.time-shard-canvas');
    if(!img || !canvas) return;

    const run=()=>{
      try{
        const w=img.naturalWidth||0, h=img.naturalHeight||0;
        if(!w || !h) return;

        // Work at source resolution only once per loaded stone for clean edges.
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

        // Preserve about 15% of the original prismatic hue,
        // but make the player's chosen light-source color dominate the glass body.
        for(let i=0;i<px.length;i+=4){
          const a=px[i+3];
          if(a===0) continue;

          const or=px[i], og=px[i+1], ob=px[i+2];
          const lum=(0.2126*or + 0.7152*og + 0.0722*ob)/255;

          // Base tinted glass: dark facets stay deep, bright facets retain brilliance.
          const shade=0.22 + Math.pow(lum,0.78)*0.98;
          let tr=chosen.r*shade;
          let tg=chosen.g*shade;
          let tb=chosen.b*shade;

          // Keep a small amount of the mother stone's original rainbow refraction.
          const keepOriginal = 0.14;
          tr=tr*(1-keepOriginal)+or*keepOriginal;
          tg=tg*(1-keepOriginal)+og*keepOriginal;
          tb=tb*(1-keepOriginal)+ob*keepOriginal;

          // Bright glass highlights should become pale versions of the chosen color,
          // not remain plain white.
          if(lum>0.72){
            const t=Math.min(1,(lum-0.72)/0.28)*0.60;
            const hr=chosen.r + (255-chosen.r)*0.72;
            const hg=chosen.g + (255-chosen.g)*0.72;
            const hb=chosen.b + (255-chosen.b)*0.72;
            tr=tr*(1-t)+hr*t;
            tg=tg*(1-t)+hg*t;
            tb=tb*(1-t)+hb*t;
          }

          px[i]=Math.max(0,Math.min(255,Math.round(tr)));
          px[i+1]=Math.max(0,Math.min(255,Math.round(tg)));
          px[i+2]=Math.max(0,Math.min(255,Math.round(tb)));
        }

        ctx.putImageData(data,0,0);
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

  function applyShardPalette(el,hex){
    if(!el) return;
    const p=shardPalette(hex);
    el.style.setProperty('--shard-main',p.base);
    el.style.setProperty('--shard-dark',p.dark);
    el.style.setProperty('--shard-deep',p.deep);
    el.style.setProperty('--shard-light',p.light);
    el.style.setProperty('--shard-edge',p.edge);
    el.style.setProperty('--shard-glow',p.glow);
    el.style.setProperty('--shard-mist',p.mist);
    recolorShardCanvas(el,p.base);
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
    const q = new URLSearchParams({action, ...params, _:Date.now()});
    const r = await fetch(`${endpoint}?${q.toString()}`, {cache:'no-store'});
    if(!r.ok) throw new Error(`Adventure API ${r.status}`);
    const data = await r.json();
    if(data?.ok === false) throw new Error(data.error || 'Adventure API failed');
    return data;
  }

  async function ensure(){
    if(ensurePromise) return ensurePromise;
    ensurePromise = (async()=>{
      let t = token();
      if(!t){
        t = generateToken();
        setToken(t);
        try{ await api('adventureCreate',{token:t}); }catch(err){ console.warn('時印建立暫時離線',err); }
        toast('時印已建立。');
        return {token:t, isNew:true};
      }
      try{
        const loaded = await api('adventureLoad',{token:t});
        if(!loaded?.exists) await api('adventureCreate',{token:t});
      }catch(err){ console.warn('時印確認暫時離線',err); }
      return {token:t, isNew:false};
    })();
    try{
      return await ensurePromise;
    }finally{
      ensurePromise = null;
    }
  }

  async function load(force=false){
    const t = token();
    if(!t) return null;
    if(progressCache && !force) return progressCache;
    try{
      progressCache = await api('adventureLoad',{token:t});
      return progressCache;
    }catch(err){
      console.warn('旅程讀取失敗',err);
      return {ok:false, exists:true, token:t, progress:[], storyRead:[], charactersUnlocked:[], worldUnlocked:[]};
    }
  }

  async function restore(value){
    const normalized = String(value || '').trim().toUpperCase();
    if(!/^TET-[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/.test(normalized)){
      throw new Error('這枚時印的格式不正確。');
    }
    const data = await api('adventureLoad',{token:normalized});
    if(!data?.exists) throw new Error('找不到這枚時印留下的旅程。');
    setToken(normalized);
    progressCache = data;
    sessionStorage.removeItem(SESSION_PROMPT_KEY);
    return data;
  }

  async function forgeShard(color){
    const t=token() || (await ensure()).token;
    const data=await api('adventureForge',{token:t,color:normalizeHexColor(color)});
    progressCache=null;
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

  function shardPreviewMarkup({color='#7F1521',serial='',relay='',level=0,stoneType=0,awaiting=false}={}){
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
    return `
      <div class="time-shard-asset ${levelClass}" data-shard-preview data-stone-type="${type}" style="--stone-image:url('${url}')">
        <img class="time-shard-image" src="${url}" alt="你的時印石片" crossorigin="anonymous">
        <canvas class="time-shard-canvas" aria-hidden="true"></canvas>
        <span class="time-shard-colorwash" aria-hidden="true"></span>
        <span class="time-shard-light" aria-hidden="true"></span>
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
          stoneType:stone.stoneType
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
    if(isCritical()) return;
    const data=await load(true);
    let existing=data?.stone||{};
    if(!stoneTypeNumber(existing.stoneType)){
      const retry=await load(true);
      existing=retry?.stone||existing;
    }
    const initial=normalizeHexColor(existing.color||'#7F1521');
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
    const shard=o.querySelector('[data-shard-preview]');
    const status=o.querySelector('[data-forge-status]');
    const confirmBtn=o.querySelector('[data-forge-confirm]');
    let current=initial;

    const commitColor=(hex,source)=>{
      current=normalizeHexColor(hex);
      if(source!=='picker') picker.value=current;
      if(source!=='hex') hexInput.value=current;
      if(source!=='rgb') rgbInput.value=formatRgb(current);
      applyShardPalette(shard,current);
      hexInput.classList.remove('is-invalid');
      rgbInput.classList.remove('is-invalid');
      status.textContent='';
    };

    applyShardPalette(shard,current);

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
        const result=await forgeShard(chosen);
        progressCache=result;
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
      <div class="time-mark-kicker">RESTORE TIME MARK</div>
      <h2>取回其他時印</h2>
      <p>只有需要切換另一段旅程時，才需要在這裡輸入時印。</p>
      <div class="time-mark-field">
        <label for="restoreTimeMark">輸入另一枚時印</label>
        <input id="restoreTimeMark" autocomplete="off" placeholder="TET-XXXX-XXXX-XXXX-XXXX">
      </div>
      <p class="time-mark-status" id="restoreTimeMarkStatus"></p>
      <div class="time-mark-actions">
        <button class="time-mark-btn primary" type="button" data-restore-time>取回時印</button>
        <button class="time-mark-btn" type="button" data-time-close>返回</button>
      </div>
    `);
    const field=o.querySelector('#restoreTimeMark');
    const status=o.querySelector('#restoreTimeMarkStatus');
    const restoreBtn=o.querySelector('[data-restore-time]');
    restoreBtn.onclick=async()=>{
      if(restoreBtn.disabled || isCritical()) return;
      const wanted=String(field.value||'').trim().toUpperCase();
      if(wanted && wanted===token()){
        status.textContent='這枚時印已經在這台裝置上使用中。';
        field.select();return;
      }
      if(!/^TET-[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/.test(wanted)){
        status.textContent='這枚時印的格式不正確。';
        field.focus();return;
      }
      const current=token();
      if(current && current!==wanted){
        const ok=confirm('取回另一枚時印後，這台裝置會切換到另一段旅程。\\n\\n目前的時印不會被刪除。\\n\\n確定要取回嗎？');
        if(!ok) return;
      }
      if(!beginCritical('time-mark-restore',15000)) return;
      restoreBtn.disabled=true;
      restoreBtn.setAttribute('aria-busy','true');
      restoreBtn.textContent='確認中……';
      field.disabled=true;
      status.textContent='確認時印中……';
      try{
        const data=await restore(wanted);
        closeOverlay(true);
        endCritical();
        showRestoreSuccess(data);
      }catch(err){
        endCritical();
        status.textContent=err.message||'時印確認失敗。';
        restoreBtn.disabled=false;
        restoreBtn.removeAttribute('aria-busy');
        restoreBtn.textContent='取回時印';
        field.disabled=false;field.focus();
      }
    };
  }

  async function openManager(){
    if(timeMarkBusy || isCritical()) return;
    timeMarkBusy=true;
    beginCritical('time-mark-open',10000);
    setTimeMarkButtonsBusy(true);
    showTimeMarkLoading('正在讀取時印……');

    try{
      await ensure();
      const data=await load(true);
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
            ${shardPreviewMarkup({color,serial,relay,level:stone.resonanceLevel||0})}
            <div class="time-mark-mini-copy">
              <small>時印序</small>
              <strong>${serial}</strong>
              <span>共鳴 ${Number(stone.resonanceLevel||0)}</span>
            </div>
          </div>
        ` : ''}

        <div class="time-mark-code">${token()}</div>
        <p class="time-mark-note">時印是你的旅程憑證，不需要背下來；有需要時再複製保存即可。</p>

        <div class="time-mark-actions">
          ${forged
            ? `<a class="time-mark-btn primary" href="${rootPrefix()}timemark/index.html?r=${encodeURIComponent(relay)}">進入時印幻境</a>
               <button class="time-mark-btn" type="button" data-forge-open>調整石片色彩</button>`
            : `<button class="time-mark-btn primary" type="button" data-forge-open>時空鑄印專屬石片</button>`}
          <button class="time-mark-btn" type="button" data-copy-time>複製時印</button>
          <a class="time-mark-btn" href="${rootPrefix()}journey/index.html">查看目前旅程</a>
        </div>

        <div class="time-mark-secondary">
          <button class="time-mark-link-btn" type="button" data-restore-open>取回其他時印</button>
        </div>

        <div class="time-mark-actions">
          <button class="time-mark-btn" type="button" data-time-close>關閉</button>
        </div>
      `);
      o.querySelector('[data-copy-time]').onclick=copyToken;
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

  function hasSeenFirstGuide(){
    return localStorage.getItem(FIRST_GUIDE_KEY)==='1';
  }

  function markFirstGuideSeen(){
    localStorage.setItem(FIRST_GUIDE_KEY,'1');
  }

  function showTimeMarkEntryCoach(){
    if(localStorage.getItem(ENTRY_COACH_KEY)==='1') return;
    const btn=document.querySelector('[data-time-mark]');
    if(!btn) return;

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
    requestAnimationFrame(()=>coach.classList.add('is-visible'));

    const close=()=>{
      localStorage.setItem(ENTRY_COACH_KEY,'1');
      btn.classList.remove('is-coach-highlight');
      coach.classList.remove('is-visible');
      setTimeout(()=>coach.remove(),220);
    };
    coach.querySelector('[data-entry-coach-close]').onclick=close;
    setTimeout(close,9000);
  }

  function showFirstTimeGuide(){
    if(hasSeenFirstGuide()) return;
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
      const data=await load(true);
      if(!data?.player?.lastStoryId) return;
      const show=()=>showResumePrompt(data,false);
      if(document.body.classList.contains('pre-entry')){
        const ob=new MutationObserver(()=>{if(!document.body.classList.contains('pre-entry')){ob.disconnect();setTimeout(show,350)}});
        ob.observe(document.body,{attributes:true,attributeFilter:['class']});
      }else setTimeout(show,500);
    }catch(_){ }
  }

  async function refreshTimeMarkEntryState(){
    try{
      const data=await load(true);
      const forged=!!data?.stone?.forged;
      document.querySelectorAll('[data-time-mark]').forEach(btn=>{
        const label=btn.querySelector('.time-mark-orb-label');
        if(label) label.textContent=forged?'時印':'留下時印';
        btn.setAttribute('aria-label',forged?'開啟時印':'留下我的時印');
        btn.classList.toggle('is-unforged',!forged);
      });
    }catch(_){}
  }

  async function init(){
    bindButtons();
    await ensure();
    await refreshTimeMarkEntryState();
    maybePromptReturning();

    if(document.body.classList.contains('home-page')){
      const showGuide=()=>{
        if(!hasSeenFirstGuide()) setTimeout(showFirstTimeGuide,700);
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
  return {token, ensure, load, restore, forgeShard, completeStory, touchPosition, openManager, openForge, openRestoreDialog, showResumePrompt, showRestoreSuccess, playTimeRiftTransition, copyToken, downloadTimeMarkCard, shardPalette, applyShardPalette, serialLabel, shardPreviewMarkup, stoneAssetUrl, normalizeHexColor};
})();
