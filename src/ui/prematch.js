function pmLaunch(){
  document.getElementById('prematch').classList.add('hidden');
  startGame();
}

function startGame(){
  overlay.style.display='none';
  gameRunning=false;cancelAnimationFrame(frameId);
  gameOver=false;gameTimer=0;killerElimCount=0;gameDuration=180;
  Object.assign(killerMemory,{
    eliminationCount:0,
    stunsReceived:0,
    smokeEncounters:0,
  });
  _flowCache.clear();
  mines=[];buildings=[];projectiles=[];scraps=[];survivors=[];smokescreens=[];
  bloodDecals.length=0;bloodParticles.length=0;explosionList.length=0;
  deathCameraEvent=null;deathSlowFactor=1;deathSlowTarget=1;
  // Apply pre-match settings
  simSpeed = parseFloat(document.getElementById('pm-simspeed')?.value||'1')||1;
  document.getElementById('speed-input').value=simSpeed;
  document.getElementById('speed-val').textContent=simSpeed.toFixed(1)+'x';
  gameDuration = parseFloat(document.getElementById('pm-duration')?.value||'180')||180;

  // Apply seed
  const seedInput=(document.getElementById('pm-seed-input')?.value||'').trim();
  pmCurrentSeed = seedInput!==''?seedInput:String(Math.floor(Math.random()*0xFFFFFFFF));
  document.getElementById('pm-seed-input').value=pmCurrentSeed;
  document.getElementById('pm-seed-display').textContent=pmCurrentSeed;
  document.getElementById('pm-footer-seed').textContent=pmCurrentSeed;
  _pmSeedOverride=pmCurrentSeed;

  resize(); genMap(); spawnScraps();

  // Apply killer config
  const kPos=randPos(80);
  killer=new Killer(kPos.x,kPos.y);
  const kHp=parseInt(document.getElementById('pm-k-hp')?.value||'1000')||1000;
  killer.maxHp=kHp; killer.hp=kHp;
  killer.speed=parseFloat(document.getElementById('pm-k-speed')?.value||'53')||53;
  killer._cfgGrabCD=parseFloat(document.getElementById('pm-k-grabcd')?.value||'15')||15;
  killer._cfgMineCD=parseFloat(document.getElementById('pm-k-minecd')?.value||'18')||18;
  killer._cfgRageCD=parseFloat(document.getElementById('pm-k-ragecd')?.value||'30')||30;
  killer._cfgRageDur=parseFloat(document.getElementById('pm-k-ragedur')?.value||'10')||10;
  killer._cfgMaxMines=parseInt(document.getElementById('pm-k-maxmines')?.value||'6')||6;
  // Apply initial killer statuses
  for(const [sname,cfg] of Object.entries(pmKillerInitStatuses)){
    if(cfg.enabled){const dur=cfg.perm?99999:parseFloat(cfg.dur)||5;applyStatus(killer,sname,dur,{});}
  }

  // Survivor count & kits
  const survCount=parseInt(document.getElementById('pm-surv-count')?.value||'11')||11;
  const kitRows=document.querySelectorAll('.pm-kit-row');
  const kitList=[];
  kitRows.forEach(r=>{const sel=r.querySelector('select');if(sel)kitList.push(sel.value);});
  while(kitList.length<survCount) kitList.push(PM_DEFAULT_KITS[kitList.length%PM_DEFAULT_KITS.length]);

  const names=['Sigma','Blake','Robert','James','Casey','Dana','Evan','Faye','Gray','Hana','Iris',
    'Jade','Kane','Lena','Milo','Nova','Omar','Pix','Quinn','Rex','Skye','Tyne','Uma','Vex','Wren','Zuri'];
  const kits=kitList.slice(0,survCount);
  for(let i=0;i<kits.length;i++){
    let pos;
    for(let t=0;t<20;t++){pos=randPos(80);if(dist(pos,killer)>200)break;}
    const k=kits[i];let s;
    if(k==='engineer')      s=new Engineer(pos.x,pos.y,names[i]);
    else if(k==='brawler')  s=new Brawler(pos.x,pos.y,names[i]);
    else if(k==='escapee')  s=new Escapee(pos.x,pos.y,names[i]);
    else if(k==='recon')    s=new Recon(pos.x,pos.y,names[i]);
    else if(k==='commander')s=new Commander(pos.x,pos.y,names[i]);
    else if(k==='assault')  s=new Assault(pos.x,pos.y,names[i]);
    else if(k==='trapmaker')s=new Trapmaker(pos.x,pos.y,names[i]);
    else if(k==='golfer')   s=new Golfer(pos.x,pos.y,names[i]);
    else if(k==='sniper')   s=new Sniper(pos.x,pos.y,names[i]);
    else s=new Medic(pos.x,pos.y,names[i]);
    // Apply initial survivor statuses from pmSurvInitStatuses
    if(pmSurvInitStatuses[k]){
      for(const [sname,cfg] of Object.entries(pmSurvInitStatuses[k])){
        if(cfg.enabled){const dur=cfg.perm?99999:parseFloat(cfg.dur)||5;applyStatus(s,sname,dur,{});}
      }
    }
    // Apply per-kit base stat overrides
    if(pmKitStats[k]){
      const ks=pmKitStats[k];
      if(ks.hp){s.maxHp=parseFloat(ks.hp);s.hp=s.maxHp;}
      if(ks.speed) s.baseSpeed=parseFloat(ks.speed);
    }
    survivors.push(s);
  }

  // Apply global status duration overrides
  _pmStatusDurOverrides={};
  document.querySelectorAll('.pm-statedur-row').forEach(row=>{
    const name=row.dataset.status;
    const perm=row.querySelector('.pm-perm-chk')?.checked;
    const dur=parseFloat(row.querySelector('.pm-dur-inp')?.value)||null;
    if(dur||perm) _pmStatusDurOverrides[name]={dur:perm?99999:dur,perm};
  });

  logEl.innerHTML='';
  addLog('Simulation started — Killer hunts relentlessly','skill');
  addLog('Stuck survivors will auto-escape to safety.');
  
  if(survivors.length===1){
    survivors[0].lastSurvivorBoost=false;
    survivors[0].checkLastSurvivor();
  } else {
    if(audioCtx.state==='suspended') audioCtx.resume();
    ambient.currentTime=0;
    ambient.volume=0;
    ambient.play().catch(()=>{});
    activeMusicKey='ambient';
    currentBPM=120;
    cameraBeat.targetSwingAmt=0;
  }
  preloadAndDetectBPMs();
  
  lmsCam.active=false; lmsCam.slowTimer=0; lmsCam.slowFactor=1;
  lmsCam.barAlpha=0; lmsCam.barTarget=0; lmsCam.focusEntity=null;
  lmsCam.drumIntensity=0; lmsCam.cutCooldown=0;
  skillDropdown=null;
  cameraState.mode='normal';
  cameraState.initialized=false;
  cameraState.individualIdx=0;
  cameraState.cx=W/2; cameraState.cy=H/2; cameraState.zoom=1;
  cameraState.targetCX=W/2; cameraState.targetCY=H/2; cameraState.targetZoom=1;

  ctx.clearRect(0,0,W,H);
  ctx.fillStyle=COLS.gb0; ctx.fillRect(0,0,W,H);
  drawWalls(); drawScraps();
  for(const s of survivors) if(s.alive) s.draw();
  if(killer&&killer.alive) killer.draw();

  gameRunning=false;lastTime=performance.now();
  playMatchIntro(()=>{
    cameraBeat.targetSwingAmt=0.8;
    gameRunning=true;lastTime=performance.now();
    frameId=requestAnimationFrame(loop);
  });
}

// ─── PRE-MATCH SYSTEM ─────────────────────────────────────────────────────────
let _pmSeedOverride='';
let _pmStatusDurOverrides={};
let pmCurrentSeed='';
let pmKillerInitStatuses={};
let pmSurvInitStatuses={};
let pmKitStats={};

const PM_DEFAULT_KITS=['engineer','brawler','brawler','escapee','medic','recon','commander','assault','trapmaker','golfer','sniper'];
const PM_ALL_KITS=['engineer','brawler','escapee','medic','recon','commander','assault','trapmaker','golfer','sniper'];
const PM_ALL_STATUSES=Object.keys(STATUS_DESCRIPTIONS);

const PM_KIT_DEFAULTS={
  engineer: {hp:100,speed:88},
  brawler:  {hp:120,speed:88},
  escapee:  {hp:100,speed:95},
  medic:    {hp:100,speed:76},
  recon:    {hp:100,speed:92},
  commander:{hp:100,speed:80},
  assault:  {hp:100,speed:85},
  trapmaker:{hp:100,speed:82},
  golfer:   {hp:100,speed:84},
  sniper:   {hp:100,speed:78},
};

function pmResetDefaults(){
  document.getElementById('pm-seed-input').value='';
  document.getElementById('pm-seed-display').textContent='';
  document.getElementById('pm-footer-seed').textContent='—';
  document.getElementById('pm-surv-count').value='11';
  document.getElementById('pm-duration').value='180';
  document.getElementById('pm-simspeed').value='1';
  document.getElementById('pm-k-hp').value='1000';
  document.getElementById('pm-k-speed').value='53';
  document.getElementById('pm-k-grabcd').value='15';
  document.getElementById('pm-k-minecd').value='18';
  document.getElementById('pm-k-ragecd').value='30';
  document.getElementById('pm-k-ragedur').value='10';
  document.getElementById('pm-k-maxmines').value='6';
  pmKillerInitStatuses={};
  pmSurvInitStatuses={};
  pmKitStats={};
  _pmStatusDurOverrides={};
  pmBuildKitList();
  pmBuildKillerStatuses();
  pmBuildSurvStats();
  pmBuildStatusDurList();
  pmRegenerateSeed();
}

function pmTab(name){
  document.querySelectorAll('.pm-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.pm-nav-btn').forEach(b=>b.classList.remove('active'));
  const panel=document.getElementById('pm-panel-'+name);
  if(panel) panel.classList.add('active');
  const btns=document.querySelectorAll('.pm-nav-btn');
  btns.forEach(b=>{if(b.textContent.toLowerCase().includes(name.substring(0,3))) b.classList.add('active');});
}

function pmRegenerateSeed(){
  const seed=String(Math.floor(Math.random()*0xFFFFFFFF));
  document.getElementById('pm-seed-input').value=seed;
  document.getElementById('pm-seed-display').textContent='✓ '+seed;
  document.getElementById('pm-footer-seed').textContent=seed;
  _pmSeedOverride=seed;
  pmDrawMapPreview();
}

function pmDrawMapPreview(){
  const cv=document.getElementById('pm-map-canvas');
  if(!cv) return;
  const wc=cv.getContext('2d');
  const seedVal=(document.getElementById('pm-seed-input')?.value||'').trim();
  _pmSeedOverride=seedVal!==''?seedVal:String(Math.floor(Math.random()*0xFFFFFFFF));
  document.getElementById('pm-footer-seed').textContent=_pmSeedOverride;

  // Save real game state
  const savedW=W,savedH=H,savedCC=COLS_C,savedRC=ROWS_C,savedGrid=mapGrid;
  const savedWallCanvas=_wallCanvas; _wallCanvas=null;

  // Use the ACTUAL canvas wrap dimensions so the preview uses the same grid as the real match
  const wrapEl=document.getElementById('canvas-wrap');
  const wrapRect=wrapEl.getBoundingClientRect();
  W=wrapRect.width||800; H=wrapRect.height||600;

  // Generate the map using the seeded genMap (same as startGame will do)
  COLS_C=0; ROWS_C=0;
  genMap(); // this sets COLS_C, ROWS_C, mapGrid using _pmSeedOverride

  // Draw preview scaled to fit canvas
  const TW=cv.width/COLS_C, TH=cv.height/ROWS_C;
  wc.fillStyle='#14100c'; wc.fillRect(0,0,cv.width,cv.height);
  for(let cy=0;cy<ROWS_C;cy++) for(let cx=0;cx<COLS_C;cx++){
    wc.fillStyle=mapGrid[cy][cx]?((cx+cy)%2===0?'#0d0a08':'#0e0b09'):'#6e2a2a';
    wc.fillRect(cx*TW,cy*TH,TW,TH);
  }
  wc.strokeStyle='rgba(110,42,42,0.18)'; wc.lineWidth=0.5;
  for(let c=0;c<=COLS_C;c++){wc.beginPath();wc.moveTo(c*TW,0);wc.lineTo(c*TW,cv.height);wc.stroke();}
  for(let r=0;r<=ROWS_C;r++){wc.beginPath();wc.moveTo(0,r*TH);wc.lineTo(cv.width,r*TH);wc.stroke();}

  // Restore all real game state
  W=savedW; H=savedH; COLS_C=savedCC; ROWS_C=savedRC; mapGrid=savedGrid;
  _wallCanvas=savedWallCanvas;
}

document.getElementById('pm-seed-input')?.addEventListener('input',()=>{
  const v=(document.getElementById('pm-seed-input').value||'').trim();
  _pmSeedOverride=v;
  document.getElementById('pm-footer-seed').textContent=v||'—';
  pmDrawMapPreview();
});

function pmBuildKitList(){
  const el=document.getElementById('pm-kit-list');
  if(!el) return;
  el.innerHTML='';
  PM_DEFAULT_KITS.forEach((kit,i)=>{
    const row=document.createElement('div');
    row.className='pm-row pm-kit-row';
    row.innerHTML=`<span class="pm-label" style="min-width:60px">SLOT ${i+1}</span>
      <select class="pm-input" style="width:110px;">${PM_ALL_KITS.map(k=>`<option value="${k}"${k===kit?' selected':''}>${k.toUpperCase()}</option>`).join('')}</select>
      <button class="pm-btn pm-btn-sm" onclick="this.parentElement.remove()">✕</button>`;
    el.appendChild(row);
  });
}

function pmAddKit(){
  const el=document.getElementById('pm-kit-list');
  if(!el) return;
  const i=el.children.length;
  const row=document.createElement('div');
  row.className='pm-row pm-kit-row';
  row.innerHTML=`<span class="pm-label" style="min-width:60px">SLOT ${i+1}</span>
    <select class="pm-input" style="width:110px;">${PM_ALL_KITS.map(k=>`<option value="${k}">${k.toUpperCase()}</option>`).join('')}</select>
    <button class="pm-btn pm-btn-sm" onclick="this.parentElement.remove()">✕</button>`;
  el.appendChild(row);
}

function pmBuildKillerStatuses(){
  const el=document.getElementById('pm-killer-statuses');
  if(!el) return;
  el.innerHTML='';
  const grid=document.createElement('div');
  grid.className='pm-status-grid';
  for(const sname of PM_ALL_STATUSES){
    if(!pmKillerInitStatuses[sname]) pmKillerInitStatuses[sname]={enabled:false,dur:'5',perm:false};
    const cfg=pmKillerInitStatuses[sname];
    const item=document.createElement('div');item.className='pm-status-item';
    const cid=`ki-${sname}`;
    item.innerHTML=`<input type="checkbox" class="pm-status-check" id="${cid}" ${cfg.enabled?'checked':''}>
      <label class="pm-status-name" for="${cid}">${sname.toUpperCase()}</label>
      <input type="number" class="pm-status-dur" value="${cfg.dur}" min="0.1" max="99999" step="0.5">
      <input type="checkbox" class="pm-perm-check" title="Permanent" ${cfg.perm?'checked':''}>
      <span class="pm-perm-label">∞</span>`;
    item.querySelector('.pm-status-check').addEventListener('change',e=>{pmKillerInitStatuses[sname].enabled=e.target.checked;});
    item.querySelector('.pm-status-dur').addEventListener('input',e=>{pmKillerInitStatuses[sname].dur=e.target.value;});
    item.querySelector('.pm-perm-check').addEventListener('change',e=>{pmKillerInitStatuses[sname].perm=e.target.checked;});
    grid.appendChild(item);
  }
  el.appendChild(grid);
}

function pmBuildSurvStats(){
  const el=document.getElementById('pm-surv-stats');
  if(!el) return;
  el.innerHTML='';
  for(const kit of PM_ALL_KITS){
    if(!pmKitStats[kit]) pmKitStats[kit]={hp:String(PM_KIT_DEFAULTS[kit].hp),speed:String(PM_KIT_DEFAULTS[kit].speed)};
    if(!pmSurvInitStatuses[kit]) pmSurvInitStatuses[kit]={};
    const card=document.createElement('div');card.className='pm-entity-card';
    const headDiv=document.createElement('div');headDiv.className='pm-entity-header';
    headDiv.innerHTML=`<span class="pm-entity-name">${kit.toUpperCase()}</span>`;
    card.appendChild(headDiv);
    const statsRow=document.createElement('div');statsRow.className='pm-row';
    statsRow.innerHTML=`<span class="pm-label">MAX HP</span><input class="pm-input" type="number" min="1" max="99999" value="${pmKitStats[kit].hp}" data-kit="${kit}" data-stat="hp">
      <span class="pm-label" style="margin-left:10px">SPEED</span><input class="pm-input" type="number" min="1" max="999" value="${pmKitStats[kit].speed}" data-kit="${kit}" data-stat="speed">`;
    statsRow.querySelectorAll('input').forEach(inp=>{
      inp.addEventListener('input',e=>{pmKitStats[e.target.dataset.kit][e.target.dataset.stat]=e.target.value;});
    });
    card.appendChild(statsRow);
    // Status grid for this kit
    const stTitle=document.createElement('div');stTitle.className='pm-section-title';stTitle.style.marginTop='6px';stTitle.textContent='INITIAL STATUSES';
    card.appendChild(stTitle);
    const grid=document.createElement('div');grid.className='pm-status-grid';
    for(const sname of PM_ALL_STATUSES){
      if(!pmSurvInitStatuses[kit][sname]) pmSurvInitStatuses[kit][sname]={enabled:false,dur:'5',perm:false};
      const cfg=pmSurvInitStatuses[kit][sname];
      const item=document.createElement('div');item.className='pm-status-item';
      const cid=`si-${kit}-${sname}`;
      item.innerHTML=`<input type="checkbox" class="pm-status-check" id="${cid}" ${cfg.enabled?'checked':''}>
        <label class="pm-status-name" for="${cid}">${sname.toUpperCase()}</label>
        <input type="number" class="pm-status-dur" value="${cfg.dur}" min="0.1" max="99999" step="0.5">
        <input type="checkbox" class="pm-perm-check" ${cfg.perm?'checked':''}>
        <span class="pm-perm-label">∞</span>`;
      item.querySelector('.pm-status-check').addEventListener('change',e=>{pmSurvInitStatuses[kit][sname].enabled=e.target.checked;});
      item.querySelector('.pm-status-dur').addEventListener('input',e=>{pmSurvInitStatuses[kit][sname].dur=e.target.value;});
      item.querySelector('.pm-perm-check').addEventListener('change',e=>{pmSurvInitStatuses[kit][sname].perm=e.target.checked;});
      grid.appendChild(item);
    }
    card.appendChild(grid);
    el.appendChild(card);
  }
}

function pmBuildStatusDurList(){
  const el=document.getElementById('pm-status-dur-list');
  if(!el) return;
  el.innerHTML='';
  const grid=document.createElement('div');grid.className='pm-status-grid';
  // Default durations map (approximate)
  const PM_DUR_DEFAULTS={stunned:3,blinded:3,slowed:3,grabbed:5,highlighted:5,fatigued:4.5,
    cd_boost:10,weakness:5,punched:2,striken:3.5,silenced:1.5,rage:10,speed:2,speed_ii:4,
    anxious:30,parry:1.5,king_of_rules:0.5,last_survivor:9999,cloaked:10,bleed:3,
    invincibility:1,x_ray:6,ammo_pack:30,rocket_boots:60,reloading:10,iron_body:99999,
    resistance:8,self_healing:5,scared:15,wary:10,carpal_tunnel:10,
    dancefloor_madness:99999,survivor_rage:99999,furious:99999,energized:30,charging:10};
  for(const sname of PM_ALL_STATUSES){
    const defDur=PM_DUR_DEFAULTS[sname]||5;
    const item=document.createElement('div');item.className='pm-status-item pm-statedur-row';item.dataset.status=sname;
    item.innerHTML=`<span class="pm-status-name">${sname.toUpperCase()}</span>
      <input type="number" class="pm-status-dur pm-dur-inp" value="${defDur}" min="0.1" max="99999" step="0.5">
      <input type="checkbox" class="pm-perm-check pm-perm-chk" title="Permanent">
      <span class="pm-perm-label">∞</span>`;
    item.querySelector('.pm-perm-chk').addEventListener('change',function(){
      item.querySelector('.pm-dur-inp').disabled=this.checked;
    });
    grid.appendChild(item);
  }
  el.appendChild(grid);
}

// Init pre-match on page load
(function pmInit(){
  pmBuildKitList();
  pmBuildKillerStatuses();
  pmBuildSurvStats();
  pmBuildStatusDurList();
  pmRegenerateSeed();
})();

window.addEventListener('keydown', e => {
  keysHeld.add(e.key);

  
  // ── Ringmaster shortcuts ──────────────────────────────────────────
  if(e.key==='r'||e.key==='R'){
    if(gameRunning){
      ringmaster.active=!ringmaster.active;
      addLog(`Ringmaster mode: ${ringmaster.active?'ON':'OFF'}`,'skill');
    }
  }
  if(ringmaster.active&&gameRunning){
    const toolMap={'1':'trap','2':'wall','3':'floor','4':'spawn_survivor','5':'spawn_killer'};
    if(toolMap[e.key]){ ringmaster.tool=toolMap[e.key]; return; }
    // Kit selection while spawn_survivor active: Q/W/E/A/S/D/Z/X/C/V
    if(ringmaster.tool==='spawn_survivor'){
      const kitKeys={q:'engineer',w:'brawler',e:'escapee',a:'medic',s:'recon',
        d:'commander',z:'assault',x:'trapmaker',c:'golfer',v:'sniper'};
      const k=kitKeys[e.key.toLowerCase()];
      if(k){ ringmaster.spawnKit=k; addLog(`Spawn kit: ${k}`,'skill'); return; }
    }
  }

  if (e.key === 'i' || e.key === 'I') {
    debugSafety = !debugSafety;
    addLog(`Tile safety debug: ${debugSafety ? 'ON' : 'OFF'}`, 'skill');
  }
  
  if (e.key === 'c' || e.key === 'C') {
    const modes=lmsCam.active?['normal','action','individual','lms-cam']:CAMERA_MODES;
    const idx=modes.indexOf(cameraState.mode);
    cameraState.mode=modes[(idx+1)%modes.length];
    if(cameraState.mode==='normal'){
      cameraState.targetCX=W/2; cameraState.targetCY=H/2; cameraState.targetZoom=1;
    }
    addLog(`Camera mode: ${cameraState.mode.toUpperCase()}`,'skill');
  }
  
  if((e.key==='n'||e.key==='N'||e.key==='Tab')&&cameraState.mode==='individual'){
    e.preventDefault();
    const el=[killer,...survivors.filter(s=>s.alive)];
    if(el.length){
      cameraState.individualIdx=(cameraState.individualIdx+1)%el.length;
      const t=el[cameraState.individualIdx];
      addLog(`Following: ${t===killer?'KILLER':t.name}`,'skill');
    }
  }
});

window.addEventListener('keyup', e => { keysHeld.delete(e.key); });