class Sniper extends Survivor {
  constructor(x,y,name){
    super(x,y,name,COLS.gb2,'sniper');
    this.baseSpeed=78;
    this.skill1CD=0;
    this.skill2CD=0;
    this.maxCharge=10;
    this.chargeTimer=0;
    this.isCharging=false;
    this.sodaActive=false;
    this.sodaTimer=0;
    this.instantShot=false;
  }
  aiUpdate(dt){
    if(this.isCharging){
      this.velX=0;this.velY=0;
      this.stamina=Math.min(this.maxStamina,this.stamina+this.staminaRegen*dt);
      return;
    }
    super.aiUpdate(dt);
  }
  update(dt){
    if(this.isCharging===this){
      // Rooted while player-charging: tick statuses, kit, facing, but no movement
      tickStatuses(this,dt);
      pushOutOfWall(this);
      this.velX=0; this.velY=0;
      if(this.skill1CD>0) this.skill1CD=Math.max(0,this.skill1CD-dt/this.cdMult());
      if(this.skill2CD>0) this.skill2CD=Math.max(0,this.skill2CD-dt/this.cdMult());
      this.kitUpdate(dt);
      this.facingSmooth=lerpAngle(this.facingSmooth||this.facing,this.facingTarget,1-Math.exp(-this.facingSpeed*dt));
      this.facing=this.facingSmooth;
      return;
    }
    super.update(dt);
  }

  kitUpdate(dt){
    if(this.skill1CD>0) this.skill1CD=Math.max(0,this.skill1CD-dt/this.cdMult());
    if(this.skill2CD>0) this.skill2CD=Math.max(0,this.skill2CD-dt/this.cdMult());
    if(this.sodaActive&&hasStatus(this,'energized')){
      this.sodaTimer-=dt;
      if(this.sodaTimer<=0){
        this.sodaActive=false;
        clearStatus(this,'energized');
        applyStatus(this,'speed_ii',30,{});
        applyStatus(this,'invincibility',5,{});
        this.instantShot=true;
        addLog(`${this.name} soda expired — SPEED II + INVINCIBILITY + INSTANT SHOT!`,'skill');
      }
    } else if(this.sodaActive&&!hasStatus(this,'energized')){
      this.sodaActive=false;
    }
    if(this.isCharging){
      const _totalDur=this._chargeTotalDur||this.maxCharge;
      const _cSt=getStatus(this,'charging');
      // Drive chargeTimer from the status remaining so visual always matches mechanical state
      if(_cSt){
        this.chargeTimer=Math.max(0,_totalDur-_cSt.remaining);
      } else {
        // Status was cleared externally (interrupt) — mark complete
        this.chargeTimer=_totalDur;
      }
      const frac=Math.min(1,this.chargeTimer/_totalDur);
      const u=this.skillUrgency();
      const kd=dist(this,killer);
      const shouldFire=
        frac>=1.0||
        (frac>=0.75&&u>0.75)||
        (frac>=0.50&&u>0.88)||
        (frac>=0.25&&u>0.96)||
        kd>Math.hypot(W,H)*0.85;
      if(shouldFire) this.shoot();
      return;
    }
    const u=this.skillUrgency();
    const kd=dist(this,killer);
    if(this.skill1CD<=0&&!this.isCharging&&killer.alive&&kd>CELL*2&&(u>0.25||kd<CELL*5)){
      this.beginCharge();
    }
    if(this.skill2CD<=0&&!this.sodaActive&&u<0.45&&!hasStatus(this,'energized')){
      this.drinkSoda();
    }
  }
  beginCharge(){
    this.isCharging=true;
    this.chargeTimer=0;
    if(this.instantShot){
      this.instantShot=false;
      this.chargeTimer=this.maxCharge;
    } else {
      applyStatus(this,'charging',this.maxCharge,{});
      // Sync chargeTimer to actual status duration (may be scaled by LMS/energized)
      const st=getStatus(this,'charging');
      if(st) this._chargeTotalDur=st.remaining;
      else this._chargeTotalDur=this.maxCharge;
    }
  }
  shoot(){
    const frac=Math.min(1,this.chargeTimer/this.maxCharge);
    let stunMult=frac>=1.0?2.0:frac>=0.75?1.75:frac>=0.5?1.5:1.25;
    const baseStun=2.5;
    const kd=dist(this,killer);
    const maxDist=Math.hypot(W,H);
    const _accPenalty=this.lmsActive?2.2/3:2.2;
    const accFrac=Math.max(0.18,1-(kd/maxDist)*_accPenalty);
    if(Math.random()<accFrac){
      const stunDur=this.lmsScale(baseStun*stunMult);
      stunKiller(this,stunDur);
      if(frac>=0.5) applyStatus(killer,'slowed',4,{amount:0.24});
      if(frac>=0.75) applyStatus(killer,'blinded',4,{});
      if(frac>=1.0){
        applyStatus(this,'speed',15,{});
        applyStatus(this,'invincibility',5,{});
        addLog(`${this.name} FULL CHARGE — Speed + Invincibility!`,'skill');
      }
      addLog(`${this.name} SNIPE! ${stunDur.toFixed(1)}s stun (${Math.round(frac*100)}% charge)`,'stun');
      if(this.sodaActive&&hasStatus(this,'energized')){
        this.sodaActive=false;
        clearStatus(this,'energized');
        applyStatus(this,'fatigued',3,{});
        addLog(`${this.name} Energized discharged — Fatigued 3s`,'skill');
      }
    } else {
      addLog(`${this.name} sniper missed (dist: ${Math.round(kd)}px)`,'skill');
    }
    this.isCharging=false;
    this.chargeTimer=0;
    clearStatus(this,'charging');
    this.skill1CD=(this.lmsActive?27:55)*this.cdMult();
  }
  drinkSoda(){
    this.sodaActive=true;
    this.sodaTimer=30;
    applyStatus(this,'energized',30,{});
    this.skill2CD=(this.lmsActive?40:80)*this.cdMult();
    addLog(`${this.name} drinks soda — ENERGIZED!`,'skill');
  }
  draw(){
    super.draw();
    if(this.isCharging&&killer.alive&&this.alive){
      const _dDur=this._chargeTotalDur||this.maxCharge;
      const frac=Math.min(1,this.chargeTimer/_dDur);
      const r=Math.round(140+frac*115);
      const g=Math.round(60*(1-frac));
      ctx.strokeStyle=`rgba(${r},${g},0,${0.22+frac*0.68})`;
      ctx.lineWidth=1+frac*3;ctx.setLineDash([5,5]);
      ctx.beginPath();ctx.moveTo(this.x,this.y);ctx.lineTo(killer.x,killer.y);ctx.stroke();
      ctx.setLineDash([]);ctx.lineWidth=1;
      // Charge % readout above the sniper
      ctx.fillStyle=`rgba(${r},${g},0,0.92)`;
      ctx.font='bold 9px VCROSD,monospace';ctx.textAlign='center';
      ctx.fillText(`${Math.round(frac*100)}%`,this.x,this.y-this.r-14);
      ctx.textAlign='left';
    }
    if(this.sodaActive&&this.alive){
      const fl=Math.sin(Date.now()/220)>0;
      ctx.strokeStyle=fl?COLS.gb3:COLS.gb2;ctx.lineWidth=1;ctx.setLineDash([1,2]);
      ctx.strokeRect(this.x-this.r-5,this.y-this.r-5,this.r*2+10,this.r*2+10);
      ctx.setLineDash([]);
    }  
  }
}

function spawnScraps(){
  scraps=[];
  for(let i=0;i<22;i++){
    const p=randPos(50);
    scraps.push({x:p.x+rand(-CELL*0.32,CELL*0.32),y:p.y+rand(-CELL*0.32,CELL*0.32),collected:false,id:Math.random()});
  }
}

function drawScraps(){
  for(const s of scraps){
    if(s.collected)continue;
    ctx.fillStyle=COLS.gb0;ctx.fillRect(s.x-3+1,s.y-3+1,6,6);
    ctx.fillStyle=COLS.gb2;ctx.fillRect(s.x-3,s.y-3,6,6);
    ctx.fillStyle=COLS.gb3;ctx.fillRect(s.x-3,s.y-3,2,2);
  }
}