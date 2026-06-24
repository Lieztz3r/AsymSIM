function addLog(msg, cls=''){
  if(msg===undefined||msg===null) msg='[unknown event]';
  msg=String(msg);
  const up = msg.toUpperCase();
  const fx = new Set();

  
  if(cls==='kill')  { fx.add('red'); fx.add('shaky'); }
  if(cls==='stun')  { fx.add('shaky'); fx.add('flashy'); }
  if(cls==='heal')  { fx.add('flashy'); }
  if(cls==='skill') { fx.add('flashy'); }

  
  if(up.includes('ELIMINATED'))     { fx.add('rainbow'); fx.add('wavy'); fx.add('shaky'); fx.add('flashy'); fx.add('death'); }
  if(up.includes('LAST SURVIVOR'))  { fx.add('rainbow'); fx.add('wavy'); fx.add('bouncy'); fx.add('shaky'); fx.add('flashy'); }
  if(up.includes('KING OF RULES'))  { fx.add('red'); fx.add('zigzag'); fx.add('shaky'); fx.add('flashy'); }
  if(up.includes('RAGE'))           { fx.add('red'); fx.add('zigzag'); fx.add('shaky'); fx.add('flashy'); }
  if(up.includes('PARR'))           { fx.add('rainbow'); fx.add('bouncy'); fx.add('shaky'); fx.add('flashy'); }
  if(up.includes('STRIKE'))         { fx.add('rainbow'); fx.add('bouncy'); fx.add('shaky'); fx.add('flashy'); }
  if(up.includes('MINE HIT'))       { fx.add('red'); fx.add('zigzag'); fx.add('shaky'); fx.add('flashy'); }
  if(up.includes('MISSILE HIT'))    { fx.add('zigzag'); fx.add('shaky'); fx.add('flashy'); }
  if(up.includes('GRABBED'))        { fx.add('red'); fx.add('zigzag'); fx.add('shaky'); }
  if(up.includes('STUNNED'))        { fx.add('zigzag'); fx.add('shaky'); }
  if(up.includes('BLINDED'))        { fx.add('zigzag'); fx.add('shaky'); fx.add('flashy'); }
  if(up.includes('LMS'))            { fx.add('rainbow'); fx.add('wavy'); fx.add('bouncy'); fx.add('flashy'); }
  if(up.includes('EMERGENCY'))      { fx.add('zigzag'); fx.add('shaky'); fx.add('red'); }
  if(up.includes('PUNCH'))          { fx.add('bouncy'); fx.add('shaky'); }
  if(up.includes('HEAL'))           { fx.add('bouncy'); fx.add('flashy'); }

  
  const d = document.createElement('div');
  d.className = 'log-line' + (cls ? ' '+cls : '') + (fx.has('death') ? ' fx-death' : '') + (fx.has('red')&&!fx.has('rainbow') ? ' fx-red' : '');

  
  const containerAnims = [];
  if(fx.has('shaky'))  containerAnims.push('log-shake 0.11s linear infinite');
  if(fx.has('flashy')) containerAnims.push('log-flash 1.8s ease-in-out infinite');
  if(containerAnims.length) d.style.animation = containerAnims.join(', ');
  if(fx.has('red') && !fx.has('rainbow')){ d.style.color='#ff5555'; d.style.textShadow='0 0 10px rgba(255,60,60,0.9)'; }
  if(fx.has('death')) {
    d.style.fontSize = '17px';
    d.style.letterSpacing = '2px';
    d.style.textAlign = 'center';
  }

  
  if(fx.has('wavy') || fx.has('rainbow') || fx.has('bouncy') || fx.has('zigzag')){
    const charAnims = [];
    if(fx.has('wavy'))    charAnims.push('log-wave 0.68s ease-in-out infinite');
    if(fx.has('rainbow')) charAnims.push('log-rainbow 1.1s linear infinite');
    if(fx.has('bouncy'))  charAnims.push('log-bounce 0.55s ease-in-out infinite');
    if(fx.has('zigzag'))  charAnims.push('log-zigzag 0.38s ease-in-out infinite');
    const animStr = charAnims.join(', ');
    const chars = [...msg]; 
    chars.forEach((ch, i) => {
      if(ch === ' '){ d.appendChild(document.createTextNode('\u00A0')); return; }
      const sp = document.createElement('span');
      sp.className = 'log-char';
      sp.textContent = ch;
      sp.style.animation = animStr;
      sp.style.animationDelay = charAnims.map(()=> (i * 0.028) + 's').join(', ');
      d.appendChild(sp);
    });
  } else {
    d.textContent = msg;
  }

  logEl.appendChild(d);
  
  let totalHeight = 0;
  for(const child of logEl.children) totalHeight += fx.has('death') ? 2 : 1;
  while(logEl.children.length > 38) logEl.removeChild(logEl.firstChild);
}

function checkWinCondition(){
  const alive=survivors.filter(s=>s.alive).length;
  if(alive===0)showEnd('KILLER WINS',true,'All survivors eliminated.');
}
function showEnd(title,killerWin,detail){
  gameOver=true;gameRunning=false;cancelAnimationFrame(frameId);
  stopAllMusic();
  document.getElementById('overlay-title').textContent=title;
  document.getElementById('overlay-title').className=killerWin?'killer-win':'survivor-win';
  document.getElementById('overlay-detail').innerHTML=`${detail}<br><br>ELIM: ${killerElimCount}/${survivors.length}<br>STUNS: ${killerMemory.stunsReceived}`;
  overlay.style.display='flex';
}

function openPrematch(){
  overlay.style.display='none';
  document.getElementById('prematch').classList.remove('hidden');
  pmDrawMapPreview();
}


let hoveredEntity=null;
const keysHeld=new Set();

let skillDropdown = null;


function buildStatusTooltip(entity, isKiller){
  const statuses=entity.statuses||{};
  const activeKeys=Object.keys(statuses).filter(k=>statuses[k].remaining>0);
  if(activeKeys.length===0 && !isKiller) return '';
  let html='<div class="tt-section">ACTIVE EFFECTS</div>';
  if(activeKeys.length===0){html+='<div class="tt-status">None</div>';return html;}
  for(const k of activeKeys){
    const rem=statuses[k].remaining.toFixed(1);
    const desc=STATUS_DESCRIPTIONS[k]||'Active effect.';
    html+=`<div class="tt-status"><span>${k.toUpperCase()} (${rem}s)</span><div class="tt-status-desc">${desc}</div></div>`;
  }
  if(isKiller && entity.rageActive){
    html+=`<div class="tt-status"><span>RAGE (${entity.rageTimer.toFixed(1)}s)</span><div class="tt-status-desc">Speed greatly increased, damage boosted.</div></div>`;
  }
  return html;
}

function showKillerTooltip(e){
  if(!killer) return;
  hoveredEntity=killer;
  let html=`<div class="tt-title">KILLER</div>`;
  html+=`<div class="tt-skill"><span class="tt-skill-name">PNC — Punch</span><span class="tt-skill-cd ${killer.punchAttackCD<=0?'ready':'on-cd'}">${killer.punchAttackCD<=0?'READY':killer.punchAttackCD.toFixed(1)+'s'}</span></div>`;
  html+=`<div class="tt-status-desc">Melee strike dealing 10 damage. 5s cooldown.</div>`;
  html+=`<div class="tt-skill"><span class="tt-skill-name">GRB — Grab</span><span class="tt-skill-cd ${killer.grabCooldown<=0?'ready':'on-cd'}">${killer.grabCooldown<=0?'READY':killer.grabCooldown.toFixed(1)+'s'}</span></div>`;
  html+=`<div class="tt-status-desc">Seize a nearby survivor, dealing damage over time.</div>`;
  html+=`<div class="tt-skill"><span class="tt-skill-name">MNE — Mine</span><span class="tt-skill-cd ${killer.mineCooldown<=0?'ready':'on-cd'}">${killer.mineCooldown<=0?'READY':killer.mineCooldown.toFixed(1)+'s'}</span></div>`;
  html+=`<div class="tt-status-desc">Place a mine ahead of the target's escape path.</div>`;
  html+=`<div class="tt-skill"><span class="tt-skill-name">RAG — Rage</span><span class="tt-skill-cd ${killer.rageCooldown<=0&&!killer.rageActive?'ready':'on-cd'}">${killer.rageActive?'ACTIVE':killer.rageCooldown<=0?'READY':killer.rageCooldown.toFixed(1)+'s'}</span></div>`;
  html+=`<div class="tt-status-desc">Greatly boost speed and damage for 20 seconds.</div>`;
  html+=buildStatusTooltip(killer, true);
  tooltipEl.innerHTML=html;
  tooltipEl.classList.add('visible');
  positionTooltip(e);
}

function showSurvivorTooltip(e, survivor){
  if(!survivor) return;
  hoveredEntity=survivor;
  let html=`<div class="tt-title">${survivor.name} [${survivor.kit.toUpperCase()}]</div>`;
  html+=`<div style="font-size:14px;color:var(--gb1);margin-bottom:6px">${Math.round(survivor.hp)}/${survivor.effectiveMaxHp()} HP · ${survivor.alive?survivor.state:'ELIMINATED'}</div>`;
  html+=`<div class="tt-section">SKILLS</div>`;

  if(survivor.kit==='engineer'){
    const eng=survivor;
    const engSkills=SURVIVOR_SKILLS.engineer;
    html+=`<div class="tt-skill"><span class="tt-skill-name">BLD — Build</span><span class="tt-skill-cd ${eng.skill1CD<=0?'ready':'on-cd'}">${eng.skill1CD<=0?'READY':eng.skill1CD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?engSkills[0].lmsDesc:engSkills[0].desc} Scrap: ${eng.scrap}</div>`;
    html+=`<div class="tt-skill"><span class="tt-skill-name">WRN — Wrench</span><span class="tt-skill-cd ${eng.wrenchCD<=0?'ready':'on-cd'}">${eng.wrenchCD<=0?'READY':eng.wrenchCD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?engSkills[1].lmsDesc:engSkills[1].desc}</div>`;
  } else if(survivor.kit==='brawler'){
    const br=survivor;
    const punchReady=br.punchCD<=0&&br.punchStacks>0;
    html+=`<div class="tt-skill"><span class="tt-skill-name">PNC — Punch [${br.punchStacks}/2]</span><span class="tt-skill-cd ${punchReady?'ready':'on-cd'}">${punchReady?'READY':br.punchCD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?SURVIVOR_SKILLS.brawler[0].lmsDesc:SURVIVOR_SKILLS.brawler[0].desc}</div>`;
    const parryReady=br.parryCD<=0&&!br.parrying;
    const parryLabel=br.parrying?`ACTIVE (${br.parryTimer.toFixed(1)}s)`:parryReady?'READY':br.parryCD.toFixed(1)+'s';
    html+=`<div class="tt-skill"><span class="tt-skill-name">PRY — Parry</span><span class="tt-skill-cd ${parryReady||br.parrying?'ready':'on-cd'}">${parryLabel}</span></div>`;
    html+=`<div class="tt-status-desc">Counter a grab or punch — stuns killer 4s. Expires after 1.5s window.</div>`;
  } else if(survivor.kit==='escapee'){
    const esc=survivor;
    html+=`<div class="tt-skill"><span class="tt-skill-name">HLG — Self-Heal</span><span class="tt-skill-cd ${esc.skill1CD<=0?'ready':'on-cd'}">${esc.skill1CD<=0?'READY':esc.skill1CD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?SURVIVOR_SKILLS.escapee[0].lmsDesc:SURVIVOR_SKILLS.escapee[0].desc}</div>`;
    html+=`<div class="tt-skill"><span class="tt-skill-name">SLG — Slingshot</span><span class="tt-skill-cd ${esc.skill2CD<=0?'ready':'on-cd'}">${esc.skill2CD<=0?'READY':esc.skill2CD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?SURVIVOR_SKILLS.escapee[1].lmsDesc:SURVIVOR_SKILLS.escapee[1].desc}</div>`;
  } else if(survivor.kit==='medic'){
    const med=survivor;
    html+=`<div class="tt-skill"><span class="tt-skill-name">LNK — Link</span><span class="tt-skill-cd ${med.skill1CD<=0?'ready':'on-cd'}">${med.skill1CD<=0?'READY':med.skill1CD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?SURVIVOR_SKILLS.medic[0].lmsDesc:SURVIVOR_SKILLS.medic[0].desc}</div>`;
    html+=`<div class="tt-skill"><span class="tt-skill-name">SHL — Self-Heal</span><span class="tt-skill-cd ${med.skill2CD<=0?'ready':'on-cd'}">${med.skill2CD<=0?'READY':med.skill2CD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?SURVIVOR_SKILLS.medic[1].lmsDesc:SURVIVOR_SKILLS.medic[1].desc} (x${med.selfHealStacks||0})</div>`;
  } else if(survivor.kit==='recon'){
    const rec=survivor;
    html+=`<div class="tt-skill"><span class="tt-skill-name">SCN — Mine Scan</span><span class="tt-skill-cd ${rec.skill1CD<=0?'ready':'on-cd'}">${rec.skill1CD<=0?'READY':rec.skill1CD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?SURVIVOR_SKILLS.recon[0].lmsDesc:SURVIVOR_SKILLS.recon[0].desc}</div>`;
    html+=`<div class="tt-skill"><span class="tt-skill-name">SMK — Smokescreen</span><span class="tt-skill-cd ${rec.skill2CD<=0?'ready':'on-cd'}">${rec.skill2CD<=0?'READY':rec.skill2CD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?SURVIVOR_SKILLS.recon[1].lmsDesc:SURVIVOR_SKILLS.recon[1].desc}</div>`;
  } else if(survivor.kit==='commander'){
    const cmd=survivor;
    html+=`<div class="tt-skill"><span class="tt-skill-name">DRP — Airdrop</span><span class="tt-skill-cd ${cmd.airdropCD<=0?'ready':'on-cd'}">${cmd.airdropCD<=0?'READY':cmd.airdropCD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?SURVIVOR_SKILLS.commander[0].lmsDesc:SURVIVOR_SKILLS.commander[0].desc}${cmd.airdropPending?' [PENDING]':''}</div>`;
    html+=`<div class="tt-skill"><span class="tt-skill-name">RAY — Ray Beam</span><span class="tt-skill-cd ${cmd.skill2CD<=0&&!cmd.rayActive?'ready':'on-cd'}">${cmd.rayActive?'ACTIVE':cmd.skill2CD<=0?'READY':cmd.skill2CD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?SURVIVOR_SKILLS.commander[1].lmsDesc:SURVIVOR_SKILLS.commander[1].desc}</div>`;
  } else if(survivor.kit==='assault'){
    const asl=survivor;
    html+=`<div class="tt-skill"><span class="tt-skill-name">GRN — Grenade</span><span class="tt-skill-cd ${asl.grenadeCD<=0?'ready':'on-cd'}">${asl.grenadeCD<=0?'READY':asl.grenadeCD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?SURVIVOR_SKILLS.assault[0].lmsDesc:SURVIVOR_SKILLS.assault[0].desc}</div>`;
    html+=`<div class="tt-skill"><span class="tt-skill-name">PST — Pistol [${asl.bulletCount}/${asl.maxBullets}]</span><span class="tt-skill-cd ${asl.pistolCD<=0&&asl.bulletCount>0?'ready':'on-cd'}">${hasStatus(asl,'reloading')?'RELOADING':asl.pistolCD<=0?'READY':asl.pistolCD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?SURVIVOR_SKILLS.assault[1].lmsDesc:SURVIVOR_SKILLS.assault[1].desc}</div>`;
  } else if(survivor.kit==='trapmaker'){
    const trp=survivor;
    html+=`<div class="tt-skill"><span class="tt-skill-name">DST — Destroy Mine</span><span class="tt-skill-cd ${trp.destroyCD<=0?'ready':'on-cd'}">${trp.destroyCD<=0?'READY':trp.destroyCD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?SURVIVOR_SKILLS.trapmaker[0].lmsDesc:SURVIVOR_SKILLS.trapmaker[0].desc}</div>`;
    html+=`<div class="tt-skill"><span class="tt-skill-name">TRP — Trap [${trp.improvisedMines.length}/${trp.maxImprovisedMines}]</span><span class="tt-skill-cd ${trp.trapCD<=0?'ready':'on-cd'}">${trp.trapCD<=0?'READY':trp.trapCD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?SURVIVOR_SKILLS.trapmaker[1].lmsDesc:SURVIVOR_SKILLS.trapmaker[1].desc}</div>`;
  } else if(survivor.kit==='trapmaker'){
    const trp=survivor;
    html+=`<div class="tt-skill"><span class="tt-skill-name">DST — Destroy Mine</span><span class="tt-skill-cd ${trp.destroyCD<=0?'ready':'on-cd'}">${trp.destroyCD<=0?'READY':trp.destroyCD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?SURVIVOR_SKILLS.trapmaker[0].lmsDesc:SURVIVOR_SKILLS.trapmaker[0].desc}</div>`;
    html+=`<div class="tt-skill"><span class="tt-skill-name">TRP — Trap [${trp.improvisedMines.length}/${trp.maxImprovisedMines}]</span><span class="tt-skill-cd ${trp.trapCD<=0?'ready':'on-cd'}">${trp.trapCD<=0?'READY':trp.trapCD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?SURVIVOR_SKILLS.trapmaker[1].lmsDesc:SURVIVOR_SKILLS.trapmaker[1].desc}</div>`;
  } else if(survivor.kit==='golfer'){
    const glf=survivor;
    html+=`<div class="tt-skill"><span class="tt-skill-name">SWG — Swing</span><span class="tt-skill-cd ${glf.skill1CD<=0?'ready':'on-cd'}">${glf.skill1CD<=0?'READY':glf.skill1CD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?SURVIVOR_SKILLS.golfer[0].lmsDesc:SURVIVOR_SKILLS.golfer[0].desc}</div>`;
    html+=`<div class="tt-skill"><span class="tt-skill-name">FLG — Flag [${glf.flags?glf.flags.filter(f=>f.alive).length:0}/${glf.lmsActive?8:5}]</span><span class="tt-skill-cd ${glf.skill2CD<=0?'ready':'on-cd'}">${glf.skill2CD<=0?'READY':glf.skill2CD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?SURVIVOR_SKILLS.golfer[1].lmsDesc:SURVIVOR_SKILLS.golfer[1].desc}</div>`;
    if(survivor.lmsActive){
      html+=`<div class="tt-skill"><span class="tt-skill-name">RCL — Recall</span><span class="tt-skill-cd ${glf.skill3CD<=0?'ready':'on-cd'}">${glf.skill3CD<=0?'READY':glf.skill3CD.toFixed(1)+'s'}</span></div>`;
      html+=`<div class="tt-status-desc">${SURVIVOR_SKILLS.golfer[2].lmsDesc}</div>`;
    }
  } else if(survivor.kit==='sniper'){
    const snp=survivor;
    const chargePct=snp.isCharging?Math.round(Math.min(1,snp.chargeTimer/snp.maxCharge)*100):0;
    html+=`<div class="tt-skill"><span class="tt-skill-name">AIM — Snipe${snp.isCharging?` [${chargePct}%]`:''}</span><span class="tt-skill-cd ${snp.skill1CD<=0?'ready':'on-cd'}">${snp.isCharging?'CHARGING':snp.skill1CD<=0?'READY':snp.skill1CD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?SURVIVOR_SKILLS.sniper[0].lmsDesc:SURVIVOR_SKILLS.sniper[0].desc}</div>`;
    html+=`<div class="tt-skill"><span class="tt-skill-name">SDA — Soda</span><span class="tt-skill-cd ${snp.skill2CD<=0?'ready':'on-cd'}">${snp.sodaActive?'ACTIVE':snp.skill2CD<=0?'READY':snp.skill2CD.toFixed(1)+'s'}</span></div>`;
    html+=`<div class="tt-status-desc">${survivor.lmsActive?SURVIVOR_SKILLS.sniper[1].lmsDesc:SURVIVOR_SKILLS.sniper[1].desc}</div>`;
  }

  html+=buildStatusTooltip(survivor, false);
  tooltipEl.innerHTML=html;
  tooltipEl.classList.add('visible');
  positionTooltip(e);
}

function positionTooltip(e){
  const mx=e.clientX, my=e.clientY;
  const tw=tooltipEl.offsetWidth||220, th=tooltipEl.offsetHeight||150;
  let left=mx+12, top=my+12;
  if(left+tw>window.innerWidth) left=mx-tw-12;
  if(top+th>window.innerHeight) top=my-th-12;
  tooltipEl.style.left=left+'px';
  tooltipEl.style.top=top+'px';
}

function hideTooltip(){
  tooltipEl.classList.remove('visible');
  hoveredEntity=null;
}


function updateUI(){
  const khp=document.getElementById('k-hp');
  const kpct=Math.max(0,killer.hp/killer.maxHp);
  khp.style.width=(kpct*100)+'%';
  khp.className='hp-fill '+(kpct>0.5?'green':kpct>0.25?'yellow':'red');
  document.getElementById('k-hp-txt').textContent=`${Math.round(killer.hp)}/1000`;
  const kstatus=[];
  if(hasStatus(killer,'stunned'))kstatus.push('STUNNED');
  if(hasStatus(killer,'blinded'))kstatus.push('BLINDED');
  if(killer.rageActive)kstatus.push('RAGE');
  if(hasStatus(killer,'highlighted'))kstatus.push('SONAR');
  document.getElementById('k-status').textContent=kstatus.join(' | ');
  const kskills=document.getElementById('k-skills');kskills.innerHTML='';
  for(const sk of [{l:'PNC',cd:killer.punchAttackCD},{l:'GRB',cd:killer.grabCooldown},{l:'MNE',cd:killer.mineCooldown},{l:'RAG',cd:killer.rageCooldown,active:killer.rageActive}]){
    const d=document.createElement('div');
    d.className='skill-pip '+(sk.active?'active':sk.cd<=0?'ready':'cd');
    d.textContent=sk.l;d.style.width='32px';kskills.appendChild(d);
  }
  const panel=document.getElementById('survivors-panel');panel.innerHTML='';
  for(const s of survivors){
    const card=document.createElement('div');card.className='survivor-card';
    const hpPct=Math.max(0,s.hp/s.effectiveMaxHp());
    const kc=({engineer:COLS.gb3,brawler:COLS.gb1,escapee:COLS.gb3,medic:COLS.gb2,recon:COLS.gb3,commander:COLS.gb3,assault:COLS.gb2,trapmaker:COLS.gb1})[s.kit]||COLS.gb2;
    card.style.borderColor=s.alive?kc+'55':'#222';card.style.opacity=s.alive?'1':'0.35';
    const stPct=s.stamina/s.maxStamina;
    const stateStr=s.alive?(s.emergencyFleeTimer>0?'ESCAPE!':s.state):'';
    card.innerHTML=`<h4 style="color:${kc}">${s.name}</h4>
      <div class="hp-bar"><div class="hp-fill ${hpPct>0.5?'green':hpPct>0.25?'yellow':'red'}" style="width:${hpPct*100}%"></div></div>
      <div style="height:3px;background:#1c1410;margin:1px 0;border-radius:1px"><div style="height:100%;background:${stPct>0.5?'#33cc66':stPct>0.2?'#ccaa22':'#cc4422'};width:${stPct*100}%;border-radius:1px"></div></div>
      <div style="font-size:8px;color:#555">${Math.round(s.hp)}hp | ${stateStr}</div>`;
    const capturedS = s;
    card.addEventListener('mouseenter', (e) => showSurvivorTooltip(e, capturedS));
    card.addEventListener('mousemove', positionTooltip);
    card.addEventListener('mouseleave', hideTooltip);
    card.addEventListener('click', ()=>{
      if(!capturedS.alive) return;
      // Follow this survivor with the camera (individual mode)
      cameraState.mode='individual';
      const entityList=[killer,...survivors.filter(s=>s.alive)];
      const idx=entityList.indexOf(capturedS);
      if(idx>=0) cameraState.individualIdx=idx;
      addLog(`Camera following ${capturedS.name} [${capturedS.kit}]`,'skill');
    });
    panel.appendChild(card);
  }

  const kPanel=document.getElementById('killer-panel');
  kPanel.onmouseenter=(e)=>showKillerTooltip(e);
  kPanel.onmousemove=(e)=>{showKillerTooltip(e);positionTooltip(e);};
  kPanel.onmouseleave=hideTooltip;
  kPanel.onclick=()=>{
    cameraState.mode='individual';
    cameraState.individualIdx=0;
    addLog('Camera following Killer','skill');
  };
}