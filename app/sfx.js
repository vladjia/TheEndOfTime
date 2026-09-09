// 《時盡》介面音效
//
// 用 Web Audio，不用 <audio>。原因有兩個：
//   1. 延遲。<audio> 的 play() 有數十毫秒的不確定延遲，點擊音效慢了就會覺得介面鈍。
//      AudioBufferSourceNode 是排程到取樣點的，準。
//   2. 重疊。同一顆音效連續觸發時 <audio> 會互相打斷，Web Audio 各自獨立。
//
// 瀏覽器規定使用者互動之前不准出聲，所以 AudioContext 是第一次點擊才建立的。
// 這套介面全部靠點擊驅動，所以不會有「第一聲被吃掉」的問題。

window.TimeSfx = (() => {
  'use strict';

  // 路徑從 sfx.js 自己的位置推算：app/sfx.js → 上一層 → assets/audio/
  // 用相對路徑的話，dev/ 底下的頁面會去找 dev/assets/，找不到。
  const BASE = (() => {
    try{
      const me = document.currentScript && document.currentScript.src;
      if(me) return new URL('../assets/audio/', me).href;
    }catch(_){}
    return 'assets/audio/';
  })();
  const FILES = {
    tick:     ['01-tick'],
    rotate:   ['02-rotate'],
    settle:   ['03-settle'],
    strike:   ['04-strike-a', '04-strike-b'],   // 兩種力道，隨機交替
    complete: ['05-complete'],
    reject:   ['06-reject'],
    hover:    ['07-hover']
  };

  const MUTE_KEY = 'theEndOfTime.sfx.muted';
  const DEFAULT_ON = true;      // 想預設靜音就改成 false

  // 可調參數。dev/jiazi-dial.html 的調校台會即時改這裡，
  // 調定之後把數字寫回這個物件就是最終設定。
  const CONFIG = {
    master:      1.00,   // 總音量
    tickGain:    1.00,   // 喀噠聲音量
    tickMinGap:  0,      // 兩聲喀噠之間至少幾毫秒；0 = 每一格都響
    bedGain:     1.00    // 滑行床音音量；0 = 不播
  };

  let ctx = null;
  let master = null;
  const buffers = {};           // name -> [AudioBuffer]
  let loading = null;
  let muted = readMuted();
  let rotateNode = null;

  function readMuted(){
    try{
      const v = localStorage.getItem(MUTE_KEY);
      return v === null ? !DEFAULT_ON : v === '1';
    }catch(_){ return !DEFAULT_ON; }
  }
  function writeMuted(v){
    try{ localStorage.setItem(MUTE_KEY, v ? '1' : '0'); }catch(_){}
  }

  // webm/opus 檔案小得多，但 Safari 支援度不穩，所以留 mp3 後備。
  function ext(){
    try{
      const a = document.createElement('audio');
      if(a.canPlayType('audio/webm; codecs="opus"')) return '.webm';
    }catch(_){}
    return '.mp3';
  }

  function ensureCtx(){
    if(ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : CONFIG.master;
    master.connect(ctx.destination);
    return ctx;
  }

  async function load(){
    if(loading) return loading;
    const c = ensureCtx();
    if(!c) return null;
    const e = ext();
    loading = (async () => {
      await Promise.all(Object.entries(FILES).map(async ([name, list]) => {
        buffers[name] = await Promise.all(list.map(async f => {
          try{
            const r = await fetch(BASE + f + e);
            if(!r.ok) throw new Error(f + ' ' + r.status);
            return await c.decodeAudioData(await r.arrayBuffer());
          }catch(err){
            console.warn('音效載入失敗：' + f, err);
            return null;
          }
        }));
      }));
    })();
    return loading;
  }

  function src(name, {gain = 1, detune = 0, when = 0} = {}){
    const c = ensureCtx();
    if(!c || muted) return null;
    const list = buffers[name];
    if(!list || !list.length) return null;
    const buf = list.length === 1 ? list[0] : list[(Math.random() * list.length) | 0];
    if(!buf) return null;

    const s = c.createBufferSource();
    s.buffer = buf;
    if(detune && s.detune) s.detune.value = detune;
    const g = c.createGain();
    g.gain.value = gain;
    s.connect(g).connect(master);
    s.start(when || c.currentTime);
    return {source:s, gain:g};
  }

  // 定位聲會連續播很多次。每次隨機微調音高，
  // 才不會聽出來是同一個檔案在重播 —— 這比準備三個變體更自然。
  function tick(when, gain){
    return src('tick', {
      when,
      gain: gain == null ? 1 : gain,
      detune: (Math.random() * 2 - 1) * 70     // ±70 cents
    });
  }

  // ── 沿著緩動曲線排定位聲 ──────────────────────────
  // 盤用 cubic-bezier 轉動，所以「經過第 k 格」的時間點不是平均分佈的。
  // 開頭快、結尾慢，喀噠聲也必須跟著疏密變化，否則會像節拍器。
  function bezier(x1, y1, x2, y2){
    const A = (a, b) => 1 - 3*b + 3*a;
    const B = (a, b) => 3*b - 6*a;
    const C = a => 3*a;
    const calc = (t, a, b) => ((A(a,b)*t + B(a,b))*t + C(a))*t;
    // 給定輸出 y，回推需要的時間 x
    return (y) => {
      let lo = 0, hi = 1, t = y;
      for(let i = 0; i < 24; i++){
        const v = calc(t, y1, y2);
        if(Math.abs(v - y) < 1e-4) break;
        if(v < y) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return calc(t, x1, x2);
    };
  }
  const EASE = bezier(0.16, 0.9, 0.24, 1);

  function ticksAlong(steps, durationMs){
    const c = ensureCtx();
    if(!c || muted || !steps || CONFIG.tickGain <= 0) return;
    const n = Math.min(Math.abs(steps), 60);
    const t0 = c.currentTime;
    const gap = Math.max(0, CONFIG.tickMinGap) / 1000;
    let last = -1;
    for(let k = 1; k <= n; k++){
      const at = EASE(k / n) * durationMs / 1000;
      // 緩動曲線開頭很快，前幾格會擠在幾十毫秒內糊成一片。
      // 間隔不夠就跳過這一聲 —— 最後一聲一定要留，那是「到位」。
      if(gap > 0 && last >= 0 && (at - last) < gap && k !== n) continue;
      last = at;
      tick(t0 + at, (0.55 + 0.45 * (1 - k / n)) * CONFIG.tickGain);
    }
  }

  // ── 滑行床音：跟著旋轉長度淡入淡出 ────────────────
  function startRotate(){
    const c = ensureCtx();
    if(!c || muted || CONFIG.bedGain <= 0) return;
    stopRotate(0.05);
    const list = buffers.rotate;
    if(!list || !list[0]) return;
    const s = c.createBufferSource();
    s.buffer = list[0];
    s.loop = true;
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(CONFIG.bedGain, c.currentTime + 0.09);
    s.connect(g).connect(master);
    s.start();
    rotateNode = {source:s, gain:g};
  }
  function stopRotate(fade = 0.18){
    if(!rotateNode || !ctx) return;
    const {source, gain} = rotateNode;
    rotateNode = null;
    const t = ctx.currentTime;
    try{
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + fade);
      source.stop(t + fade + 0.02);
    }catch(_){}
  }

  // ── 對外 ──────────────────────────────────────────
  const api = {
    load,
    play: (name, opt) => src(name, opt),
    tick,
    ticksAlong,
    startRotate,
    stopRotate,
    strike:   () => src('strike'),
    settle:   () => src('settle'),
    complete: () => src('complete'),
    reject:   () => src('reject'),
    hover:    () => src('hover', {gain:1}),
    get config(){ return Object.assign({}, CONFIG); },
    tune(patch){
      Object.assign(CONFIG, patch || {});
      if(master && ctx && !muted){
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.linearRampToValueAtTime(CONFIG.master, ctx.currentTime + 0.05);
      }
      return api.config;
    },
    get muted(){ return muted; },
    setMuted(v){
      muted = !!v;
      writeMuted(muted);
      if(master && ctx){
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.linearRampToValueAtTime(muted ? 0 : CONFIG.master, ctx.currentTime + 0.08);
      }
      if(muted) stopRotate(0.08);
    },
    toggle(){ api.setMuted(!muted); return muted; }
  };

  // 第一次互動才建立 AudioContext 並開始載入。
  // 之前就建立的話會被瀏覽器擋成 suspended，然後第一聲永遠不會響。
  const wake = () => {
    load();
    if(ctx && ctx.state === 'suspended') ctx.resume();
  };
  ['pointerdown','keydown','touchstart'].forEach(ev =>
    document.addEventListener(ev, wake, {once:false, passive:true}));

  return api;
})();
