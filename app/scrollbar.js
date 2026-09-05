(() => {
  if(!matchMedia('(pointer:fine)').matches) return;

  let rail = null;
  let thumb = null;
  let dragging = false;
  let dragStartY = 0;
  let dragStartScroll = 0;

  function topbarHeight(){
    const bar = document.querySelector('.topbar-v3');
    return bar ? Math.ceil(bar.getBoundingClientRect().height) : 0;
  }

  function metrics(){
    const doc = document.documentElement;
    const viewport = innerHeight;
    const maxScroll = Math.max(0, doc.scrollHeight - viewport);
    const top = topbarHeight() + 8;
    const bottom = 8;
    const railHeight = Math.max(80, viewport - top - bottom);
    const ratio = viewport / Math.max(doc.scrollHeight, viewport);
    const thumbHeight = Math.max(54, Math.round(railHeight * ratio));
    const travel = Math.max(0, railHeight - thumbHeight);
    return { maxScroll, top, railHeight, thumbHeight, travel };
  }

  function ensure(){
    if(rail) return;

    rail = document.createElement('div');
    rail.className = 'time-scrollbar';
    rail.setAttribute('aria-hidden','true');

    thumb = document.createElement('div');
    thumb.className = 'time-scrollbar-thumb';

    rail.appendChild(thumb);
    document.body.appendChild(rail);

    thumb.addEventListener('pointerdown', e=>{
      dragging = true;
      dragStartY = e.clientY;
      dragStartScroll = scrollY;
      thumb.setPointerCapture?.(e.pointerId);
      document.body.classList.add('scrollbar-dragging');
      e.preventDefault();
    });

    thumb.addEventListener('pointermove', e=>{
      if(!dragging) return;
      const m = metrics();
      if(!m.travel || !m.maxScroll) return;

      const dy = e.clientY - dragStartY;
      const deltaScroll = dy / m.travel * m.maxScroll;
      scrollTo(0, dragStartScroll + deltaScroll);
    });

    const stop = e=>{
      if(!dragging) return;
      dragging = false;
      thumb.releasePointerCapture?.(e.pointerId);
      document.body.classList.remove('scrollbar-dragging');
    };

    thumb.addEventListener('pointerup', stop);
    thumb.addEventListener('pointercancel', stop);

    rail.addEventListener('pointerdown', e=>{
      if(e.target === thumb) return;
      const m = metrics();
      if(!m.maxScroll) return;

      const rect = rail.getBoundingClientRect();
      const y = e.clientY - rect.top - m.thumbHeight / 2;
      const pct = Math.min(1, Math.max(0, y / Math.max(1,m.travel)));
      scrollTo({top:pct * m.maxScroll, behavior:'smooth'});
    });
  }

  function update(){
    ensure();
    const m = metrics();

    rail.style.top = `${m.top}px`;
    rail.style.height = `${m.railHeight}px`;

    if(!m.maxScroll){
      rail.hidden = true;
      return;
    }

    rail.hidden = false;
    thumb.style.height = `${m.thumbHeight}px`;

    const pct = Math.min(1, Math.max(0, scrollY / m.maxScroll));
    thumb.style.transform = `translateY(${Math.round(m.travel * pct)}px)`;
  }

  addEventListener('scroll', update, {passive:true});
  addEventListener('resize', update);
  new ResizeObserver(update).observe(document.documentElement);

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', update, {once:true});
  }else{
    update();
  }
})();