
const $ = s => document.querySelector(s);
async function getJSON(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error(path);return r.json()}
function chinese(n){n=Number(n);const d=['零','一','二','三','四','五','六','七','八','九','十'];if(n<=10)return d[n]||String(n);if(n<20)return '十'+d[n-10];if(n<100){const t=Math.floor(n/10),o=n%10;return d[t]+'十'+(o?d[o]:'')}return String(n)}
function storyLabel(s){if(!s)return '';const a=s.chapterNumber?`第${chinese(s.chapterNumber)}章${s.chapterTitle?`｜${s.chapterTitle}`:''}`:'';const b=s.sectionNumber?`第${chinese(s.sectionNumber)}節${s.sectionTitle?`｜${s.sectionTitle}`:''}`:'';return [a,b].filter(Boolean).join('　')}
async function init(){
  try{
    await window.EndOfTimeAdventure.ensure();
    const [progress,config]=await Promise.all([window.EndOfTimeAdventure.load(true),getJSON('../data/config.json')]);
    const publicData=await getJSON(`${config.gasApiEndpoint}?type=public&_=${Date.now()}`);
    const storyMap=new Map((publicData.story||[]).map(x=>[x.id,x]));
    const charMap=new Map((publicData.characters||[]).map(x=>[x.id,x]));
    const worldMap=new Map((publicData.world||[]).map(x=>[x.id,x]));
    const current=progress?.lastStory || (progress?.player?.lastStoryId?storyMap.get(progress.player.lastStoryId):null);
    $('#journeyTimeMark').textContent=progress?.token||window.EndOfTimeAdventure.token();
    $('#journeyCurrentTitle').textContent=current?storyLabel(current):'旅程尚未開始';
    $('#journeyCurrentDesc').textContent=current?'你可以回到這段時間裂縫，繼續往前。':'從故事開始，你所看見的世界才會逐漸出現。';
    const resume=$('#journeyResume');
    if(current){resume.hidden=false;resume.href=progress?.player?.lastUrl||`../story/read.html?id=${encodeURIComponent(current.id)}`}
    const storyRead=progress?.storyRead||[];
    const chars=progress?.charactersUnlocked||[];
    const worlds=progress?.worldUnlocked||[];
    $('#journeyStoryCount').textContent=String(storyRead.length);
    $('#journeyCharCount').textContent=String(chars.length);
    $('#journeyWorldCount').textContent=String(worlds.length);
    const list=$('#journeyRecords');
    const records=[];
    storyRead.forEach(id=>{const s=storyMap.get(id);if(s)records.push(['已讀故事',storyLabel(s)])});
    chars.forEach(id=>{const c=charMap.get(id);if(c)records.push(['已知人物',c.fullName||c.name||id])});
    worlds.forEach(id=>{const w=worldMap.get(id);if(w)records.push(['已知世界',w.title||id])});
    if(!records.length){list.innerHTML='<div class="journey-empty">你尚未在這個世界留下足夠的痕跡。</div>'}
    else list.innerHTML=records.map(r=>`<div class="journey-list-row"><small>${r[0]}</small><div>${r[1]}</div></div>`).join('');
    $('#journeyCopy').onclick=()=>window.EndOfTimeAdventure.copyToken();
    $('#journeyCard').onclick=()=>window.EndOfTimeAdventure.downloadTimeMarkCard();
  }catch(err){console.error(err);$('#journeyRecords').innerHTML='<div class="journey-empty">目前無法讀取你的旅程。</div>'}
  finally{window.SiteLoading?.hide?.()}
}
init();
