class Assault extends Survivor {
  constructor(x,y,name){
    super(x,y,name,COLS.gb2,'assault');
    this.baseSpeed=85;
    this.grenadeCD=0;
    this.bulletCount=5;
    this.maxBullets=5;
    this.pistolCD=0;
    this.reloadDuration=10;
    this.reloadProgress=0;
    applyStatus(this,'iron_body',99999,{});
  }
  effectiveMaxHp(){ return this.maxHp; }
  kitUpdate(dt){
    if(this.grenadeCD>0) this.grenadeCD=Math.max(0,this.grenadeCD-dt/this.cdMult());
    if(this.pistolCD>0)  this.pistolCD=Math.max(0,this.pistolCD-dt/this.cdMult());
    
    if(!hasStatus(this,'iron_body')) applyStatus(this,'iron_body',99999,{});

    
    if(hasStatus(this,'reloading')&&this.bulletCount<this.maxBullets){
      this.reloadProgress+=dt;
      const bulletsPerSec=this.maxBullets/this.reloadDuration;
      const newBullets=Math.floor(this.reloadProgress*bulletsPerSec);
      if(newBullets>0){
        this.bulletCount=Math.min(this.maxBullets,this.bulletCount+newBullets);
        this.reloadProgress-=newBullets/bulletsPerSec;
      }
      if(this.bulletCount>=this.maxBullets){
        clearStatus(this,'reloading');
        addLog(`${this.name} reloaded!`,'skill');
      }
    }

    const u=this.skillUrgency();
    const kd=dist(this,killer);

    if(this.pistolCD<=0&&this.bulletCount>0&&!hasStatus(this,'reloading')&&kd<this.skillRange(300,450)&&killer.alive){
      if(u>0.3||kd<200) this.shoot();
    }
    if(this.grenadeCD<=0&&kd<this.skillRange(240,400)&&killer.alive&&!hasStatus(killer,'stunned')){
      if(u>0.5||kd<160) this.throwGrenade();
    }
  }
  throwGrenade(){
    const kd=dist(this,killer);
    const _baseStunT=0.5+Math.max(0,1-(kd/350))*2.5;
    // dynStun scales with urgency (+30% at max urgency) then lmsScale handles LMS ×3
    const stunT=this.lmsScale(this.dynStun(_baseStunT)/_baseStunT*_baseStunT);
    
    const throwA=Math.atan2(killer.y+rand(-35,35)-this.y, killer.x+rand(-35,35)-this.x);
    const throwSpd=190+rand(-20,50);
    projectiles.push({
      type:'grenade',
      x:this.x,y:this.y,
      vx:Math.cos(throwA)*throwSpd,
      vy:Math.sin(throwA)*throwSpd,
      sliding:true,
      stunT,alive:true,age:0,id:Math.random()
    });
    this.grenadeCD=(this.lmsActive?15:30)*this.cdMult();
    if(hasStatus(this,'ammo_pack')) this._consumeAmmoPack();
    addLog(`${this.name} threw grenade!`,'skill');
  }
  shoot(){
    if(this.bulletCount<=0) return;
    const kd=dist(this,killer);
    if(!this.rollAccuracy(kd)){
      addLog(`${this.name} pistol missed!`,'skill');
      this.bulletCount--;
    } else {
      const _pistolStun=this.dynStun(1);
      const _pistolBlind=this.lmsScale(2);
      applyStatus(killer,'stunned',_pistolStun,{});
      applyStatus(killer,'blinded',_pistolBlind,{});
      killer.releaseGrab?.();killer.onStunned?.();
      addLog(`${this.name} pistol HIT! Stunned 1s, Blinded 2s`,'stun');
      this.bulletCount--;
    }
    this.pistolCD=(this.lmsActive?0.5:1)*this.cdMult();
    if(this.bulletCount<=0&&!hasStatus(this,'reloading')){
      applyStatus(this,'reloading',this.reloadDuration,{});
      this.reloadProgress=0;
      addLog(`${this.name} reloading pistol!`,'skill');
    }
    if(hasStatus(this,'ammo_pack')) this._consumeAmmoPack();
  }
  draw(){
    super.draw();
    if(!this.alive) return;
    ctx.fillStyle=COLS.gb2;ctx.font='8px VCROSD,monospace';ctx.textAlign='center';
    ctx.fillText(`${this.bulletCount}/${this.maxBullets}`,this.x,this.y+this.r+20);ctx.textAlign='left';
  }
}