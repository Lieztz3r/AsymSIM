class Commander extends Survivor {
  constructor(x,y,name){
    super(x,y,name,COLS.recon,'commander');
    this.baseSpeed=80;
    this.airdropCD=0;
    this.airdropPending=null; 
    this.rayActive=false;
    this.rayTimer=0;
    this.skill2CD=0;
  }
  kitUpdate(dt){
    if(this.airdropCD>0) this.airdropCD=Math.max(0,this.airdropCD-dt/this.cdMult());
    if(this.skill2CD>0)  this.skill2CD=Math.max(0,this.skill2CD-dt/this.cdMult());

    
    if(this.airdropPending){
      if(!this.airdropPending.landed) this.airdropPending.timer-=dt;
      if(this.airdropPending.timer<=0&&!this.airdropPending.landed){
        this.airdropPending.landed=true;
        addLog(`Airdrop box landed!`,'skill');
      }
      if(this.airdropPending.landed){
        
        for(const s of survivors){
          if(!s.alive) continue;
          if(Math.hypot(s.x-this.airdropPending.x,s.y-this.airdropPending.y)<30){
            const pool=['x_ray','ammo_pack','rocket_boots'];
            const pick=pool[Math.floor(Math.random()*pool.length)];
            const durations={x_ray:6,ammo_pack:30,rocket_boots:60};
            applyStatus(s,pick,durations[pick],{});
            addLog(`${s.name} got ${pick.replace('_',' ').toUpperCase()} from airdrop!`,'skill');
            this.airdropPending=null;
            break;
          }
        }
      }
    }

    
    if(this.rayActive){
      this.rayTimer-=dt;
      
      applyStatus(killer,'slowed',0.1,{amount:0.55});
      applyStatus(this,'slowed',0.1,{amount:0.15});
      
      const killerPositive=['resistance','highlighted'];
      for(const k of killerPositive){
        const st=getStatus(killer,k);
        if(st) st.remaining=Math.max(0,st.remaining-dt);
      }
      if(killer.rageActive) killer.rageTimer=Math.max(0,killer.rageTimer-dt);
      if(this.rayTimer<=0){
        this.rayActive=false;
        clearStatus(this,'slowed');
        addLog(`${this.name} ray beam ended`,'skill');
      }
    }

    const u=this.skillUrgency();
    if(this.airdropCD<=0&&!this.airdropPending){
      const mateNeedsHelp=survivors.some(s=>s!==this&&s.alive&&(s.hp<s.effectiveMaxHp()*0.6||s.currentlyChased));
      const selfNeedsHelp=this.hp<this.effectiveMaxHp()*0.7||this.currentlyChased;
      if(mateNeedsHelp||selfNeedsHelp) this.useAirdrop();
    }
    if(this.skill2CD<=0&&!this.rayActive){
      const kd=dist(this,killer);
      const killerActive=killer.alive&&!hasStatus(killer,'stunned')&&!hasStatus(killer,'blinded');
      if(kd<this.skillRange(300,500)&&killerActive&&u>0.35) this.useRay();
    }
  }
  useAirdrop(){
    this.airdropPending={x:this.x,y:this.y,timer:12,landed:false};
    this.airdropCD=this.lmsActive?37:75;
    if(hasStatus(this,'ammo_pack')) this._consumeAmmoPack();
    addLog(`${this.name} called Airdrop — arrives in 12s`,'skill');
  }
  useRay(){
    this.rayActive=true;
    const _rayDur=this.lmsScale(4)*(1+this.skillUrgency()*0.3);
    this.rayTimer=_rayDur;
    this.skill2CD=(this.lmsActive?30:60)*this.cdMult();
    if(hasStatus(this,'ammo_pack')) this._consumeAmmoPack();
    addLog(`${this.name} firing Ray Beam!`,'skill');
  }
  draw(){
    super.draw();
    if(!this.alive){ this.airdropPending=null; this.rayActive=false; return; }
    if(this.airdropPending){
      const a=this.airdropPending;
      const fl=Math.sin(Date.now()/200)>0;
      ctx.strokeStyle=fl?COLS.gb3:COLS.gb2;ctx.lineWidth=1;ctx.setLineDash([3,3]);
      ctx.strokeRect(a.x-16,a.y-16,32,32);ctx.setLineDash([]);
      ctx.fillStyle=COLS.gb2;ctx.font='8px VCROSD,monospace';ctx.textAlign='center';
      ctx.fillText(a.landed?'BOX':Math.ceil(a.timer)+'s',a.x,a.y+3);ctx.textAlign='left';
    }
    
    if(this.rayActive&&killer.alive&&this.alive){
      const alpha=0.4+0.4*Math.sin(Date.now()/60);
      ctx.strokeStyle=`rgba(100,200,255,${alpha})`;ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(this.x,this.y);ctx.lineTo(killer.x,killer.y);ctx.stroke();
      ctx.lineWidth=1;
    }
  }
}