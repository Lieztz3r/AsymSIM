class Golfer extends Survivor {
  constructor(x,y,name){
    super(x,y,name,COLS.gb3,'golfer');
    this.baseSpeed=84;
    this.skill1CD=0;
    this.skill2CD=0;
    this.skill3CD=0;
    this.flags=[];
    this.maxFlags=5;
    this.swingSlowTimer=0;
    this.aimingTimer=0;
    this.bounceGuide=[];
    this.golfBall=null;
    this._spawnBall();
  }
  _spawnBall(){
    const p=randOpenNear(this.x,this.y,CELL,CELL*2)||{x:this.x+CELL,y:this.y};
    this.golfBall={x:p.x,y:p.y,vx:0,vy:0,r:7,alive:true,trail:[],id:Math.random()};
  }
  _computeBounceGuide(fromX,fromY,toX,toY,bounces=4){
    const guide=[];
    let x=fromX,y=fromY;
    const speed=440;
    let a=Math.atan2(toY-fromY,toX-fromX);
    let vx=Math.cos(a)*speed,vy=Math.sin(a)*speed;
    guide.push({x,y});
    for(let b=0;b<bounces;b++){
      for(let step=0;step<500;step++){
        const nx=x+vx*0.016,ny=y+vy*0.016;
        const cx=Math.floor(nx/CELL),cy=Math.floor(ny/CELL);
        if(cx<0||cy<0||cx>=COLS_C||cy>=ROWS_C||!mapGrid[cy][cx]){
          const prevCX=Math.floor(x/CELL),prevCY=Math.floor(y/CELL);
          if(mapGrid[prevCY]?.[cx]) vy=-vy;
          else if(mapGrid[cy]?.[prevCX]) vx=-vx;
          else{vx=-vx;vy=-vy;}
          guide.push({x,y});
          break;
        }
        x=nx;y=ny;
      }
    }
    guide.push({x,y});
    return guide;
  }
  kitUpdate(dt){
    if(!this.alive){ if(this.golfBall) this.golfBall.alive=false; return; }
    if(this.skill1CD>0) this.skill1CD=Math.max(0,this.skill1CD-dt/this.cdMult());
    if(this.skill2CD>0) this.skill2CD=Math.max(0,this.skill2CD-dt/this.cdMult());
    if(this.skill3CD>0) this.skill3CD=Math.max(0,this.skill3CD-dt/this.cdMult());
    if(this.swingSlowTimer>0){this.swingSlowTimer-=dt;if(this.swingSlowTimer<=0)clearStatus(this,'slowed');}
    if(!this.golfBall||!this.golfBall.alive) this._spawnBall();
    const gb=this.golfBall;
    gb.trail.push({x:gb.x,y:gb.y,t:1.0});
    for(let i=gb.trail.length-1;i>=0;i--){gb.trail[i].t-=dt*4;if(gb.trail[i].t<=0)gb.trail.splice(i,1);}
    if(!hasStatus(this,'grabbed') && (gb.vx||gb.vy)){
      // Sub-step ball movement to prevent tunneling through walls
      const BALL_STEPS=4;
      const subDt=dt/BALL_STEPS;
      for(let _bs=0;_bs<BALL_STEPS;_bs++){
        const prevX=gb.x, prevY=gb.y;
        gb.x+=gb.vx*subDt; gb.y+=gb.vy*subDt;
        gb.x=Math.max(gb.r,Math.min(W-gb.r,gb.x));
        gb.y=Math.max(gb.r,Math.min(H-gb.r,gb.y));
        const gcx=Math.floor(gb.x/CELL),gcy=Math.floor(gb.y/CELL);
        const inWall=gcx<0||gcy<0||gcx>=COLS_C||gcy>=ROWS_C||!mapGrid[gcy]?.[gcx];
        if(inWall){
          const prevCX=Math.floor(prevX/CELL),prevCY=Math.floor(prevY/CELL);
          const xOpen=mapGrid[prevCY]?.[gcx];
          const yOpen=mapGrid[gcy]?.[prevCX];
          if(xOpen&&!yOpen){ gb.vy=-gb.vy*0.72; gb.y=prevY; }
          else if(yOpen&&!xOpen){ gb.vx=-gb.vx*0.72; gb.x=prevX; }
          else { gb.vx=-gb.vx*0.72; gb.vy=-gb.vy*0.72; gb.x=prevX; gb.y=prevY; }
          // Push ball to nearest open cell center to prevent embedding
          const ncx=Math.floor(gb.x/CELL),ncy=Math.floor(gb.y/CELL);
          if(!mapGrid[ncy]?.[ncx]){
            // Wider spiral search so ball never gets permanently stuck in a wall
            let found=false;
            outer: for(let sr=1;sr<8;sr++){
              for(const [ddx,ddy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
                const nx2=ncx+ddx*sr,ny2=ncy+ddy*sr;
                if(nx2>=0&&ny2>=0&&nx2<COLS_C&&ny2<ROWS_C&&mapGrid[ny2][nx2]){
                  gb.x=nx2*CELL+CELL/2; gb.y=ny2*CELL+CELL/2;
                  found=true; break outer;
                }
              }
            }
            // Give ball a small random nudge so it doesn't freeze if push-out succeeded
            if(found){
              gb.vx=(Math.random()-0.5)*60;
              gb.vy=(Math.random()-0.5)*60;
            } else {
              gb.vx=0; gb.vy=0;
            }
          }
        }
      }
      gb.vx*=Math.exp(-0.55*dt);gb.vy*=Math.exp(-0.55*dt);
      const _gbSpd=Math.hypot(gb.vx,gb.vy);
      if(_gbSpd>0&&_gbSpd<6){gb.vx=0;gb.vy=0;}
      if(dist(gb,killer)<killer.r+gb.r&&killer.alive){
        const _stunDur=this.lmsActive?6:2;
        stunKiller(this,_stunDur);
        applyStatus(killer,'slowed',_stunDur,{amount:this.lmsActive?0.9:0.4});
        addLog(`${this.name} golf ball hit killer! ${_stunDur}s stun!`,'stun');
        gb.vx=0;gb.vy=0;
      }
    }
    const u=this.skillUrgency();
    const ballDist=dist(this,gb);
    if(this.skill1CD<=0&&ballDist<CELL*1.5&&killer.alive){
      this.aimingTimer+=dt;
      this.bounceGuide=this._computeBounceGuide(gb.x,gb.y,killer.x,killer.y,4);
      if(this.aimingTimer>=1.5||(u>0.7&&this.aimingTimer>=0.5)) this.swing();
    } else {
      this.aimingTimer=0;
      if(ballDist>CELL*3&&(this.state==='patrol'||this.state==='high-alert')){
        const fd=getFlowDir(this.x,this.y,gb.x,gb.y);
        const flen=Math.hypot(fd.dx,fd.dy)||1;
        this.smoothMove(fd.dx/flen,fd.dy/flen,this.effectiveSpeed(false)*0.8,dt);
      }
    }
    if(this.skill2CD<=0){
      const nearMine=mines.find(m=>m.alive&&!m.improvised&&dist(this,m)<CELL*2);
      if(nearMine&&!this.flags.some(f=>f.alive&&f.cx===Math.floor(nearMine.x/CELL)&&f.cy===Math.floor(nearMine.y/CELL))){
        this.placeFlag();
      }
    }
    if(this.lmsActive&&this.skill3CD<=0&&dist(this,gb)>CELL*2&&!hasStatus(this,'reloading')){
      this.recallBall();
    }
    if(this._recallTimer>0){
      this._recallTimer-=dt;
      const elapsed=this._recallMaxTime-(this._recallTimer);
      const frac=Math.min(1,elapsed/this._recallMaxTime);
      if(this._recallStart){
        gb.x=this._recallStart.x+(this.x-this._recallStart.x)*frac;
        gb.y=this._recallStart.y+(this.y-this._recallStart.y)*frac;
      }
      if(this._recallTimer<=0){gb.x=this.x;gb.y=this.y;this._recallTimer=0;}
    }
    for(const f of this.flags){
      if(!f.alive) continue;
      const conflictMine=mines.find(m=>m.alive&&!m.improvised&&Math.floor(m.x/CELL)===f.cx&&Math.floor(m.y/CELL)===f.cy);
      if(conflictMine){
        conflictMine.alive=false;
        if(killer.myMines){const ki=killer.myMines.indexOf(conflictMine);if(ki>=0)killer.myMines.splice(ki,1);}
        addLog(`${this.name} flag destroyed a mine!`,'skill');
      }
    }
  }
  swing(){
    const gb=this.golfBall;
    if(!gb) return;
    const a=Math.atan2(killer.y-gb.y,killer.x-gb.x);
    const speed=this.lmsActive?3150:1050;
    gb.vx=Math.cos(a)*speed;gb.vy=Math.sin(a)*speed;
    this.skill1CD=10*this.cdMult();
    const _swSlowAmt=this.lmsActive?0.10:0.30;
    const _swSlowDur=this.lmsActive?1:2;
    applyStatus(this,'slowed',_swSlowDur,{amount:_swSlowAmt});
    this.swingSlowTimer=_swSlowDur;
    addLog(`${this.name} swings! (4-bounce guide)`, 'skill');
  }
  placeFlag(){
    const cx=Math.floor(this.x/CELL),cy=Math.floor(this.y/CELL);
    if(!mapGrid[cy]?.[cx]) return;
    if(mines.some(m=>m.alive&&Math.floor(m.x/CELL)===cx&&Math.floor(m.y/CELL)===cy)) return;
    const tx=cx*CELL+CELL/2,ty=cy*CELL+CELL/2;
    const _maxF=this.lmsActive?15:this.maxFlags;
    if(this.flags.length>=_maxF) this.flags.shift();
    this.flags.push({x:tx,y:ty,cx,cy,alive:true,id:Math.random()});
    this.skill2CD=15*this.cdMult();
    addLog(`${this.name} placed a flag!`,'skill');
  }
  recallBall(){
    const gb=this.golfBall;if(!gb) return;
    const d=dist(this,gb);
    this._recallMaxTime=d/(this.lmsActive?1140:380);
    this._recallTimer=this._recallMaxTime;
    this._recallStart={x:gb.x,y:gb.y};
    gb.vx=0;gb.vy=0;
    const _recallDur=this.lmsActive?this._recallMaxTime/3:this._recallMaxTime;
    applyStatus(this,'reloading',_recallDur,{_recall:true});
    this.skill3CD=20*this.cdMult();
    addLog(`${this.name} recalling golf ball!`,'skill');
  }
  draw(){
    super.draw();
    for(const f of this.flags){
      if(!f.alive) continue;
      ctx.fillStyle='rgba(216,138,61,0.12)';
      ctx.fillRect(f.x-CELL/2,f.y-CELL/2,CELL,CELL);
      ctx.strokeStyle=COLS.gb3;ctx.lineWidth=1;ctx.setLineDash([2,3]);
      ctx.strokeRect(f.x-CELL/2,f.y-CELL/2,CELL,CELL);ctx.setLineDash([]);
      ctx.fillStyle=COLS.gb3;ctx.font='11px VCROSD,monospace';ctx.textAlign='center';
      ctx.fillText('P',f.x,f.y+4);ctx.textAlign='left';
    }
    if(this.aimingTimer>0.2&&this.bounceGuide.length>1){
      ctx.strokeStyle='rgba(216,138,61,0.60)';ctx.lineWidth=1;ctx.setLineDash([4,4]);
      ctx.beginPath();ctx.moveTo(this.bounceGuide[0].x,this.bounceGuide[0].y);
      for(let i=1;i<this.bounceGuide.length;i++) ctx.lineTo(this.bounceGuide[i].x,this.bounceGuide[i].y);
      ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=1;
    }
    const gb=this.golfBall;
    if(!gb||!gb.alive||!this.alive) return;
    const spd=Math.hypot(gb.vx,gb.vy);
    const a=spd>15?Math.atan2(gb.vy,gb.vx):0;
    const strT=Math.min(1,spd/420);
    const sx=1+strT*1.5;
    const sy=Math.max(0.45,1-strT*0.52);
    for(const tr of gb.trail){
      ctx.globalAlpha=tr.t*0.30;
      ctx.fillStyle=COLS.gb3;
      ctx.beginPath();ctx.arc(tr.x,tr.y,gb.r*0.5,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
    if(spd>300){
      for(let i=1;i<=3;i++){
        ctx.globalAlpha=0.12/i;
        ctx.fillStyle=COLS.gb3;
        ctx.save();ctx.translate(gb.x-Math.cos(a)*gb.r*3.5*i,gb.y-Math.sin(a)*gb.r*3.5*i);
        ctx.rotate(a);ctx.scale(sx*0.7,sy*0.7);
        ctx.beginPath();ctx.arc(0,0,gb.r,0,Math.PI*2);ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha=1;
    }
    if(spd>60){
      ctx.strokeStyle=`rgba(216,138,61,${Math.min(0.6,spd/500)})`;ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(gb.x,gb.y);
      ctx.lineTo(gb.x-Math.cos(a)*gb.r*5,gb.y-Math.sin(a)*gb.r*5);ctx.stroke();ctx.lineWidth=1;
    }
    ctx.save();ctx.translate(gb.x,gb.y);ctx.rotate(a);ctx.scale(sx,sy);
    ctx.fillStyle=COLS.gb0;ctx.beginPath();ctx.arc(1,1,gb.r,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#f0f0f0';ctx.beginPath();ctx.arc(0,0,gb.r,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.18)';ctx.beginPath();ctx.arc(-gb.r*0.25,-gb.r*0.22,gb.r*0.32,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
}