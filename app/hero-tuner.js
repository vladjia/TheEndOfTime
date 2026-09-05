(() => {
  const STORAGE_KEY = 'theEndOfTime.heroTuner.v1';

  const defaults = {
    x: 52,
    y: 8,
    height: 520,
    scale: 1
  };

  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));

  function load(){
    try{
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        x: clamp(Number(saved.x ?? defaults.x),0,100),
        y: clamp(Number(saved.y ?? defaults.y),0,100),
        height: clamp(Number(saved.height ?? defaults.height),320,760),
        scale: clamp(Number(saved.scale ?? defaults.scale),0.75,1.35)
      };
    }catch{
      return {...defaults};
    }
  }

  function save(state){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function apply(state){
    const root = document.documentElement;
    root.style.setProperty('--home-hero-x', `${state.x}%`);
    root.style.setProperty('--home-hero-y', `${state.y}%`);
    root.style.setProperty('--home-hero-height', `${state.height}px`);
    root.style.setProperty('--home-hero-scale', state.scale);
  }

  function cssText(state){
    return `--home-hero-x: ${state.x}%;
--home-hero-y: ${state.y}%;
--home-hero-height: ${state.height}px;
--home-hero-scale: ${state.scale};`;
  }

  function init(){
    if(!document.querySelector('.hero.hero-cover')) return;

    let state = load();
    apply(state);

    const panel = document.createElement('aside');
    panel.className = 'hero-tuner';
    panel.innerHTML = `
      <div class="hero-tuner-head">
        <div class="hero-tuner-title">首頁圖定位器</div>
        <button type="button" class="hero-tuner-toggle" aria-label="收合定位器">－</button>
      </div>

      <div class="hero-tuner-body">
        <div class="hero-tuner-row">
          <label for="heroTuneX">左右 X</label>
          <input id="heroTuneX" type="range" min="0" max="100" step="1">
          <div class="hero-tuner-value" data-value="x"></div>
        </div>

        <div class="hero-tuner-row">
          <label for="heroTuneY">上下 Y</label>
          <input id="heroTuneY" type="range" min="0" max="100" step="1">
          <div class="hero-tuner-value" data-value="y"></div>
        </div>

        <div class="hero-tuner-row">
          <label for="heroTuneH">高度</label>
          <input id="heroTuneH" type="range" min="320" max="760" step="10">
          <div class="hero-tuner-value" data-value="height"></div>
        </div>

        <div class="hero-tuner-row">
          <label for="heroTuneS">縮放</label>
          <input id="heroTuneS" type="range" min="0.75" max="1.35" step="0.01">
          <div class="hero-tuner-value" data-value="scale"></div>
        </div>

        <pre class="hero-tuner-code"></pre>

        <div class="hero-tuner-actions">
          <button type="button" data-action="reset">重設</button>
          <button type="button" data-action="save">記住位置</button>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    const x = panel.querySelector('#heroTuneX');
    const y = panel.querySelector('#heroTuneY');
    const h = panel.querySelector('#heroTuneH');
    const s = panel.querySelector('#heroTuneS');
    const code = panel.querySelector('.hero-tuner-code');

    function syncControls(){
      x.value = state.x;
      y.value = state.y;
      h.value = state.height;
      s.value = state.scale;

      panel.querySelector('[data-value="x"]').textContent = `${state.x}%`;
      panel.querySelector('[data-value="y"]').textContent = `${state.y}%`;
      panel.querySelector('[data-value="height"]').textContent = `${state.height}px`;
      panel.querySelector('[data-value="scale"]').textContent = state.scale.toFixed(2);

      code.textContent = cssText(state);
    }

    function update(){
      state = {
        x: Number(x.value),
        y: Number(y.value),
        height: Number(h.value),
        scale: Number(s.value)
      };
      apply(state);
      syncControls();
    }

    [x,y,h,s].forEach(input => input.addEventListener('input', update));

    panel.querySelector('[data-action="reset"]').addEventListener('click',()=>{
      state = {...defaults};
      localStorage.removeItem(STORAGE_KEY);
      apply(state);
      syncControls();
    });

    panel.querySelector('[data-action="save"]').addEventListener('click',(e)=>{
      save(state);
      const btn = e.currentTarget;
      const old = btn.textContent;
      btn.textContent = '已記住';
      setTimeout(()=>btn.textContent = old,900);
    });

    panel.querySelector('.hero-tuner-toggle').addEventListener('click',(e)=>{
      panel.classList.toggle('is-collapsed');
      e.currentTarget.textContent = panel.classList.contains('is-collapsed') ? '＋' : '－';
    });

    syncControls();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded',init,{once:true});
  }else{
    init();
  }
})();