window.SiteLoading = (() => {
  let hidden = false;

  function hide(){
    if(hidden) return;
    hidden = true;

    const el = document.getElementById('siteLoading');
    if(!el) return;

    el.classList.add('is-leaving');
    setTimeout(()=>el.remove(), 360);
  }

  function setText(text){
    const el = document.querySelector('#siteLoading .site-loading-text');
    if(el && text) el.textContent = text;
  }

  return { hide, setText };
})();