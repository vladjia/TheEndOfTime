document.addEventListener('DOMContentLoaded', async()=>{
  const A=window.EndOfTimeAdventure;
  const L=window.SiteLoading;

  const $=s=>document.querySelector(s);
  const title=$('#journeyCurrentTitle');
  const desc=$('#journeyCurrentDesc');
  const resume=$('#journeyResume');
  const storyCount=$('#journeyStoryCount');
  const charCount=$('#journeyCharCount');
  const worldCount=$('#journeyWorldCount');
  const tokenEl=$('#journeyTimeMark');
  const stateEl=$('#journeyMarkState');
  const copyBtn=$('#journeyCopy');
  const openBtn=$('#journeyOpenMark');
  const records=$('#journeyRecords');

  const setLoadingText=text=>{ try{ L?.setText(text); }catch(_){} };

  function safeCount(value){
    return Array.isArray(value) ? value.length : 0;
  }

  function renderRecords(data){
    if(!records) return;
    const items=Array.isArray(data?.progress) ? data.progress : [];

    if(!items.length){
      records.innerHTML='<div class="journey-empty">你的旅程尚未留下第一道時痕。</div>';
      return;
    }

    const labelFor=type=>{
      if(type==='STORY') return '故事';
      if(type==='CHARACTER') return '角色';
      if(type==='WORLD') return '世界';
      return '時痕';
    };

    records.innerHTML=items
      .filter(x=>['STORY','CHARACTER','WORLD'].includes(String(x?.type||'')))
      .slice()
      .reverse()
      .map(item=>`
        <div class="journey-list-row journey-record-row">
          <small>${labelFor(String(item.type||''))}</small>
          <div>
            <strong>${String(item.displayLabel||item.targetId||'').replace(/[<>&"]/g,'')}</strong>
            ${item.recordedAt ? `<span>${new Date(item.recordedAt).toLocaleString('zh-TW')}</span>` : ''}
          </div>
        </div>
      `).join('') || '<div class="journey-empty">你的旅程尚未留下第一道時痕。</div>';
  }

  try{
    if(!A) throw new Error('時印系統尚未載入。');

    setLoadingText('確認你的時印……');
    await A.ensure();

    setLoadingText('尋回旅程中……');
    const data=await A.load(false);

    if(!data || data.ok===false){
      throw new Error('旅程暫時無法讀取。');
    }

    const storyN=safeCount(data.storyRead);
    const charN=safeCount(data.charactersUnlocked);
    const worldN=safeCount(data.worldUnlocked);

    if(storyCount) storyCount.textContent=String(storyN);
    if(charCount) charCount.textContent=String(charN);
    if(worldCount) worldCount.textContent=String(worldN);

    const last=data.lastStory;
    if(last){
      const chapter=last.chapterNumber ? `第 ${last.chapterNumber} 章` : '';
      const section=last.sectionNumber ? `第 ${last.sectionNumber} 節` : '';
      const main=[chapter,last.chapterTitle,section,last.sectionTitle].filter(Boolean).join('｜');
      if(title) title.textContent=main || '上一次留下的時間裂縫';
      if(desc) desc.textContent='這裡記著你上一次停下的位置。';

      if(resume && data.player?.lastUrl){
        resume.hidden=false;
        resume.href=data.player.lastUrl;
        resume.onclick=e=>{
          e.preventDefault();
          const target=data.player.lastUrl;
          const started=A.playTimeRiftTransition({
            mode:'resume',
            onDone:()=>{ location.href=target; }
          });
          if(!started) location.href=target;
        };
      }
    }else{
      if(title) title.textContent='旅程尚未開始';
      if(desc) desc.textContent='從故事開始，你所看見的世界才會逐漸出現。';
    }

    const t=A.token();
    if(tokenEl) tokenEl.textContent=t || '尚未建立';
    if(copyBtn){
      copyBtn.disabled=!t;
      copyBtn.onclick=()=>A.copyToken();
    }

    const stone=data.stone||{};
    const forged=!!stone.forged;

    if(stateEl){
      stateEl.textContent=forged
        ? `時印已完成鑄印｜目前留下 ${storyN+charN+worldN} 道時痕`
        : '你的旅程已被記住，但時印石片尚未完成時空鑄印。';
    }

    if(openBtn){
      openBtn.disabled=false;
      openBtn.textContent=forged ? '進入時印幻境' : '查看時印';
      openBtn.onclick=()=>{
        if(forged && stone.relayCode){
          location.href=`../timemark/index.html?r=${encodeURIComponent(stone.relayCode)}`;
        }else{
          // 不再像舊「儲存時印卡」那樣直接呼叫 openForge。
          // 先開啟時印管理器，讓玩家自己決定是否進行時空鑄印。
          A.openManager();
        }
      };
    }

    renderRecords(data);
    setLoadingText('旅程已尋回。');
  }catch(err){
    console.error('Journey load failed:',err);
    if(title) title.textContent='旅程暫時無法讀取';
    if(desc) desc.textContent=err?.message||'請稍後再試。';
    if(tokenEl) tokenEl.textContent='—';
    if(stateEl) stateEl.textContent='目前無法確認時印狀態。';
    if(records) records.innerHTML='<div class="journey-empty">旅程資料讀取失敗。</div>';
  }finally{
    // Loading 由 journey.js 明確控制：
    // 等 ensure + load + 畫面完成後才關閉，不再靠 12 秒 fail-safe。
    setTimeout(()=>{ try{ L?.hide(); }catch(_){} },180);
  }
});
