// ═══════════════════════════════════════════════════════════════════════
//  ENTITY BASE CLASS
// ═══════════════════════════════════════════════════════════════════════
class Entity {
  constructor(x,y,r,color,maxHp){
    this.x=x;this.y=y;this.r=r;this.color=color;
    this.maxHp=maxHp;this.hp=maxHp;
    this.alive=true;this.statuses={};
    this.facing=rand(0,Math.PI*2);
    this.id=Math.random()+Date.now();
  }
  moveDir(dx,dy,spd,dt){ moveEntity(this,dx,dy,spd,dt); }
  takeDamage(amount,src){
    if(!this.alive)return;
    if(hasStatus(this,'invincibility')) return;
    if(hasStatus(this,'iron_body'))   amount*=0.90;
    if(hasStatus(this,'furious'))     amount*=0.95;
    if(hasStatus(this,'weakness'))    amount*=(getStatus(this,'weakness').data.amount||1.35);
    if(hasStatus(this,'scared'))      amount*=1.50;
    if(hasStatus(this,'resistance'))  amount*=0.22;
    this.hp=Math.max(0,this.hp-amount);
    if(this.hp<=0)this.die(src);
  }
  heal(amount){
    if(!this.alive)return;
    this.hp=Math.min(this.effectiveMaxHp(),this.hp+amount);
  }
  effectiveMaxHp(){return this.maxHp;}
  die(src){this.alive=false;}
  drawBase(){
    if(!this.alive)return;
    const s=this.r*2;
    const px=Math.round(this.x-this.r), py=Math.round(this.y-this.r);
    ctx.fillStyle=COLS.gb0;
    ctx.fillRect(px+2,py+2,s,s);
    ctx.fillStyle=this.color;
    ctx.fillRect(px,py,s,s);
    const _ef=this.facingSmooth!==undefined?this.facingSmooth:this.facing;
    const dpx=Math.round(this.x+Math.cos(_ef)*(this.r-4)-2);
    const dpy=Math.round(this.y+Math.sin(_ef)*(this.r-4)-2);
    ctx.fillStyle=COLS.gb0;
    ctx.fillRect(dpx,dpy,4,4);
    const bw=s+4, bh=3, bx=px-2, by=py-6;
    ctx.fillStyle=COLS.gb0; ctx.fillRect(bx,by,bw,bh);
    const pct=Math.max(0,this.hp/this.effectiveMaxHp());
    ctx.fillStyle=pct>0.5?COLS.gb3:pct>0.25?COLS.gb2:COLS.gb1;
    ctx.fillRect(bx,by,Math.round(bw*pct),bh);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  KILLER CLASS  —  fully revamped AI
// ═══════════════════════════════════════════════════════════════════════
class Killer extends Entity {
  constructor(x,y){
    super(x,y,18,'#d98a3d',1000);
    this.speed=53; this.name='Killer';
    this.grabbedSurvivor=null;
    this.grabCooldown=0; this.mineCooldown=0; this.rageCooldown=0; this.punchAttackCD=0;
    this.rageActive=false; this.rageTimer=0;
    this.myMines=[];
    this.aiTarget=null; this.aiRetargetTimer=0;
    this.velX=0; this.velY=0;
    this.knockbackVX=0; this.knockbackVY=0;
    this.wanderTarget=null; this.wanderTimer=0;
    this.facingSmooth=this.facing;
    this.blindedDir=0; this.blindedWobble=0;
    this.killerState='wander';
    this.killerStateTier=0;
    this.killerStateLockTimer=0;
    this.adaptPhase=0;
    this.phaseTimer=0;
    this.globalCD=0;

    // ── Progressive learning memory ──────────────────────────────────
    this._learnMemory={
      // Which survivors were hard to catch (kept escaping)
      slippery:{},         // survivorId → escape count
      // Which tiles are "danger" (survivor ambush zones)
      dangerTiles:{},      // "cx,cy" → weight
      // How many times smoke burned us
      smokeAvoidWeight:0,  // 0‥1
      // Timing: track time between stuns to learn skill cooldowns
      lastStunAt:-999,
      stunIntervals:[],    // rolling last 5 intervals
      estimatedCooldown:30,// guess of survivor skill cooldown
      // Grenade caution radius — grows each time we're hit
      grenadeWaryDist:160,
      // Mine placement success/fail
      mineHitCount:0,
      mineWastedCount:0,
      // Phase-override: force rush when survivors are clustering
      clusterRushActive:false,
      clusterRushTimer:0,
      // Last seen each survivor position
      lastSeen:{},         // survivorId → {x,y,t}
      // Patrol coverage: set of visited cells
      visitedCells:new Set(),
    };

    // ── Tactical state ───────────────────────────────────────────────
    this._tacticalMode='hunt';   // hunt | ambush | flank | rush
    this._tacticalTimer=0;
    this._flankAngle=0;
    this._ambushPos=null;
    this._patrolWaypoints=[];
    this._patrolWpIdx=0;
    this._feintTimer=0;           // fake direction to bait survivors
    this._lastPos={x:x,y:y};
    this._stuckTimer=0;
    this._stuckFix=0;
  }

  // ── Speed ────────────────────────────────────────────────────────────
  effectiveSpeed(){
    let s=this.speed;
    if(this.rageActive) s*=1.85;
    if(hasStatus(this,'slowed')) s*=1-(getStatus(this,'slowed').data.amount||0.35);
    if(hasStatus(this,'stunned')) s=0;
    return s;
  }

  // ── korMult ─────────────────────────────────────────────────────────
  korMult(){ return hasStatus(this,'king_of_rules')?1.5:1; }

  // ════════════════════════════════════════════════════════════════════
  //  MAIN UPDATE
  // ════════════════════════════════════════════════════════════════════
  update(dt){
    tickStatuses(this,dt);

    // Knockback
    if(this.knockbackVX||this.knockbackVY){
      moveEntity(this,this.knockbackVX,this.knockbackVY,1,dt);
      const drag=1-Math.exp(-7*dt);
      this.knockbackVX-=this.knockbackVX*drag;
      this.knockbackVY-=this.knockbackVY*drag;
      if(Math.hypot(this.knockbackVX,this.knockbackVY)<4){this.knockbackVX=0;this.knockbackVY=0;}
    }

    this.grabCooldown=Math.max(0,this.grabCooldown-dt);
    this.mineCooldown=Math.max(0,this.mineCooldown-dt);
    this.rageCooldown=Math.max(0,this.rageCooldown-dt);
    this.punchAttackCD=Math.max(0,this.punchAttackCD-dt);

    if(this.rageActive){
      this.rageTimer-=dt;
      if(this.rageTimer<=0){this.rageActive=false;addLog('Killer rage ended','skill');}
    }

    // Maintain grab
    if(this.grabbedSurvivor){
      if(!this.grabbedSurvivor.alive||hasStatus(this,'stunned')||!hasStatus(this.grabbedSurvivor,'grabbed'))
        this.releaseGrab();
      else{
        this.grabbedSurvivor.x=this.x;
        this.grabbedSurvivor.y=this.y;
        this.grabbedSurvivor.takeDamage(5*this.korMult()*dt,this);
      }
    }

    pushOutOfWall(this);

    // Stuck detection
    this._checkStuck(dt);

    // Update last-seen positions for all survivors
    this._updateLastSeen();

    // Tactical mode update
    this._updateTacticalMode(dt);

    this.updateKillerState(dt);
    if(hasStatus(this,'stunned'))return;
    if(hasStatus(this,'blinded')){this.doBlindedMove(dt);return;}
    this.facingSmooth=lerpAngle(this.facingSmooth,this.facing,1-Math.exp(-3.5*dt));

    // Execute move based on tactical mode
    this._executeTacticalMove(dt);
    this.trySkills(dt);
  }

  // ── Stuck detection & resolution ────────────────────────────────────
  _checkStuck(dt){
    const moved=Math.hypot(this.x-this._lastPos.x,this.y-this._lastPos.y);
    this._lastPos={x:this.x,y:this.y};
    if(moved<1.5&&!hasStatus(this,'stunned')){
      this._stuckTimer+=dt;
      if(this._stuckTimer>1.0){
        // Force a random open direction
        this._stuckFix=Math.random()*Math.PI*2;
        this._stuckTimer=0;
        this.wanderTarget=randPos(40);
      }
    } else {
      this._stuckTimer=Math.max(0,this._stuckTimer-dt*2);
    }
  }

  // ── Track last seen positions ────────────────────────────────────────
  _updateLastSeen(){
    for(const s of survivors){
      if(!s.alive)continue;
      this._learnMemory.lastSeen[s.id]={x:s.x,y:s.y,t:gameTimer};
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  ADAPTIVE PHASE SYSTEM (enhanced)
  // ════════════════════════════════════════════════════════════════════
  _updateAdaptPhase(dt){
    this.phaseTimer=Math.max(0,this.phaseTimer-dt);
    if(this.phaseTimer>0)return;
    this.phaseTimer=3;
    const alive=survivors.filter(s=>s.alive).length;
    // Phase based on survivors AND game timer
    const timeRatio=gameTimer/Math.max(1,gameDuration);
    if(alive>6)      this.adaptPhase=0;
    else if(alive>2) this.adaptPhase=1;
    else             this.adaptPhase=2;

    // Late game always uses phase 2 logic regardless
    if(timeRatio>0.75&&this.adaptPhase<2) this.adaptPhase=2;
  }

  // ════════════════════════════════════════════════════════════════════
  //  TACTICAL MODE  — decides HOW to chase, not just WHO
  // ════════════════════════════════════════════════════════════════════
  _updateTacticalMode(dt){
    this._tacticalTimer-=dt;
    const lm=this._learnMemory;

    // Cluster rush: if 3+ survivors within 3 cells of each other, rush them
    const alive=survivors.filter(s=>s.alive);
    if(alive.length>=3){
      for(const sa of alive){
        const nearby=alive.filter(sb=>sb!==sa&&dist(sa,sb)<CELL*3.5).length;
        if(nearby>=2){
          lm.clusterRushActive=true;
          lm.clusterRushTimer=8;
          break;
        }
      }
    }
    if(lm.clusterRushActive){
      lm.clusterRushTimer-=dt;
      if(lm.clusterRushTimer<=0)lm.clusterRushActive=false;
    }

    if(this._tacticalTimer>0)return;

    // Pick new mode based on situation
    const t=this.aiTarget;
    if(!t||!t.alive){this._tacticalMode='hunt';this._tacticalTimer=3;return;}

    const kd=dist(this,t);
    const tSafety=worldSafety(t.x,t.y);
    const selfSafety=worldSafety(this.x,this.y);
    const slippery=(lm.slippery[t.id]||0);
    const timeLeft=gameDuration-gameTimer;

    // Roll for mode
    let roll=Math.random();

    if(lm.clusterRushActive){
      this._tacticalMode='rush';
      this._tacticalTimer=6;
    } else if(slippery>=3&&kd>CELL*4&&timeLeft>60){
      // Target has escaped many times — try flanking
      this._tacticalMode='flank';
      this._flankAngle=Math.atan2(t.y-this.y,t.x-this.x)+((Math.random()<0.5?1:-1)*Math.PI/2);
      this._tacticalTimer=rand(4,8);
    } else if(tSafety>=8&&kd>CELL*5&&alive.length<=4){
      // Target is in high-safety zone — set ambush near predicted exit
      this._tacticalMode='ambush';
      this._ambushPos=this._predictInterceptPos(t);
      this._tacticalTimer=rand(6,12);
    } else if(selfSafety>=7&&roll<0.15){
      // We're in an open area — use feint
      this._tacticalMode='feint';
      this._feintTimer=rand(2,4);
      this._tacticalTimer=5;
    } else {
      this._tacticalMode='hunt';
      this._tacticalTimer=rand(3,7);
    }
  }

  // Predict where target will be in 2 seconds (simple linear extrapolation)
  _predictInterceptPos(target){
    const vx=target.velX||0, vy=target.velY||0;
    const px=target.x+vx*2, py=target.y+vy*2;
    // Find nearest open cell to predicted pos
    return randOpenNear(px,py,0,CELL*2)||{x:target.x,y:target.y};
  }

  // ════════════════════════════════════════════════════════════════════
  //  EXECUTE TACTICAL MOVE
  // ════════════════════════════════════════════════════════════════════
  _executeTacticalMove(dt){
    switch(this.killerState){
      case 'wander': this.doWander(dt);break;
      case 'rage':   this.doRageChase(dt);break;
      case 'forced': break;
      default:       this._doTacticalChase(dt);
    }
  }

  _doTacticalChase(dt){
    if(!this.aiTarget||!this.aiTarget.alive){this.doWander(dt);return;}
    const t=this.aiTarget;

    switch(this._tacticalMode){
      case 'flank':    this._doFlank(dt,t);break;
      case 'ambush':   this._doAmbush(dt,t);break;
      case 'feint':    this._doFeint(dt,t);break;
      case 'rush':     this._doRush(dt,t);break;
      default:         this.doChase(dt);
    }
  }

  // Standard chase (flow-field pathfinding)
  doChase(dt){
    if(!this.aiTarget||!this.aiTarget.alive){this.doWander(dt);return;}
    const t=this.aiTarget;
    const fd=getFlowDir(this.x,this.y,t.x,t.y);
    const spd=this.effectiveSpeed();
    const len=Math.hypot(fd.dx,fd.dy)||1;
    let dvx=fd.dx/len, dvy=fd.dy/len;
    // Smoke avoidance
    const av=this.applySmokeAvoidance(dvx,dvy);
    dvx=av.dx;dvy=av.dy;
    const al=Math.hypot(dvx,dvy)||1;
    dvx/=al;dvy/=al;
    const sm=1-Math.exp(-8*dt);
    this.velX+=(dvx*spd-this.velX)*sm;
    this.velY+=(dvy*spd-this.velY)*sm;
    this.velApply(dt);
  }

  // Flank: move to a side position relative to target's heading
  _doFlank(dt,t){
    const targetAngle=this._flankAngle;
    const flankR=CELL*3;
    const fx=t.x+Math.cos(targetAngle)*flankR;
    const fy=t.y+Math.sin(targetAngle)*flankR;
    const fd=getFlowDir(this.x,this.y,fx,fy);
    const len=Math.hypot(fd.dx,fd.dy)||1;
    let dvx=fd.dx/len,dvy=fd.dy/len;
    const av=this.applySmokeAvoidance(dvx,dvy);
    dvx=av.dx;dvy=av.dy;
    const al=Math.hypot(dvx,dvy)||1;
    const sm=1-Math.exp(-7*dt);
    this.velX+=((dvx/al)*this.effectiveSpeed()-this.velX)*sm;
    this.velY+=((dvy/al)*this.effectiveSpeed()-this.velY)*sm;
    this.velApply(dt);

    // If we're close enough after flanking, switch to direct hunt
    if(dist(this,t)<CELL*2.5) this._tacticalMode='hunt';
  }

  // Ambush: move to intercept pos and wait
  _doAmbush(dt,t){
    const pos=this._ambushPos||t;
    const d=dist(this,pos);
    if(d>40){
      const fd=getFlowDir(this.x,this.y,pos.x,pos.y);
      const len=Math.hypot(fd.dx,fd.dy)||1;
      const spd=this.effectiveSpeed()*0.75;
      const sm=1-Math.exp(-6*dt);
      this.velX+=((fd.dx/len)*spd-this.velX)*sm;
      this.velY+=((fd.dy/len)*spd-this.velY)*sm;
      this.velApply(dt);
    } else {
      // At ambush spot — slow patrol until target gets close
      this.velX*=Math.exp(-4*dt);
      this.velY*=Math.exp(-4*dt);
      this.velApply(dt);
      this.facing=Math.atan2(t.y-this.y,t.x-this.x);
      // Break ambush if target is close
      if(dist(this,t)<CELL*3) this._tacticalMode='rush';
    }
  }

  // Feint: move away from target briefly then rush
  _doFeint(dt,t){
    this._feintTimer-=dt;
    if(this._feintTimer>0){
      // Move away
      const a=Math.atan2(this.y-t.y,this.x-t.x);
      const spd=this.effectiveSpeed()*0.6;
      const sm=1-Math.exp(-5*dt);
      this.velX+=(Math.cos(a)*spd-this.velX)*sm;
      this.velY+=(Math.sin(a)*spd-this.velY)*sm;
      this.velApply(dt);
    } else {
      this._tacticalMode='rush';
    }
  }

  // Rush: direct sprint toward target
  _doRush(dt,t){
    const fd=getFlowDir(this.x,this.y,t.x,t.y);
    const len=Math.hypot(fd.dx,fd.dy)||1;
    const spd=this.effectiveSpeed();
    const sm=1-Math.exp(-12*dt);
    this.velX+=((fd.dx/len)*spd-this.velX)*sm;
    this.velY+=((fd.dy/len)*spd-this.velY)*sm;
    this.velApply(dt);
  }

  // Rage chase — full speed, ignore smoke
  doRageChase(dt){
    if(!this.aiTarget||!this.aiTarget.alive){this.doWander(dt);return;}
    const t=this.aiTarget;
    const fd=getFlowDir(this.x,this.y,t.x,t.y);
    const len=Math.hypot(fd.dx,fd.dy)||1;
    const spd=this.effectiveSpeed();
    const sm=1-Math.exp(-14*dt);
    this.velX+=((fd.dx/len)*spd-this.velX)*sm;
    this.velY+=((fd.dy/len)*spd-this.velY)*sm;
    this.velApply(dt);
  }

  doWander(dt){
    // Improved wander: prefer unvisited cells for map coverage
    if(!this.wanderTarget||dist(this,this.wanderTarget)<50||this.wanderTimer<=0){
      this.wanderTarget=this._pickCoverageWanderTarget();
      this.wanderTimer=rand(3,8);
    }
    this.wanderTimer-=dt;
    const fd=getFlowDir(this.x,this.y,this.wanderTarget.x,this.wanderTarget.y);
    const spdW=this.effectiveSpeed()*0.7;
    const len=Math.hypot(fd.dx,fd.dy)||1;
    const sm=1-Math.exp(-5*dt);
    this.velX+=((fd.dx/len)*spdW-this.velX)*sm;
    this.velY+=((fd.dy/len)*spdW-this.velY)*sm;
    this.velApply(dt);
    // Mark visited
    const cx=Math.floor(this.x/CELL),cy=Math.floor(this.y/CELL);
    this._learnMemory.visitedCells.add(`${cx},${cy}`);
  }

  // Prefer unvisited cells during wander
  _pickCoverageWanderTarget(){
    let best=null, bestScore=-Infinity;
    for(let i=0;i<20;i++){
      const p=randPos(60);
      const cx=Math.floor(p.x/CELL),cy=Math.floor(p.y/CELL);
      const visited=this._learnMemory.visitedCells.has(`${cx},${cy}`);
      const danger=this._learnMemory.dangerTiles[`${cx},${cy}`]||0;
      const score=(visited?0:50)+rand(-20,20)-danger*30;
      if(score>bestScore){bestScore=score;best=p;}
    }
    return best||randPos(60);
  }

  // ════════════════════════════════════════════════════════════════════
  //  TARGET SELECTION  (adaptive + learning)
  // ════════════════════════════════════════════════════════════════════
  chooseTarget(){
    const alive=survivors.filter(s=>s.alive);
    if(!alive.length){this.aiTarget=null;return;}

    if(hasStatus(this,'dancefloor_madness')){
      // Target lowest HP
      this.aiTarget=alive.reduce((a,b)=>a.hp<=b.hp?a:b);
      return;
    }

    const lm=this._learnMemory;

    if(this.adaptPhase===0){
      // Phase 0: nearest, but penalize smoke-users slightly
      this.aiTarget=alive.reduce((a,b)=>{
        const da=dist(this,a)+(a.kit==='recon'?CELL*1.5:0);
        const db=dist(this,b)+(b.kit==='recon'?CELL*1.5:0);
        return da<=db?a:b;
      });
    } else if(this.adaptPhase===1){
      // Phase 1: balance isolation + low HP, avoid highly-alert clusters
      this.aiTarget=alive.reduce((a,b)=>{
        const teamsA=alive.filter(q=>q!==a&&dist(q,a)<CELL*4).length;
        const teamsB=alive.filter(q=>q!==b&&dist(q,b)<CELL*4).length;
        const hpA=a.hp/a.effectiveMaxHp();
        const hpB=b.hp/b.effectiveMaxHp();
        // Score: fewer teammates nearby + lower HP = more attractive
        const sA=(4-teamsA)*25+(1-hpA)*60+(lm.slippery[a.id]||0)*(-8);
        const sB=(4-teamsB)*25+(1-hpB)*60+(lm.slippery[b.id]||0)*(-8);
        return sA>=sB?a:b;
      });
    } else {
      // Phase 2: always lowest HP — finish off weakened survivors
      this.aiTarget=alive.reduce((a,b)=>{
        const hpA=a.hp/a.effectiveMaxHp();
        const hpB=b.hp/b.effectiveMaxHp();
        return hpA<=hpB?a:b;
      });
    }

    // LMS override: if a survivor is LMS, always target them
    const lmsSurv=alive.find(s=>s.lmsActive);
    if(lmsSurv) this.aiTarget=lmsSurv;
  }

  // ════════════════════════════════════════════════════════════════════
  //  KILLER STATE MACHINE
  // ════════════════════════════════════════════════════════════════════
  updateKillerState(dt){
    this._updateAdaptPhase(dt);
    this.killerStateLockTimer=Math.max(0,this.killerStateLockTimer-dt);
    this.aiRetargetTimer=Math.max(0,this.aiRetargetTimer-dt);

    const alive=survivors.filter(s=>s.alive);
    let wantState;
    if(hasStatus(this,'stunned')||hasStatus(this,'blinded')){
      wantState='forced';
    } else if(this.rageActive){
      wantState='rage';
    } else if(alive.length>0){
      wantState='chase';
    } else {
      wantState='wander';
    }

    const wantTier=KILLER_STATE_TIER[wantState]??0;
    const curTier=KILLER_STATE_TIER[this.killerState]??0;

    if(wantState!==this.killerState){
      if(wantTier>curTier){
        this._applyKillerStateTransition(wantState,wantTier);
      } else if(this.killerStateLockTimer<=0){
        const allowedTier=Math.max(wantTier,curTier-1);
        const allowedState=this._killerStateForTier(allowedTier);
        if(allowedState!==this.killerState){
          const tierDelta=curTier-allowedTier;
          this.killerStateLockTimer=KILLER_DOWNGRADE_LOCKOUT[Math.min(tierDelta,KILLER_DOWNGRADE_LOCKOUT.length-1)]??6.0;
          this._applyKillerStateTransition(allowedState,allowedTier);
        }
      }
    }

    if((this.killerState==='chase'||this.killerState==='rage')&&this.aiRetargetTimer<=0){
      this.chooseTarget();
      this.aiRetargetTimer=0.4;  // retarget slightly more often
    }
  }

  _killerStateForTier(tier){
    for(const [state,t] of Object.entries(KILLER_STATE_TIER)){
      if(t===tier)return state;
    }
    return 'wander';
  }

  _applyKillerStateTransition(newState,newTier){
    if(newState===this.killerState)return;
    this.killerState=newState;
    this.killerStateTier=newTier;
    if(newState==='wander'){this.wanderTarget=null;this.wanderTimer=0;}
    if(newState==='forced'){this.releaseGrab();}
  }

  // ════════════════════════════════════════════════════════════════════
  //  SKILLS  (fully revamped adaptive logic)
  // ════════════════════════════════════════════════════════════════════
  trySkills(dt){
    const alive=survivors.filter(s=>s.alive);
    if(!alive.length)return;
    if(this.grabbedSurvivor)return;
    this.globalCD=Math.max(0,this.globalCD-dt);
    if(this.globalCD>0)return;

    // ── 1. Punch (close range, opportunistic) ────────────────────────
    if(this.punchAttackCD<=0){
      for(const s of alive){
        if(dist(this,s)<58&&!hasStatus(s,'grabbed')){
          this.killerPunch(s);
          this.globalCD=1.5;
          break;
        }
      }
    }

    // ── 2. Grab (when punch not available or survivor is isolated) ───
    if(this.grabCooldown<=0&&!this.grabbedSurvivor){
      for(const s of alive){
        const kd=dist(this,s);
        if(kd<45&&!hasStatus(s,'grabbed')){
          // Prefer isolated targets (fewer nearby teammates)
          const nearbyTeam=alive.filter(q=>q!==s&&dist(q,s)<CELL*3).length;
          if(nearbyTeam<=1||kd<28){
            this.grab(s);
            this.globalCD=2;
            break;
          }
        }
      }
    }

    // ── 3. Mine (strategic placement based on phase & learning) ──────
    if(this.mineCooldown<=0&&this.myMines.length<(this._cfgMaxMines||6)){
      const shouldMine=this._decideShouldMine(alive);
      if(shouldMine){
        const fm=this._computeStrategicMinePos();
        if(fm&&!mines.some(m=>m.alive&&Math.hypot(m.x-fm.x,m.y-fm.y)<CELL)){
          this.placeMine(fm.x,fm.y);
          this.globalCD=2;
          return;
        }
      }
    }

    // ── 4. Rage (timing-aware: save for when multiple survivors close) ──
    if(this.rageCooldown<=0&&!this.rageActive){
      const rageScore=this._computeRageScore(alive);
      if(rageScore>0.55){
        this.activateRage();
        this.globalCD=1;
      }
    }
  }

  // Should we place a mine right now?
  _decideShouldMine(alive){
    if(!alive.length)return false;
    const lm=this._learnMemory;

    switch(this.adaptPhase){
      case 0:
        // Choke points when many survivors — block escape routes
        return alive.length>4;
      case 1:
        // Near cornered targets or high-safety zones (survivors hide there)
        return this.aiTarget&&dist(this,this.aiTarget)<CELL*6;
      case 2:
        // Always if off cooldown — flood the zone
        return true;
    }
    return false;
  }

  // Rage score: 0‥1, higher = more worthwhile to rage now
  _computeRageScore(alive){
    if(!alive.length)return 0;
    // Count survivors within 4 cells
    const closeCount=alive.filter(s=>dist(this,s)<CELL*4).length;
    // Boost if target has been evading
    const slippery=this.aiTarget?(this._learnMemory.slippery[this.aiTarget.id]||0):0;
    // Boost in late phase
    const phaseFactor=0.15*this.adaptPhase;
    // Cooldown ratio (prefer raging when it will stay up a long time)
    const rageDurFactor=(this._cfgRageDur||10)/10;

    let score=closeCount*0.12+slippery*0.06+phaseFactor+rageDurFactor*0.15;
    // Rage threshold based on remaining survivors
    const rageThreshold=this.adaptPhase===2?0.25:this.adaptPhase===1?0.45:0.55;
    return Math.min(1,score)-rageThreshold+rageThreshold;
  }

  // ── Strategic mine placement ─────────────────────────────────────────
  _computeStrategicMinePos(){
    if(!ROWS_C||!COLS_C)return null;
    if(this.adaptPhase===0){
      // Find corridor choke-points near survivors
      let best=null,bestScore=-Infinity;
      for(let cy=1;cy<ROWS_C-1;cy++) for(let cx=1;cx<COLS_C-1;cx++){
        if(!mapGrid[cy][cx])continue;
        let exits=0;
        if(mapGrid[cy][cx-1])exits++;if(mapGrid[cy][cx+1])exits++;
        if(mapGrid[cy-1]&&mapGrid[cy-1][cx])exits++;if(mapGrid[cy+1]&&mapGrid[cy+1][cx])exits++;
        if(exits!==2)continue; // only corridors
        const px=cx*CELL+CELL/2,py=cy*CELL+CELL/2;
        const dKiller=Math.hypot(px-this.x,py-this.y);
        if(dKiller>CELL*4||dKiller<CELL)continue;
        const dSurvivors=survivors.filter(s=>s.alive).reduce((mn,s)=>Math.min(mn,Math.hypot(px-s.x,py-s.y)),Infinity);
        // Prefer positions that survivors are heading toward
        const onPath=survivors.filter(s=>{
          if(!s.alive)return false;
          const vl=Math.hypot(s.velX,s.velY);
          if(vl<1)return false;
          const dot=(s.velX/vl)*((px-s.x)/Math.max(1,Math.hypot(px-s.x,py-s.y)))+
                    (s.velY/vl)*((py-s.y)/Math.max(1,Math.hypot(px-s.x,py-s.y)));
          return dot>0.5&&Math.hypot(px-s.x,py-s.y)<CELL*4;
        }).length;
        const score=dSurvivors/(dKiller+1)+onPath*40;
        if(score>bestScore){bestScore=score;best={x:px,y:py};}
      }
      return best||randOpenNear(this.x,this.y,CELL,CELL*3);
    } else if(this.adaptPhase===1){
      const t=this.aiTarget;
      if(!t||!t.alive)return randOpenNear(this.x,this.y,CELL,CELL*3);
      // Place near high-safety tiles close to target (where they hide)
      let best=null,bestScore=-Infinity;
      const step=2;
      for(let cy=1;cy<ROWS_C-1;cy+=step) for(let cx=1;cx<COLS_C-1;cx+=step){
        if(!mapGrid[cy][cx])continue;
        const px=cx*CELL+CELL/2,py=cy*CELL+CELL/2;
        const safety=getTileSafety(cx,cy);
        if(safety<6)continue;
        const dTarget=Math.hypot(px-t.x,py-t.y);
        const dKiller=Math.hypot(px-this.x,py-this.y);
        if(dKiller>CELL*5)continue;
        const score=safety-dTarget/CELL*0.5;
        if(score>bestScore){bestScore=score;best={x:px,y:py};}
      }
      return best||randOpenNear(t.x,t.y,CELL,CELL*3);
    } else {
      // Phase 2: highest safety tile = where LMS survivor will run to
      let best=null,bestSafety=-1;
      for(let cy=1;cy<ROWS_C-1;cy++) for(let cx=1;cx<COLS_C-1;cx++){
        if(!mapGrid[cy][cx])continue;
        const s=getTileSafety(cx,cy);
        if(s>bestSafety){bestSafety=s;best={x:cx*CELL+CELL/2,y:cy*CELL+CELL/2};}
      }
      return best;
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  GRAB / PUNCH  (parry-aware, memory-updating)
  // ════════════════════════════════════════════════════════════════════
  grab(s){
    if(hasStatus(s,'invincibility'))return;
    if(hasStatus(s,'parry')){
      // Parried — take the full stun, record it, avoid this survivor for a bit
      if(s.parrying!==undefined){s.parrying=false;s.parryTimer=0;}
      clearStatus(s,'parry');
      applyStatus(this,'stunned',4,{});
      applyStatus(this,'slowed',4,{amount:0.75});
      this.releaseGrab();this.onStunned();
      addLog(`${s.name} PARRIED the grab! Killer stunned 4s!`,'stun');
      this.grabCooldown=this._cfgGrabCD||15;
      // Learn: this survivor is dangerous to grab
      this._learnMemory.slippery[s.id]=(this._learnMemory.slippery[s.id]||0)+2;
      if(lmsCam.active){lmsCam.slowTimer=1.8;lmsCam.barTarget=1;setTimeout(()=>{lmsCam.barTarget=0;},2200);}
      return;
    }
    s.takeDamage((this.rageActive?22:30)*this.korMult(),this);
    if(s.alive){
      this.grabbedSurvivor=s;applyStatus(s,'grabbed',5,{});
      addLog(`Killer grabbed ${s.name}!`,'kill');
    }
    this.grabCooldown=this._cfgGrabCD||15;
  }

  killerPunch(s){
    if(hasStatus(s,'parry')){
      if(s.parrying!==undefined){s.parrying=false;s.parryTimer=0;}
      clearStatus(s,'parry');
      applyStatus(this,'stunned',4,{});
      this.onStunned();
      addLog(`${s.name} PARRIED the punch! Killer stunned 4s!`,'stun');
      this.punchAttackCD=8;
      this._learnMemory.slippery[s.id]=(this._learnMemory.slippery[s.id]||0)+2;
      if(lmsCam.active){lmsCam.slowTimer=1.8;lmsCam.barTarget=1;setTimeout(()=>{lmsCam.barTarget=0;},2200);}
      return;
    }
    const punchDmg=10*this.korMult();
    s.takeDamage(punchDmg,this);
    if(s.alive&&!hasStatus(s,'invincibility'))applyStatus(s,'bleed',3,{});
    addLog(`Killer punched ${s.name} (-${punchDmg}, BLEED)!`,'kill');
    this.punchAttackCD=5;
  }

  // ── Mine placement ────────────────────────────────────────────────
  placeMine(x,y){
    const mcx=Math.floor(x/CELL),mcy=Math.floor(y/CELL);
    for(const s of survivors){
      if(s.alive&&s.kit==='golfer'&&s.flags){
        if(s.flags.some(f=>f.alive&&f.cx===mcx&&f.cy===mcy)){
          addLog('Mine blocked by a flag!','skill');
          return;
        }
      }
    }
    if(this.myMines.length>=(this._cfgMaxMines||6)){
      const old=this.myMines.shift();
      const idx=mines.indexOf(old);if(idx>=0)mines.splice(idx,1);
    }
    const m={x,y,r:30,alive:true};
    this.myMines.push(m);mines.push(m);
    const baseCD=this.adaptPhase===2?10:this.adaptPhase===1?14:18;
    this.mineCooldown=this._cfgMineCD||baseCD;
  }

  // ── Rage ─────────────────────────────────────────────────────────
  activateRage(){
    this.rageActive=true;
    this.rageTimer=this._cfgRageDur||10;
    this.rageCooldown=this._cfgRageCD||30;
    this._applyKillerStateTransition('rage',KILLER_STATE_TIER['rage']);
    addLog('Killer activated RAGE!','skill');
  }

  releaseGrab(){
    if(this.grabbedSurvivor){clearStatus(this.grabbedSurvivor,'grabbed');this.grabbedSurvivor=null;}
  }

  // ── React to being stunned ────────────────────────────────────────
  onStunned(){
    killerMemory.stunsReceived++;
    this.releaseGrab();
    this._applyKillerStateTransition('forced',KILLER_STATE_TIER['forced']);

    // Learn: track stun intervals to estimate survivor cooldowns
    const lm=this._learnMemory;
    if(lm.lastStunAt>0){
      const interval=gameTimer-lm.lastStunAt;
      if(interval>3&&interval<120){
        lm.stunIntervals.push(interval);
        if(lm.stunIntervals.length>6)lm.stunIntervals.shift();
        const avg=lm.stunIntervals.reduce((a,b)=>a+b,0)/lm.stunIntervals.length;
        lm.estimatedCooldown=Math.round(avg);
      }
    }
    lm.lastStunAt=gameTimer;

    // Mark tile where we were stunned as dangerous
    const cx=Math.floor(this.x/CELL),cy=Math.floor(this.y/CELL);
    const key=`${cx},${cy}`;
    lm.dangerTiles[key]=(lm.dangerTiles[key]||0)+1;

    // Decay old danger over time — we'll read this each check
    addLog('Killer stunned!','stun');
  }

  onBlinded(){
    const vlen=Math.hypot(this.velX,this.velY);
    this.blindedDir=vlen>5?Math.atan2(this.velY,this.velX):this.facing;
    this.blindedWobble=0;
    // Mark tile as dangerous
    const cx=Math.floor(this.x/CELL),cy=Math.floor(this.y/CELL);
    const key=`${cx},${cy}`;
    this._learnMemory.dangerTiles[key]=(this._learnMemory.dangerTiles[key]||0)+0.5;
    // Increment smoke memory
    killerMemory.smokeEncounters++;
    this._learnMemory.smokeAvoidWeight=Math.min(1,this._learnMemory.smokeAvoidWeight+0.25);
  }

  doBlindedMove(dt){
    this.blindedWobble+=(Math.random()-0.5)*7*dt;
    this.blindedWobble=Math.max(-1.3,Math.min(1.3,this.blindedWobble));
    const moveAngle=this.blindedDir+this.blindedWobble;
    const spd=this.effectiveSpeed()*0.5;
    const smB=1-Math.exp(-6*dt);
    this.velX+=(Math.cos(moveAngle)*spd-this.velX)*smB;
    this.velY+=(Math.sin(moveAngle)*spd-this.velY)*smB;
    this.velApply(dt);
    this.facingSmooth=lerpAngle(this.facingSmooth,this.blindedDir,1-Math.exp(-1.2*dt));
    this.facing=this.facingSmooth;
  }

  velApply(dt){
    const vl=Math.hypot(this.velX,this.velY);
    if(vl>0.1){
      const px=this.x,py=this.y;
      this.moveDir(this.velX,this.velY,vl,dt);
      this.facing=Math.atan2(this.velY,this.velX);
      if(Math.hypot(this.x-px,this.y-py)<0.15){this.velX=0;this.velY=0;}
    }
  }

  // ── Smoke avoidance (learning-weighted) ──────────────────────────
  applySmokeAvoidance(dx,dy){
    let rx=dx,ry=dy;
    if(hasStatus(this,'dancefloor_madness'))return{dx:rx,dy:ry};
    const avoidStr=Math.min(1,this._learnMemory.smokeAvoidWeight+0.25);
    for(const sm of smokescreens){
      if(!sm.alive)continue;
      const d=dist(this,sm);
      const avoidR=sm.r+75+this._learnMemory.smokeAvoidWeight*40;
      if(d<avoidR){
        const pushA=Math.atan2(this.y-sm.y,this.x-sm.x);
        const str=(1-(d/avoidR))*5*avoidStr;
        rx+=Math.cos(pushA)*str;
        ry+=Math.sin(pushA)*str;
      }
    }
    return{dx:rx,dy:ry};
  }

  // ── Draw ─────────────────────────────────────────────────────────
  draw(){
    if(!this.alive)return;
    this.drawBase();
    if(hoveredEntity===this){
      const pulse=0.6+0.4*Math.sin(Date.now()/120);
      ctx.strokeStyle=`rgba(255,255,255,${pulse})`;ctx.lineWidth=3;ctx.setLineDash([]);
      ctx.strokeRect(this.x-this.r-6,this.y-this.r-6,this.r*2+12,this.r*2+12);
      ctx.fillStyle=`rgba(255,255,255,0.08)`;
      ctx.fillRect(this.x-this.r-6,this.y-this.r-6,this.r*2+12,this.r*2+12);
      ctx.strokeStyle=COLS.gb3;ctx.lineWidth=1;ctx.setLineDash([3,3]);
      ctx.strokeRect(this.x-this.r-10,this.y-this.r-10,this.r*2+20,this.r*2+20);
      ctx.setLineDash([]);
    }
    if(this.rageActive){
      const flash=Math.sin(Date.now()/80)>0?COLS.gb2:COLS.gb1;
      ctx.strokeStyle=flash;ctx.lineWidth=2;
      ctx.strokeRect(this.x-this.r-3,this.y-this.r-3,this.r*2+6,this.r*2+6);
    }
    if(hasStatus(this,'stunned')){
      ctx.fillStyle=COLS.gb3;ctx.font='9px VCROSD,monospace';ctx.textAlign='center';
      ctx.fillText('*',this.x,this.y-this.r-5);ctx.textAlign='left';
    }
    if(hasStatus(this,'blinded')){
      ctx.fillStyle='rgba(216,138,61,0.15)';ctx.fillRect(this.x-this.r-4,this.y-this.r-4,this.r*2+8,this.r*2+8);
      ctx.fillStyle=COLS.gb2;ctx.font='9px VCROSD,monospace';ctx.textAlign='center';
      ctx.fillText('?',this.x,this.y-this.r-5);ctx.textAlign='left';
    }
    if(hasStatus(this,'highlighted')){
      ctx.strokeStyle=COLS.gb3;ctx.lineWidth=1;ctx.setLineDash([2,2]);
      ctx.strokeRect(this.x-this.r-5,this.y-this.r-5,this.r*2+10,this.r*2+10);ctx.setLineDash([]);
    }
    // Draw tactical mode indicator (debug-lite)
    if(this._tacticalMode&&this._tacticalMode!=='hunt'){
      const modeColors={flank:COLS.gb2,ambush:COLS.gb1,feint:COLS.gb3,rush:'#ff4444'};
      ctx.fillStyle=modeColors[this._tacticalMode]||COLS.gb2;
      ctx.font='7px VCROSD,monospace';ctx.textAlign='center';
      ctx.fillText(this._tacticalMode.toUpperCase()[0],this.x,this.y-this.r-12);ctx.textAlign='left';
    }
    ctx.fillStyle=COLS.gb0;ctx.font='bold 8px VCROSD,monospace';ctx.textAlign='center';
    ctx.fillText('K',this.x,this.y+3);ctx.textAlign='left';
  }
}

const LOS_ANGLE=Math.PI/3.5, LOS_RANGE=240;