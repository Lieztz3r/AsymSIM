class Engineer extends Survivor {
  constructor(x,y,name){
    super(x,y,name,COLS.eng,'engineer');
    this.scrap=5;
    this.hasTurret=false;
    this.hasSonar=false;
    this.turret=null;
    this.sonar=null;
    this.wrenchCD=0;
  }
  
  kitUpdate(dt){
    for(const sc of scraps) if(!sc.collected&&dist(this,sc)<22){sc.collected=true;this.scrap=Math.min(15,this.scrap+1);}
    if(this.turret&&!this.turret.alive){this.hasTurret=false;this.turret=null;}
    if(this.sonar&&!this.sonar.alive){this.hasSonar=false;this.sonar=null;}
    this.wrenchCD=Math.max(0,this.wrenchCD-dt/this.cdMult());

    const u=this.skillUrgency();

    
    
    const wrenchRange=this.skillRange(180, 320);
    const wrenchHpThresh=0.85 - u*0.25; 
    if(this.wrenchCD<=0){
      const candidates=survivors.filter(s=>
        s!==this && s.alive &&
        dist(this,s)<wrenchRange &&
        !hasStatus(s,'cd_boost')
      );
      if(candidates.length){
        const best=candidates.reduce((a,b)=>{
          const as=(a.kit==='brawler'?50:0)+(a.effectiveMaxHp()-a.hp);
          const bs=(b.kit==='brawler'?50:0)+(b.effectiveMaxHp()-b.hp);
          return as>bs?a:b;
        });
        // Use skill class tags: prioritize OFFENSIVE allies near killer
        const bestIsOffensive=skillHasClass(`${best.kit}_punch`,'offensive')||
          skillHasClass(`${best.kit}_build`,'offensive')||
          ['brawler','assault','sniper'].includes(best.kit);
        const needsWrench=
          (bestIsOffensive && dist(best,killer)<this.skillRange(200,340)) ||
          (best.hp/best.effectiveMaxHp() < wrenchHpThresh) ||
          (u>0.5 && (best.skill1CD>0||best.skill2CD>0));
        if(needsWrench) this.useWrench(best);
      }
    }

    
    
    if(this.skill1CD<=0 && this.scrap>=7 && !this.hasTurret && !this.hasSonar){
      const activeChase=survivors.some(s=>
        s!==this && s.alive && s.currentlyChased &&
        dist(s,killer)<this.skillRange(250,400)
      );
      const emergency=survivors.some(s=>
        s!==this && s.alive &&
        s.hp<s.effectiveMaxHp()*this.skillRange(0.3,0.55)
      );
      const selfThreat=u>0.4 && dist(this,killer)<this.skillRange(200,350);
      if(activeChase||emergency||selfThreat) this.placeTurret();
    }
    if(this.skill1CD<=0 && this.scrap>=5 && !this.hasSonar && !this.hasTurret){
      const mateNeedsHelp=survivors.some(s=>
        s!==this && s.alive &&
        (s.alertLevel>1.5 || s.hp<s.effectiveMaxHp()*this.skillRange(0.55,0.85) || s.currentlyChased)
      );
      if(mateNeedsHelp||(this.scrap>=10&&u<0.3)) this.placeSonar();
    }
  }
  placeSonar(){
    if(this.scrap<5||this.hasSonar)return;
    this.scrap-=5;
    const ecx=Math.floor(this.x/CELL), ecy=Math.floor(this.y/CELL);
    const pos={x:ecx*CELL+CELL/2, y:ecy*CELL+CELL/2};
    const b={type:'sonar',x:pos.x,y:pos.y,r:20,radius:200,alive:true,timer:8,id:Math.random()};
    this.sonar=b; this.hasSonar=true;
    buildings.push(b);
    this.skill1CD=70*this.cdMult();
    addLog(`${this.name} placed Sonar`,'skill');
  }
  placeTurret(){
    if(this.scrap<7||this.hasTurret)return;
    this.scrap-=7;
    const ecx=Math.floor(this.x/CELL), ecy=Math.floor(this.y/CELL);
    const pos={x:ecx*CELL+CELL/2, y:ecy*CELL+CELL/2};
    const b={type:'turret',x:pos.x,y:pos.y,r:16,radius:220,alive:true,timer:60,missile1CD:0,missile2CD:30,id:Math.random()};
    this.turret=b; this.hasTurret=true;
    buildings.push(b);
    this.skill1CD=85*this.cdMult();
    addLog(`${this.name} placed Turret`,'skill');
  }
  useWrench(target){
    if(!this.rollAccuracy(dist(this,target))){
      addLog(`${this.name} wrench missed!`,'skill');
      this.wrenchCD=20*this.cdMult();
      return;
    }
    const _cdBoostDur=this.lmsScale(this.dynStun(10));
    applyStatus(target,'cd_boost',_cdBoostDur,{});
    this.wrenchCD=25*this.cdMult();
    projectiles.push({type:'wrench',x:this.x,y:this.y,target,speed:280,alive:true,id:Math.random()});
    addLog(`${this.name} wrenched ${target.name}`,'skill');
  }
  aiUpdate(dt){
    if(this.state==='patrol'&&this.alertLevel<1.2){
      let nearest=null, nearDist=320;
      for(const sc of scraps){
        if(sc.collected)continue;
        const d=dist(this,sc);
        if(d<nearDist){nearDist=d;nearest=sc;}
      }
      if(nearest&&nearDist>22){
        const fd=getFlowDir(this.x,this.y,nearest.x,nearest.y);
        this.smoothMove(fd.dx,fd.dy,this.effectiveSpeed(false)*0.78,dt);
        return;
      }
    }
    super.aiUpdate(dt);
  }
}