
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
    shard.innerHTML=A.shardPreviewMarkup({
      color:stone.color||'#7F1521',
      serial:A.serialLabel(stone.serial),
      relay:stone.relayCode||'',
      level:stone.resonanceLevel||0,
      stoneType:stone.stoneType,
      engraveSeed:stone.engraveSeed||''
    });
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
