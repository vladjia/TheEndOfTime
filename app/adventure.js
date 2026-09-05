
window.EndOfTimeAdventure = (() => {
  const STORAGE_KEY = 'theEndOfTime.timeMark';
  const SESSION_PROMPT_KEY = 'theEndOfTime.timeMark.prompted';
  let configCache = null;
  let progressCache = null;
  let ensurePromise = null;
  let timeMarkBusy = false;
  let criticalAction = '';
  let criticalTimer = null;

  function rootPrefix(){
    return location.pathname.includes('/story/') || location.pathname.includes('/characters/') || location.pathname.includes('/world/') || location.pathname.includes('/journey/') ? '../' : '';
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
  function setToken(value){ localStorage.setItem(STORAGE_KEY, String(value || '').trim().toUpperCase()); }
  function clearToken(){ localStorage.removeItem(STORAGE_KEY); progressCache = null; }

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
    const t = token();
    if(!t) return;
    const canvas=document.createElement('canvas');
    canvas.width=1200;canvas.height=630;
    const ctx=canvas.getContext('2d');
    const g=ctx.createLinearGradient(0,0,1200,630);
    g.addColorStop(0,'#090b0f');g.addColorStop(1,'#18080c');
    ctx.fillStyle=g;ctx.fillRect(0,0,1200,630);
    ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=2;ctx.strokeRect(52,52,1096,526);
    ctx.fillStyle='rgba(255,255,255,.62)';ctx.font='28px sans-serif';ctx.fillText('THE END OF TIME',86,120);
    ctx.fillStyle='#f1f2f4';ctx.font='64px serif';ctx.fillText('時印',86,218);
    ctx.fillStyle='rgba(255,255,255,.58)';ctx.font='28px sans-serif';ctx.fillText('你的旅程已被記錄。',86,284);
    ctx.fillStyle='#ffffff';ctx.font='bold 38px monospace';ctx.fillText(t,86,390);
    ctx.fillStyle='rgba(255,255,255,.42)';ctx.font='22px sans-serif';ctx.fillText('在其他裝置選擇「取回時印」，即可回到你的旅程。',86,470);
    const a=document.createElement('a');a.download=`時盡_時印_${t}.png`;a.href=canvas.toDataURL('image/png');a.click();
    toast('時印卡已儲存。');
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

  async function openManager(){
    if(timeMarkBusy || isCritical()) return;
    timeMarkBusy = true;
    beginCritical('time-mark-open',10000);
    setTimeMarkButtonsBusy(true);
    showTimeMarkLoading('正在讀取時印……');

    try{
      const {token:t}=await ensure();
      const o=overlay(`
        <div class="time-mark-kicker">TIME MARK</div>
        <h2>你的時印</h2>
        <p>你的旅程會自動保存在這台裝置。若要換手機或電腦，請先保存這枚時印。</p>
        <div class="time-mark-code">${t}</div>
        <p class="time-mark-note">不需要背下來。保存一份即可。</p>
        <div class="time-mark-device-state">
          <span class="time-mark-device-dot" aria-hidden="true"></span>
          <div>
            <strong>此裝置已記住這枚時印</strong>
            <span>你的旅程會在這台裝置上自動延續。</span>
          </div>
        </div>
        <div class="time-mark-actions">
          <button class="time-mark-btn primary" type="button" data-copy-time>複製時印</button>
          <a class="time-mark-btn" href="${rootPrefix()}journey/index.html">查看目前旅程</a>
        </div>
        <div class="time-mark-field">
          <label for="restoreTimeMark">切換到另一枚時印</label>
          <input id="restoreTimeMark" autocomplete="off" placeholder="TET-XXXX-XXXX-XXXX-XXXX">
        </div>
        <p class="time-mark-status" id="restoreTimeMarkStatus"></p>
        <div class="time-mark-actions"><button class="time-mark-btn" type="button" data-restore-time>取回時印</button><button class="time-mark-btn" type="button" data-time-close>關閉</button></div>
      `);

      o.querySelector('[data-copy-time]').onclick=copyToken;
      o.querySelector('[data-restore-time]').onclick=async()=>{
        const field=o.querySelector('#restoreTimeMark');
        const status=o.querySelector('#restoreTimeMarkStatus');
        const restoreBtn=o.querySelector('[data-restore-time]');
        if(restoreBtn.disabled || isCritical()) return;

        const wanted = String(field.value || '').trim().toUpperCase();
        if(wanted && wanted === token()){
          status.textContent='這枚時印已經在這台裝置上使用中。';
          field.select();
          return;
        }

        if(!/^TET-[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/.test(wanted)){
          status.textContent='這枚時印的格式不正確。';
          field.focus();
          return;
        }

        const current = token();
        if(current && current !== wanted){
          const ok = confirm('取回另一枚時印後，這台裝置會切換到另一段旅程。\n\n目前的時印不會被刪除，只是不再作為這台裝置的目前旅程。\n\n確定要取回嗎？');
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
          restoreBtn.setAttribute('aria-busy','false');
          restoreBtn.textContent='取回時印';
          field.disabled=false;
          field.focus();
        }
      };
    }catch(err){
      closeOverlay();
      toast(err?.message || '時印讀取失敗，請稍後再試。');
    }finally{
      timeMarkBusy = false;
      setTimeMarkButtonsBusy(false);
      endCritical();
    }
  }

  function playTimeRiftTransition({mode='restore', onDone}={}){
    if(isCritical()) return null;
    beginCritical(`time-rift-${mode}`,7000);
    const copy = mode==='resume'
      ? {kicker:'TIME RIFT', title:'正在回到時間裂縫……', text:'時間正在重新接合。'}
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

  async function init(){
    bindButtons();
    await ensure();
    maybePromptReturning();
  }

  document.addEventListener('DOMContentLoaded',init);
  return {token, ensure, load, restore, completeStory, touchPosition, openManager, showResumePrompt, showRestoreSuccess, playTimeRiftTransition, copyToken, downloadTimeMarkCard};
})();
