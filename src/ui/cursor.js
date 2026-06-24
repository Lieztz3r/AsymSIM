/* ════════════════════════════════════════════
   DEBRIS PARTICLE SYSTEM
   Wall-hit splatter scaled by impact velocity.
   Expects: <canvas id="debris-canvas">
   ════════════════════════════════════════════ */
(function() {
  const canvas = document.getElementById('debris-canvas');
  const ctx    = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const GB   = ['#f3d27a','#d98a3d','#b06a30','#6e2a2a','#4a1e1e','#14100c'];
  const DUST = ['#3a2a1c','#4a3624','#241810','#5a4230'];

  function pickColor(x, y) {
    if (Math.random() < 0.28) return DUST[Math.floor(Math.random() * DUST.length)];
    const t   = Math.max(0, Math.min(1, y / canvas.height));
    const idx = Math.floor(t * (GB.length - 1));
    return GB[Math.min(idx + Math.floor(Math.random() * 2), GB.length - 1)];
  }

  class Particle {
    constructor(x, y, wall, norm) {
      this.x = x; this.y = y;
      const base   = { left: 0, right: Math.PI, top: Math.PI/2, bottom: -Math.PI/2 }[wall];
      const spread = (Math.random() - 0.5) * Math.PI * 0.9;
      const spd    = (1.2 + norm * 6.5) * (0.5 + Math.random() * 0.8);
      this.vx = Math.cos(base + spread) * spd;
      this.vy = Math.sin(base + spread) * spd;
      this.gravity  = 0.08 + norm * 0.10 + Math.random() * 0.08;
      this.friction = 0.97;
      this.life  = 1.0;
      this.decay = 0.013 + Math.random() * 0.018;
      this.color = pickColor(x, y);
      this.rot   = Math.random() * Math.PI * 2;
      this.rotV  = (Math.random() - 0.5) * 0.18;

      const r = Math.random();
      if (r < 0.55) {
        this.type = 'chunk';
        this.size = 4 + Math.random() * 9;
        const n   = 4 + Math.floor(Math.random() * 3);
        this.pts  = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
          const d = this.size * (0.55 + Math.random() * 0.45);
          this.pts.push([Math.cos(a) * d, Math.sin(a) * d]);
        }
      } else if (r < 0.82) {
        this.type  = 'pebble';
        this.size  = 1.5 + Math.random() * 4;
        this.decay += 0.008;
      } else {
        this.type    = 'dust';
        this.size    = 0.8 + Math.random() * 2;
        this.decay  += 0.02;
        this.gravity = 0.04;
        const ds = spd * (1.4 + norm * 0.8);
        this.vx = Math.cos(base + spread) * ds;
        this.vy = Math.sin(base + spread) * ds;
      }
    }

    update() {
      this.x  += this.vx; this.y += this.vy;
      this.vy += this.gravity; this.vx *= this.friction;
      this.rot += this.rotV;  this.life -= this.decay;
      return this.life > 0;
    }

    draw() {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.life);
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.fillStyle = this.color;
      if (this.type === 'chunk') {
        ctx.beginPath();
        this.pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  class Crack {
    constructor(x, y, wall, norm) {
      this.x = x; this.y = y;
      this.life  = 1.0;
      this.decay = Math.max(0.001, 0.006 - norm * 0.005);
      this.lw    = 0.5 + norm * 1.2;
      this.arms  = [];
      const base  = { left: 0, right: Math.PI, top: Math.PI/2, bottom: -Math.PI/2 }[wall];
      const count = Math.round(2 + norm * 8);
      for (let i = 0; i < count; i++) {
        const a    = base + (Math.random() - 0.5) * Math.PI * 0.75;
        const len  = (8 + norm * 58) * (0.6 + Math.random() * 0.7);
        const segs = 2 + Math.floor(Math.random() * 4);
        const pts  = [[0, 0]];
        let cx = 0, cy = 0;
        for (let s = 0; s < segs; s++) {
          const da = (Math.random() - 0.5) * 0.6;
          cx += Math.cos(a + da) * (len / segs);
          cy += Math.sin(a + da) * (len / segs);
          pts.push([cx, cy]);
        }
        this.arms.push(pts);
      }
    }
    update() { this.life -= this.decay; return this.life > 0; }
    draw() {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.life) * 0.75;
      ctx.strokeStyle = '#6e2a2a';
      ctx.lineWidth   = this.lw;
      ctx.translate(this.x, this.y);
      this.arms.forEach(pts => {
        ctx.beginPath();
        pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
        ctx.stroke();
      });
      ctx.restore();
    }
  }

  class Flash {
    constructor(x, y, norm) {
      this.x = x; this.y = y;
      this.life  = 1.0;
      this.decay = 0.10;
      this.r     = 4 + norm * 22 + Math.random() * 6;
    }
    update() { this.life -= this.decay; return this.life > 0; }
    draw() {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.life) * 0.55;
      ctx.fillStyle   = '#f3d27a';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * (2 - this.life), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  const particles = [], cracks = [], flashes = [];
  const WALL_THRESH = 14;
  let activeWall = null;
  let prevX = -999, prevY = -999, prevT = performance.now(), impactNorm = 0;

  function trackVelocity(x, y) {
    const now = performance.now();
    const dt  = Math.max(now - prevT, 1);
    impactNorm = Math.min(Math.sqrt((x-prevX)**2 + (y-prevY)**2) / dt / 5, 1);
    prevX = x; prevY = y; prevT = now;
  }

  function getWall(x, y) {
    const W = canvas.width, H = canvas.height;
    if (x < WALL_THRESH)     return 'left';
    if (x > W - WALL_THRESH) return 'right';
    if (y < WALL_THRESH)     return 'top';
    if (y > H - WALL_THRESH) return 'bottom';
    return null;
  }

  function spawnBurst(x, y, wall, norm) {
    flashes.push(new Flash(x, y, norm));
    cracks.push(new Crack(x, y, wall, norm));
    const n = Math.round(3 + norm * 32);
    for (let i = 0; i < n; i++) particles.push(new Particle(x, y, wall, norm));
  }

  document.addEventListener('mousemove', e => {
    const x = e.clientX, y = e.clientY;
    trackVelocity(x, y);
    const wall = getWall(x, y);
    if (wall && wall !== activeWall) spawnBurst(x, y, wall, impactNorm);
    activeWall = wall;
  }, { passive: true });

  (function loop() {
    requestAnimationFrame(loop);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    [flashes, cracks, particles].forEach(arr => {
      for (let i = arr.length - 1; i >= 0; i--) {
        arr[i].draw();
        if (!arr[i].update()) arr.splice(i, 1);
      }
    });
  })();
})();


/* ════════════════════════════════════════════
   GHOST CURSOR TRAIL
   Hidden ghosts always lerp in JS (no DOM
   writes) so they appear without snapping.
   Expects: <div id="cursor-layer">
   ════════════════════════════════════════════ */
(function() {
  const layer = document.getElementById('cursor-layer');
  const COLOR = '#f3d27a', DARK = '#14100c', MAX = 7;

  const pool = Array.from({ length: MAX }, () => {
    const el = document.createElement('div');
    el.className = 'ghost';
    el.innerHTML = `<svg width="13" height="20" viewBox="0 0 13 20" xmlns="http://www.w3.org/2000/svg">
      <polygon points="0,0 0,16 3.5,12.5 6,19 8,18.2 5.5,12 10,12"
        fill="${COLOR}" stroke="${DARK}" stroke-width="0.7" fill-opacity="1" stroke-opacity="0.45"/>
    </svg>`;
    layer.appendChild(el);
    return { el, x: -300, y: -300, fadeOpacity: 0 };
  });

  const HIST = 18;
  const hx = new Float32Array(HIST), hy = new Float32Array(HIST);
  let head = 0, mx = -300, my = -300, speed = 0, angle = 0;
  let prevMx = -300, prevMy = -300, lastT = performance.now();

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    const now = performance.now(), dt = Math.max(now - lastT, 1);
    const vx = (mx - prevMx) / dt, vy = (my - prevMy) / dt;
    speed = Math.sqrt(vx*vx + vy*vy);
    if (speed > 0.04) angle = Math.atan2(vy, vx);
    prevMx = mx; prevMy = my; lastT = now;
  }, { passive: true });

  function countFromSpeed(s) {
    if (s < 0.25) return 1;
    if (s < 0.70) return 2;
    if (s < 1.30) return 4;
    return MAX;
  }

  (function tick() {
    requestAnimationFrame(tick);
    hx[head] = mx; hy[head] = my;
    head = (head + 1) % HIST;

    const count   = countFromSpeed(speed);
    const stretch = Math.min(1 + speed * 0.50, 1.95);
    const squash  = Math.max(1 - speed * 0.20, 0.58);
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const m00 = ca*ca*stretch + sa*sa*squash;
    const m01 = ca*sa*(stretch - squash);
    const m11 = sa*sa*stretch + ca*ca*squash;

    for (let i = 0; i < MAX; i++) {
      const idx = ((head - 1 - i*3) % HIST + HIST) % HIST;
      const tx = hx[idx], ty = hy[idx];

      if (i === 0) { pool[i].x = tx; pool[i].y = ty; }
      else { pool[i].x += (tx - pool[i].x) * 0.42; pool[i].y += (ty - pool[i].y) * 0.42; }

      const el = pool[i].el;
      const targetOpacity = i < count ? 1 - (i / MAX) * 0.82 : 0;
      pool[i].fadeOpacity += (targetOpacity - pool[i].fadeOpacity) * 0.10;

      if (pool[i].fadeOpacity < 0.005) {
        if (el.style.display !== 'none') el.style.display = 'none';
        continue;
      }
      el.style.display = 'block';
      const sz = 1 - (i / MAX) * 0.28;
      el.style.opacity = pool[i].fadeOpacity;
      el.style.transform = (speed > 0.18 && i <= 1)
        ? `translate(${pool[i].x}px,${pool[i].y}px) matrix(${m00*sz},${m01*sz},${m01*sz},${m11*sz},0,0)`
        : `translate(${pool[i].x}px,${pool[i].y}px) scale(${sz})`;
    }
  })();

})();