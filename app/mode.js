window.EndOfTimeMode = (() => {
  const KEY = 'theEndOfTime.contentMode';

  function current(){
    return localStorage.getItem(KEY) === 'full' ? 'full' : 'public';
  }

  function set(mode){
    localStorage.setItem(KEY, mode === 'full' ? 'full' : 'public');
    document.documentElement.dataset.contentMode = current();
  }

  function copyText(copy,key,fallback=''){
    const item = copy?.[key];
    if(item == null) return fallback;
    if(typeof item === 'string') return item || fallback;
    return item.text || fallback;
  }

  function buildModal(copy){
    let modal = document.getElementById('spoilerModeModal');
    if(modal) return modal;

    modal = document.createElement('div');
    modal.id = 'spoilerModeModal';
    modal.className = 'spoiler-modal';
    modal.hidden = true;

    modal.innerHTML = `
      <div class="spoiler-dialog" role="dialog" aria-modal="true" aria-labelledby="spoilerTitle">
        <div class="spoiler-dialog-mark">!</div>
        <small>FULL ARCHIVE</small>
        <h2 id="spoilerTitle">${copyText(copy,'site.mode.confirm.title','開啟完整設定？')}</h2>
        <p>${copyText(copy,'site.mode.confirm.desc','將顯示人物死亡、完整身世、世界核心真相與劇情內容。')}</p>
        <div class="spoiler-dialog-actions">
          <button type="button" class="btn" data-spoiler-cancel>${copyText(copy,'site.mode.confirm.keep','保持無雷')}</button>
          <button type="button" class="btn primary" data-spoiler-confirm>${copyText(copy,'site.mode.confirm.open','開啟有雷內容')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', e=>{
      if(e.target === modal || e.target.closest('[data-spoiler-cancel]')){
        closeModal();
      }
      if(e.target.closest('[data-spoiler-confirm]')){
        set('full');
        closeModal();
        location.reload();
      }
    });

    document.addEventListener('keydown', e=>{
      if(e.key === 'Escape' && !modal.hidden) closeModal();
    });

    return modal;
  }

  function openModal(copy){
    const modal = buildModal(copy);
    modal.hidden = false;
    requestAnimationFrame(()=>modal.classList.add('is-open'));
    document.body.classList.add('modal-open');
  }

  function closeModal(){
    const modal = document.getElementById('spoilerModeModal');
    if(!modal) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    setTimeout(()=>{ modal.hidden = true; }, 180);
  }

  function bind(copy){
    document.documentElement.dataset.contentMode = current();

    document.querySelectorAll('[data-mode-toggle]').forEach(button=>{
      const refresh = () => {
        const mode = current();
        button.dataset.mode = mode;
        button.textContent = mode === 'full'
          ? copyText(copy,'site.mode.full','完整・有雷')
          : copyText(copy,'site.mode.public','公開・無雷');
        button.setAttribute('aria-label',
          mode === 'full'
            ? copyText(copy,'site.mode.full.disable','切回無雷')
            : copyText(copy,'site.mode.confirm.title','開啟完整設定？')
        );
      };

      refresh();

      button.addEventListener('click', ()=>{
        if(current() === 'full'){
          set('public');
          location.reload();
          return;
        }
        openModal(copy);
      });
    });
  }

  return { current, set, bind, copyText };
})();