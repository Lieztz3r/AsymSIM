class Medic extends Survivor {
  constructor(x,y,name){
    super(x,y,name,COLS.medic,'medic');
    this.baseSpeed=76;this.staminaRegen=14;
    this.linkTarget=null;this.linkTimer=0;
    this.maxHpReduction=0;this.maxHpReductTimer=120;this.selfHealStacks=0;
  }
  effectiveMaxHp(){return Math.round(this.maxHp*(1-Math.min(0.6,this.maxHpReduction)));}
  
  kitUpdate(dt){
    const u=this.skillUrgency();

    if(this.linkTimer>0){
      this.linkTimer-=dt;
      if(!this.linkTarget||!this.linkTarget.alive||dist(this,this.linkTarget)>this.skillRange(200,280)){
        this.linkTarget=null;
        const newTarget=survivors
          .filter(s=>s!==this&&s.alive&&dist(this,s)<=this.skillRange(200,280)&&s.hp<s.effectiveMaxHp())
          .sort((a,b)=>a.hp-b.hp)[0]||null;
        if(newTarget){
          this.linkTarget=newTarget;
          addLog(`${this.name} link reattached to ${newTarget.name}`,'heal');
        }
      } else {
        const _healRate=this.lmsScale(3.6)*(1+this.skillUrgency()*0.2);
        this.linkTarget.heal(_healRate*dt);
      }
      if(this.linkTimer<=0) this.linkTarget=null;
    }

    if(this.maxHpReduction>0){
      this.maxHpReductTimer-=dt;
      if(this.maxHpReductTimer<=0){this.maxHpReduction=0;this.maxHpReductTimer=120;this.selfHealStacks=0;}
    }

    
    if(this.alertLevel>=this.skillRange(1.5,0.6)){
      for(const s of survivors){
        if(s!==this&&s.alive&&s.knownKillerTime>0.5){
          s.receiveSignal({x:killer.x,y:killer.y},0.8);
        }
      }
    }

    
    
    const linkRange=this.skillRange(220,320);
    const linkHpThresh=this.skillRange(0.80,0.95); 
    if(this.skill1CD<=0&&!this.linkTarget){
      const injured=survivors.filter(s=>
        s.alive && s!==this &&
        dist(this,s)<linkRange &&
        s.hp<s.effectiveMaxHp()*linkHpThresh
      );
      if(injured.length){
        const t=injured.reduce((a,b)=>a.hp<b.hp?a:b);
        this.useLink(t);
      }
    }

    
    
    const selfHealThresh=this.skillRange(0.65,0.85);
    const selfHealMinDist=this.skillRange(80,40);
    if(this.skill2CD<=0 &&
       this.hp<=this.effectiveMaxHp()*selfHealThresh &&
       dist(this,killer)>selfHealMinDist &&
       this.maxHpReduction<0.6)
      this.selfHeal();
  }
  aiUpdate(dt){
    const kd=dist(this,killer);
    const immediatelyDangerous=kd<90&&this.alertLevel>=1.8;
    const healTarget=this.linkTarget&&this.linkTarget.alive?this.linkTarget:
      survivors.filter(s=>s!==this&&s.alive&&s.hp<s.effectiveMaxHp()*0.85).sort((a,b)=>a.hp-b.hp)[0]||null;
    if(healTarget&&!immediatelyDangerous){
      const td=dist(this,healTarget);
      if(td>50){
        this.updateStamina(dt,false);
        const fd=getFlowDir(this.x,this.y,healTarget.x,healTarget.y);
        let fx=fd.dx,fy=fd.dy;
        if(kd<180&&this.alertLevel>=1){
          const killerA=Math.atan2(killer.y-this.y,killer.x-this.x);
          const targetA=Math.atan2(healTarget.y-this.y,healTarget.x-this.x);
          const adf=Math.abs(((killerA-targetA+Math.PI*3)%(Math.PI*2))-Math.PI);
          if(adf<Math.PI*0.55){
            const sideA=targetA+Math.PI/2*this.strafeDir;
            fx=Math.cos(sideA)*0.6+fx*0.4;
            fy=Math.sin(sideA)*0.6+fy*0.4;
          }
        }
        const spd=this.effectiveSpeed(false)*(kd<160?1.05:0.9);
        this.moveDir(fx,fy,spd,dt);
        if(fx||fy)this.facingTarget=Math.atan2(fy,fx);
        return;
      }
    }
    if(immediatelyDangerous){super.aiUpdate(dt);return;}
    super.aiUpdate(dt);
  }
  useLink(target){
    if(!this.rollAccuracy(dist(this,target))){
      addLog(`${this.name} link failed!`,'heal');
      this.skill1CD=15*this.cdMult();return;
    }
    this.linkTarget=target;this.linkTimer=22;this.skill1CD=50*this.cdMult();
    addLog(`${this.name} linked to ${target.name}`,'heal');
  }
  selfHeal(){
    const _healAmt=this.lmsScale(40)*(1+this.skillUrgency()*0.15);
    this.heal(_healAmt);
    const _penalty=this.lmsActive?this.lmsScale(0.15,false):0.15;
    this.maxHpReduction=Math.min(0.6,this.maxHpReduction+_penalty);
    this.maxHpReductTimer=120;this.selfHealStacks++;this.skill2CD=30*this.cdMult();
    this.hp=Math.min(this.effectiveMaxHp(),this.hp);
    addLog(`${this.name} self-healed (x${this.selfHealStacks})`,'heal');
  }
  draw(){
    super.draw();
    for(const s of survivors){
      if(!s.alive||s===this)continue;
      ctx.strokeStyle='rgba(139,172,15,0.22)';ctx.lineWidth=0.5;
      ctx.strokeRect(s.x-s.r-3,s.y-s.r-3,s.r*2+6,s.r*2+6);
      ctx.fillStyle=COLS.gb2;ctx.font='7px VCROSD,monospace';ctx.textAlign='center';
      ctx.fillText(Math.round(s.hp),s.x,s.y-s.r-3);ctx.textAlign='left';
    }
    if(this.linkTarget&&this.linkTarget.alive){
      ctx.strokeStyle=COLS.gb2;ctx.lineWidth=1;ctx.setLineDash([3,3]);
      ctx.beginPath();ctx.moveTo(this.x,this.y);ctx.lineTo(this.linkTarget.x,this.linkTarget.y);
      ctx.stroke();ctx.setLineDash([]);
    }
  }
}