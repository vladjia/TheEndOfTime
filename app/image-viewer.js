window.EndOfTimeImageViewer = (() => {
  let overlay = null;
  let stage = null;
  let image = null;
  let caption = null;
  let zoomLabel = null;
  let scale = 1;
  let tx = 0;
  let ty = 0;
  let dragging = false;
  let dragStart = null;
  const pointers = new Map();
  let pinchStartDistance = 0;
  let pinchStartScale = 1;

  const MIN_SCALE = 0.35;
  const MAX_SCALE = 8;

  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));

  function eligible(img){
    if(!(img instanceof HTMLImageElement)) return false;
    if(img.closest('.site-loading,.brand-v3,.welcome-gate')) return false;
    if(img.classList.contains('loading-frame-image') || img.classList.contains('brand-logo')) return false;
    if(img.dataset.viewer === 'false') return false;
    return Boolean(
      img.dataset.viewer === 'true' ||
      img.closest('main')
    );
  }

  function build(){
    if(overlay) return;

    overlay = document.createElement('div');
    overlay.className = 'image-viewer';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','圖片鑑賞');

    overlay.innerHTML = `
      <button class="image-viewer-close" type="button" aria-label="關閉圖片">×</button>
      <div class="image-viewer-stage">
        <img class="image-viewer-image" alt="">
      </div>
      <div class="image-viewer-footer">
        <div class="image-viewer-caption"></div>
        <div class="image-viewer-zoom" aria-live="polite">100%</div>
      </div>
    `;

    document.body.appendChild(overlay);

    stage = overlay.querySelector('.image-viewer-stage');
    image = overlay.querySelector('.image-viewer-image');
    caption = overlay.querySelector('.image-viewer-caption');
    zoomLabel = overlay.querySelector('.image-viewer-zoom');

    overlay.querySelector('.image-viewer-close').addEventListener('click', close);
    overlay.addEventListener('click', e=>{
      if(e.target === overlay) close();
    });

    stage.addEventListener('wheel', onWheel, {passive:false});
    stage.addEventListener('dblclick', onDoubleClick);

    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);

    document.addEventListener('keydown', e=>{
      if(!overlay?.classList.contains('is-open')) return;
      if(e.key === 'Escape') close();
      if(e.key === '+' || e.key === '=') setScale(scale * 1.2);
      if(e.key === '-') setScale(scale / 1.2);
      if(e.key === '0') reset();
    });
  }

  function labelFor(img){
    return img.dataset.viewerLabel ||
      img.alt ||
      img.closest('figure')?.querySelector('figcaption')?.textContent?.trim() ||
      '圖片鑑賞';
  }

  function open(img){
    if(!eligible(img)) return;

    build();

    scale = 1;
    tx = 0;
    ty = 0;
    pointers.clear();

    image.src = img.currentSrc || img.src;
    image.alt = img.alt || '';
    caption.textContent = labelFor(img);

    document.body.classList.add('image-viewer-open');
    overlay.classList.add('is-open');
    updateTransform();
    requestAnimationFrame(()=>overlay.classList.add('is-ready'));
  }

  function close(){
    if(!overlay) return;

    overlay.classList.remove('is-ready','is-open');
    document.body.classList.remove('image-viewer-open');
    pointers.clear();
    dragging = false;

    setTimeout(()=>{
      if(!overlay?.classList.contains('is-open')){
        image.removeAttribute('src');
      }
    },180);
  }

  function reset(){
    scale = 1;
    tx = 0;
    ty = 0;
    updateTransform();
  }

  function setScale(next, clientX=null, clientY=null){
    const old = scale;
    const clamped = clamp(next,MIN_SCALE,MAX_SCALE);
    if(clamped === old) return;

    if(clientX != null && clientY != null && stage){
      const rect = stage.getBoundingClientRect();
      const px = clientX - (rect.left + rect.width/2);
      const py = clientY - (rect.top + rect.height/2);
      const ratio = clamped / old;

      tx = px - (px - tx) * ratio;
      ty = py - (py - ty) * ratio;
    }

    scale = clamped;
    if(scale <= 1){
      tx *= scale;
      ty *= scale;
    }
    updateTransform();
  }

  function updateTransform(){
    if(!image) return;
    image.style.transform = `translate3d(${tx}px,${ty}px,0) scale(${scale})`;
    if(zoomLabel) zoomLabel.textContent = `${Math.round(scale*100)}%`;
  }

  function onWheel(e){
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.13 : 0.885;
    setScale(scale * factor,e.clientX,e.clientY);
  }

  function onDoubleClick(e){
    e.preventDefault();
    if(scale > 1.05){
      reset();
    }else{
      setScale(2.2,e.clientX,e.clientY);
    }
  }

  function distance(a,b){
    return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
  }

  function onPointerDown(e){
    if(!overlay?.classList.contains('is-open')) return;
    stage.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId,e);

    if(pointers.size === 1){
      dragging = true;
      dragStart = {x:e.clientX,y:e.clientY,tx,ty};
      stage.classList.add('is-dragging');
    }else if(pointers.size === 2){
      const pts = [...pointers.values()];
      pinchStartDistance = distance(pts[0],pts[1]);
      pinchStartScale = scale;
      dragging = false;
      stage.classList.remove('is-dragging');
    }
  }

  function onPointerMove(e){
    if(!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId,e);

    if(pointers.size === 2){
      const pts = [...pointers.values()];
      const d = distance(pts[0],pts[1]);
      if(pinchStartDistance > 0){
        setScale(pinchStartScale * (d / pinchStartDistance));
      }
      return;
    }

    if(dragging && dragStart && pointers.size === 1){
      tx = dragStart.tx + (e.clientX - dragStart.x);
      ty = dragStart.ty + (e.clientY - dragStart.y);
      updateTransform();
    }
  }

  function onPointerUp(e){
    pointers.delete(e.pointerId);

    if(pointers.size < 2){
      pinchStartDistance = 0;
      pinchStartScale = scale;
    }

    if(pointers.size === 0){
      dragging = false;
      dragStart = null;
      stage.classList.remove('is-dragging');
    }else if(pointers.size === 1){
      const p = [...pointers.values()][0];
      dragging = true;
      dragStart = {x:p.clientX,y:p.clientY,tx,ty};
      stage.classList.add('is-dragging');
    }
  }

  function init(){
    build();

    document.addEventListener('click', e=>{
      const img = e.target.closest?.('img');
      if(!eligible(img)) return;
      if(e.defaultPrevented) return;

      e.preventDefault();
      e.stopPropagation();
      open(img);
    }, true);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded',init,{once:true});
  }else{
    init();
  }

  return { open, close, reset };
})();