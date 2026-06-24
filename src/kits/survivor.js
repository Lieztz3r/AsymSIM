// ═══════════════════════════════════════════════════════════════════════
//  SKILL CLASS CONSTANTS  (defined here so all kits can reference them)
// ═══════════════════════════════════════════════════════════════════════
const SKILL_CLASS = {
  SUPPORT:   'support',    // benefits teammates
  OFFENSIVE: 'offensive',  // damages/debuffs killer
  DEFENSIVE: 'defensive',  // protects self or teammates from harm
  SELF:      'self',       // only affects self
  TEAM:      'team',       // explicitly benefits other survivors
  RECALL:    'recall',     // retrieves / re-arms something
  RECHARGE:  'recharge',   // restores resources (stamina, ammo, scrap…)
  MISC:      'misc',       // does not neatly fit another category
};

// Skill registry — each entry lists all relevant class tags
// Used by AI to decide which skills to prioritise under which conditions
const SKILL_REGISTRY = {
  // KILLER skills
  killer_punch:   { classes:[SKILL_CLASS.OFFENSIVE],                     range:58,  cd:5   },
  killer_grab:    { classes:[SKILL_CLASS.OFFENSIVE,SKILL_CLASS.DEFENSIVE],range:45,  cd:15  },
  killer_mine:    { classes:[SKILL_CLASS.OFFENSIVE,SKILL_CLASS.MISC],    range:999, cd:18  },
  killer_rage:    { classes:[SKILL_CLASS.OFFENSIVE,SKILL_CLASS.SELF],    range:999, cd:30  },
  // Engineer
  eng_build:      { classes:[SKILL_CLASS.SUPPORT,SKILL_CLASS.TEAM,SKILL_CLASS.DEFENSIVE], range:0,   cd:85  },
  eng_wrench:     { classes:[SKILL_CLASS.SUPPORT,SKILL_CLASS.TEAM,SKILL_CLASS.RECHARGE],  range:350, cd:25  },
  // Brawler
  brawler_punch:  { classes:[SKILL_CLASS.OFFENSIVE,SKILL_CLASS.SELF],    range:54,  cd:12  },
  brawler_parry:  { classes:[SKILL_CLASS.DEFENSIVE,SKILL_CLASS.SELF],    range:68,  cd:22  },
  // Escapee
  esc_heal:       { classes:[SKILL_CLASS.SELF,SKILL_CLASS.RECHARGE],     range:0,   cd:40  },
  esc_sling:      { classes:[SKILL_CLASS.OFFENSIVE,SKILL_CLASS.SELF],    range:420, cd:12  },
  // Medic
  med_link:       { classes:[SKILL_CLASS.SUPPORT,SKILL_CLASS.TEAM],      range:320, cd:50  },
  med_heal:       { classes:[SKILL_CLASS.SELF,SKILL_CLASS.RECHARGE],     range:0,   cd:30  },
  // Recon
  rec_scan:       { classes:[SKILL_CLASS.SUPPORT,SKILL_CLASS.TEAM,SKILL_CLASS.MISC], range:195, cd:25 },
  rec_smoke:      { classes:[SKILL_CLASS.DEFENSIVE,SKILL_CLASS.TEAM],    range:0,   cd:30  },
  // Commander
  cmd_airdrop:    { classes:[SKILL_CLASS.SUPPORT,SKILL_CLASS.TEAM,SKILL_CLASS.RECALL], range:0, cd:75 },
  cmd_ray:        { classes:[SKILL_CLASS.OFFENSIVE,SKILL_CLASS.SUPPORT],  range:500, cd:60  },
  // Assault
  asl_grenade:    { classes:[SKILL_CLASS.OFFENSIVE,SKILL_CLASS.TEAM],    range:400, cd:30  },
  asl_pistol:     { classes:[SKILL_CLASS.OFFENSIVE,SKILL_CLASS.SELF],    range:450, cd:1   },
  // Trapmaker
  trp_destroy:    { classes:[SKILL_CLASS.DEFENSIVE,SKILL_CLASS.TEAM,SKILL_CLASS.MISC], range:CELL*1.5, cd:50 },
  trp_trap:       { classes:[SKILL_CLASS.OFFENSIVE,SKILL_CLASS.MISC],    range:0,   cd:35  },
  // Golfer
  glf_swing:      { classes:[SKILL_CLASS.OFFENSIVE,SKILL_CLASS.SELF],    range:CELL*1.5, cd:10 },
  glf_flag:       { classes:[SKILL_CLASS.DEFENSIVE,SKILL_CLASS.MISC],    range:0,   cd:15  },
  glf_recall:     { classes:[SKILL_CLASS.RECALL,SKILL_CLASS.MISC],       range:0,   cd:20  },
  // Sniper
  snp_snipe:      { classes:[SKILL_CLASS.OFFENSIVE,SKILL_CLASS.SELF],    range:9999,cd:55  },
  snp_soda:       { classes:[SKILL_CLASS.SELF,SKILL_CLASS.RECHARGE],     range:0,   cd:80  },
};

// Helper: does a skill have a given class?
function skillHasClass(skillKey, cls){
  const reg=SKILL_REGISTRY[skillKey];
  return reg&&reg.classes.includes(cls);
}

// ═══════════════════════════════════════════════════════════════════════
//  SURVIVOR BASE CLASS
// ═══════════════════════════════════════════════════════════════════════
class Survivor extends Entity {
  constructor(x,y,name,color,kit){
    super(x,y,14,color,100);
    this.name=name;this.kit=kit;
    this.baseSpeed=88;
    this.stamina=100;this.maxStamina=100;this.staminaRegen=12;this.staminaDrain=22;
    this.sprinting=false;this.fatigueCooldown=0;
    this.state='patrol';
    this.statePrev='patrol';
    this.fleeHoldTimer=0;
    this.alertLevel=0;
    this.alertFade=0;
    this.alertTimer=0;
    this.knownKillerPos=null;
    this.knownKillerTime=0;
    this.knownKillerConfidence=0;
    this.facingTarget=this.facing;
    this.facingSpeed=7.0;
    this.ceTarget=null;this.ceTimer=0;
    this.patrolTarget=null;this.patrolTimer=0;
    this.strafeDir=randSign();this.strafeTimer=rand(0.5,1.5);
    this.wanderAngle=rand(0,Math.PI*2);
    this.skill1CD=0;this.skill2CD=0;
    this.dead=false;this.lastSurvivorBoost=false;this.skillBoostMult=1;
    this.teamSignalTimer=0;
    this.velX=0;this.velY=0;
    this.lastSeenRevealedMine=null;
    this.blindedDir=0;this.blindedWobble=0;
    this.currentlyChased=false;this.chasedTimer=0;
    this.facingSmooth=this.facing;
    this.wasGrabbed=false;
    this.glanceOffset=0;this.glanceTimer=0;this.glanceFadeTimer=0;
    this.mentalMap=null;this.knownCellCount=0;
    this.stuckPos={x:x,y:y};
    this.stuckTimer=0;
    this.emergencyFleeTimer=0;
    this.emergencyTarget=null;
    this._fleeTarget=null;
    this._fleeTargetTimer=0;

    // ── Survivor AI memory ───────────────────────────────────────────
    this._aiMem={
      // Remember the last N positions killer was seen at
      killerTrack:[],          // [{x,y,t}] last 8 entries
      maxTrack:8,
      // Cooperation: last time we called for help
      helpCallTimer:0,
      // Last time we got a response (teammate came near)
      lastTeammateRescue:0,
      // Whether we're the "bait" right now
      isBaiting:false,
      // Predicted killer heading
      killerHeading:0,
      // Safety cell cache
      safeCellCache:null,
      safeCellCacheTimer:0,
      // How many times we've evaded at this escape target
      evadeAttempts:0,
      // Timer for side-channel awareness broadcast
      broadcastTimer:0,
      // Kit-specific urgency bias (set by subclasses)
      urgencyBias:0,
    };
  }

  effectiveMaxHp(){return this.maxHp;}

  // ════════════════════════════════════════════════════════════════════
  //  TAKE DAMAGE  (interrupts rooted actions)
  // ════════════════════════════════════════════════════════════════════
  takeDamage(amount,src){
    if(!this.alive)return;
    if(hasStatus(this,'reloading')){
      clearStatus(this,'reloading');
      applyStatus(this,'speed_ii',4,{});
      addLog(`${this.name} reload interrupted — Speed II!`,'stun');
    }
    if(hasStatus(this,'charging')){
      clearStatus(this,'charging');
      this.isCharging=false;
      this.chargeTimer=0;
      addLog(`${this.name} charge interrupted!`,'stun');
    }
    if(hasStatus(this,'anxious')){
      amount*=1.1;
      clearStatus(this,'anxious');
      applyStatus(this,'scared',15,{});
      addLog(`${this.name} is SCARED!`,'stun');
    }
    super.takeDamage(amount,src);
    if(this.alive){
      applyStatus(this,'speed',2,{amount:0.45});
      if(!this._hpLog)this._hpLog=[];
      this._hpLog.push({t:gameTimer,dmg:amount});
      this._hpLog=this._hpLog.filter(e=>gameTimer-e.t<=10);
      const totalDmg=this._hpLog.reduce((s,e)=>s+e.dmg,0);
      if(!hasStatus(this,'furious')&&!this.lmsActive&&totalDmg>=this.effectiveMaxHp()*0.4){
        applyStatus(this,'furious',99999,{});
        addLog(`${this.name} is FURIOUS!`,'stun');
      }
      spawnBlood(this.x,this.y,'hit',
        src&&src.x!==undefined?src.x:undefined,
        src&&src.y!==undefined?src.y:undefined);

      // Scream to nearby teammates when hurt
      this._broadcastDanger();
    }
  }

  // Broadcast danger signal to all nearby teammates
  _broadcastDanger(){
    if(this._aiMem.broadcastTimer>0)return;
    this._aiMem.broadcastTimer=1.5;
    for(const s of survivors){
      if(s!==this&&s.alive&&dist(this,s)<CELL*5){
        s.receiveSignal({x:killer.x,y:killer.y},0.9);
        s.alertLevel=Math.max(s.alertLevel,1.5);
      }
    }
  }

  // ── Cooldown multiplier ──────────────────────────────────────────
  cdMult(){
    if(hasStatus(this,'ammo_pack'))return 0.0001;
    let m=this.skillBoostMult;
    if(hasStatus(this,'cd_boost'))  m*=0.45;
    if(hasStatus(this,'anxious'))   m*=0.85;
    if(hasStatus(this,'scared'))    m*=0.50;
    if(hasStatus(this,'wary'))      m*=0.75;
    if(hasStatus(this,'energized')) m*=0.25;
    return m;
  }

  _consumeAmmoPack(){
    const st=getStatus(this,'ammo_pack');
    if(st)st.remaining=Math.max(0,st.remaining-3);
  }

  // ── Last Survivor activation ──────────────────────────────────────
  checkLastSurvivor(){
    if(!this.lastSurvivorBoost){
      this.lastSurvivorBoost=true;this.skillBoostMult=0.33;
      this.lmsActive=true;
      this.hp=this.effectiveMaxHp();
      this.stamina=this.maxStamina;
      this.skill1CD=0;this.skill2CD=0;
      if(this.kit==='engineer'){this.wrenchCD=0;}
      if(this.kit==='brawler'){this.punchCD=0;this.punchStacks=2;this.punchState='ready';this.parryCD=0;}
      clearStatus(this,'survivor_rage');
      clearStatus(this,'furious');
      this._rageLandedStun=false;
      applyStatus(this,'last_survivor',9999,{});
      addLog(`${this.name} is the LAST SURVIVOR — FULLY HEALED, SKILLS READY, ALL EFFECTS ×3!`,'skill');
      triggerLMS(this.kit);
    }
  }

  // ── Accuracy ─────────────────────────────────────────────────────
  getAccuracy(targetDist){
    let acc=1.0;
    acc*=Math.max(0.2,1-(targetDist/400)*0.7);
    if(this.currentlyChased)acc*=Math.max(0.3,1-this.chasedTimer*0.04);
    if(this.hp<this.effectiveMaxHp()*0.3)acc*=0.6;
    return Math.min(1,Math.max(0.1,acc));
  }
  rollAccuracy(targetDist){return Math.random()<this.getAccuracy(targetDist);}

  // ── Emergency flee ────────────────────────────────────────────────
  triggerEmergencyFlee(){
    if(hasStatus(this,'reloading')||hasStatus(this,'charging')||hasStatus(this,'self_healing'))return;
    let bestDist=0,bestPos=null;
    const step=2;
    for(let cy=1;cy<ROWS_C-1;cy+=step) for(let cx=1;cx<COLS_C-1;cx+=step){
      if(!mapGrid[cy][cx])continue;
      const px=cx*CELL+CELL/2,py=cy*CELL+CELL/2;
      const d=Math.hypot(px-killer.x,py-killer.y);
      if(d>bestDist){bestDist=d;bestPos={x:px,y:py};}
    }
    if(bestPos&&bestDist>CELL*2){
      this.emergencyTarget=bestPos;
      this.emergencyFleeTimer=6;
      this.stamina=this.maxStamina;
      this.fatigueCooldown=0;
      clearStatus(this,'fatigued');
      addLog(`${this.name} emergency escape!`,'skill');
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  SENSES  (vision + hearing + team signals)
  // ════════════════════════════════════════════════════════════════════
  updateSenses(dt){
    const killerVisible=this.canSee(killer.x,killer.y);
    if(killerVisible){
      this.knownKillerPos={x:killer.x,y:killer.y};
      this.knownKillerTime=0;
      this.knownKillerConfidence=1;
      this.alertLevel=2;this.alertTimer=8;
      // Track killer path
      const track=this._aiMem.killerTrack;
      track.push({x:killer.x,y:killer.y,t:gameTimer});
      if(track.length>this._aiMem.maxTrack)track.shift();
      // Compute killer heading from track
      if(track.length>=2){
        const last=track[track.length-1],prev=track[track.length-2];
        const dx=last.x-prev.x,dy=last.y-prev.y;
        if(Math.hypot(dx,dy)>2)this._aiMem.killerHeading=Math.atan2(dy,dx);
      }
      if(this.teamSignalTimer<=0){
        this.teamSignalTimer=1.5;
        for(const s of survivors){
          if(s!==this&&s.alive&&dist(this,s)<220){
            s.receiveSignal({x:killer.x,y:killer.y},1);
          }
        }
      }
    } else {
      this.knownKillerTime+=dt;
      this.knownKillerConfidence=Math.max(0,this.knownKillerConfidence-dt*0.15);
      if(this.knownKillerConfidence<0.1)this.knownKillerPos=null;
      this.alertTimer=Math.max(0,this.alertTimer-dt);
      if(this.alertTimer<=0&&this.alertLevel>0)this.alertLevel=Math.max(0,this.alertLevel-0.5*dt);
    }
    this.teamSignalTimer=Math.max(0,this.teamSignalTimer-dt);

    // Mine awareness
    for(const m of mines){
      if(!m.alive||!m.revealed)continue;
      if(dist(this,m)<210)this.lastSeenRevealedMine={x:m.x,y:m.y};
    }

    // Chase tracking
    const kd=dist(this,killer);
    if(this.alertLevel>=1.5&&kd<200){
      this.currentlyChased=true;
      this.chasedTimer+=dt;
    } else {
      if(this.currentlyChased&&kd>280)this.currentlyChased=false;
      this.chasedTimer=Math.max(0,this.chasedTimer-dt*0.5);
    }

    // Broadcast timer
    this._aiMem.broadcastTimer=Math.max(0,this._aiMem.broadcastTimer-dt);
  }

  updateHearing(dt){
    if(!killer.alive)return;
    const kd=dist(this,killer);
    const HEAR_RANGE=CELL*3.5;
    const HEAR_RANGE_MOVING=CELL*5.0;
    const killerSpeed=Math.hypot(killer.velX,killer.velY);
    const effectiveRange=killerSpeed>80?HEAR_RANGE_MOVING:HEAR_RANGE;
    if(kd>effectiveRange)return;
    if(this.knownKillerConfidence>0.85)return;
    const hearChance=Math.max(0,1-(kd/effectiveRange))*0.85;
    if(Math.random()>hearChance*dt*4)return;
    const accuracy=Math.max(0.1,1-(kd/effectiveRange));
    const noiseAngle=(Math.random()-0.5)*(1-accuracy)*Math.PI*0.9;
    const trueAngle=Math.atan2(killer.y-this.y,killer.x-this.x);
    const heardAngle=trueAngle+noiseAngle;
    const heardDist=kd*(0.7+Math.random()*0.6);
    const heardX=this.x+Math.cos(heardAngle)*heardDist;
    const heardY=this.y+Math.sin(heardAngle)*heardDist;
    const confidence=accuracy*0.45;
    if(confidence>this.knownKillerConfidence){
      this.knownKillerPos={x:heardX,y:heardY};
      this.knownKillerConfidence=confidence;
      this.knownKillerTime=0;
      if(this.alertLevel<0.8)this.alertLevel=Math.min(0.8,this.alertLevel+0.3);
      if(this.alertTimer<2.5)this.alertTimer=2.5;
      const hearFaceNoise=(Math.random()-0.5)*0.6;
      this.facingTarget=heardAngle+hearFaceNoise;
      if(this.teamSignalTimer<=0){
        this.teamSignalTimer=3;
        for(const s of survivors){
          if(s!==this&&s.alive&&dist(this,s)<CELL*2.5){
            s.receiveSignal({x:heardX,y:heardY},confidence*0.5);
          }
        }
      }
    }
  }

  receiveSignal(pos,confidence){
    if(this.knownKillerConfidence<confidence){
      this.knownKillerPos={x:pos.x,y:pos.y};
      this.knownKillerConfidence=confidence*0.7;
      this.knownKillerTime=0;
      if(this.alertLevel<1)this.alertLevel=1;
      if(this.alertTimer<3)this.alertTimer=3;
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  STAMINA MANAGEMENT
  // ════════════════════════════════════════════════════════════════════
  updateStamina(dt,wantSprint){
    if(hasStatus(this,'reloading'))return false;
    if(this.fatigueCooldown>0){
      this.fatigueCooldown-=dt;applyStatus(this,'fatigued',0.1,{});this.sprinting=false;return false;
    }
    clearStatus(this,'fatigued');
    const rocketDrain=hasStatus(this,'rocket_boots')?0.90:1.0;
    if(wantSprint&&this.stamina>0){
      const drain=(hasStatus(this,'speed_ii')?this.staminaDrain*0.5:this.staminaDrain)*rocketDrain;
      this.stamina=Math.max(0,this.stamina-drain*dt);
      this.sprinting=true;
      if(this.stamina===0){this.fatigueCooldown=4.5;this.sprinting=false;applyStatus(this,'fatigued',4.5,{});addLog(`${this.name} fatigued!`);return false;}
      return true;
    } else {
      this.sprinting=false;
      const r=this.alertLevel<0.5?this.staminaRegen*1.5:this.staminaRegen;
      this.stamina=Math.min(this.maxStamina,this.stamina+r*dt);
      return false;
    }
  }

  // ── Line of sight ─────────────────────────────────────────────────
  canSee(tx,ty){
    const xray=hasStatus(this,'x_ray');
    const range=xray?LOS_RANGE*3:LOS_RANGE;
    const d=Math.hypot(tx-this.x,ty-this.y);
    if(d>range)return false;
    let effectiveAngle=LOS_ANGLE;
    if(hasStatus(this,'survivor_rage')&&!this._rageLandedStun&&!this.lmsActive)effectiveAngle=LOS_ANGLE*1.25;
    if(hasStatus(this,'carpal_tunnel')){
      const ct=getStatus(this,'carpal_tunnel');
      effectiveAngle=Math.max(0.05,effectiveAngle-(ct.data.degreesReduced||0)*(Math.PI/180));
    } else if(this._ctRecover&&this._ctRecover.timer>0){
      const frac=this._ctRecover.timer/this._ctRecover.maxTimer;
      effectiveAngle=Math.max(0.05,effectiveAngle-this._ctRecover.degreesReduced*frac*(Math.PI/180));
    }
    if(angleDiff(this.facing,Math.atan2(ty-this.y,tx-this.x))>effectiveAngle)return false;
    if(xray)return true;
    return inLOS(this,{x:tx,y:ty});
  }

  // ── Speed ────────────────────────────────────────────────────────
  effectiveSpeed(sprinting){
    let s=this.baseSpeed*(sprinting?1.55:1);
    if(hasStatus(this,'speed'))        s*=1.45;
    if(hasStatus(this,'speed_ii'))     s*=1.45;
    if(hasStatus(this,'rocket_boots')) s*=1.25;
    if(hasStatus(this,'furious'))      s*=1.05;
    if(hasStatus(this,'wary'))         s*=0.90;
    if(hasStatus(this,'slowed'))s*=1-(getStatus(this,'slowed').data.amount||0);
    if(hasStatus(this,'blinded'))s*=0.5;
    if(hasStatus(this,'fatigued'))s*=0.75;
    return s;
  }

  // ── Death ────────────────────────────────────────────────────────
  die(){
    if(this.dead)return;
    this.dead=true;this.alive=false;
    killerElimCount++;
    killerMemory.eliminationCount++;
    gameDuration+=30;

    // Rage nearby teammates
    for(const s of survivors){
      if(s.alive&&s!==this&&Math.hypot(s.x-this.x,s.y-this.y)<CELL*2){
        if(!hasStatus(s,'survivor_rage')){
          applyStatus(s,'survivor_rage',99999,{});
          s._rageLandedStun=false;
          addLog(`${s.name} is ENRAGED by nearby death!`,'kill');
        }
      }
    }

    // Teach killer: slippery target died — reduce slippery count
    if(killer&&killer._learnMemory){
      const lm=killer._learnMemory;
      lm.slippery[this.id]=0;
    }

    if(killer&&killer.alive&&killerMemory.eliminationCount>=4&&!hasStatus(killer,'dancefloor_madness')){
      applyStatus(killer,'dancefloor_madness',99999,{});
      addLog('DANCEFLOOR MADNESS — killer aggression maxed!','kill');
    }
    spawnBlood(this.x,this.y,'death',killer?killer.x:undefined,killer?killer.y:undefined);
    deathCameraEvent={x:this.x,y:this.y,timer:3.0};
    deathSlowTarget=0.14;
    addLog(`✦ ${this.name.toUpperCase()} ELIMINATED ✦`,'kill');
    spawnConfetti(130);
    const aliveLeft=survivors.filter(s=>s.alive);
    if(aliveLeft.length===1){gameDuration=Math.max(gameDuration,gameTimer+120);aliveLeft[0].checkLastSurvivor();}
    checkWinCondition();
  }

  // ════════════════════════════════════════════════════════════════════
  //  STATE MACHINE  (enhanced threat modeling)
  // ════════════════════════════════════════════════════════════════════
  evaluateState(dt){
    if(this.stateLockTimer===undefined){
      this.stateLockTimer=0;
      this.stateTierCurrent=SURVIVOR_STATE_TIER[this.state]??0;
    }
    this.stateLockTimer=Math.max(0,this.stateLockTimer-dt);

    const kd=dist(this,killer);
    const sawKiller=this.alertLevel>=1.8;
    const suspectKiller=this.alertLevel>=0.8;
    const knownClose=this.knownKillerPos&&dist(this,this.knownKillerPos)<280;

    if(hasStatus(killer,'blinded')&&killer.alive&&kd<420){
      this.alertLevel=Math.max(this.alertLevel,2);
      this.knownKillerPos={x:killer.x,y:killer.y};
    }

    let wantState;
    const killerActive=!hasStatus(killer,'stunned')&&!hasStatus(killer,'blinded');

    if(hasStatus(this,'stunned')||hasStatus(this,'blinded')){
      wantState='panic';
    } else if(!killerActive&&killer.alive&&kd<(this.kit==='brawler'?260:90)&&worldSafety(this.x,this.y)<=4){
      wantState='fight';
    } else if(sawKiller&&kd<100&&this.kit==='brawler'&&!hasStatus(this,'weakness')&&worldSafety(this.x,this.y)<=4){
      wantState='fight';
    } else if(sawKiller&&kd<200){
      wantState='chase-ender';
    } else if(suspectKiller&&knownClose&&this.stamina>25){
      wantState='chase-ender';
    } else if(suspectKiller&&knownClose){
      wantState='flee';
    } else if(suspectKiller&&!knownClose&&this.alertLevel>=0.5){
      wantState='high-alert';
    } else {
      wantState='patrol';
    }

    // Weakness forces flee
    if(hasStatus(this,'weakness'))wantState='flee';

    // Proximity override: non-brawlers flee when killer is close and active
    if(this.kit!=='brawler'&&killer&&killer.alive){
      if(killerActive){
        if(kd<CELL*3.5)wantState='flee';
        else if(kd<CELL*5&&(wantState==='patrol'||wantState==='high-alert'))wantState='flee';
      } else {
        if(kd<CELL*1.5&&(wantState==='patrol'||wantState==='high-alert'))wantState='flee';
      }
    }

    // ── Team coordination: if another survivor is in danger, consider
    //    switching from patrol→high-alert to help or bait
    if(wantState==='patrol'||wantState==='high-alert'){
      const mateDanger=survivors.some(s=>
        s!==this&&s.alive&&s.currentlyChased&&dist(this,s)<CELL*6
      );
      if(mateDanger)wantState='high-alert';
    }

    const wantTier  = SURVIVOR_STATE_TIER[wantState]??0;
    const curTier   = SURVIVOR_STATE_TIER[this.state]??0;
    const tierDelta = curTier-wantTier;

    if(wantState===this.state)return;

    if(wantTier>curTier){
      this._applyStateTransition(wantState,wantTier);
      return;
    }

    if(this.stateLockTimer>0)return;

    const allowedTier=Math.max(wantTier,curTier-1);
    const allowedState=this._stateForTier(allowedTier);
    if(allowedState!==this.state){
      const lockDuration=SURVIVOR_DOWNGRADE_LOCKOUT[Math.min(tierDelta,SURVIVOR_DOWNGRADE_LOCKOUT.length-1)]??5.0;
      this.stateLockTimer=lockDuration;
      this._applyStateTransition(allowedState,allowedTier);
    }
  }

  _stateForTier(tier){
    for(const [state,t] of Object.entries(SURVIVOR_STATE_TIER)){
      if(t===tier)return state;
    }
    return 'patrol';
  }

  _applyStateTransition(newState,newTier){
    if(newState===this.state)return;
    this.statePrev=this.state;
    this.stateTierCurrent=newTier;
    if(this.state==='chase-ender')this._ceEscTarget=null;
    const wasChasing=this.state==='flee'||this.state==='chase-ender';
    if(wasChasing&&newState==='patrol'&&worldSafety(this.x,this.y)>=9&&!hasStatus(this,'wary')){
      applyStatus(this,'wary',10,{});
      applyStatus(this,'carpal_tunnel',10,{degreesReduced:25,origDur:10});
      addLog(`${this.name} is WARY after escaping!`,'skill');
    }
    if(newState==='panic'){
      const vlen=Math.hypot(this.velX,this.velY);
      this.blindedDir=vlen>2?Math.atan2(this.velY,this.velX):this.facing;
      this.blindedWobble=0;
    }
    if(newState==='flee'){
      this.strafeTimer=rand(0.5,1.2);
      this._fleeTarget=null;
      this._fleeTargetTimer=0;
    }
    if(newState==='chase-ender'){this.ceTarget=null;this.ceTimer=0;}
    this.state=newState;
  }

  // ════════════════════════════════════════════════════════════════════
  //  MAIN UPDATE LOOP
  // ════════════════════════════════════════════════════════════════════
  update(dt){
    const prevGrabbed=this.wasGrabbed;
    const hadSpeed=hasStatus(this,'speed');
    tickStatuses(this,dt);
    const nowHasSpeed=hasStatus(this,'speed');
    if(hadSpeed&&!nowHasSpeed&&!hasStatus(this,'anxious'))applyStatus(this,'anxious',30,{});
    if(!this.alive)return;
    pushOutOfWall(this);
    const nowGrabbed=hasStatus(this,'grabbed');
    this.wasGrabbed=nowGrabbed;
    if(prevGrabbed&&!nowGrabbed)this.triggerEmergencyFlee();
    if(nowGrabbed){
      this.facingTarget=Math.atan2(killer.y-this.y,killer.x-this.x);
      this.facing=lerpAngle(this.facing,this.facingTarget,dt*6);
      this.facingSmooth=this.facing;
      return;
    }
    if(hasStatus(this,'reloading')){
      this.velX=0;this.velY=0;
      this.facingSmooth=lerpAngle(this.facingSmooth||this.facing,this.facingTarget,1-Math.exp(-this.facingSpeed*dt));
      this.facing=this.facingSmooth;
      if(this.skill1CD>0)this.skill1CD=Math.max(0,this.skill1CD-dt/this.cdMult());
      if(this.skill2CD>0)this.skill2CD=Math.max(0,this.skill2CD-dt/this.cdMult());
      this.kitUpdate(dt);
      return;
    }
    if(hasStatus(this,'charging')){
      this.velX=0;this.velY=0;
      this.facingSmooth=lerpAngle(this.facingSmooth||this.facing,this.facingTarget,1-Math.exp(-this.facingSpeed*dt));
      this.facing=this.facingSmooth;
      if(this.skill1CD>0)this.skill1CD=Math.max(0,this.skill1CD-dt/this.cdMult());
      if(this.skill2CD>0)this.skill2CD=Math.max(0,this.skill2CD-dt/this.cdMult());
      this.kitUpdate(dt);
      return;
    }
    if(hasStatus(this,'stunned')){
      this.fleeFromKillerIfStunned(dt);
      return;
    }
    if(this.skill1CD>0)this.skill1CD=Math.max(0,this.skill1CD-dt/this.cdMult());
    if(this.skill2CD>0)this.skill2CD=Math.max(0,this.skill2CD-dt/this.cdMult());

    this.updateMentalMap();
    this.updateSenses(dt);
    this.updateHearing(dt);
    this.facingSmooth=lerpAngle(this.facingSmooth||this.facing,this.facingTarget,1-Math.exp(-this.facingSpeed*dt));
    this.facing=this.facingSmooth;

    // Stuck detection
    if(this.emergencyFleeTimer<=0){
      this.stuckTimer+=dt;
      if(this.stuckTimer>=1.0){
        const moved=Math.hypot(this.x-this.stuckPos.x,this.y-this.stuckPos.y);
        if(moved<CELL*0.45){
          this.patrolTarget=null;
          this._fleeTarget=null;
          this._ceEscTarget=null;
          const scx=Math.floor(this.x/CELL),scy=Math.floor(this.y/CELL);
          const dirs=[[1,0],[-1,0],[0,1],[0,-1]].sort(()=>Math.random()-0.5);
          for(const [ddx,ddy] of dirs){
            const nx2=scx+ddx,ny2=scy+ddy;
            if(nx2>=0&&ny2>=0&&nx2<COLS_C&&ny2<ROWS_C&&mapGrid[ny2][nx2]&&
               !(killer&&killer.alive&&Math.hypot(nx2*CELL+CELL/2-killer.x,ny2*CELL+CELL/2-killer.y)<CELL*2)){
              this.velX=ddx*this.effectiveSpeed(false)*0.7;
              this.velY=ddy*this.effectiveSpeed(false)*0.7;
              break;
            }
          }
          if(moved<CELL*0.15)this.triggerEmergencyFlee();
        }
        this.stuckPos={x:this.x,y:this.y};
        this.stuckTimer=0;
      }
    }

    // Rocket boots distance tracking
    if(hasStatus(this,'rocket_boots')){
      if(!this._rbBootsAccum)this._rbBootsAccum=0;
      const moved=Math.hypot(this.x-(this._rbLastX||this.x),this.y-(this._rbLastY||this.y));
      this._rbBootsAccum+=moved;
      const tilesWalked=Math.floor(this._rbBootsAccum/CELL);
      if(tilesWalked>0){
        const st=getStatus(this,'rocket_boots');
        if(st)st.remaining=Math.max(0,st.remaining-tilesWalked*2);
        this._rbBootsAccum-=tilesWalked*CELL;
      }
    }
    this._rbLastX=this.x;this._rbLastY=this.y;

    this.kitUpdate(dt);
    this.evaluateState(dt);

    // Emergency flee override
    if(this.emergencyFleeTimer>0){
      if(hasStatus(this,'reloading')||hasStatus(this,'charging')||hasStatus(this,'self_healing')){
        this.emergencyFleeTimer=0;this.emergencyTarget=null;
      }
      this.emergencyFleeTimer-=dt;
      if(this.emergencyTarget&&dist(this,this.emergencyTarget)>CELL*0.5){
        const fd=getFlowDir(this.x,this.y,this.emergencyTarget.x,this.emergencyTarget.y);
        const len=Math.hypot(fd.dx,fd.dy)||1;
        clearStatus(this,'fatigued');
        this.fatigueCooldown=0;
        this.stamina=Math.max(0,this.stamina-this.staminaDrain*dt);
        const spd=this.baseSpeed*1.45;
        this.smoothMove(fd.dx/len,fd.dy/len,spd,dt);
        this.stuckPos={x:this.x,y:this.y};this.stuckTimer=0;
      } else {
        this.emergencyFleeTimer=0;
      }
      this.applyLookAround(dt);
      return;
    }

    this.aiUpdate(dt);

    // Wound blood trail
    if(this.hp<this.effectiveMaxHp()*0.50){
      if(!this._woundTrailTimer)this._woundTrailTimer=0;
      this._woundTrailTimer-=dt;
      if(this._woundTrailTimer<=0){
        const hpFrac=Math.max(0,this.hp/this.effectiveMaxHp());
        const interval=0.06+hpFrac*0.44;
        this._woundTrailTimer=interval;
        const vl=Math.hypot(this.velX,this.velY);
        if(vl>this.baseSpeed*0.25){
          spawnBlood(this.x,this.y,'hit',
            this.x+(this.velX/vl)*22,this.y+(this.velY/vl)*22);
        }
      }
    } else {
      this._woundTrailTimer=0;
    }

    // Run smoke
    if(!hasStatus(this,'stunned')&&!hasStatus(this,'grabbed')){
      const spd=Math.hypot(this.velX,this.velY);
      if(spd>this.baseSpeed*0.85){
        if(!this._smokePuff)this._smokePuff=0;
        this._smokePuff-=dt;
        if(this._smokePuff<=0){
          spawnRunSmoke(this.x,this.y+this.r);
          this._smokePuff=0.07+Math.random()*0.04;
        }
      }
    }
    this.applyLookAround(dt);
  }

  fleeFromKillerIfStunned(dt){
    const kd=dist(this,killer);
    if(kd<350){
      const a=Math.atan2(this.y-killer.y,this.x-killer.x);
      const spd=this.effectiveSpeed(false)*0.5;
      moveEntity(this,Math.cos(a),Math.sin(a),spd,dt);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  AI DISPATCH
  // ════════════════════════════════════════════════════════════════════
  aiUpdate(dt){
    if(this.state==='flee')            this.doFlee(dt);
    else if(this.state==='chase-ender')this.doChaseEnder(dt);
    else if(this.state==='fight')      this.doFight(dt);
    else if(this.state==='panic')      this.doPanic(dt);
    else if(this.state==='high-alert') this.doHighAlert(dt);
    else                               this.doPatrol(dt);
  }

  // ════════════════════════════════════════════════════════════════════
  //  FLEE  (smart: avoids mines, uses corridors, reads killer heading)
  // ════════════════════════════════════════════════════════════════════
  doFlee(dt){
    const kd=dist(this,killer);
    const selfSafety=worldSafety(this.x,this.y);
    const MIN_DIST=CELL*2.5;
    const killerThreatening=kd<CELL*5||selfSafety<4;
    if(!killerThreatening){
      this.updateStamina(dt,false);
      this.doPatrol(dt);
      return;
    }
    const wantSprint=(selfSafety<4&&this.stamina>20)||(kd<200&&this.stamina>20);
    const sprinting=this.updateStamina(dt,wantSprint);
    this._fleeMove(dt,sprinting);
    if(kd<MIN_DIST){this.stuckPos={x:this.x,y:this.y};this.stuckTimer=0;}
  }

  // ── Chase-ender ─────────────────────────────────────────────────────
  doChaseEnder(dt){
    const kd=dist(this,killer);
    const wantSprint=this.stamina>35||(kd<180&&this.stamina>15);
    const sprinting=this.updateStamina(dt,wantSprint&&this.stamina>12);
    const spd=this.effectiveSpeed(sprinting);
    const needsTarget=!this._ceEscTarget;
    const arrived=this._ceEscTarget&&dist(this,this._ceEscTarget)<CELL*1.2;
    const killerReachedTarget=this._ceEscTarget&&
      Math.hypot(killer.x-this._ceEscTarget.x,killer.y-this._ceEscTarget.y)<CELL*1.5;
    if(needsTarget||arrived||killerReachedTarget){
      this._ceEscTarget=this._computeGlobalEscapeTarget();
    }
    let dx=0,dy=0;
    if(this._ceEscTarget){
      const tdx=this._ceEscTarget.x-this.x,tdy=this._ceEscTarget.y-this.y;
      const tdist=Math.hypot(tdx,tdy)||1;
      if(tdist>8){
        const fd=getFlowDir(this.x,this.y,this._ceEscTarget.x,this._ceEscTarget.y);
        const flen=Math.hypot(fd.dx,fd.dy);
        if(flen>0.01){
          dx=fd.dx/flen;dy=fd.dy/flen;
          const dot=(dx*(tdx/tdist))+(dy*(tdy/tdist));
          if(dot<0.0){dx=tdx/tdist;dy=tdy/tdist;}
        } else {dx=tdx/tdist;dy=tdy/tdist;}
      }
    }
    if(kd<CELL*1.5&&(dx!==0||dy!==0)){
      const ka=Math.atan2(this.y-killer.y,this.x-killer.x);
      const urgency=Math.max(0,1-(kd/(CELL*1.5)));
      dx=dx*(1-urgency)+Math.cos(ka)*urgency;
      dy=dy*(1-urgency)+Math.sin(ka)*urgency;
    }
    if(dx===0&&dy===0){
      const ka=Math.atan2(this.y-killer.y,this.x-killer.x);
      dx=Math.cos(ka);dy=Math.sin(ka);
    }
    this.smoothMove(dx,dy,spd,dt);
    this.stuckPos={x:this.x,y:this.y};this.stuckTimer=0;
  }

  _computeGlobalEscapeTarget(){
    const kx=killer.x,ky=killer.y;
    const kd_to_self=Math.hypot(this.x-kx,this.y-ky);

    // Predict where killer is heading — avoid that sector
    const killerHeading=this._aiMem.killerHeading;
    const avoidAngle=killerHeading;

    let bestScore=-Infinity,bestPos=null;
    let bestScoreNoFilter=-Infinity,bestPosNoFilter=null;
    const step=2;
    for(let cy=1;cy<ROWS_C-1;cy+=step){
      for(let cx=1;cx<COLS_C-1;cx+=step){
        if(!mapGrid[cy][cx])continue;
        const px=cx*CELL+CELL/2,py=cy*CELL+CELL/2;
        const dKiller=Math.hypot(px-kx,py-ky);
        let orthoOpen=0;
        if(cy>0        &&mapGrid[cy-1][cx])orthoOpen++;
        if(cy<ROWS_C-1 &&mapGrid[cy+1][cx])orthoOpen++;
        if(cx>0        &&mapGrid[cy][cx-1])orthoOpen++;
        if(cx<COLS_C-1 &&mapGrid[cy][cx+1])orthoOpen++;
        if(orthoOpen<=1)continue;
        let diagOpen=0;
        if(cy>0        &&cx>0        &&mapGrid[cy-1][cx-1])diagOpen++;
        if(cy>0        &&cx<COLS_C-1 &&mapGrid[cy-1][cx+1])diagOpen++;
        if(cy<ROWS_C-1 &&cx>0        &&mapGrid[cy+1][cx-1])diagOpen++;
        if(cy<ROWS_C-1 &&cx<COLS_C-1 &&mapGrid[cy+1][cx+1])diagOpen++;
        const loopWeight=0.6+(orthoOpen/4)*0.6+(diagOpen/4)*0.4+(orthoOpen>=3?0.35:0.0);
        const mapCX=W/2,mapCY=H/2;
        const killerAngle=Math.atan2(ky-mapCY,kx-mapCX);
        const cellAngle=Math.atan2(py-mapCY,px-mapCX);
        let aDiff=Math.abs(((cellAngle-killerAngle+Math.PI*3)%(Math.PI*2))-Math.PI);
        // Penalise tiles in the direction killer is heading
        const toCellAngle=Math.atan2(py-ky,px-kx);
        const killerHeadingPenalty=Math.max(0,Math.cos(avoidAngle-toCellAngle))*0.5;
        const branchBonus=0.7+(aDiff/Math.PI)*0.8-killerHeadingPenalty;
        const distFactor=Math.min(dKiller,kd_to_self*2.5);
        const safetyMult=0.5+(getTileSafety(cx,cy)/9)*1.0;
        const score=distFactor*loopWeight*branchBonus*safetyMult;
        if(score>bestScoreNoFilter){bestScoreNoFilter=score;bestPosNoFilter={x:px,y:py};}
        if(dKiller<CELL*2)continue;
        if(score>bestScore){bestScore=score;bestPos={x:px,y:py};}
      }
    }
    const result=bestPos||bestPosNoFilter;
    return result?this._jitterTarget(result):result;
  }

  _fleeMove(dt,sprinting){
    const kd=dist(this,killer);
    const spd=this.effectiveSpeed(sprinting);
    this._fleeTargetTimer-=dt;
    const arrived=this._fleeTarget&&dist(this,this._fleeTarget)<CELL*1.8;
    const stale=!this._fleeTarget||this._fleeTargetTimer<=0;
    const killerNear=this._fleeTarget&&
      Math.hypot(killer.x-this._fleeTarget.x,killer.y-this._fleeTarget.y)<CELL*2;
    if(arrived&&worldSafety(this.x,this.y)>=4&&dist(this,killer)>CELL*4){
      this._fleeTargetTimer=rand(3,6);
      this._fleeTarget=null;
      return;
    }
    if(arrived||stale||killerNear){
      this._fleeTarget=this._computeFleeBandTarget();
      this._fleeTargetTimer=rand(4,8);
    }
    let dx=0,dy=0;
    if(this._fleeTarget){
      const tdx=this._fleeTarget.x-this.x,tdy=this._fleeTarget.y-this.y;
      const tdist=Math.hypot(tdx,tdy)||1;
      const fd=getFlowDir(this.x,this.y,this._fleeTarget.x,this._fleeTarget.y);
      const flen=Math.hypot(fd.dx,fd.dy)||1;
      dx=fd.dx/flen;dy=fd.dy/flen;
      if((dx*(tdx/tdist))+(dy*(tdy/tdist))<0){dx=tdx/tdist;dy=tdy/tdist;}
    } else {
      const a=Math.atan2(this.y-killer.y,this.x-killer.x);
      dx=Math.cos(a);dy=Math.sin(a);
    }
    if(kd<CELL*1.5){
      const ka=Math.atan2(this.y-killer.y,this.x-killer.x);
      const urgency=Math.max(0,1-(kd/(CELL*1.5)));
      dx=dx*(1-urgency)+Math.cos(ka)*urgency;
      dy=dy*(1-urgency)+Math.sin(ka)*urgency;
    }
    // Mine avoidance
    for(const m of mines){
      if(!m.alive||!m.revealed)continue;
      const md=dist(this,m);
      const avoidR=m.r+130;
      if(md<avoidR){
        const push=Math.atan2(this.y-m.y,this.x-m.x);
        const str=Math.max(0,1-(md/avoidR))*22;
        dx+=Math.cos(push)*str;dy+=Math.sin(push)*str;
      }
    }
    const selfSafety=worldSafety(this.x,this.y);
    if(selfSafety<4){
      let gx=0,gy=0,bestS=selfSafety;
      for(const [ddx,ddy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
        const ns=worldSafety(this.x+ddx*CELL,this.y+ddy*CELL);
        if(ns>bestS){bestS=ns;gx=ddx;gy=ddy;}
      }
      if(gx||gy){const gl=Math.hypot(gx,gy)||1;dx+=(gx/gl)*0.5;dy+=(gy/gl)*0.5;}
    }
    const prevX=this.x,prevY=this.y;
    this.smoothMove(dx,dy,spd,dt);
    if(Math.abs(this.x-prevX)<0.5&&Math.abs(this.y-prevY)<0.5)this._fleeTarget=null;
  }

  _computeFleeBandTarget(){
    // Cache safe cells periodically
    if(!this._aiMem.safeCellCache||this._aiMem.safeCellCacheTimer<=0){
      let maxSafety=0;
      for(let cy=1;cy<ROWS_C-1;cy++) for(let cx=1;cx<COLS_C-1;cx++){
        if(!mapGrid[cy][cx])continue;
        const s=getTileSafety(cx,cy);
        if(s>maxSafety)maxSafety=s;
      }
      this._aiMem.safeCellCache={maxSafety};
      this._aiMem.safeCellCacheTimer=3;
    }
    this._aiMem.safeCellCacheTimer-=0;

    const maxSafety=this._aiMem.safeCellCache.maxSafety;
    let best=null,bestDist=Infinity;
    const step=2;
    for(let cy=1;cy<ROWS_C-1;cy+=step) for(let cx=1;cx<COLS_C-1;cx+=step){
      if(!mapGrid[cy][cx])continue;
      if(getTileSafety(cx,cy)<maxSafety)continue;
      const px=cx*CELL+CELL/2,py=cy*CELL+CELL/2;
      const dSelf=Math.hypot(px-this.x,py-this.y);
      if(dSelf<CELL)continue;
      if(killer&&killer.alive){
        const _kActive=!hasStatus(killer,'stunned')&&!hasStatus(killer,'blinded');
        if(_kActive&&Math.hypot(px-killer.x,py-killer.y)<CELL*3.5)continue;
      }
      if(dSelf<bestDist){bestDist=dSelf;best={x:px,y:py};}
    }
    if(!best){
      for(let cy=1;cy<ROWS_C-1;cy++) for(let cx=1;cx<COLS_C-1;cx++){
        if(!mapGrid[cy][cx])continue;
        const px=cx*CELL+CELL/2,py=cy*CELL+CELL/2;
        const d=Math.hypot(px-this.x,py-this.y);
        if(!best||d<Math.hypot(best.x-this.x,best.y-this.y))best={x:px,y:py};
      }
    }
    return best?this._jitterTarget(best):best;
  }

  // ── Fight ────────────────────────────────────────────────────────────
  doFight(dt){
    this.updateStamina(dt,false);
    const fd=getFlowDir(this.x,this.y,killer.x,killer.y);
    this.smoothMove(fd.dx,fd.dy,this.effectiveSpeed(false),dt);
  }

  // ── Panic ────────────────────────────────────────────────────────────
  doPanic(dt){
    this.updateStamina(dt,false);
    if(hasStatus(this,'blinded')){
      this.blindedWobble+=(Math.random()-0.5)*1.8*dt;
      this.blindedWobble*=Math.exp(-1.2*dt);
      this.blindedWobble=Math.max(-0.7,Math.min(0.7,this.blindedWobble));
      let moveAngle=this.blindedDir+this.blindedWobble;
      if(this.lastSeenRevealedMine){
        const md=dist(this,this.lastSeenRevealedMine);
        if(md<115){
          const mineAngle=Math.atan2(this.lastSeenRevealedMine.y-this.y,this.lastSeenRevealedMine.x-this.x);
          moveAngle=mineAngle+Math.PI;
        }
      }
      const spd=this.effectiveSpeed(false)*0.55;
      this.smoothMove(Math.cos(moveAngle),Math.sin(moveAngle),spd,dt);
      return;
    }
    const stunnedA=Math.atan2(this.y-killer.y,this.x-killer.x)+(Math.random()-0.5)*0.8;
    const spd=this.effectiveSpeed(false)*0.28;
    this.smoothMove(Math.cos(stunnedA),Math.sin(stunnedA),spd,dt);
  }

  // ── Patrol  (role-aware, team spread, mine-avoiding) ─────────────────
  doPatrol(dt){
    this.updateStamina(dt,false);
    const selfCX=Math.floor(this.x/CELL),selfCY=Math.floor(this.y/CELL);
    const sameCell=this.patrolTarget&&
      Math.floor(this.patrolTarget.x/CELL)===selfCX&&
      Math.floor(this.patrolTarget.y/CELL)===selfCY;
    if(!this.patrolTarget||dist(this,this.patrolTarget)<CELL*0.8||this.patrolTimer<=0||sameCell){
      const raw=this._computeRolePatrolTarget();
      let finalTarget=raw?this._jitterTarget(raw):raw;
      if(finalTarget&&Math.floor(finalTarget.x/CELL)===selfCX&&Math.floor(finalTarget.y/CELL)===selfCY){
        finalTarget=randPos(60);
      }
      this.patrolTarget=finalTarget;
      this.patrolTimer=rand(4,9)+rand(-1,2)+Math.random()*2;
      this.velX*=0.25;this.velY*=0.25;
    }
    this.patrolTimer-=dt;

    const tdx=this.patrolTarget.x-this.x,tdy=this.patrolTarget.y-this.y;
    const tdist=Math.hypot(tdx,tdy)||1;
    const fd=getFlowDir(this.x,this.y,this.patrolTarget.x,this.patrolTarget.y);
    const flen=Math.hypot(fd.dx,fd.dy)||1;
    let pdx=fd.dx/flen,pdy=fd.dy/flen;
    const dot=(pdx*(tdx/tdist))+(pdy*(tdy/tdist));
    if(dot<0.0){pdx=tdx/tdist;pdy=tdy/tdist;}

    if(!fd.dx&&!fd.dy){
      this.patrolTarget=null;this.velX=0;this.velY=0;
      const _dirs=[[1,0],[-1,0],[0,1],[0,-1]].sort(()=>Math.random()-0.5);
      for(const [_ddx,_ddy] of _dirs){
        const _nx=Math.floor(this.x/CELL)+_ddx,_ny=Math.floor(this.y/CELL)+_ddy;
        if(_nx>=0&&_ny>=0&&_nx<COLS_C&&_ny<ROWS_C&&mapGrid[_ny][_nx]){
          this.velX=_ddx*this.effectiveSpeed(false)*0.45;
          this.velY=_ddy*this.effectiveSpeed(false)*0.45;
          break;
        }
      }
      return;
    }

    const ma=this._applyMineAvoidance(pdx,pdy);
    pdx=ma.dx;pdy=ma.dy;

    // Avoid patrol target if it's near a mine
    if(this.patrolTarget&&mines.some(m=>m.alive&&(m.revealed||(this.kit==='trapmaker'&&!m.improvised))&&dist(this.patrolTarget,m)<m.r+80))
      this.patrolTarget=null;
    // Avoid patrol target if killer is between us and it
    if(this.patrolTarget&&killer&&killer.alive){
      const _kActive=!hasStatus(killer,'stunned')&&!hasStatus(killer,'blinded');
      if(_kActive){
        const _kd2=dist(this,killer);
        const _td2=dist(this,this.patrolTarget);
        if(_kd2<_td2*0.85){
          const _ta=Math.atan2(this.patrolTarget.y-this.y,this.patrolTarget.x-this.x);
          const _ka=Math.atan2(killer.y-this.y,killer.x-this.x);
          const _adiff=Math.abs(((_ta-_ka+Math.PI*3)%(Math.PI*2))-Math.PI);
          if(_adiff<Math.PI*0.38)this.patrolTarget=null;
        }
      }
    }

    // Team spread: don't clump on same patrol target as teammate
    if(this.patrolTarget){
      const clumped=survivors.filter(s=>
        s!==this&&s.alive&&s.patrolTarget&&
        Math.hypot(s.patrolTarget.x-this.patrolTarget.x,s.patrolTarget.y-this.patrolTarget.y)<CELL
      ).length;
      if(clumped>=2)this.patrolTarget=null; // recompute next tick
    }

    if(this.patrolTarget){
      for(const [_ddx,_ddy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const _wnx=Math.floor(this.x/CELL)+_ddx,_wny=Math.floor(this.y/CELL)+_ddy;
        const _isW=_wnx<0||_wny<0||_wnx>=COLS_C||_wny>=ROWS_C||!mapGrid[_wny]?.[_wnx];
        if(_isW){const _wdot=(pdx*_ddx)+(pdy*_ddy);if(_wdot>0.72){this.patrolTarget=null;break;}}
      }
    }
    this.smoothMove(pdx,pdy,this.effectiveSpeed(false)*0.7,dt);
  }

  // ── High alert ───────────────────────────────────────────────────────
  doHighAlert(dt){
    this.updateStamina(dt,false);
    const refX=this.knownKillerPos?this.knownKillerPos.x:null;
    const refY=this.knownKillerPos?this.knownKillerPos.y:null;
    const kd=dist(this,killer);
    const SAFE_DIST=CELL*4;

    if(refX!==null){
      const dToRef=Math.hypot(refX-this.x,refY-this.y);
      if(dToRef>CELL*2&&kd>SAFE_DIST){
        const tdx=refX-this.x,tdy=refY-this.y;
        const tdist=Math.hypot(tdx,tdy)||1;
        const fd=getFlowDir(this.x,this.y,refX,refY);
        const flen=Math.hypot(fd.dx,fd.dy)||1;
        let dx=fd.dx/flen,dy=fd.dy/flen;
        const dot=(dx*(tdx/tdist))+(dy*(tdy/tdist));
        if(dot<0.0){dx=tdx/tdist;dy=tdy/tdist;}
        this.smoothMove(dx,dy,this.effectiveSpeed(false)*0.6,dt);
        this.facingTarget=Math.atan2(refY-this.y,refX-this.x);
        return;
      }
    }

    if(!this.patrolTarget||dist(this,this.patrolTarget)<40||this.patrolTimer<=0){
      let best=null,bestScore=-Infinity;
      for(let i=0;i<12;i++){
        const p=randPos(60);
        const dKiller=refX!==null?Math.hypot(p.x-refX,p.y-refY):200;
        const dSelf=dist(this,p);
        const safetyBonus=worldSafety(p.x,p.y)*28;
        const score=dKiller*0.6+dSelf*0.4+safetyBonus+rand(-30,30);
        if(score>bestScore){bestScore=score;best=p;}
      }
      this.patrolTarget=best||randPos(60);
      this.patrolTimer=rand(3,7);
    }
    this.patrolTimer-=dt;

    const tdx=this.patrolTarget.x-this.x,tdy=this.patrolTarget.y-this.y;
    const tdist=Math.hypot(tdx,tdy)||1;
    const fd=getFlowDir(this.x,this.y,this.patrolTarget.x,this.patrolTarget.y);
    const flen=Math.hypot(fd.dx,fd.dy)||1;
    let pdx=fd.dx/flen,pdy=fd.dy/flen;
    const dot=(pdx*(tdx/tdist))+(pdy*(tdy/tdist));
    if(dot<0.0){pdx=tdx/tdist;pdy=tdy/tdist;}
    if(!fd.dx&&!fd.dy){this.patrolTarget=null;return;}
    const ma=this._applyMineAvoidance(pdx,pdy);
    pdx=ma.dx;pdy=ma.dy;
    this.facingTarget=Math.atan2(pdy,pdx)+Math.sin(Date.now()/600)*0.55;
    this.smoothMove(pdx,pdy,this.effectiveSpeed(false)*0.75,dt);

    // Team broadcast
    if(this.teamSignalTimer<=0&&this.knownKillerPos){
      this.teamSignalTimer=3;
      for(const s of survivors){
        if(s!==this&&s.alive&&dist(this,s)<280){
          s.receiveSignal(this.knownKillerPos,0.6);
        }
      }
    }
  }

  // ── Smooth move ───────────────────────────────────────────────────────
  smoothMove(dx,dy,spd,dt){
    if(!dx&&!dy)return;
    const len=Math.hypot(dx,dy)||1;
    let fx=dx/len,fy=dy/len;
    const ccx=Math.floor(this.x/CELL),ccy=Math.floor(this.y/CELL);
    if(ccx>=0&&ccy>=0&&ccx<COLS_C&&ccy<ROWS_C&&mapGrid[ccy]?.[ccx]){
      const cx=ccx*CELL+CELL/2,cy=ccy*CELL+CELL/2;
      const perpX=-fy,perpY=fx;
      const offPerp=(cx-this.x)*perpX+(cy-this.y)*perpY;
      const sign=offPerp>0?1:-1;
      const nudgeX=perpX*sign,nudgeY=perpY*sign;
      const tnx=Math.floor((this.x+nudgeX*10)/CELL),tny=Math.floor((this.y+nudgeY*10)/CELL);
      if(tnx>=0&&tny>=0&&tnx<COLS_C&&tny<ROWS_C&&mapGrid[tny]?.[tnx]){
        const alignStr=Math.min(Math.abs(offPerp)/(CELL*0.3),1.0)*0.3;
        fx+=nudgeX*alignStr;fy+=nudgeY*alignStr;
      }
    }
    const fl=Math.hypot(fx,fy)||1;
    fx/=fl;fy/=fl;
    this.facingTarget=Math.atan2(fy,fx);
    moveEntity(this,fx,fy,spd,dt);
    this.velX=fx*spd;this.velY=fy*spd;
  }

  // ── Mental map ───────────────────────────────────────────────────────
  updateMentalMap(){
    if(!this.mentalMap&&ROWS_C&&COLS_C)this.mentalMap=new Uint8Array(ROWS_C*COLS_C);
    if(!this.mentalMap)return;
    const cx=Math.floor(this.x/CELL),cy=Math.floor(this.y/CELL);
    const r=4;
    for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){
      const nx=cx+dx,ny=cy+dy;
      if(nx<0||ny<0||nx>=COLS_C||ny>=ROWS_C||!mapGrid[ny][nx])continue;
      if(dx*dx+dy*dy<=r*r&&!this.mentalMap[ny*COLS_C+nx]){
        this.mentalMap[ny*COLS_C+nx]=1;
        this.knownCellCount++;
      }
    }
  }
  knownCell(cx,cy){
    if(!this.mentalMap||cx<0||cy<0||cx>=COLS_C||cy>=ROWS_C)return false;
    return this.mentalMap[cy*COLS_C+cx]===1;
  }

  // ── Look-around ──────────────────────────────────────────────────────
  applyLookAround(dt){
    this.glanceTimer-=dt;
    if(this.glanceTimer<=0){
      this.glanceTimer=rand(1.2,2.8);
      const sweepAmt=this.state==='flee'?rand(0.2,0.45):rand(0.3,0.7);
      this.glanceOffset=randSign()*sweepAmt;
      this.glanceFadeTimer=rand(0.5,1.1);
    }
    if(this.glanceFadeTimer>0){
      this.glanceFadeTimer-=dt;
      if(this.glanceFadeTimer<=0)this.glanceOffset*=0.5;
    }
    this.facingSmooth=lerpAngle(this.facingSmooth,this.facingTarget+this.glanceOffset,1-Math.exp(-3*dt));
    this.facing=this.facingSmooth;
  }

  // ════════════════════════════════════════════════════════════════════
  //  SKILL HELPERS  (urgency-based, LMS-aware, dynamic durations)
  // ════════════════════════════════════════════════════════════════════
  skillUrgency(){
    const tier=SURVIVOR_STATE_TIER[this.state]??0;
    const maxTier=5;
    const tierFactor=tier/maxTier;
    const kd=dist(this,killer);
    const DIST_FAR=400,DIST_NEAR=60;
    const distFactor=Math.max(0,Math.min(1,1-(kd-DIST_NEAR)/(DIST_FAR-DIST_NEAR)));
    let urgency=Math.min(1,tierFactor*0.65+distFactor*0.35);
    if(hasStatus(this,'resistance'))urgency*=0.55;
    if(hasStatus(this,'weakness'))  urgency=Math.min(1,urgency*1.6);
    if(hasStatus(this,'speed_ii'))  urgency*=0.75;
    urgency+=this._aiMem.urgencyBias||0;
    return Math.max(0,Math.min(1,urgency));
  }

  skillRoll(baseChance,urgentChance,dt){
    const u=this.skillUrgency();
    const chance=baseChance+(urgentChance-baseChance)*u;
    return Math.random()<chance*dt;
  }

  skillRange(baseRange,urgentRange){
    const u=this.skillUrgency();
    return baseRange+(urgentRange-baseRange)*u;
  }

  // LMS scale — precision-safe (no Math.ceil rounding bugs on small fractions)
  lmsScale(value,isBuff=true){
    if(!this.lmsActive)return value;
    if(isBuff){
      // Multiply by exactly 3, then floor to avoid floating-point excess
      return Math.floor(value*300)/100;
    } else {
      // Divide by 3, ceil only for integer statuses
      return Number((value/3).toFixed(3));
    }
  }

  // Dynamic stun duration: scales with urgency and LMS
  dynStun(baseStun){
    if(this.lmsActive)return this.lmsScale(baseStun);
    const u=this.skillUrgency();
    return baseStun*(1+u*0.3); // up to +30% at max urgency
  }

  // Dynamic slow duration
  dynSlow(baseDur,baseAmount){
    if(this.lmsActive)return{dur:this.lmsScale(baseDur),amount:Math.min(0.95,baseAmount*1.5)};
    const u=this.skillUrgency();
    return{dur:baseDur*(1+u*0.2),amount:baseAmount};
  }

  // ── AI role ──────────────────────────────────────────────────────────
  get aiRole(){
    if(this.kit==='brawler'||this.kit==='assault')return 'offensive';
    if(this.kit==='recon'||this.kit==='commander'||this.kit==='escapee')return 'support-offensive';
    return 'support-defensive';
  }

  // ── Mine avoidance helper ─────────────────────────────────────────────
  _applyMineAvoidance(dx,dy){
    for(const m of mines){
      if(!m.alive)continue;
      const vis=m.revealed||(this.kit==='trapmaker'&&!m.improvised);
      if(!vis)continue;
      const md=dist(this,m);
      const avoidR=m.r+130;
      if(md<avoidR){
        const push=Math.atan2(this.y-m.y,this.x-m.x);
        const str=Math.max(0,1-(md/avoidR))*22;
        dx+=Math.cos(push)*str;dy+=Math.sin(push)*str;
      }
    }
    return{dx,dy};
  }

  // ── Offensive beacon (for aggressive kits) ───────────────────────────
  _computeOffensiveBeacon(){
    let best=null,bestD=Infinity;
    const step=2;
    for(let cy=1;cy<ROWS_C-1;cy+=step) for(let cx=1;cx<COLS_C-1;cx+=step){
      if(!mapGrid[cy][cx]||getTileSafety(cx,cy)<9)continue;
      const px=cx*CELL+CELL/2,py=cy*CELL+CELL/2;
      const d=Math.hypot(px-killer.x,py-killer.y);
      if(d<bestD){bestD=d;best={x:px,y:py};}
    }
    return best;
  }

  // ── Jitter patrol target slightly ────────────────────────────────────
  _jitterTarget(pos){
    if(!pos)return pos;
    const offsets=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
    const shuffle=offsets.sort(()=>Math.random()-0.5);
    for(const [dx,dy] of shuffle){
      if(dx===0&&dy===0)continue;
      const jx=pos.x+(dx*(CELL*(0.35+Math.random()*0.55)));
      const jy=pos.y+(dy*(CELL*(0.35+Math.random()*0.55)));
      const cx=Math.floor(jx/CELL),cy=Math.floor(jy/CELL);
      if(cx>=1&&cy>=1&&cx<COLS_C-1&&cy<ROWS_C-1&&mapGrid[cy][cx]){
        let _openN=0;
        if(mapGrid[cy-1]?.[cx])_openN++;
        if(mapGrid[cy+1]?.[cx])_openN++;
        if(mapGrid[cy]?.[cx-1])_openN++;
        if(mapGrid[cy]?.[cx+1])_openN++;
        if(_openN>=2)return{x:jx,y:jy};
      }
    }
    const fallbacks=[];
    for(let cy=1;cy<ROWS_C-1;cy+=2) for(let cx=1;cx<COLS_C-1;cx+=2){
      if(!mapGrid[cy][cx])continue;
      const px=cx*CELL+CELL/2,py=cy*CELL+CELL/2;
      if(Math.hypot(px-pos.x,py-pos.y)>CELL*1.5)fallbacks.push({x:px,y:py});
    }
    if(fallbacks.length)return fallbacks[Math.floor(Math.random()*fallbacks.length)];
    return pos;
  }

  // ── Circumference patrol target ───────────────────────────────────────
  _selectCircumferenceTarget(center,R,preferHighSafety){
    const ccx=Math.floor(center.x/CELL),ccy=Math.floor(center.y/CELL);
    const candidates=[];
    for(let dy=-(R+3);dy<=R+3;dy++) for(let dx=-(R+3);dx<=R+3;dx++){
      const nx=ccx+dx,ny=ccy+dy;
      if(nx<1||ny<1||nx>=COLS_C-1||ny>=ROWS_C-1||!mapGrid[ny][nx])continue;
      const d=Math.sqrt(dx*dx+dy*dy);
      if(d<R-2||d>R+2)continue;
      const safety=getTileSafety(nx,ny);
      candidates.push({x:nx*CELL+CELL/2,y:ny*CELL+CELL/2,safety});
    }
    if(!candidates.length)return null;
    let totalW=0;
    for(const c of candidates){
      c.w=preferHighSafety?Math.pow(c.safety+1,2):Math.pow(10-c.safety+1,2);
      totalW+=c.w;
    }
    let r=Math.random()*totalW;
    for(const c of candidates){r-=c.w;if(r<=0)return c;}
    return candidates[candidates.length-1];
  }

  // ── Role-aware patrol target ──────────────────────────────────────────
  _computeRolePatrolTarget(){
    const role=this.lmsActive?'support-defensive':this.aiRole;

    if(role==='offensive'&&killer){
      const beacon=this._computeOffensiveBeacon();
      if(beacon&&Math.hypot(beacon.x-killer.x,beacon.y-killer.y)>CELL*4&&dist(this,killer)>CELL*3){
        const t=this._selectCircumferenceTarget(beacon,5,true);
        if(t)return t;
      }
    }

    if(role==='support-offensive'&&killer){
      const hasReadySkill=this.skill1CD<=0||this.skill2CD<=0;
      const alive=survivors.filter(s=>s.alive).length;
      const fewSurvivors=alive<=5;
      if(hasReadySkill&&!fewSurvivors&&dist(this,killer)>CELL*6){
        const t=this._selectCircumferenceTarget({x:killer.x,y:killer.y},7,true);
        if(t)return t;
      }
    }

    // Team spread: move toward survivors who are alone
    const aliveOthers=survivors.filter(s=>s!==this&&s.alive);
    if(aliveOthers.length>0){
      // Find the most isolated teammate
      const isolated=aliveOthers.reduce((a,b)=>{
        const dA=aliveOthers.filter(q=>q!==a&&dist(q,a)<CELL*5).length;
        const dB=aliveOthers.filter(q=>q!==b&&dist(q,b)<CELL*5).length;
        return dA<dB?a:b;
      });
      // Move toward them only if far and killer isn't between us
      if(dist(this,isolated)>CELL*6&&killer){
        const kd=dist(this,killer);
        const ka=Math.atan2(killer.y-this.y,killer.x-this.x);
        const ia=Math.atan2(isolated.y-this.y,isolated.x-this.x);
        const angDiff=Math.abs(((ka-ia+Math.PI*3)%(Math.PI*2))-Math.PI);
        if(angDiff>Math.PI*0.45&&kd>CELL*5){
          return{x:isolated.x+rand(-CELL,CELL),y:isolated.y+rand(-CELL,CELL)};
        }
      }
    }

    // Default: random safe position
    let best=null,bestS=-1;
    for(let i=0;i<28;i++){
      const p=randPos(60);
      let s=worldSafety(p.x,p.y);
      if(killer&&killer.alive){
        const _kd=Math.hypot(p.x-killer.x,p.y-killer.y);
        const _kActive=!hasStatus(killer,'stunned')&&!hasStatus(killer,'blinded');
        if(_kActive){
          if(_kd<CELL*5)continue;
          else if(_kd<CELL*7)s=Math.max(0,s-4);
          else if(_kd<CELL*9)s=Math.max(0,s-2);
        } else {
          if(_kd<CELL*3)continue;
        }
      }
      if(s>bestS){bestS=s;best=p;}
    }
    if(!best&&killer){
      let bfd=0;
      for(let cy=1;cy<ROWS_C-1;cy+=3) for(let cx=1;cx<COLS_C-1;cx+=3){
        if(!mapGrid[cy][cx])continue;
        const px=cx*CELL+CELL/2,py=cy*CELL+CELL/2;
        const d=Math.hypot(px-killer.x,py-killer.y);
        if(d>bfd){bfd=d;best={x:px,y:py};}
      }
    }
    return best||randPos(60);
  }

  // ── Stubs (overridden by subclasses) ─────────────────────────────────
  kitUpdate(dt){}

  // ════════════════════════════════════════════════════════════════════
  //  DRAW  (unchanged from original)
  // ════════════════════════════════════════════════════════════════════
  drawBase(){
    if(!this.alive)return;
    const s=this.r*2;
    const spd=Math.hypot(this.velX||0,this.velY||0);
    const tRaw=Math.min(1,spd/(this.baseSpeed*1.6));
    if(this._sqT===undefined)this._sqT=0;
    this._sqT+=(tRaw-this._sqT)*(1-Math.exp(-8*(1/60)));
    const t=this._sqT;
    const stretchX=1+t*0.10;
    const squashY=Math.max(0.92,1-t*0.06);
    const velAngle=(this.velX||this.velY)?Math.atan2(this.velY||0,this.velX||0):(this.facingSmooth||this.facing);
    if(this._sqAngle===undefined)this._sqAngle=velAngle;
    this._sqAngle=lerpAngle(this._sqAngle,velAngle,1-Math.exp(-10*(1/60)));
    ctx.save();
    ctx.translate(this.x,this.y);
    ctx.rotate(this._sqAngle);
    ctx.scale(stretchX,squashY);
    ctx.fillStyle=COLS.gb0;ctx.fillRect(-this.r+2,-this.r+2,s,s);
    ctx.fillStyle=this.color;ctx.fillRect(-this.r,-this.r,s,s);
    const _ef=this.facingSmooth!==undefined?this.facingSmooth:this.facing;
    const localFacing=_ef-velAngle;
    const dpx=Math.round(Math.cos(localFacing)*(this.r-4)-2);
    const dpy=Math.round(Math.sin(localFacing)*(this.r-4)-2);
    ctx.fillStyle=COLS.gb0;ctx.fillRect(dpx,dpy,4,4);
    ctx.restore();
    const bw=s+4,bh=3,bx=Math.round(this.x-this.r-2),by=Math.round(this.y-this.r-6);
    ctx.fillStyle=COLS.gb0;ctx.fillRect(bx,by,bw,bh);
    const pct=Math.max(0,this.hp/this.effectiveMaxHp());
    ctx.fillStyle=pct>0.5?COLS.gb3:pct>0.25?COLS.gb2:COLS.gb1;
    ctx.fillRect(bx,by,Math.round(bw*pct),bh);
  }

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
      ctx.strokeRect(this.x-this.r-10,this.y-this.r-10,this.r*2+20,this.r*2+20);ctx.setLineDash([]);
    }
    {
      const alertAlpha=this.alertLevel>0.3?0.18+this.alertLevel*0.06:0.12;
      const alpha=Math.min(0.28,alertAlpha);
      const _losDir=this.facingSmooth;
      ctx.fillStyle=`rgba(216,138,61,${alpha})`;
      ctx.beginPath();ctx.moveTo(this.x,this.y);
      ctx.arc(this.x,this.y,LOS_RANGE,_losDir-LOS_ANGLE,_losDir+LOS_ANGLE);
      ctx.closePath();ctx.fill();
      ctx.strokeStyle=`rgba(216,138,61,0.35)`;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(this.x,this.y);
      ctx.arc(this.x,this.y,LOS_RANGE,_losDir-LOS_ANGLE,_losDir+LOS_ANGLE);
      ctx.closePath();ctx.stroke();
    }
    if(hasStatus(this,'cloaked')){
      ctx.globalAlpha=0.28;ctx.fillStyle='rgba(0,255,180,0.18)';
      ctx.fillRect(this.x-this.r-2,this.y-this.r-2,this.r*2+4,this.r*2+4);ctx.globalAlpha=1;
      ctx.strokeStyle='rgba(0,220,160,0.55)';ctx.lineWidth=1;ctx.setLineDash([2,3]);
      ctx.strokeRect(this.x-this.r-3,this.y-this.r-3,this.r*2+6,this.r*2+6);ctx.setLineDash([]);
    }
    if(hasStatus(this,'invincibility')){
      const fl=Math.sin(Date.now()/40)>0;
      ctx.fillStyle=fl?'rgba(255,255,255,0.65)':'rgba(200,255,200,0.25)';
      ctx.fillRect(this.x-this.r,this.y-this.r,this.r*2,this.r*2);
      ctx.strokeStyle='#ffffff';ctx.lineWidth=2;
      ctx.strokeRect(this.x-this.r-5,this.y-this.r-5,this.r*2+10,this.r*2+10);
    }
    if(hasStatus(this,'x_ray')){
      ctx.fillStyle='rgba(100,200,255,0.08)';
      ctx.strokeStyle='rgba(100,200,255,0.4)';ctx.lineWidth=1;ctx.setLineDash([4,4]);
      ctx.beginPath();ctx.moveTo(this.x,this.y);
      ctx.arc(this.x,this.y,LOS_RANGE*3,this.facingSmooth-LOS_ANGLE,this.facingSmooth+LOS_ANGLE);
      ctx.closePath();ctx.fill();ctx.stroke();ctx.setLineDash([]);
    }
    if(hasStatus(this,'rocket_boots')){
      const fl=Math.sin(Date.now()/90)>0;
      ctx.strokeStyle=fl?'#ff8800':'#ffcc44';ctx.lineWidth=1;ctx.setLineDash([1,2]);
      ctx.strokeRect(this.x-this.r-4,this.y-this.r-4,this.r*2+8,this.r*2+8);ctx.setLineDash([]);
    }
    const bw=this.r*2+4,bx=this.x-this.r-2,by=this.y+this.r+2;
    ctx.fillStyle=COLS.gb0;ctx.fillRect(bx,by,bw,2);
    const stPct=this.stamina/this.maxStamina;
    ctx.fillStyle=stPct>0.5?COLS.gb3:stPct>0.2?COLS.gb2:COLS.gb1;
    ctx.fillRect(bx,by,Math.round(bw*stPct),2);
    if(hasStatus(this,'stunned'))ctx.fillStyle=COLS.gb3,ctx.fillRect(this.x-4,this.y-this.r-8,8,4);
    if(hasStatus(this,'blinded')){
      ctx.fillStyle='rgba(216,138,61,0.18)';ctx.fillRect(this.x-this.r-2,this.y-this.r-2,this.r*2+4,this.r*2+4);
      ctx.fillStyle=this.color;ctx.fillRect(this.x-this.r,this.y-this.r,this.r*2,this.r*2);
    }
    if(hasStatus(this,'fatigued')){
      ctx.strokeStyle=COLS.gb1;ctx.lineWidth=1;ctx.setLineDash([2,2]);
      ctx.strokeRect(this.x-this.r-3,this.y-this.r-3,this.r*2+6,this.r*2+6);ctx.setLineDash([]);
    }
    if(hasStatus(this,'cd_boost')){
      ctx.strokeStyle=COLS.gb3;ctx.lineWidth=1;
      ctx.strokeRect(this.x-this.r-3,this.y-this.r-3,this.r*2+6,this.r*2+6);
    }
    if(hasStatus(this,'parry')){
      const fl=Math.sin(Date.now()/55)>0;
      ctx.fillStyle=fl?'rgba(255,255,255,0.75)':'rgba(255,255,255,0.15)';
      ctx.fillRect(this.x-this.r,this.y-this.r,this.r*2,this.r*2);
      ctx.strokeStyle='#ffffff';ctx.lineWidth=2;
      ctx.strokeRect(this.x-this.r-4,this.y-this.r-4,this.r*2+8,this.r*2+8);
    }
    if(this.lastSurvivorBoost){
      const fl=Math.sin(Date.now()/200)>0;
      ctx.strokeStyle=fl?COLS.gb3:COLS.gb2;ctx.lineWidth=1;ctx.setLineDash([3,2]);
      ctx.strokeRect(this.x-this.r-5,this.y-this.r-5,this.r*2+10,this.r*2+10);ctx.setLineDash([]);
    }
    if(this.emergencyFleeTimer>0){
      const fl2=Math.sin(Date.now()/120)>0;
      ctx.strokeStyle=fl2?COLS.gb3:COLS.gb0;ctx.lineWidth=2;ctx.setLineDash([2,2]);
      ctx.strokeRect(this.x-this.r-6,this.y-this.r-6,this.r*2+12,this.r*2+12);ctx.setLineDash([]);
    }
    if(this.alertLevel>1.5){
      ctx.fillStyle=COLS.gb3;ctx.font='9px VCROSD,monospace';ctx.textAlign='center';
      ctx.fillText('!',this.x,this.y-this.r-9);ctx.textAlign='left';
    } else if(this.state==='high-alert'){
      ctx.fillStyle=COLS.gb2;ctx.font='9px VCROSD,monospace';ctx.textAlign='center';
      ctx.fillText('!!',this.x,this.y-this.r-9);ctx.textAlign='left';
    } else if(this.alertLevel>0.5){
      ctx.fillStyle=COLS.gb1;ctx.font='9px VCROSD,monospace';ctx.textAlign='center';
      ctx.fillText('?',this.x,this.y-this.r-9);ctx.textAlign='left';
    }
    ctx.fillStyle=COLS.gb0;ctx.font='bold 8px VCROSD,monospace';ctx.textAlign='center';
    ctx.fillText(this.kit[0].toUpperCase(),this.x,this.y+3);ctx.textAlign='left';
    ctx.fillStyle=this.color;ctx.font='7px VCROSD,monospace';ctx.textAlign='center';
    ctx.fillText(this.name,this.x,this.y+this.r+10);ctx.textAlign='left';
  }
}