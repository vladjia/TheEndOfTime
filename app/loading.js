window.SiteLoading = (() => {
  let closed = false;
  let failSafeTimer = null;
  let frameTimer = null;
  let frameIndex = 0;
  const FRAME_COUNT = 8;
  const FRAME_MS = 105;

  function getEl(){
    return document.getElementById('siteLoading');
  }

  function framePath(base,index){
    return `${base}loading-${String(index).padStart(2,'0')}.png`;
  }

  function startFrames(){
    const img = document.querySelector('#siteLoading .loading-frame-image');
    if(!img) return;

    const base = img.dataset.loadingBase || 'assets/images/loading/';

    // 先預載全部 8 幀，避免切換時閃黑。
    for(let i=1;i<=FRAME_COUNT;i++){
      const preload = new Image();
      preload.src = framePath(base,i);
    }

    frameIndex = 1;

    frameTimer = setInterval(()=>{
      if(closed){
        clearInterval(frameTimer);
        frameTimer = null;
        return;
      }
      frameIndex = (frameIndex % FRAME_COUNT) + 1;
      img.src = framePath(base,frameIndex);
    }, FRAME_MS);
  }

  function hide(){
    if(closed) return;
    closed = true;

    if(frameTimer){
      clearInterval(frameTimer);
      frameTimer = null;
    }

    if(failSafeTimer){
      clearTimeout(failSafeTimer);
      failSafeTimer = null;
    }

    const el = getEl();
    if(!el) return;

    el.setAttribute('aria-busy','false');
    el.classList.add('is-leaving');

    setTimeout(()=>{
      el.remove();
    }, 220);
  }

  function setText(text){
    const target = document.querySelector('#siteLoading .site-loading-text');
    if(target && text) target.textContent = text;
  }

  function failSafe(ms = 12000){
    if(failSafeTimer) clearTimeout(failSafeTimer);
    failSafeTimer = setTimeout(()=>{
      console.warn('《時盡》Loading fail-safe：資料等待逾時，自動關閉 Loading。');
      hide();
    }, ms);
  }

  function init(){
    startFrames();
    failSafe();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded',init,{once:true});
  }else{
    init();
  }

  window.addEventListener('pageshow', ()=>{
    if(document.readyState === 'complete' && !getEl()) closed = true;
  });

  return { hide, setText, failSafe };
})();