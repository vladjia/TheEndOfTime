window.EndOfTimeSealEffects = (() => {
  const KNOWN = new Set(['jiashi','baiji','yeshenxing','anyanxiu']);

  function activate(el){
    el.classList.remove('seal-active');
    void el.offsetWidth;
    el.classList.add('seal-active');
  }

  function deactivate(el){
    el.classList.remove('seal-active');
  }

  function ensureButterflies(el, characterId){
    if(characterId !== 'anyanxiu') return;

    const anchor =
      el.querySelector('.archive-character-seal') ||
      el.querySelector('.character-visual-mark');

    if(!anchor || anchor.querySelector('.seal-butterflies')) return;

    const group = document.createElement('span');
    group.className = 'seal-butterflies';
    group.setAttribute('aria-hidden','true');

    const swarm1 = document.createElement('span');
    swarm1.className = 'seal-butterfly-swarm seal-butterfly-swarm-1';

    const swarm2 = document.createElement('span');
    swarm2.className = 'seal-butterfly-swarm seal-butterfly-swarm-2';

    group.appendChild(swarm1);
    group.appendChild(swarm2);
    anchor.appendChild(group);
  }

  function bind(el, characterId){
    if(!el || !KNOWN.has(characterId)) return;

    el.dataset.character = characterId;
    ensureButterflies(el, characterId);

    if(el.dataset.sealBound === '1') return;
    el.dataset.sealBound = '1';

    el.addEventListener('pointerenter',()=>activate(el));
    el.addEventListener('pointerleave',()=>deactivate(el));
    el.addEventListener('focusin',()=>activate(el));
    el.addEventListener('focusout',()=>deactivate(el));
  }

  function bindArchive(root=document){
    root.querySelectorAll('.archive-character[data-character]').forEach(card=>{
      bind(card,card.dataset.character);
    });
  }

  function bindCharacterVisual(root=document,characterId=''){
    const visual = root.querySelector('.character-visual');
    if(visual) bind(visual,characterId);
  }

  return { bind, bindArchive, bindCharacterVisual };
})();