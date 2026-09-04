
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

async function getJSON(path){
  const r = await fetch(path, {cache:'no-store'});
  if(!r.ok) throw new Error(path);
  return r.json();
}

function renderCharacters(data){
  const box = $('#characterCards');
  box.innerHTML = '';
  (data.characters || []).forEach(c=>{
    const el = document.createElement('article');
    el.className='card';
    el.innerHTML = `
      <div class="role">${c.role || ''}</div>
      <h3>${c.title}・${c.name}</h3>
      <p>${c.publicIntro || ''}</p>
      <div class="sig">${c.signature || ''}</div>`;
    box.appendChild(el);
  });
}

async function loadDriveGallery(endpoint){
  if(!endpoint) return;
  try{
    const data = await getJSON(endpoint);
    (data.images || []).forEach(x=>{
      const slot = document.getElementById(x.slot);
      if(!slot) return;
      const img = document.createElement('img');
      img.src = x.url; img.alt = x.alt || '';
      slot.appendChild(img);
    });
  }catch(e){ console.warn('Drive gallery error', e); }
}

async function init(){
  try{
    const [config, chars, world, story] = await Promise.all([
      getJSON('data/config.json'),
      getJSON('data/characters.json'),
      getJSON('data/world.json'),
      getJSON('data/story.json')
    ]);
    renderCharacters(chars);
    $('#worldName').textContent = world.world?.name || '世界觀';
    $('#worldIntro').textContent = world.world?.publicIntro || '';
    $('#tagline').textContent = story.public?.tagline || '';
    await loadDriveGallery(config.driveGalleryEndpoint);
  }catch(e){
    console.error(e);
  }
}
init();
