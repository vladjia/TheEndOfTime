
// 時印幻境
//   無參數        → 個人時印幻境（讀自己的 token）
//   ?r=RIFT-XXXX  → 公開展示頁（讀他人時印，後端不回傳 TOKEN）

document.addEventListener('DOMContentLoaded', async () => {
  const A = window.EndOfTimeAdventure;
  const err = document.getElementById('timemarkError');
  if(!A){ if(err) err.textContent = '時印系統尚未載入。'; return; }

  const relay = String(new URLSearchParams(location.search).get('r') || '').trim().toUpperCase();
  try{
    if(relay) await renderPublic(A, relay);
    else await renderPersonal(A);
  }catch(e){
    if(err) err.textContent = e?.message || '時印幻境暫時無法開啟。';
  }finally{
    try{ window.SiteLoading?.hide?.(); }catch(_){}
  }
});

function paintShard(A, stone){
  const host = document.getElementById('timemarkShardHost');
  if(!host) return;
  const color = stone.color || '#7F1521';
  const box = document.createElement('div');
  box.innerHTML = A.shardPreviewMarkup({
    color,
    serial: A.serialLabel(stone.serial),
    relay: stone.relayCode || '',
    level: stone.resonanceLevel || 0,
    stoneType: stone.stoneType,
    engraveSeed: stone.engraveSeed || '',
    glyphColor: stone.glyphColor || '',
    scar: stone.scar || '',
    scarDone: stone.scarDone ?? ''
  });
  const el = box.firstElementChild;
  A.applyShardPalette(el, color);
  host.replaceChildren(el);
}

function setCounts(story, character, world){
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = String(v); };
  set('tmStory', story);
  set('tmCharacter', character);
  set('tmWorld', world);
}

function forgedDateText(value){
  if(!value) return '';
  const d = new Date(value);
  if(isNaN(d.getTime())) return '';
  return `${d.getFullYear()}／${String(d.getMonth()+1).padStart(2,'0')}／${String(d.getDate()).padStart(2,'0')}`;
}

// ── 個人時印幻境 ────────────────────────────────────────
async function renderPersonal(A){
  const err = document.getElementById('timemarkError');
  await A.ensure();
  const data = await A.load(false);
  const stone = data?.stone || {};

  if(!stone.forged){
    if(err) err.textContent = '這枚時印尚未完成時空鑄印。';
    setTimeout(() => A.openForge(), 250);
    return;
  }

  paintShard(A, stone);
  document.getElementById('timemarkSerial').textContent = A.serialLabel(stone.serial);
  document.getElementById('timemarkResonance').textContent = `第 ${Number(stone.resonanceLevel||0)} 階共鳴`;
  setCounts(
    (data.storyRead||[]).length,
    (data.charactersUnlocked||[]).length,
    (data.worldUnlocked||[]).length
  );

  const last = data?.lastStory;
  document.getElementById('timemarkLast').textContent = last
    ? `上一次，你停在第${last.chapterNumber||''}章${last.chapterTitle?'｜'+last.chapterTitle:''}${last.sectionNumber?'・第'+last.sectionNumber+'節':''}${last.sectionTitle?'｜'+last.sectionTitle:''}`
    : '你的旅程尚未留下第一道可返回的時間裂縫。';

  renderWuxing(A);

  // 只有本人看得到「複製分享連結」
  const actions = document.querySelector('.timemark-actions-main');
  if(actions && stone.relayCode){
    const btn = document.createElement('button');
    btn.className = 'time-mark-btn';
    btn.type = 'button';
    btn.textContent = '複製分享連結';
    btn.onclick = () => A.copyShareUrl(stone.relayCode).catch(() => {});
    actions.appendChild(btn);
  }
}

// ── 公開展示頁 ──────────────────────────────────────────
async function renderPublic(A, relay){
  document.body.classList.add('timemark-public');
  const err = document.getElementById('timemarkError');

  const head = document.querySelector('.timemark-head');
  if(head){
    head.innerHTML = `
      <small>TIME MARK · SHARED</small>
      <h1>一枚時印</h1>
      <p>這是另一個人在《時盡》留下的痕跡。你看得見他走到哪裡，卻走不進他的旅程。</p>`;
  }

  const data = await A.relayLoad(relay);

  if(!data || !data.exists){
    const stage = document.getElementById('timemarkStage');
    if(stage) stage.innerHTML = '<div class="timemark-missing">這枚時印不存在，或尚未完成時空鑄印。</div>';
    const records = document.querySelector('.timemark-records');
    if(records) records.remove();
    swapActionsToCta();
    return;
  }

  const stone = data.stone || {};
  paintShard(A, stone);

  document.getElementById('timemarkSerial').textContent = A.serialLabel(stone.serial);
  document.getElementById('timemarkResonance').textContent = `第 ${Number(stone.resonanceLevel||0)} 階共鳴`;

  const c = data.counts || {};
  setCounts(c.story || 0, c.character || 0, c.world || 0);

  const forged = forgedDateText(stone.forgedAt);
  document.getElementById('timemarkLast').textContent = forged
    ? `鑄印於 ${forged}`
    : '這枚時印已完成時空鑄印。';

  // 統計文字改為第三人稱
  const texts = ['走過的故事', '真正認識的人', '已理解的世界碎片'];
  document.querySelectorAll('.timemark-records article p')
    .forEach((el, i) => { if(texts[i]) el.textContent = texts[i]; });

  swapActionsToCta();
  if(err) err.textContent = '';
}

function swapActionsToCta(){
  const actions = document.querySelector('.timemark-actions-main');
  if(!actions) return;
  actions.innerHTML = `
    <a class="time-mark-btn primary" href="../index.html">留下你自己的時印</a>
    <a class="time-mark-btn" href="../story/index.html">從故事開始</a>`;
}


// ── 時印五行 ────────────────────────────────────────────
// 只出現在個人頁。公開展示頁拿不到 token（後端刻意不回傳），
// 所以那裡本來就算不出來 —— 這個界線是對的，不要繞過去。
function renderWuxing(A){
  const wx = A.tokenWuxing(A.token());
  if(!wx || !wx.native) return;

  const stage = document.querySelector('.timemark-records') || document.getElementById('timemarkStage');
  if(!stage) return;

  const CN = ['〇','一','二','三','四','五','六','七','八'];
  const n = wx.native;

  const box = document.createElement('section');
  box.className = 'timemark-wuxing';
  box.innerHTML = `
    <div class="tw-native">
      <small>本命</small>
      <strong style="color:${n.hex}">${n.gan}${n.zhi}</strong>
      <span>${n.wuxing}・${n.yang ? '陽' : '陰'}</span>
      <p>時印的第一組與你的母石同源——你是那個時辰來的。</p>
    </div>
    <div class="tw-tally">
      <small>時印五行</small>
      <div class="tw-bars">
        ${wx.order.map(w => `
          <i class="${wx.tally[w] ? 'has' : ''}" style="--wx:${wx.hex[w]}">
            <b>${w}</b><em>${CN[wx.tally[w]]}</em>
          </i>`).join('')}
      </div>
      <p>其餘七組是時空給的，不是你選的。</p>
    </div>`;
  stage.insertAdjacentElement('afterend', box);
}
