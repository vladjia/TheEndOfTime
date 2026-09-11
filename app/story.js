const $ = s => document.querySelector(s);

async function getJSON(path){
  const r = await fetch(path,{cache:'no-store'});
  if(!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

function copyText(copy,key,fallback=''){
  const item = copy?.[key];
  if(item == null) return fallback;
  if(typeof item === 'string') return item || fallback;
  return item.text || fallback;
}

function applyCopy(copy){
  document.querySelectorAll('[data-copy]').forEach(el=>{
    const key = el.dataset.copy;
    const value = copyText(copy,key,el.textContent);
    if(value) el.textContent = value;
  });
}

function chineseNumber(n){
  const num = Number(n);
  const d = ['零','一','二','三','四','五','六','七','八','九','十'];
  if(!Number.isFinite(num) || num <= 0) return String(n || '');
  if(num <= 10) return d[num];
  if(num < 20) return '十' + d[num - 10];
  if(num < 100){
    const t = Math.floor(num / 10), o = num % 10;
    return d[t] + '十' + (o ? d[o] : '');
  }
  return String(num);
}

function chapterLabel(item){
  return item.chapterNumber ? `第${chineseNumber(item.chapterNumber)}章` : '';
}

function sectionLabel(item){
  return item.sectionNumber ? `第${chineseNumber(item.sectionNumber)}節` : '';
}

function readerHref(item){
  return `read.html?id=${encodeURIComponent(item.id || '')}`;
}

function paragraphs(text){
  return String(text || '')
    .replace(/\r\n/g,'\n')
    .split(/\n\s*\n/)
    .map(x=>x.trim())
    .filter(Boolean);
}


async function adventureProgress(){
  try{
    await window.EndOfTimeAdventure?.ensure?.();
    return await window.EndOfTimeAdventure?.load?.();
  }catch(_){ return null; }
}

function visibleStoryRows(rows, progress){
  const published=rows.filter(item=>item.isReadable);
  if(!progress?.exists) return published.slice(0,1);

  const read = new Set(progress.storyRead || []);
  const next=published.find(item=>!read.has(item.id));
  return published.filter(item=>read.has(item.id) || item.id===next?.id);
}

function renderToc(story,copy,progress){
  const box = $('#storyToc');
  if(!box) return;

  const allRows = [...(story || [])]
    .sort((a,b)=>(Number(a.order)||9999)-(Number(b.order)||9999));
  const rows = visibleStoryRows(allRows, progress);

  const chapters = new Map();

  rows.forEach(item=>{
    const key = String(item.chapterNumber || item.chapterTitle || '0');
    if(!chapters.has(key)){
      chapters.set(key,{
        number:item.chapterNumber,
        title:item.chapterTitle,
        items:[]
      });
    }
    chapters.get(key).items.push(item);
  });

  box.innerHTML = '';

  if(!rows.length){
    box.innerHTML = '<div class="story-empty">故事仍在時間裡成形。</div>';
    return;
  }

  chapters.forEach(ch=>{
    const section = document.createElement('section');
    section.className='toc-chapter';

    const head = document.createElement('div');
    head.className='toc-chapter-head';
    head.innerHTML = `
      <small>${ch.number ? chapterLabel({chapterNumber:ch.number}) : 'CHAPTER'}</small>
      <h2>${ch.title || '未命名章節'}</h2>
    `;
    section.appendChild(head);

    const list = document.createElement('div');
    list.className='toc-section-list';

    ch.items.forEach(item=>{
      const el = document.createElement('a');
      el.className='toc-section-item';
      el.href=readerHref(item);

      el.innerHTML=`
        <div class="toc-section-number">${sectionLabel(item) || '—'}</div>
        <div class="toc-section-main">
          <h3>${item.sectionTitle || '未命名篇章'}</h3>
          ${item.subtitle ? `<small>${item.subtitle}</small>` : ''}
          ${item.publicSummary ? `<p>${item.publicSummary}</p>` : ''}
        </div>
        <div class="toc-section-status">
          ${copyText(copy,'site.story.read','閱讀本節 →')}
        </div>
      `;
      list.appendChild(el);
    });

    section.appendChild(list);
    box.appendChild(section);
  });
}

function endOfStoryHtml(){
  return `
    <div class="reader-end">
      <div class="reader-end-mark">未完待續</div>
      <p class="reader-end-note">故事目前寫到這裡。時印已經記下你走過的地方。</p>
      <div class="reader-end-links">
        <a href="index.html">回到目錄</a>
        <a href="../journey/index.html">我的旅程</a>
      </div>
    </div>`;
}

// 節末圖。放在正文之後、「繼續前行」之前——
// 讀者剛讀完最後一句，往下捲，畫面在那裡。那是落幕，不是插圖。
//
// 一節可以放好幾張：圖片ID 一行一個（逗號也可以），由上到下依序顯示。
// 圖片說明一行對一張，可以留空行。
//
// 圖片解鎖於 留空 ＝ 讀到這一節就看得到。
// 填了某個節 ID ＝ 要先讀過那一節，這一整組圖才會出現（會回溯出現在舊的節上）。
function splitImageIds(v){
  // Drive 的 ID 不含逗號與空白，所以這幾種分隔都安全。
  return String(v || '').split(/[\n\r,，、;；\s]+/).map(s=>s.trim()).filter(Boolean);
}

function sectionImageHtml(item, progress){
  const ids = splitImageIds(item.imageId);
  if(!ids.length) return '';

  const gate = String(item.imageUnlockAfter || '').trim();
  if(gate){
    const read = new Set(progress?.storyRead || []);
    if(!read.has(gate)) return '';
  }

  // 說明是一行一張，不能用逗號切——說明本身會有逗號。
  const alts = String(item.imageAlt || '').split(/\r?\n/);

  return ids.map((imageId, i)=>{
    const alt = String(alts[i] || '').trim().replace(/"/g,'&quot;');
    const url = `https://drive.google.com/thumbnail?id=${encodeURIComponent(imageId)}&sz=w1600`;
    return `<figure class="reader-figure"><img src="${url}" alt="${alt}" loading="lazy"></figure>`;
  }).join('');
}

function renderReader(story,copy,id,progress){
  const article = $('#readerArticle');
  if(!article) return;

  const allRows = [...(story || [])]
    .sort((a,b)=>(Number(a.order)||9999)-(Number(b.order)||9999));
  const rows = visibleStoryRows(allRows, progress);

  const index = rows.findIndex(x=>x.id===id);
  const item = rows[index];

  // 「還有沒有下一節」要問全部已開放的章節，不能只問目前可見的那幾筆。
  // rows 只含「已讀 + 下一節」，拿它判斷會把「還沒解鎖」誤判成「作者還沒寫」。
  const published = allRows.filter(x=>x.isReadable);
  const publishedIndex = published.findIndex(x=>x.id===id);
  const hasMore = publishedIndex >= 0 && publishedIndex < published.length - 1;
  const alreadyRead = new Set(progress?.storyRead || []).has(id);

  if(!item){
    article.innerHTML = `
      <div class="story-empty">
        <small>STORY</small>
        <p>這個章節目前不存在於你的旅程中。</p>
      </div>`;
    return;
  }

  document.title = `${chapterLabel(item)} ${sectionLabel(item)}｜${item.sectionTitle || '時盡'}`;
  const crumb = $('#storyBreadcrumbCurrent');
  if(crumb){
    crumb.textContent = [chapterLabel(item),sectionLabel(item)]
      .filter(Boolean)
      .join(' ');
  }

  const body = paragraphs(item.body);

  article.innerHTML = `
    <header class="reader-head">
      <div class="reader-chapter">${chapterLabel(item)}${item.chapterTitle && item.chapterTitle !== chapterLabel(item) ? `｜${item.chapterTitle}` : ''}</div>
      <div class="reader-section">${sectionLabel(item)}</div>
      <h1>${item.sectionTitle || '未命名篇章'}</h1>
      ${item.subtitle ? `<div class="reader-subtitle">${item.subtitle}</div>` : ''}
    </header>
    <div class="reader-body">
      ${body.map(p=>{
        if(/^[-—－*＊]{3,}$/.test(p)){
          return '<div class="scene-break" aria-hidden="true"><span></span></div>';
        }
        return `<p>${p.replace(/\n/g,'<br>')}</p>`;
      }).join('')}
    </div>
    ${sectionImageHtml(item, progress)}
    <div class="reader-complete-wrap" id="completeStoryWrap">
      ${alreadyRead && !hasMore ? endOfStoryHtml() : `
      <button class="reader-complete-btn" id="completeStoryButton" type="button">${hasMore ? '繼續前行' : '記下這一刻'}</button>
      <div class="reader-complete-hint" id="completeStoryHint">${hasMore
        ? '讀完此節後，將這一刻留在時印中。'
        : '這是目前寫到的最後一節。留下此刻，故事會在這裡等你。'}</div>`}
    </div>
  `;

  const completeBtn = $('#completeStoryButton');
  if(completeBtn){
    completeBtn.addEventListener('click', async()=>{
      completeBtn.disabled=true;
      completeBtn.textContent='記錄此刻中……';
      try{
        const result = await window.EndOfTimeAdventure.completeStory(item.id,{lastUrl:location.href,lastScroll:window.scrollY});
        completeBtn.textContent='此刻已被記下';
        const hint=$('#completeStoryHint');
        if(hint) hint.textContent = result?.unlocks?.length ? '你的旅程出現了新的變化。' : '時印已記下這段旅程。';
        const nextReadable = rows.slice(index+1)[0];
        if(nextReadable){
          setTimeout(()=>{ location.href=readerHref(nextReadable); },650);
        }else{
          // 沒有下一節就不要把人丟去旅程頁。留在原地，明白告訴他寫到這裡。
          setTimeout(()=>{
            const wrap=$('#completeStoryWrap');
            if(wrap) wrap.innerHTML = endOfStoryHtml();
          },700);
        }
      }catch(err){
        completeBtn.disabled=false;completeBtn.textContent=hasMore?'繼續前行':'記下這一刻';
        const hint=$('#completeStoryHint');if(hint)hint.textContent=err.message||'這一刻暫時無法寫入時印。';
      }
    });
  }

  const resumeScroll = sessionStorage.getItem('theEndOfTime.resumeScroll');
  if(resumeScroll){ sessionStorage.removeItem('theEndOfTime.resumeScroll'); requestAnimationFrame(()=>scrollTo({top:Number(resumeScroll)||0,behavior:'instant'})); }
  let touchTimer;
  const syncPos=()=>{clearTimeout(touchTimer);touchTimer=setTimeout(()=>window.EndOfTimeAdventure?.touchPosition?.(item.id),700)};
  addEventListener('scroll',syncPos,{passive:true});

  const prev = rows.slice(0,index).reverse()[0];
  const next = rows.slice(index+1)[0];

  const prevEl = $('#prevStory');
  const nextEl = $('#nextStory');

  if(prev){
    prevEl.href=readerHref(prev);
    prevEl.textContent=copyText(copy,'site.reader.prev','← 上一節');
  }else{
    prevEl.hidden=true;
  }

  if(next){
    nextEl.href=readerHref(next);
    nextEl.textContent=copyText(copy,'site.reader.next','下一節 →');
  }else{
    nextEl.hidden=true;
  }
}

async function initStory(){
  try{
    const config = await getJSON('../data/config.json');
    const endpoint = config.gasApiEndpoint;
    if(!endpoint) throw new Error('No GAS endpoint');

    const data = await getJSON(`${endpoint}?type=public&_=${Date.now()}`);
    applyCopy(data.copy || {});

    if(document.body.classList.contains('story-index-page')){
      const progress = await adventureProgress();
      renderToc(data.story || [],data.copy || {},progress);
      return;
    }

    if(document.body.classList.contains('story-reader-page')){
      const id = new URLSearchParams(location.search).get('id') || '';
      const progress = await adventureProgress();
      renderReader(data.story || [],data.copy || {},id,progress);
    }
  }catch(err){
    console.error('故事資料載入失敗',err);
    const target = $('#storyToc') || $('#readerArticle');
    if(target){
      target.innerHTML='<div class="story-empty">故事資料暫時無法載入。</div>';
    }
  }finally{
    window.SiteLoading?.hide?.();
  }
}

initStory();
