let _introActive=false;
function playMatchIntro(onDone){
  _introActive=true;
  const ov=document.createElement('canvas');
  ov.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:9999;pointer-events:none;';
  ov.width=W; ov.height=H;
  document.body.appendChild(ov);
  const oc=ov.getContext('2d');

  // Curtain canvas — separate layer below black frame
  const cv2=document.createElement('canvas');
  cv2.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:9998;pointer-events:none;';
  cv2.width=W; cv2.height=H;
  document.body.appendChild(cv2);
  const cc=cv2.getContext('2d');

  const TARGET_Y=Math.max(42,H*0.06);
  const START_Y=-120; // fixtures start above screen
  const DESCEND_DUR=0.55; // seconds per spotlight descent
  const DESCEND_GAP=0.45; // gap between each spotlight starting descent
  const LIGHT_DELAY=0.35; // delay after last descend before lights start
  const FADE_DUR=0.45;    // each light fade-in duration
  const LIGHT_GAP=0.95;   // gap between each light turning on
  const WAIT_LIT=1.8;     // wait after all lit
  const CURTAIN_DUR=0.9;

  // Spotlight X positions: corners + center
  const spotXs=[W*0.04, W*0.50, W*0.96];

  const spots=[
    {x:spotXs[0], y:START_Y, targetY:TARGET_Y, alpha:0, descending:false, descended:false},
    {x:spotXs[1], y:START_Y, targetY:TARGET_Y, alpha:0, descending:false, descended:false},
    {x:spotXs[2], y:START_Y, targetY:TARGET_Y, alpha:0, descending:false, descended:false},
  ];

  // Rotation angles: left tilts right, center straight, right tilts left
  const spotAngles=[-Math.PI/5, 0, Math.PI/5];

  // Phases: descend → light → wait → curtain → done
  let elapsed=0, prevT=null, done=false;
  let waitLitTimer=-1, curtainT=0;
  let lightsOn=0;
  const MAX_VOL=0.5;

  function allDescended(){ return spots.every(s=>s.descended); }
  function allLit(){ return spots.every(s=>s.alpha>=0.98); }

  function conePoly(i){
    const {x,y}=spots[i];
    const ang=spotAngles[i];
    const len=Math.max(W,H)*2.8;
    const spread=Math.PI/7;
    const a1=Math.PI/2+ang-spread/2;
    const a2=Math.PI/2+ang+spread/2;
    const ty=y+11;
    return{
      tip:{x,y:ty},
      left:{x:x+Math.cos(a1)*len, y:ty+Math.sin(a1)*len},
      right:{x:x+Math.cos(a2)*len, y:ty+Math.sin(a2)*len},
    };
  }

  function drawFixture(x,y,litA,angleRad){
    oc.save();
    oc.translate(x,y);
    oc.rotate(angleRad);
    oc.lineWidth=1.5;
    // Ceiling mount bar
    oc.fillStyle='#4a4a4a'; oc.strokeStyle='#999';
    oc.fillRect(-21,-51,42,10); oc.strokeRect(-21,-51,42,10);
    // Corner ceiling hooks
    oc.beginPath();
    oc.moveTo(-21,-51); oc.lineTo(-28,-60);
    oc.moveTo(21,-51);  oc.lineTo(28,-60);
    oc.strokeStyle='#777'; oc.stroke();
    // Pivot arm
    oc.fillStyle='#5a5a5a'; oc.strokeStyle='#888';
    oc.fillRect(-5,-41,10,16); oc.strokeRect(-5,-41,10,16);
    // Main housing
    oc.fillStyle='#363636'; oc.strokeStyle='#777';
    oc.beginPath();
    oc.moveTo(-23,-25); oc.lineTo(23,-25);
    oc.lineTo(16,11); oc.lineTo(-16,11);
    oc.closePath(); oc.fill(); oc.stroke();
    // Side bracket arms
    oc.strokeStyle='#666'; oc.lineWidth=1.2;
    oc.beginPath();
    oc.moveTo(-23,-19); oc.lineTo(-34,-13);
    oc.moveTo(23,-19);  oc.lineTo(34,-13);
    oc.stroke();
    // Lens outer ring
    oc.beginPath(); oc.arc(0,-5,14,0,Math.PI*2);
    oc.fillStyle='#1a1a1a'; oc.fill();
    oc.strokeStyle='#888'; oc.lineWidth=2; oc.stroke();
    if(litA>0.01){
      const g=oc.createRadialGradient(0,-5,0,0,-5,14);
      g.addColorStop(0,`rgba(255,238,148,${litA})`);
      g.addColorStop(0.42,`rgba(255,198,60,${litA*0.70})`);
      g.addColorStop(1,'rgba(255,95,5,0)');
      oc.beginPath(); oc.arc(0,-5,14,0,Math.PI*2);
      oc.fillStyle=g; oc.fill();
    } else {
      oc.beginPath(); oc.arc(0,-5,9,0,Math.PI*2);
      oc.fillStyle='#0c0c0c'; oc.fill();
    }
    oc.restore();
  }

  function frame(ts){
    if(done) return;
    if(!prevT) prevT=ts;
    const dt=Math.min((ts-prevT)/1000,0.08);
    prevT=ts; elapsed+=dt;

    // Phase 1: descend spotlights one by one
    for(let i=0;i<3;i++){
      const startTime=i*DESCEND_GAP;
      if(elapsed>=startTime && !spots[i].descended){
        spots[i].descending=true;
        const t=Math.min(1,(elapsed-startTime)/DESCEND_DUR);
        const ease=t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
        spots[i].y=START_Y+(TARGET_Y-START_Y)*ease;
        if(t>=1){ spots[i].y=TARGET_Y; spots[i].descended=true; spots[i].descending=false; }
      }
    }

    // Phase 2: lights on one by one after all descended
    const allDesc=allDescended();
    const lightPhaseStart=DESCEND_GAP*2+DESCEND_DUR+LIGHT_DELAY;
    if(allDesc){
      for(let i=0;i<3;i++){
        const lightStart=lightPhaseStart+i*LIGHT_GAP;
        if(elapsed>=lightStart){
          spots[i].alpha=Math.min(1,spots[i].alpha+(dt/FADE_DUR));
        }
      }
    }

    // Music volume: +1/3 per light substantially on
    const curOn=spots.filter(s=>s.alpha>0.5).length;
    if(curOn!==lightsOn){
      lightsOn=curOn;
      ambient.volume=(lightsOn/3)*MAX_VOL;
    }

    // Phase 3: wait after all lit
    const allLt=allLit();
    if(allLt && waitLitTimer<0) waitLitTimer=0;
    if(waitLitTimer>=0 && waitLitTimer<WAIT_LIT) waitLitTimer+=dt;

    // Phase 4: curtains open
    const opening=waitLitTimer>=WAIT_LIT;
    if(opening) curtainT=Math.min(1,curtainT+dt/CURTAIN_DUR);

    // ── Draw curtain layer (below black) ─────────────────────────────────
    cc.clearRect(0,0,cv2.width,cv2.height);
    if(curtainT>0 && curtainT<1){
      const ease=curtainT<0.5?2*curtainT*curtainT:1-Math.pow(-2*curtainT+2,2)/2;
      const hw=cv2.width/2;
      // Curtain gradient — rich red/dark theater color
      const lg1=cc.createLinearGradient(0,0,hw*(1-ease),0);
      lg1.addColorStop(0,'#1a0a0a');
      lg1.addColorStop(0.5,'#2a0808');
      lg1.addColorStop(1,'#0a0303');
      cc.fillStyle=lg1;
      cc.fillRect(0,0,hw*(1-ease),cv2.height);
      const lg2=cc.createLinearGradient(hw+hw*ease,0,cv2.width,0);
      lg2.addColorStop(0,'#0a0303');
      lg2.addColorStop(0.5,'#2a0808');
      lg2.addColorStop(1,'#1a0a0a');
      cc.fillStyle=lg2;
      cc.fillRect(hw+hw*ease,0,hw*(1-ease),cv2.height);
      // Vertical fold lines on curtain
      cc.strokeStyle='rgba(0,0,0,0.25)'; cc.lineWidth=3;
      const folds=6;
      for(let f=0;f<folds;f++){
        const lx=hw*(1-ease)*f/folds;
        cc.beginPath(); cc.moveTo(lx,0); cc.lineTo(lx,cv2.height); cc.stroke();
        const rx=hw+hw*ease+(hw*(1-ease)*f/folds);
        cc.beginPath(); cc.moveTo(rx,0); cc.lineTo(rx,cv2.height); cc.stroke();
      }
      // Gold fringe at curtain edge
      const fringeW=8;
      cc.fillStyle='rgba(180,140,20,0.7)';
      cc.fillRect(hw*(1-ease)-fringeW,0,fringeW,cv2.height);
      cc.fillRect(hw+hw*ease,0,fringeW,cv2.height);
    } else if(curtainT<=0){
      // Full curtains closed
      cc.fillStyle='#1a0808';
      cc.fillRect(0,0,cv2.width/2,cv2.height);
      cc.fillStyle='#1a0808';
      cc.fillRect(cv2.width/2,0,cv2.width/2,cv2.height);
    }

    // ── Draw black frame layer (above curtains) ───────────────────────────
    oc.clearRect(0,0,ov.width,ov.height);
    if(curtainT<1){
      if(!opening){
        // Full black
        oc.fillStyle='#000';
        oc.fillRect(0,0,ov.width,ov.height);
        // Punch transparent cone holes
        oc.save();
        oc.globalCompositeOperation='destination-out';
        for(let i=0;i<3;i++){
          const sl=spots[i]; if(sl.alpha<=0.005) continue;
          const {tip,left,right}=conePoly(i);
          const g=oc.createLinearGradient(tip.x,tip.y,tip.x,ov.height*0.88);
          g.addColorStop(0,`rgba(0,0,0,${sl.alpha})`);
          g.addColorStop(0.5,`rgba(0,0,0,${sl.alpha*0.90})`);
          g.addColorStop(1,`rgba(0,0,0,${sl.alpha*0.68})`);
          oc.beginPath();
          oc.moveTo(tip.x,tip.y);
          oc.lineTo(left.x,left.y);
          oc.lineTo(right.x,right.y);
          oc.closePath();
          oc.fillStyle=g; oc.fill();
        }
        oc.restore();
        // Cone glow tint
        oc.save();
        for(let i=0;i<3;i++){
          const sl=spots[i]; if(sl.alpha<=0.005) continue;
          const {tip,left,right}=conePoly(i);
          const g=oc.createLinearGradient(tip.x,tip.y,tip.x,ov.height);
          g.addColorStop(0,`rgba(216,138,61,${sl.alpha*0.22})`);
          g.addColorStop(0.35,`rgba(216,138,61,${sl.alpha*0.07})`);
          g.addColorStop(1,'rgba(216,138,61,0)');
          oc.beginPath();
          oc.moveTo(tip.x,tip.y);
          oc.lineTo(left.x,left.y);
          oc.lineTo(right.x,right.y);
          oc.closePath();
          oc.fillStyle=g; oc.fill();
          oc.strokeStyle=`rgba(216,138,61,${sl.alpha*0.55})`;
          oc.lineWidth=1;
          oc.beginPath();
          oc.moveTo(tip.x,tip.y); oc.lineTo(left.x,left.y);
          oc.moveTo(tip.x,tip.y); oc.lineTo(right.x,right.y);
          oc.stroke();
        }
        oc.restore();
      } else {
        // Black frame splits with curtains but faster — just thin border remains
        const ease=curtainT<0.5?2*curtainT*curtainT:1-Math.pow(-2*curtainT+2,2)/2;
        const hw=ov.width/2;
        oc.fillStyle='#000';
        oc.fillRect(0,0,hw*(1-ease),ov.height);
        oc.fillRect(hw+hw*ease,0,hw*(1-ease),ov.height);
      }
    }

    // Fixtures always on top of black frame
    for(let i=0;i<3;i++){
      const startTime=i*DESCEND_GAP;
      if(elapsed>=startTime-0.08)
        drawFixture(spots[i].x, spots[i].y, spots[i].alpha, spotAngles[i]);
    }

    if(curtainT>=1){
      done=true; _introActive=false;
      document.body.removeChild(ov);
      document.body.removeChild(cv2);
      // White flash above everything
      const flashDiv=document.createElement('div');
      flashDiv.style.cssText='position:fixed;inset:0;background:white;z-index:99999;pointer-events:none;';
      document.body.appendChild(flashDiv);
      let fAlpha=1;
      function fadeFlash(){
        fAlpha-=0.05;
        flashDiv.style.opacity=Math.max(0,fAlpha);
        if(fAlpha>0) requestAnimationFrame(fadeFlash);
        else document.body.removeChild(flashDiv);
      }
      requestAnimationFrame(fadeFlash);
      onDone();
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

let _lmsFlashAlpha=0;
function triggerLMSFlash(){
  _lmsFlashAlpha=1.0;
}

let _waveformAnalyser=null;
let _waveformData=null;
function _initWaveform(trackEl){
  try{
    if(_waveformAnalyser) return; // already connected
    const src=audioCtx.createMediaElementSource(trackEl);
    _waveformAnalyser=audioCtx.createAnalyser();
    _waveformAnalyser.fftSize=512;
    _waveformAnalyser.smoothingTimeConstant=0.75;
    src.connect(_waveformAnalyser);
    _waveformAnalyser.connect(audioCtx.destination);
    _waveformData=new Uint8Array(_waveformAnalyser.frequencyBinCount);
  }catch(e){ _waveformAnalyser=null; }
}

function drawRingmaster(){
  if(!ringmaster.active) return;
  // Draw preview tile highlight
  if(ringmaster.previewTile){
    applyCameraTransform();
    const{cx,cy}=ringmaster.previewTile;
    const px=cx*CELL, py=cy*CELL;
    const toolColors={trap:'rgba(216,138,61,0.45)',wall:'rgba(110,42,42,0.55)',
      floor:'rgba(139,172,15,0.45)',spawn_survivor:'rgba(100,200,100,0.45)',
      spawn_killer:'rgba(200,80,80,0.45)'};
    ctx.fillStyle=toolColors[ringmaster.tool]||'rgba(255,255,255,0.25)';
    ctx.fillRect(px,py,CELL,CELL);
    ctx.strokeStyle='rgba(255,255,255,0.7)';ctx.lineWidth=2;
    ctx.strokeRect(px,py,CELL,CELL);ctx.lineWidth=1;
    restoreCameraTransform();
  }
  // Toolbar HUD (screen space)
  const tools=['trap','wall','floor','spawn_survivor','spawn_killer'];
  const toolLabels={trap:'TRAP',wall:'WALL',floor:'FLOOR',spawn_survivor:'SURV',spawn_killer:'KILL'};
  const tw=58,th=38,gap=6,startX=W/2-(tools.length*(tw+gap)-gap)/2,startY=8;
  ctx.globalAlpha=0.92;
  ctx.fillStyle='rgba(20,16,12,0.88)';
  ctx.fillRect(startX-10,startY-4,(tools.length*(tw+gap))+14,th+8);
  ctx.strokeStyle='rgba(216,138,61,0.7)';ctx.lineWidth=1;
  ctx.strokeRect(startX-10,startY-4,(tools.length*(tw+gap))+14,th+8);
  ctx.globalAlpha=1;
  for(let i=0;i<tools.length;i++){
    const tx=startX+i*(tw+gap);
    const active=ringmaster.tool===tools[i];
    ctx.fillStyle=active?COLS.gb2:'rgba(30,22,16,0.85)';
    ctx.fillRect(tx,startY,tw,th);
    ctx.strokeStyle=active?COLS.gb3:COLS.gb1;ctx.lineWidth=active?2:1;
    ctx.strokeRect(tx,startY,tw,th);
    ctx.fillStyle=active?COLS.gb0:COLS.gb2;
    ctx.font=`bold 9px VCROSD,monospace`;ctx.textAlign='center';
    ctx.fillText(toolLabels[tools[i]],tx+tw/2,startY+14);
    ctx.fillStyle=active?COLS.gb0:COLS.gb1;
    ctx.font='7px VCROSD,monospace';
    ctx.fillText(`[${i+1}]`,tx+tw/2,startY+27);
  }
  ctx.textAlign='left';
  // Kit selector when spawn_survivor is active
  if(ringmaster.tool==='spawn_survivor'){
    const kits=['engineer','brawler','escapee','medic','recon','commander','assault','trapmaker','golfer','sniper'];
    const ky=startY+th+18;
    const kw=56,kgap=4,ksx=W/2-(kits.length*(kw+kgap)-kgap)/2;
    ctx.globalAlpha=0.88;
    ctx.fillStyle='rgba(14,11,9,0.92)';
    ctx.fillRect(ksx-8,ky-4,(kits.length*(kw+kgap))+10,32);
    ctx.strokeStyle=COLS.gb1;ctx.lineWidth=1;
    ctx.strokeRect(ksx-8,ky-4,(kits.length*(kw+kgap))+10,32);
    ctx.globalAlpha=1;
    for(let j=0;j<kits.length;j++){
      const kx=ksx+j*(kw+kgap);
      const sel=ringmaster.spawnKit===kits[j];
      ctx.fillStyle=sel?COLS.gb2:'rgba(30,22,16,0.7)';
      ctx.fillRect(kx,ky,kw,24);
      ctx.strokeStyle=sel?COLS.gb3:COLS.gb1;ctx.lineWidth=sel?2:1;
      ctx.strokeRect(kx,ky,kw,24);
      ctx.fillStyle=sel?COLS.gb0:COLS.gb2;
      ctx.font='7px VCROSD,monospace';ctx.textAlign='center';
      ctx.fillText(kits[j].substring(0,6).toUpperCase(),kx+kw/2,ky+15);
    }
    ctx.textAlign='left';
  }
  // Label
  ctx.fillStyle=COLS.gb2;ctx.font='8px VCROSD,monospace';
  ctx.fillText('RINGMASTER MODE — Click=place  Right-click=remove  R=toggle  1-5=tool',4,H-18);
}

function drawWaveform(){
  if(!lmsTrackActive||!_waveformAnalyser||!_waveformData) return;
  _waveformAnalyser.getByteTimeDomainData(_waveformData);

  // Only use the top half (above center line — no mirror)
  const total=_waveformData.length;
  const waveH=90;           // max bar height
  const barW=5;
  const gap=2;
  const fullW=total*(barW+gap)-gap;
  const startX=(W-fullW)/2;
  // Bottom of waveform sits just above the bottom HUD: startY = H - waveH - 4
  const baseY=H-4;          // bars grow upward from here

  ctx.save();
  ctx.globalAlpha=0.88;
  for(let i=0;i<total;i++){
    // v: 0=silence, ±1=max amplitude; boost by 2.5 to make quiet tracks visible
    const v=Math.min(1,Math.abs((_waveformData[i]-128)/128)*2.5);
    const bh=Math.max(2, v*waveH);
    const bx=startX+i*(barW+gap);
    // Color: brighter green for loud, dim for quiet
    const intensity=v;
    if(intensity>0.6){
      ctx.fillStyle=`rgba(216,138,61,${0.55+intensity*0.45})`;
    } else if(intensity>0.25){
      ctx.fillStyle=`rgba(100,160,15,${0.4+intensity*0.4})`;
    } else {
      ctx.fillStyle=`rgba(110,42,42,${0.3+intensity*0.5})`;
    }
    // Draw bar upward from baseY
    ctx.fillRect(bx, baseY-bh, barW, bh);
  }

  // Glowing baseline
  ctx.globalAlpha=0.35;
  ctx.strokeStyle=COLS.gb2;
  ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(startX,baseY);
  ctx.lineTo(startX+fullW,baseY);
  ctx.stroke();

  ctx.globalAlpha=1;
  ctx.restore();
}

function stunKiller(src,dur){
  // LMS cinematic event
  if(lmsCam.active){
    lmsCam.slowTimer=Math.min(dur,2.2);
    lmsCam.barTarget=1;
    setTimeout(()=>{ lmsCam.barTarget=0; },Math.min(dur,2.2)*1000+400);
  }
  let d=dur;
  if(src&&hasStatus(src,'energized')) d*=1.25;
  if(src&&hasStatus(src,'survivor_rage')&&!src._rageLandedStun){
    d*=1.10;
    src._rageLandedStun=true;
    clearStatus(src,'survivor_rage');
    addLog(`${src.name} RAGE discharged — stun boosted!`,'stun');
    killer.statuses['stunned']={remaining:d,data:{}};
    killer.releaseGrab?.();killer.onStunned?.();
    return;
  }
  applyStatus(killer,'stunned',d,{});
  killer.releaseGrab?.();killer.onStunned?.();
}

function drawSmokescreens(){
  for(const sm of smokescreens){
    if(!sm.alive)continue;
    const lifeRatio=sm.timer/9;
    const a=Math.min(0.45,lifeRatio*0.5);
    ctx.fillStyle=`rgba(110,42,42,${a})`;
    ctx.fillRect(sm.x-sm.r,sm.y-sm.r,sm.r*2,sm.r*2);
    ctx.strokeStyle=`rgba(139,172,15,${a*0.6})`;ctx.lineWidth=1;ctx.setLineDash([3,3]);
    ctx.strokeRect(sm.x-sm.r,sm.y-sm.r,sm.r*2,sm.r*2);ctx.setLineDash([]);
  }
}


let _wallCanvas=null, _wallDirty=true;
function _buildWallCanvas(){
  if(!_wallCanvas) _wallCanvas=document.createElement('canvas');
  _wallCanvas.width=W; _wallCanvas.height=H;
  const wc=_wallCanvas.getContext('2d');
  wc.imageSmoothingEnabled=false;
  if(!mapGrid||!mapGrid.length)return;
  for(let cy=0;cy<ROWS_C;cy++) for(let cx=0;cx<COLS_C;cx++){
    const px=cx*CELL,py=cy*CELL;
    if(mapGrid[cy][cx]){
      wc.fillStyle=(cx+cy)%2===0?'#0d0a08':'#0e0b09';
      wc.fillRect(px,py,CELL,CELL);
    } else {
      wc.fillStyle=COLS.gb1;wc.fillRect(px,py,CELL,CELL);
      wc.fillStyle='#9a4a30';wc.fillRect(px,py,CELL,2);wc.fillRect(px,py,2,CELL);
      wc.fillStyle='#341512';wc.fillRect(px+CELL-2,py+2,2,CELL-2);wc.fillRect(px+2,py+CELL-2,CELL-4,2);
      wc.fillStyle='rgba(0,0,0,0.20)';wc.fillRect(px+2,py+2,CELL-4,CELL-4);
    }
  }
  wc.strokeStyle='rgba(110,42,42,0.12)';wc.lineWidth=1;
  for(let c=0;c<=COLS_C;c++){wc.beginPath();wc.moveTo(c*CELL,0);wc.lineTo(c*CELL,H);wc.stroke();}
  for(let r=0;r<=ROWS_C;r++){wc.beginPath();wc.moveTo(0,r*CELL);wc.lineTo(W,r*CELL);wc.stroke();}
}
function drawWalls(){
  if(!mapGrid||!mapGrid.length)return;
  if(!_wallCanvas||_wallCanvas.width!==W||_wallCanvas.height!==H||_wallDirty){
    _buildWallCanvas();_wallDirty=false;
  }
  ctx.drawImage(_wallCanvas,0,0);
}




let _uiTimer=0;
function loop(ts){
  if(!gameRunning)return;
  const rawDt=(ts-lastTime)/1000;lastTime=ts;
  
  if(parryImpactTimer>0){
    parryImpactTimer-=rawDt;
    if(parryImpactTimer>0){
        const flash=parryImpactTimer>PARRY_IMPACT_DUR*0.5;
        document.getElementById('screen').style.filter=flash?'brightness(100) grayscale(1)':'brightness(0)';
        ctx.clearRect(0,0,W,H);
        ctx.fillStyle=flash?'#ffffff':'#000000';
        ctx.fillRect(0,0,W,H);
        updateConfetti(rawDt);
        frameId=requestAnimationFrame(loop);
        return;
    } else {
        document.getElementById('screen').style.filter='';
    }
  }
  if(deathCameraEvent){
    deathCameraEvent.timer-=rawDt;
    if(deathCameraEvent.timer<=0){ deathCameraEvent=null; deathSlowTarget=1; }
  }
  deathSlowFactor+=(deathSlowTarget-deathSlowFactor)*(1-Math.exp(-3*rawDt));
  // LMS slow-mo
  if(lmsCam.active && lmsCam.slowTimer>0){
    lmsCam.slowTimer=Math.max(0,lmsCam.slowTimer-rawDt);
    lmsCam.slowTarget=lmsCam.slowTimer>0?0.22:1;
  } else if(lmsCam.active){
    lmsCam.slowTarget=1;
  }
  lmsCam.slowFactor=lmsCam.slowFactor+(lmsCam.slowTarget-lmsCam.slowFactor)*(1-Math.exp(-4*rawDt));
  lmsCam.barAlpha=lmsCam.barAlpha+(lmsCam.barTarget-lmsCam.barAlpha)*(1-Math.exp(-5*rawDt));
  const _lmsSlowMult=lmsCam.active?lmsCam.slowFactor:1;
  const dt=Math.min(0.1,rawDt)*simSpeed*deathSlowFactor*_lmsSlowMult;
  gameTimer+=dt;
  if(gameTimer>=gameDuration&&!gameOver){showEnd('SURVIVORS WIN',false,'Timer expired!');return;}
  if(!gameOver){
    updateTileSafety();
    
    const aliveSurvivors=survivors.filter(s=>s.alive).length;
    if(aliveSurvivors>8){
      applyStatus(killer,'king_of_rules',0.5,{});
      if(!killer._korLogged){
        killer._korLogged=true;
        addLog('KING OF RULES — killer damage ×10 until 8 survivors remain!','kill');
      }
      
      if(!deathTrackActive&&!lmsTrackActive) startDeathTrack();
    } else {
      const wasKoR=hasStatus(killer,'king_of_rules');
      clearStatus(killer,'king_of_rules');
      killer._korLogged=false;
      
      if(wasKoR&&deathTrackActive&&!lmsTrackActive) stopDeathTrack();
    }
    killer.update(dt);
    for(const s of survivors)if(s.alive)s.update(dt);
    updateBuildings(dt);updateProjectiles(dt);updateMines(dt);updateSmokescreens(dt);
    updateBlood(rawDt);updateExplosions(rawDt);
    if(Math.floor(gameTimer*10)%50===0)_flowCache.clear();
    if(Math.random()<0.0006){const p=randPos(50);scraps.push({x:p.x+rand(-CELL*0.32,CELL*0.32),y:p.y+rand(-CELL*0.32,CELL*0.32),collected:false,id:Math.random()});}
  }
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle=COLS.gb0;ctx.fillRect(0,0,W,H);
  updateCameraMode(dt);
  updateCameraBeat(dt);
  applyCameraTransform();
  drawWalls();
  drawTileSafety();
  drawBlood();   
  for(const s of survivors){if(!s.alive)continue;ctx.strokeStyle='rgba(139,172,15,0.04)';ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(killer.x,killer.y);ctx.lineTo(s.x,s.y);ctx.stroke();}
  drawScraps();drawMines();drawExplosions();drawSmokescreens();drawBuildings();drawProjectiles();
  updateAndDrawRunSmoke(dt);
  for(const s of survivors)s.draw();
  if(killer.alive)killer.draw();
  restoreCameraTransform();
  drawRingmaster();
  drawWaveform();

  // ── LMS Cinematic bars ────────────────────────────────────────────────────
  if(lmsCam.active && lmsCam.barAlpha>0.01){
    const barH=Math.round(H*0.085*lmsCam.barAlpha);
    ctx.fillStyle=`rgba(0,0,0,${lmsCam.barAlpha*0.92})`;
    ctx.fillRect(0,0,W,barH);
    ctx.fillRect(0,H-barH,W,barH);
  }
  if(_lmsFlashAlpha>0){
    _lmsFlashAlpha=Math.max(0,_lmsFlashAlpha-rawDt*2.2);
    ctx.fillStyle=`rgba(216,138,61,${_lmsFlashAlpha*0.82})`;
    ctx.fillRect(0,0,W,H);
  }

  updateConfetti(Math.min(rawDt, 0.05));
  const rem=Math.max(0,gameDuration-gameTimer);
  const remStr=`${Math.floor(rem/60)}:${(rem%60|0).toString().padStart(2,'0')}`;
  ctx.fillStyle=COLS.gb0;ctx.fillRect(W/2-38,3,76,16);
  ctx.strokeStyle=rem<30?COLS.gb1:COLS.gb2;ctx.lineWidth=1;ctx.strokeRect(W/2-38,3,76,16);
  ctx.fillStyle=rem<30?COLS.gb2:COLS.gb3;ctx.font='11px VCROSD,monospace';ctx.textAlign='center';
  ctx.fillText(remStr,W/2,15);ctx.textAlign='left';
  ctx.fillStyle=COLS.gb1;ctx.font='8px VCROSD,monospace';
  ctx.fillText(`ELIM:${killerElimCount}/${survivors.length} STUNS:${killerMemory.stunsReceived} PHASE:${killer?killer.adaptPhase:0}`,260,H-6);
  
  if(killer&&gameRunning){
    const _el=[killer,...survivors.filter(s=>s.alive)];
    const _t=_el[Math.min(cameraState.individualIdx,_el.length-1)];
    const modeLabel=cameraState.mode==='normal'?'CAM:FULL':
                    cameraState.mode==='action' ?'CAM:ACTION':
                    cameraState.mode==='lms-cam'?'CAM:LMS':
                    'CAM:'+(_t?(_t===killer?'KILLER':_t.name):'?');
    ctx.fillStyle='rgba(20,16,12,0.82)';
    ctx.fillRect(W-108,3,105,14);
    ctx.strokeStyle=COLS.gb1;ctx.lineWidth=1;
    ctx.strokeRect(W-108,3,105,14);
    ctx.fillStyle=COLS.gb2;ctx.font='8px VCROSD,monospace';ctx.textAlign='right';
    ctx.fillText(modeLabel+' [C/N]',W-4,13);ctx.textAlign='left';
  }
  _uiTimer+=rawDt;
  if(_uiTimer>=0.1){_uiTimer=0;updateUI();}
  if(hoveredEntity===killer) showKillerTooltip({clientX:parseFloat(tooltipEl.style.left)-12, clientY:parseFloat(tooltipEl.style.top)-12});
  frameId=requestAnimationFrame(loop);
}