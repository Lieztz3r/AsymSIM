class Recon extends Survivor {
  constructor(x,y,name){
    super(x,y,name,COLS.recon,'recon');
    this.baseSpeed=92;
    this.staminaDrain=18; this.staminaRegen=15;
    this.scanWaveRadius=0; this.scanWaveMax=195; this.scanWaveActive=false;
    this.smokePlaced=null;
  }
  
  kitUpdate(dt){
    const u=this.skillUrgency();

    for(const m of mines){
      if(!m.alive||!m.revealed) continue;
      if(dist(this,m)<this.skillRange(220,300)) this.lastSeenRevealedMine={x:m.x,y:m.y};
    }
    if(this.scanWaveActive){
      this.scanWaveRadius+=dt*300;
      if(this.scanWaveRadius>=this.scanWaveMax) this.scanWaveActive=false;
    }
    if(this.smokePlaced&&!this.smokePlaced.alive) this.smokePlaced=null;

    
    
    if(this.skill1CD<=0){
      const scanRange=this.skillRange(this.scanWaveMax*0.7, this.scanWaveMax);
      const nearMines=mines.filter(m=>m.alive&&!m.revealed&&dist(this,m)<scanRange);
      const proactive=u>0.5&&!this.scanWaveActive;
      if(nearMines.length>0||proactive) this.useMineScan();
    }

    
    
    if(this.skill2CD<=0&&!this.smokePlaced){
      const kd=dist(this,killer);
      const smokeKillerRange=this.skillRange(240,360);
      const chasingMate=survivors.find(s=>
        s!==this && s.alive && s.currentlyChased &&
        dist(s,killer)<this.skillRange(220,320) &&
        dist(this,s)<this.skillRange(300,420)
      );
      const useOnSelf=this.currentlyChased && kd<smokeKillerRange;
      const useOnMate=!!chasingMate;
      // Proactively use smoke when a teammate with DEFENSIVE skills is in danger
      const mateDefensive=survivors.find(s=>
        s!==this&&s.alive&&s.currentlyChased&&
        (skillHasClass(`${s.kit}_parry`,'defensive')||skillHasClass(`${s.kit}_heal`,'defensive'))&&
        dist(this,s)<this.skillRange(300,420)
      );
      const proactiveDeploy=(u>0.6&&kd<this.skillRange(0,280))||!!mateDefensive;
      if(useOnSelf||useOnMate||proactiveDeploy) this.useSmokescreen(chasingMate||mateDefensive||null);
    }
  }

  useMineScan(){
    this.skill1CD=25*this.cdMult();
    this.scanWaveRadius=0; this.scanWaveActive=true;
    let revealed=0;
    for(const m of mines){
      if(!m.alive) continue;
      if(dist(this,m)<this.scanWaveMax){
          m.revealed=true; m.revealTimer=this.lmsScale(14);
        revealed++;
        for(const s of survivors){
          if(s.alive) s.lastSeenRevealedMine={x:m.x,y:m.y};
        }
      }
    }
    addLog(`${this.name} Mine Scan — ${revealed} mine(s) revealed`,'skill');
  }

  useSmokescreen(chasingMate){
    this.skill2CD=30*this.cdMult();
    let sx,sy;
    if(this.currentlyChased&&dist(this,killer)<320){
      const midA=Math.atan2(killer.y-this.y,killer.x-this.x);
      const pd=Math.min(dist(this,killer)*0.42,85);
      sx=this.x+Math.cos(midA)*pd; sy=this.y+Math.sin(midA)*pd;
    } else if(chasingMate){
      const midA=Math.atan2(killer.y-chasingMate.y,killer.x-chasingMate.x);
      const pd=Math.min(dist(chasingMate,killer)*0.38,80);
      sx=chasingMate.x+Math.cos(midA)*pd; sy=chasingMate.y+Math.sin(midA)*pd;
    } else {
      sx=this.x+Math.cos(this.facing)*75+rand(-25,25);
      sy=this.y+Math.sin(this.facing)*75+rand(-25,25);
    }
    const scx=Math.floor(sx/CELL),scy=Math.floor(sy/CELL);
    if(scx<0||scy<0||scx>=COLS_C||scy>=ROWS_C||!mapGrid[scy][scx]){
      sx=this.x+rand(-55,55); sy=this.y+rand(-55,55);
    }
    const sm={x:sx,y:sy,r:62,alive:true,timer:9,killerInside:false,id:Math.random()};
    smokescreens.push(sm);
    this.smokePlaced=sm;
    addLog(`${this.name} deployed Smokescreen`,'skill');
  }

  aiUpdate(dt){
    const kd=dist(this,killer);
    if(kd<170&&this.alertLevel>=1.5){
      this._applyStateTransition('flee', SURVIVOR_STATE_TIER['flee']);
    }
    super.aiUpdate(dt);
  }

  evaluateState(dt){
    const kd=dist(this,killer);
    const selfSafety=worldSafety(this.x,this.y);
    const killerVulnerable=hasStatus(killer,'blinded')||hasStatus(killer,'stunned');

    
    if(hasStatus(this,'weakness')){
      this._applyStateTransition('flee', SURVIVOR_STATE_TIER['flee']);
      return;
    }

    
    
    const fightRange=hasStatus(this,'resistance')?480:380;
    if(killerVulnerable&&selfSafety>=2&&selfSafety<=4&&kd<fightRange&&!hasStatus(this,'weakness')){
      this._applyStateTransition('fight', SURVIVOR_STATE_TIER['fight']);
      return;
    }
    super.evaluateState(dt);
  }

  doFight(dt){
    this.updateStamina(dt,false);
    const selfSafety=worldSafety(this.x,this.y);
    const kd=dist(this,killer);

    if(selfSafety<2){
      
      const a=Math.atan2(this.y-killer.y,this.x-killer.x);
      this.smoothMove(Math.cos(a),Math.sin(a),this.effectiveSpeed(false),dt);
    } else if(selfSafety>4){
      
      const fd=getFlowDir(this.x,this.y,killer.x,killer.y);
      const flen=Math.hypot(fd.dx,fd.dy)||1;
      this.smoothMove(fd.dx/flen,fd.dy/flen,this.effectiveSpeed(false)*0.7,dt);
    } else {
      
      const perp=Math.atan2(this.y-killer.y,this.x-killer.x)+Math.PI/2*this.strafeDir;
      this.smoothMove(Math.cos(perp),Math.sin(perp),this.effectiveSpeed(false)*0.45,dt);
    }
  }

  draw(){
    super.draw();
    if(this.scanWaveActive&&this.scanWaveRadius>0){
      const alpha=Math.max(0,0.8*(1-this.scanWaveRadius/this.scanWaveMax));
      ctx.strokeStyle=`rgba(216,138,61,${alpha})`;ctx.lineWidth=1;ctx.setLineDash([4,4]);
      ctx.beginPath();ctx.arc(this.x,this.y,this.scanWaveRadius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    }
    if(this.smokePlaced&&this.smokePlaced.alive){
      ctx.strokeStyle='rgba(110,42,42,0.35)';ctx.lineWidth=1;ctx.setLineDash([2,4]);
      ctx.strokeRect(this.smokePlaced.x-this.smokePlaced.r,this.smokePlaced.y-this.smokePlaced.r,this.smokePlaced.r*2,this.smokePlaced.r*2);
      ctx.setLineDash([]);
    }
  }
}