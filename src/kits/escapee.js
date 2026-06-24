class Escapee extends Survivor {
  constructor(x,y,name){
    super(x,y,name,COLS.escapee,'escapee');
    this.baseSpeed=95;this.staminaDrain=17;this.staminaRegen=17;
    this.slingChargeTimer=0;
    this.baitMode=false;
    this.baitTimer=0;
  }
  takeDamage(amount,src){
    if(hasStatus(this,'self_healing')){
      clearStatus(this,'self_healing');
      applyStatus(this,'speed_ii',4,{});
      applyStatus(this,'weakness',6,{});
      addLog(`${this.name} healing interrupted — Speed II & Weakness!`,'kill');
    }
    super.takeDamage(amount,src);
  }
  
  kitUpdate(dt){
    
    if(hasStatus(this,'self_healing')){
      this.velX=0; this.velY=0;
      const st=getStatus(this,'self_healing');
      this.heal(st.data.hps*dt);
      return; // rooted — skip all other kit logic
    }

    const u=this.skillUrgency();
    const kd=dist(this,killer);

    if(this.skill1CD<=0&&this.hp<this.effectiveMaxHp()*0.85) this.selfHeal();

    
    const minCharge=this.skillRange(1.8, 0.6); 
    const slingRange=this.skillRange(320, 420); 
    if(this.skill2CD<=0 && kd>35 && kd<slingRange && killer.alive && this.alertLevel>=this.skillRange(0.9,0.4)){
      this.slingChargeTimer+=dt;
      if(this.slingChargeTimer>=minCharge){
        this.shootSling(Math.min(1, this.slingChargeTimer/2.5));
        this.slingChargeTimer=0;
      }
    } else {
      this.slingChargeTimer=0;
      if(this.skill2CD>0) this.skill2CD=Math.max(0,this.skill2CD-dt/this.cdMult());
    }

    
    
    const baitHpThresh=this.skillRange(0.35, 0.55);
    const otherLowHp=survivors.some(s=>s!==this&&s.alive&&s.hp<s.effectiveMaxHp()*baitHpThresh);
    if(otherLowHp && !this.baitMode && kd>this.skillRange(120,80)){
      this.baitMode=true; this.baitTimer=rand(8,15);
      addLog(`${this.name} baiting killer away!`,'skill');
    }
    if(this.baitMode){
      this.baitTimer-=dt;
      if(this.baitTimer<=0||kd<60) this.baitMode=false;
    }
  }

  aiUpdate(dt){
    if(hasStatus(this,'self_healing')){
      this.velX=0; this.velY=0;
      return;
    }
    super.aiUpdate(dt);
  }

  doFight(dt){
    this.updateStamina(dt,false);
    const selfSafety=worldSafety(this.x,this.y);
    const kd=dist(this,killer);

    if(selfSafety<2){
      const a=Math.atan2(this.y-killer.y,this.x-killer.x);
      this.smoothMove(Math.cos(a),Math.sin(a),this.effectiveSpeed(false),dt);
    } else if(selfSafety>4){
      this._applyStateTransition('chase-ender', SURVIVOR_STATE_TIER['chase-ender']);
    } else {
      
      const perp=Math.atan2(this.y-killer.y,this.x-killer.x)+Math.PI/2*this.strafeDir;
      this.smoothMove(Math.cos(perp),Math.sin(perp),this.effectiveSpeed(false)*0.5,dt);
    }
  }
  selfHeal(){
    if(hasStatus(this,'self_healing'))return;
    
    const healTotal=Math.floor(this.effectiveMaxHp()*(this.lmsActive?1.35:0.45));
    const healDur=5; // applyStatus will scale this via LMS action status rule
    const hps=healTotal/healDur;
    applyStatus(this,'self_healing',healDur,{hps});
    this.skill1CD=40*this.cdMult();
    addLog(`${this.name} Self-Healing: ${healTotal.toFixed(0)}HP over 5s`,'heal');
  }
  shootSling(charge){
    const kd=dist(this,killer);
    if(!this.rollAccuracy(kd)){
      addLog(`${this.name} slingshot missed!`,'skill');
      this.skill2CD=10*this.cdMult();return;
    }
    const _baseStun=0.5+charge*1.0;
    const _dynStun=this.dynStun(_baseStun);
    const stunVal=this.lmsScale(_dynStun);
    const slowVal=charge>=0.9?this.lmsScale(0.15,false):0;
    projectiles.push({type:'pebble',x:this.x,y:this.y,tx:killer.x,ty:killer.y,vx:0,vy:0,speed:320,stun:this.lmsActive?stunDur:(0.5+charge*1.0),slow:this.lmsActive?slowPenalty:(charge>=0.9?0.15:0),alive:true,id:Math.random()});
    this.skill2CD=12*this.cdMult();
    addLog(`${this.name} slingshot ${Math.round(charge*100)}%`,'skill');
  }
  evaluateState(dt){
    const kd=dist(this,killer);
    if((this.baitMode&&kd>80&&kd<300)||(this.alertLevel>=1.5&&kd<280&&this.stamina>20)){
      this._applyStateTransition('chase-ender', SURVIVOR_STATE_TIER['chase-ender']);
      return;
    }
    super.evaluateState(dt);
  }
}