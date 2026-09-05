window.SiteLoading = (() => {
  let closed = false;
  let failSafeTimer = null;

  function getEl(){
    return document.getElementById('siteLoading');
  }

  function hide(){
    if(closed) return;
    closed = true;

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
    }, 420);
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

  // 即使頁面初始化腳本意外失敗，也不允許 Loading 永久卡住。
  failSafe();

  window.addEventListener('pageshow', ()=>{
    if(document.readyState === 'complete' && !getEl()) closed = true;
  });

  return { hide, setText, failSafe };
})();