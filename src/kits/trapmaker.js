class Trapmaker extends Survivor {
  constructor(x,y,name){
    super(x,y,name,COLS.gb1,'trapmaker');
    this.baseSpeed=82;
    this.destroyCD=0;
    this.destroyTarget=null;
    this.trapCD=0;
    this.improvisedMines=[];
    this.maxImprovisedMines=3;
  }
  kitUpdate(dt){
    
    for(const m of mines){
      if(m.alive&&!m.improvised) this.lastSeenRevealedMine={x:m.x,y:m.y};
    }
    
    if(this.destroyCD<=0&&!hasStatus(this,'reloading')){
      const revealedMines=mines.filter(m=>m.alive&&!m.improvised);
      if(revealedMines.length){
        const nearest=revealedMines.reduce((a,b)=>dist(this,a)<dist(this,b)?a:b);
        const d=dist(this,nearest);
        if(d<CELL*1.5){
          
          this.destroyTarget=nearest;
          const _destroyDur=this.lmsActive?Math.max(0.5,6/3):6;
          applyStatus(this,'reloading',_destroyDur,{_destroyMine:true});
          this.destroyCD=(this.lmsActive?25:50)*this.cdMult();
          if(hasStatus(this,'ammo_pack')) this._consumeAmmoPack();
          addLog(`${this.name} defusing mine...`,'skill');
        }
      }
    }

    
    if(this.destroyTarget&&!hasStatus(this,'reloading')){
      if(this.destroyTarget.alive){
        this.destroyTarget.alive=false;
        const idx=mines.indexOf(this.destroyTarget);
        if(idx>=0) mines.splice(idx,1);
        if(killer.myMines){const ki=killer.myMines.indexOf(this.destroyTarget);if(ki>=0)killer.myMines.splice(ki,1);}
        addLog(`${this.name} destroyed a mine!`,'skill');
      }
      this.destroyTarget=null;
    }

    if(this.trapCD<=0&&this.improvisedMines.length<this.maxImprovisedMines&&!hasStatus(this,'reloading')){
      const kd=dist(this,killer);
      const u=this.skillUrgency();
      const shouldTrap=kd<this.skillRange(300,450)&&(u>0.4||this.currentlyChased);
      if(shouldTrap) this.placeTrap();
    }
  }
  placeTrap(){
    const _trapReloadDur=this.lmsActive?Math.max(0.3,4/3):4;
    applyStatus(this,'reloading',_trapReloadDur,{_placeTrap:true});
    this.trapCD=(this.lmsActive?17:35)*this.cdMult();
    if(hasStatus(this,'ammo_pack')) this._consumeAmmoPack();
    
    const tiles9=[];
    const step=2;
    for(let cy=1;cy<ROWS_C-1;cy+=step) for(let cx=1;cx<COLS_C-1;cx+=step){
      if(!mapGrid[cy][cx]||getTileSafety(cx,cy)!==9) continue;
      const px=cx*CELL+CELL/2,py=cy*CELL+CELL/2;
      tiles9.push({x:px,y:py,d:Math.hypot(px-killer.x,py-killer.y)});
    }
    let trapPos={x:this.x,y:this.y};
    if(tiles9.length>=2){
      tiles9.sort((a,b)=>a.d-b.d);
      const near9=tiles9[0],far9=tiles9[tiles9.length-1];
      const mx=(near9.x+far9.x)/2,my=(near9.y+far9.y)/2;
      let best=null,bestD=Infinity;
      for(let cy2=1;cy2<ROWS_C-1;cy2+=step) for(let cx2=1;cx2<COLS_C-1;cx2+=step){
        if(!mapGrid[cy2][cx2]) continue;
        const px2=cx2*CELL+CELL/2,py2=cy2*CELL+CELL/2;
        const d=Math.hypot(px2-mx,py2-my);
        if(d<bestD){bestD=d;best={x:px2,y:py2};}
      }
      if(best) trapPos=best;
    }
    this._pendingTrap=trapPos;
    addLog(`${this.name} placing improvised trap...`,'skill');
  }
  update(dt){
    
    if(this.destroyCD>0) this.destroyCD=Math.max(0,this.destroyCD-dt/this.cdMult());
    if(this.trapCD>0)    this.trapCD=Math.max(0,this.trapCD-dt/this.cdMult());
    super.update(dt);
    
    if(this._pendingTrap&&!hasStatus(this,'reloading')){
      const _urgMult=1+this.skillUrgency()*0.25;
      const trap={
        x:this._pendingTrap.x,y:this._pendingTrap.y,
        r:CELL/2,alive:true,
        improvised:true,
        stunT:this.lmsScale(this.dynStun(6)),
        blindT:this.lmsScale(this.dynStun(5)),
        slowAmt:Math.min(0.98,0.95*_urgMult),
        slowDur:this.lmsScale(this.lmsActive?12:5),
      };
      this.improvisedMines.push(trap);
      mines.push(trap);
      this._pendingTrap=null;
      addLog(`${this.name} improvised trap placed!`,'skill');
    }
  }
}