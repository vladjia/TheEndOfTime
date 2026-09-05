
document.addEventListener('DOMContentLoaded', async()=>{
  const A=window.EndOfTimeAdventure;
  const host=document.getElementById('timemarkShardHost');
  const err=document.getElementById('timemarkError');
  if(!A){ if(err)err.textContent='時印系統尚未載入。'; return; }

  try{
    await A.ensure();
    const data=await A.load(true);
    const stone=data?.stone||{};
    if(!stone.forged){
      if(err) err.textContent='這枚時印尚未完成時空鑄印。';
      setTimeout(()=>A.openForge(),250);
      return;
    }

    const shard=document.createElement('div');
    shard.innerHTML=`
      <div class="time-shard resonance-${Math.max(0,Math.min(5,Number(stone.resonanceLevel||0)))}">
        <span class="time-shard-reflection"></span>
        <span class="time-shard-mist"></span>
        <span class="time-shard-crack crack-a"></span>
        <span class="time-shard-crack crack-b"></span>
        <span class="time-shard-sigil" aria-hidden="true">⌛</span>
        <div class="time-shard-inscription">
          <small>時印序 ${A.serialLabel(stone.serial)}</small>
          <span>${stone.relayCode||''}</span>
        </div>
      </div>`;
    const el=shard.firstElementChild;
    A.applyShardPalette(el,stone.color||'#7F1521');
    host.replaceChildren(el);

    document.getElementById('timemarkSerial').textContent=A.serialLabel(stone.serial);
    document.getElementById('timemarkResonance').textContent=`第 ${Number(stone.resonanceLevel||0)} 階共鳴`;
    document.getElementById('tmStory').textContent=String((data.storyRead||[]).length);
    document.getElementById('tmCharacter').textContent=String((data.charactersUnlocked||[]).length);
    document.getElementById('tmWorld').textContent=String((data.worldUnlocked||[]).length);

    const last=data?.lastStory;
    document.getElementById('timemarkLast').textContent=last
      ? `上一次，你停在第${last.chapterNumber||''}章${last.chapterTitle?'｜'+last.chapterTitle:''}${last.sectionNumber?'・第'+last.sectionNumber+'節':''}${last.sectionTitle?'｜'+last.sectionTitle:''}`
      : '你的旅程尚未留下第一道可返回的時間裂縫。';
  }catch(e){
    if(err)err.textContent=e?.message||'時印幻境暫時無法開啟。';
  }
});
