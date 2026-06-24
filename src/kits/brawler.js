class Brawler extends Survivor {
  constructor(x,y,name){
    super(x,y,name,COLS.brawler,'brawler');
    this.maxHp=120;this.hp=120;
    this.punchStacks=2;this.punchCD=0;this.punchState='ready';
    this.stack1Timer=0;this.punchRange=54;
    this.facingSpeed=9.0;
    this.huntTimer=0;
    this.parryCD=0;this.parrying=false;this.parryTimer=0;
  }
  
  kitUpdate(dt){
    if(this.punchCD>0) this.punchCD=Math.max(0,this.punchCD-dt/this.cdMult());
    if(this.parryCD>0) this.parryCD=Math.max(0,this.parryCD-dt/this.cdMult());
    if(!this.betweenPunchTimer) this.betweenPunchTimer=0;
    if(this.betweenPunchTimer>0) this.betweenPunchTimer=Math.max(0,this.betweenPunchTimer-dt);
    if(this.punchStacks<2&&this.punchState==='cooldown1'){
      this.stack1Timer-=dt;
      if(this.stack1Timer<=0){this.punchStacks=0;this.punchCD=10*this.cdMult();this.punchState='cd';}
    }
    if(this.punchCD<=0&&this.punchState==='cd'){this.punchStacks=2;this.punchState='ready';}
    if(this.parrying){
      this.parryTimer-=dt;
      if(this.parryTimer<=0){
        this.parrying=false;
        clearStatus(this,'parry');
        applyStatus(this,'slowed',2.5,{amount:0.75});
        applyStatus(this,'weakness',4,{});
        addLog(`${this.name} parry expired — slowed!`,'skill');
      }
    }

    const kd=dist(this,killer);

    
    const punchRange=this.skillRange(this.punchRange, this.punchRange*1.1);
    if(kd<punchRange && this.punchStacks>0 && this.punchCD<=0 &&
       killer.alive && !hasStatus(killer,'stunned') && !this.parrying){
      this.punch();
      this.lastKillerDist=kd;
      return; 
    }

    
    
    const parryRange=this.skillRange(48, 68);
    const killerThreatening=
      !killer.grabbedSurvivor &&
      !hasStatus(killer,'stunned') &&
      !hasStatus(killer,'blinded') &&
      kd < parryRange &&
      killer.alive;
    const killerApproaching=kd<(this.lastKillerDist||kd+1);
    if(!this.lastKillerDist) this.lastKillerDist=kd;
    this.lastKillerDist=kd;

    
    const punchExhausted=this.punchStacks===0&&this.punchCD>0;
    if(this.parryCD<=0 && !this.parrying && !hasStatus(this,'weakness') &&
       punchExhausted && killerThreatening && killerApproaching){
      this.activateParry();
    }
  }
  aiUpdate(dt){
    super.aiUpdate(dt);
  }
  doPatrol(dt){
    this.huntTimer-=dt;
    if(this.knownKillerPos&&dist(this,this.knownKillerPos)>80&&this.huntTimer<=0){
      const fd=getFlowDir(this.x,this.y,this.knownKillerPos.x,this.knownKillerPos.y);
      this.moveDir(fd.dx,fd.dy,this.effectiveSpeed(false)*0.75,dt);
      if(fd.dx||fd.dy)this.facingTarget=Math.atan2(fd.dy,fd.dx);
    } else {
      super.doPatrol(dt);
    }
  }
  punch(){
    const kd=dist(this,killer);
    
    if(!this.betweenPunchTimer) this.betweenPunchTimer=0;
    if(this.betweenPunchTimer>0) return;
    if(!this.rollAccuracy(kd)){
      addLog(`${this.name} punch missed!`,'stun');
      this.punchStacks--;
      if(this.punchStacks<=0){this.punchState='cd';this.punchCD=12*this.cdMult();}
      else{this.punchState='cooldown1';this.stack1Timer=5;}
      return;
    }
    const already=hasStatus(killer,'punched');
    if(!already){
      applyStatus(killer,'punched',2,{brawler:this.id});
      const {dur:_slowDur,amount:_slowAmt}=this.dynSlow(2,0.35);
      applyStatus(killer,'slowed',this.lmsScale(_slowDur),{amount:this.lmsActive?_slowAmt/3:_slowAmt});
      applyStatus(killer,'silenced',this.lmsScale(this.dynStun(1.5)),{});
      this.betweenPunchTimer=0.1;
      const a=angle(this,killer);
      killer.knockbackVX=Math.cos(a)*480; killer.knockbackVY=Math.sin(a)*480;
      killer.releaseGrab?.();killer.onStunned?.();
      
      if(!this.lmsActive) applyStatus(this,'weakness',5,{});
      else applyStatus(this,'weakness',Math.ceil(5/3),{});
      this.punchStacks--;this.punchState='cooldown1';this.stack1Timer=5;
      addLog(`${this.name} PUNCHED killer! [SLOWED 2s | SILENCED 1.5s]`,'stun');
    } else {
      const pd=getStatus(killer,'punched');
      if(pd&&pd.data.brawler===this.id){
        if(!this.rollAccuracy(kd)){
          addLog(`${this.name} strike missed!`,'stun');
          this.punchStacks--;this.punchState='cd';this.punchCD=25*this.cdMult();
          return;
        }
        const _bStun=this.lmsScale(this.dynStun(3.5));
        const _bSlow=this.lmsScale(this.dynSlow(3.5,0.75).dur);
        applyStatus(killer,'striken',_bStun,{});applyStatus(killer,'stunned',_bStun,{});
        applyStatus(killer,'blinded',_bStun,{});applyStatus(killer,'slowed',_bSlow,{amount:0.75});
        this.betweenPunchTimer=1.0;
        const a=angle(this,killer);
        killer.knockbackVX=Math.cos(a)*820; killer.knockbackVY=Math.sin(a)*820;
        killer.releaseGrab?.();killer.onStunned?.();
        clearStatus(killer,'punched');
        this.punchStacks--;this.punchState='cd';this.punchCD=25*this.cdMult();this.stack1Timer=0;
        addLog(`${this.name} STRIKE — killer [STUNNED+BLINDED+SLOWED 3.5s]!`,'stun');
      } else {
        applyStatus(killer,'punched',2,{brawler:this.id});applyStatus(killer,'slowed',2,{amount:0.35});
        this.punchStacks--;this.punchState='cooldown1';this.stack1Timer=5;
        addLog(`${this.name} punch (renewed)`,'stun');
      }
    }
  }
activateParry(){
    this.parrying=true;
    this.parryTimer=1.5;
    applyStatus(this,'parry',1.5,{});
    this.parryCD=22*this.cdMult();
    addLog(`${this.name} PARRY!`,'stun');
  }
  evaluateState(dt){
    const kd=dist(this,killer);
    const selfSafety=worldSafety(this.x,this.y);

    
    if(hasStatus(this,'weakness')){
      this._applyStateTransition('flee', SURVIVOR_STATE_TIER['flee']);
      return;
    }

    const killerStunned=hasStatus(killer,'stunned');
    const killerVulnerable=!killerStunned&&!hasStatus(killer,'blinded');
    const mateGrabbed=survivors.some(s=>s!==this&&s.alive&&hasStatus(s,'grabbed'));
    const mateChased=survivors.some(s=>s!==this&&s.alive&&s.currentlyChased&&dist(s,killer)<300);
    const shouldEngage=killerVulnerable&&(mateGrabbed||mateChased||kd<90);

    
    const engageRange=hasStatus(this,'resistance')?400:320;

    
    let maxSafety=0;
    for(let cy=1;cy<ROWS_C-1;cy++) for(let cx=1;cx<COLS_C-1;cx++){
      if(!mapGrid[cy][cx])continue;
      const s=getTileSafety(cx,cy);
      if(s>maxSafety)maxSafety=s;
    }
    const fightSafetyThreshold=Math.floor(maxSafety*0.45);
    const canFight=selfSafety<=fightSafetyThreshold;
    // Brawler uses OFFENSIVE skills — be more aggressive when ready
    const hasPunchReady=this.punchStacks>0&&this.punchCD<=0;
    const hasParryReady=this.parryCD<=0&&!this.parrying;
    const offensiveReady=hasPunchReady||hasParryReady;
    const wantFight=canFight&&(
      (killerStunned&&hasPunchReady&&kd<this.punchRange)||
      (offensiveReady&&this.alertLevel>=1&&kd<engageRange&&shouldEngage)
    );
    if(wantFight){
      this._applyStateTransition('fight', SURVIVOR_STATE_TIER['fight']);
      return;
    }
    super.evaluateState(dt);
  }
  doFight(dt){
    this.updateStamina(dt,false);
    const kd=dist(this,killer);
    const killerStunned=hasStatus(killer,'stunned')||hasStatus(killer,'blinded');

    
    if(worldSafety(this.x,this.y)>=Math.floor(_cachedMaxSafety*0.45)&&!killerStunned){
      this._applyStateTransition('flee', SURVIVOR_STATE_TIER['flee']);
      return;
    }

    
    
    if(killerStunned&&(this.punchStacks===0||this.punchCD>0||kd>this.punchRange)){
      const a=Math.atan2(this.y-killer.y,this.x-killer.x);
      this.smoothMove(Math.cos(a),Math.sin(a),this.effectiveSpeed(false)*1.1,dt);
      
      this._applyStateTransition('flee', SURVIVOR_STATE_TIER['flee']);
      return;
    }

    
    const STANDOFF=this.punchRange*0.8;
    if(kd>this.punchRange+12){
      const fd=getFlowDir(this.x,this.y,killer.x,killer.y);
      this.smoothMove(fd.dx,fd.dy,this.effectiveSpeed(false),dt);
    } else if(kd<STANDOFF){
      
      const a=Math.atan2(this.y-killer.y,this.x-killer.x);
      this.smoothMove(Math.cos(a),Math.sin(a),this.effectiveSpeed(false)*0.9,dt);
    } else {
      
      const a=Math.atan2(this.y-killer.y,this.x-killer.x)+Math.PI/2*this.strafeDir;
      this.smoothMove(Math.cos(a),Math.sin(a),this.effectiveSpeed(false)*0.25,dt);
    }
  }
}