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

  const GB   = ['#d98fe0','#a866b4','#7a4f8e','#4a2f63','#2a1c38','#0e1d28'];
  const DUST = ['#332e3a','#443a4c','#201c26','#4a4250'];

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
      ctx.strokeStyle = '#4a2f63';
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
      ctx.fillStyle   = '#d98fe0';
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
  const COLOR = '#d98fe0', DARK = '#0e1d28', MAX = 7;

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
// ════════════════════════════════════════════
// TERMINAL.JS — merged from Terminal.js
// ════════════════════════════════════════════
'use strict';
// ═══════════════════════════════════════════════════════
//  TERMINAL TEXT — all strings shown in the terminal
//  Edit this file to change any in-game text.
// ═══════════════════════════════════════════════════════

// ─── BOOT SEQUENCE ─────────────────────────────────────
const ASCII_LOGO = [
  ' _______  _______  _______  ______    ___   _         _______  _______ ',
  '|       ||       ||   _   ||    _ |  |   | | |       |       ||       |',
  '|  _____||    _  ||  |_|  ||   | ||  |   |_| | ____  |   _   ||  _____|',
  '| |_____ |   |_| ||       ||   |_||_ |      _||____| |  | |  || |_____ ',
  '|_____  ||    ___||       ||    __  ||     |_        |  |_|  ||_____  |',
  ' _____| ||   |    |   _   ||   |  | ||    _  |       |       | _____| |',
  '|_______||___|    |__| |__||___|  |_||___| |_|       |_______||_______|',
];

const BOOT_LINES = [
  { t: '', y: 'sys', d: 100 },
  ...ASCII_LOGO.map((line, i) => ({ t: line, y: 'sys', d: 150 + i * 80 })),
  { t: '', y: 'sys', d: 720 },
  { t: 'v0.1.5 —  booting...', y: 'result', d: 850 },
  { t: 'Loading kernel modules... OK', y: 'result', d: 1050 },
  { t: 'Mounting /missions filesystem... OK', y: 'result', d: 1250 },
  { t: 'Starting sector-grid daemon... OK', y: 'result', d: 1450 },
  { t: 'Terminal session started. User: root', y: 'sys', d: 1650 },
  { t: '', y: 'sys', d: 1750 },
  { t: 'Type  help  for commands.', y: 'result', d: 1850 },
  { t: 'Type  minesweeper  to earn clearance keys.', y: 'warn', d: 2000 },
  { t: 'Type  ls /access/  to browse the key vault.', y: 'result', d: 2100 },
  { t: '', y: 'sys', d: 2200 },
  { t: 'Have a sparkling day!', y: 'sys', d: 2300 },
];

// ─── POST-REBOOT LINES ──────────────────────────────────
function makeRebootLines(lvl) {
  return [
    { t: 'SPARK-OS 0.1.5 — REBOOTED', y: 'sys', d: 100 },
    { t: 'Clearance level: LEVEL-' + lvl, y: 'warn', d: 300 },
    { t: 'Loading kernel modules... OK', y: 'result', d: 500 },
    { t: 'Mounting /missions filesystem... OK', y: 'result', d: 700 },
    { t: 'Access granted to clearance zones.', y: 'sys', d: 900 },
    { t: '────────────────────────────────────', y: 'sys', d: 1050 },
    { t: 'Type  help  for command reference.', y: 'result', d: 1200 },
    { t: 'Type  clearance --status  to verify.', y: 'result', d: 1350 },
    { t: '────────────────────────────────────', y: 'sys', d: 1450 },
  ];
}

// ─── HELP COMMAND ───────────────────────────────────────
const HELP_LINES = [
  { t: '  ╔══════════════════════════════════════════╗', y: 'sys' },
  { t: '  ║  TMD GUIDE — How to play SPARK-OS        ║', y: 'sys' },
  { t: '  ╠══════════════════════════════════════════╣', y: 'sys' },
  { t: '  ║  GOAL: Activate all 5 STOCK missions     ║', y: 'result' },
  { t: '  ║        before the hostile reaches you.   ║', y: 'result' },
  { t: '  ╠══════════════════════════════════════════╣', y: 'sys' },
  { t: '  ║  STEP 1 — Start your first mission:      ║', y: 'warn' },
  { t: '  ║    cd /missions/stock-1                  ║', y: 'result' },
  { t: '  ║    nano objective.obj                    ║', y: 'result' },
  { t: '  ║    Change status=disabled → enabled      ║', y: 'result' },
  { t: '  ║    Type :wq to save and quit             ║', y: 'result' },
  { t: '  ╠══════════════════════════════════════════╣', y: 'sys' },
  { t: '  ║  STEP 2 — Monitor your progress:         ║', y: 'warn' },
  { t: '  ║    obj           (objectives overlay)    ║', y: 'result' },
  { t: '  ║    status        (system overview)       ║', y: 'result' },
  { t: '  ╠══════════════════════════════════════════╣', y: 'sys' },
  { t: '  ║  STEP 3 — Unlock higher missions:        ║', y: 'warn' },
  { t: '  ║    minesweeper   (win → get a key)       ║', y: 'result' },
  { t: '  ║    clearance --apply /access/lvl2.key    ║', y: 'result' },
  { t: '  ╠══════════════════════════════════════════╣', y: 'sys' },
  { t: '  ║  STEP 4 — Watch for enemies:             ║', y: 'warn' },
  { t: '  ║    map           (see the sector grid)   ║', y: 'result' },
  { t: '  ║    scan --select x,y  then  scan --exec  ║', y: 'result' },
  { t: '  ║    Deter hostiles before they reach [2,2]║', y: 'result' },
  { t: '  ╠══════════════════════════════════════════╣', y: 'sys' },
  { t: '  ║  OTHER USEFUL COMMANDS:                  ║', y: 'warn' },
  { t: '  ║    ls  cd  cat  tree  grep  ps  df       ║', y: 'result' },
  { t: '  ║    man <cmd>  for detailed help          ║', y: 'result' },
  { t: '  ╚══════════════════════════════════════════╝', y: 'sys' },
];

// ─── MAN PAGES ──────────────────────────────────────────
const MAN_PAGES = {
  ls:          ['ls — list directory contents', '  ls [path]'],
  cd:          ['cd — change directory', '  cd <path>'],
  cat:         ['cat — print file contents', '  cat <file>'],
  nano:        ['nano — text editor', '  :wq save+quit  :q quit', '  :set <line#> <text>   :up / :down navigate'],
  scan:        ['scan — sector scanner (CLR-1)', '  scan --select x,y', '  scan --exec', '  scan --status', '  Note: detects and deters enemies diagonally.'],
  obj:         ['obj — objectives overlay (CLR-1)', '  obj             toggle overlay', '  obj --active    show active mission'],
  mission:     ['mission — quick navigate (CLR-1)', '  mission <id>    e.g. mission stock-1'],
  tree:        ['tree — show directory tree (CLR-2)', '  tree [path]'],
  grep:        ['grep — search file contents (CLR-2)', '  grep <pattern> <file>'],
  status:      ['status — system overview (CLR-1)', '  status'],
  clearance:   ['clearance — manage clearance level', '  clearance --status', '  clearance --apply <keyfile>'],
  map:         ['map — sector map overlay (CLR-1)', '  map             toggle map', '  map --select x,y'],
  minesweeper: ['minesweeper — earn clearance keys', '  Launch a minesweeper minigame.', '  Win to unlock a clearance key.', '  Left click: reveal | Right click: flag', '  NOTE: Unlocked after first task is complete.'],
  enemy:       ['enemy — hostile status', '  enemy --status', '  Use scan --exec to deter enemies.', '  NOTE: Enemies activate after first task.'],
  whoami:      ['whoami — show current user and clearance'],
  pwd:         ['pwd — print working directory'],
  clear:       ['clear — clear terminal screen'],
  ps:          ['ps — list running processes (CLR-2)'],
  df:          ['df — show disk usage (CLR-2)'],
  echo:        ['echo — print text', '  echo <text>'],
  hostname:    ['hostname — show system hostname'],
};

// ─── CLEARANCE STATUS BOX ───────────────────────────────
function makeClearanceStatusLines(currentClearance, CLEARANCE_REQUIRED) {
  return [
    { t: '  ╔══════════════════════════════════════╗', y: 'sys' },
    { t: '  ║  CLEARANCE STATUS                    ║', y: 'sys' },
    { t: '  ╠══════════════════════════════════════╣', y: 'sys' },
    { t: '  ║  Current level: LEVEL-' + String(currentClearance).padEnd(19) + '║', y: 'warn' },
    { t: '  ║  Accessible missions:                ║', y: 'result' },
    ...Object.keys(CLEARANCE_REQUIRED).map(id => {
      const req = CLEARANCE_REQUIRED[id];
      const ok = currentClearance >= req;
      return { t: '  ║    ' + id + ': ' + (ok ? '✓ UNLOCKED' : '✗ LOCKED (LVL-' + req + ' req)').padEnd(27) + '║', y: ok ? 'result' : 'err' };
    }),
    { t: '  ║  Run minesweeper to earn keys.       ║', y: 'warn' },
    { t: '  ╚══════════════════════════════════════╝', y: 'sys' },
  ];
}

// ─── STATUS COMMAND BOX ─────────────────────────────────
function makeStatusLines(currentClearance, OBJS, ENEMY) {
  const a = Object.values(OBJS).find(o => o.status === 'active');
  const enemyStr = ENEMY.active ? 'ACTIVE [' + ENEMY.x + ',' + ENEMY.y + ']' : 'NONE';
  return [
    { t: '  ╔══════════════════════════════════════╗', y: 'sys' },
    { t: '  ║  SPARK-OS SYSTEM STATUS              ║', y: 'sys' },
    { t: '  ╠══════════════════════════════════════╣', y: 'sys' },
    { t: '  ║  Power : 94%   Shields: NOMINAL      ║', y: 'result' },
    { t: '  ║  Comms : OK    Network: ACTIVE       ║', y: 'result' },
    { t: '  ║  Clearance Level: ' + String(currentClearance).padEnd(22) + '║', y: 'warn' },
    { t: '  ║  Mission: ' + (a ? a.id : 'NONE').padEnd(28) + '║', y: 'result' },
    { t: '  ║  Hostile: ' + enemyStr.padEnd(28) + '║', y: ENEMY.active ? 'err' : 'result' },
    { t: '  ╚══════════════════════════════════════╝', y: 'sys' },
  ];
}

// ─── OBJECTIVE ACTIVATED BOX ────────────────────────────
function makeObjActivatedLines(objId) {
  return [
    { t: '  ╔══════════════════════════════╗', y: 'sys' },
    { t: '  ║  OBJECTIVE ' + objId + ' — ACTIVE  ║', y: 'sys' },
    { t: '  ╚══════════════════════════════╝', y: 'sys' },
  ];
}

// ─── MINESWEEPER LAUNCH LINES ───────────────────────────
function makeMinesweeperLaunchLines(targetLevel) {
  return [
    { t: '  [MINIGAME] Launching Minesweeper security challenge...', y: 'sys' },
    { t: '  [MINIGAME] Win to earn CLEARANCE LEVEL-' + targetLevel + ' key.', y: 'warn' },
  ];
}

// ─── MINESWEEPER LOCKED LINE ────────────────────────────
const MINESWEEPER_LOCKED_LINES = [
  { t: '  [LOCKED] Minesweeper unlocks after completing your first task.', y: 'err' },
  { t: '  [TIP] Activate a mission first: cd /missions/stock-1 && nano objective.obj', y: 'warn' },
];

// ─── MINESWEEPER WIN LINES ──────────────────────────────
function makeMinesweeperWinLines(targetLevel) {
  return [
    { t: '  [KEY] Minesweeper challenge complete!', y: 'sys' },
    { t: '  [KEY] Clearance key generated: /access/lvl' + targetLevel + '.key', y: 'sys' },
    { t: '  [SYS] Run: clearance --apply /access/lvl' + targetLevel + '.key', y: 'warn' },
  ];
}

// ─── PS COMMAND ─────────────────────────────────────────
const PS_LINES = [
  { t: '  PID   TTY    CMD', y: 'result' },
  { t: '  1     tty1   init', y: 'result' },
  { t: '  88    tty1   kernel-watcher', y: 'result' },
  { t: '  212   pts/0  bash', y: 'result' },
  { t: '  213   pts/0  SPARK-scan-daemon', y: 'result' },
];

// ─── DF COMMAND ─────────────────────────────────────────
const DF_LINES = [
  { t: '  Filesystem    Size   Used  Avail  Use%', y: 'result' },
  { t: '  /dev/nxs0     40G    12G    28G    30%', y: 'result' },
  { t: '  /dev/nxs1     10G     4G     6G    40%', y: 'result' },
];

// ─── ENEMY ALERT LINES ──────────────────────────────────
function makeEnemySpawnLines(ex, ey) {
  return [
    { t: '  [ALERT] Hostile signature detected at [' + ex + ',' + ey + ']', y: 'err' },
  ];
}

function makeEnemyReachedLines() {
  return [
    { t: '  [SYS] ENEMY REACHED YOUR POSITION. TERMINATING...', y: 'err' },
  ];
}

// ─── SCAN COMMAND LINES ─────────────────────────────────
function makeScanLines(selectedCell, adj, ENEMY, enemyLured) {
  const lines = [
    { t: '  [SCAN] Scanning sector [' + selectedCell.x + ',' + selectedCell.y + ']...', y: 'sys' },
  ];
  // Second batch (after 700ms delay)
  const lines2 = [
    { t: '  [SCAN] Sweeping ' + adj.length + ' adjacent cells (diagonal)...', y: 'sys' },
  ];
  return { lines, lines2 };
}

function makeScanResultLines(selectedCell, adj, ENEMY, enemyLured, nearEnemy) {
  const lines = [];
  if (ENEMY.active) {
    if (nearEnemy && !enemyLured) {
      lines.push({ t: '  [SCAN] Hostile signature intercepted — enemy deterred!', y: 'warn' });
      lines.push({ t: '  [SCAN] Enemy repelled to [' + ENEMY.x + ',' + ENEMY.y + ']', y: 'sys' });
    } else if (nearEnemy && enemyLured) {
      lines.push({ t: '  [SCAN] Enemy already on intercept course.', y: 'warn' });
    } else {
      lines.push({ t: '  [SCAN] No hostile signatures detected.', y: 'result' });
    }
  } else {
    lines.push({ t: '  [SCAN] Sector clear — no hostile activity.', y: 'result' });
  }
  lines.push({ t: '  [SCAN] Adjacent: ' + adj.map(a => '[' + a.x + ',' + a.y + ']').join(' '), y: 'result' });
  return lines;
}

// ─── ACHIEVEMENT LINES ──────────────────────────────────
const ACHIEVEMENT_LINES = {
  completeTask: { t: 'ACHIEVEMENT UNLOCKED: Complete a task!', y: 'warn' },
  lvl2:         { t: 'ACHIEVEMENT UNLOCKED: Reached Clearance Level 2!', y: 'warn' },
};

// ─── MISC INLINE MESSAGES ───────────────────────────────
// These are used as short inline pl() calls — edit text here
const MSG = {
  cmdNotFound:        (cmd) => '  bash: ' + cmd + ': command not found. Try: help',
  cmdBlocked:         (cmd, req) => ['  [BLOCKED] Command "' + cmd + '" requires CLEARANCE LEVEL-' + req, '  [SYS] Run minesweeper to unlock clearance keys.'],
  clearanceApplying:  () => ['  [KEY] Valid key detected.', '  [SYS] Initiating clearance upgrade...'],
  clearanceSkipErr:   () => '  [ERR] Cannot skip clearance levels.',
  clearanceAlready:   (cur, g)  => '  [WARN] Key grants level ' + g + ', but you already have level ' + cur + '.',
  clearanceNoFile:    (f) => ['  [ERR] Key file not found: "' + f + '"', '  [TIP] Run minesweeper to earn a key.'],
  clearanceNotKey:    () => '  [ERR] Not a valid key file (.key required).',
  clearanceBadKey:    () => '  [ERR] Invalid key file — GRANT_LEVEL missing.',
  minesweeperMaxClr:  () => '  [SYS] Maximum clearance already reached!',
  objOverlayClosed:   () => '  [OBJ] Overlay closed.',
  objPaused:          (id) => '  [OBJ] Objective ' + id + ' paused.',
  objOpened:          () => '  [OBJ] Showing objectives. Type OBJ again to close.',
  mapOpened:          () => '  [MAP] Sector map open. Type MAP again to close.',
  mapClosed:          () => '  [MAP] Overlay closed.',
  mapHostile:         (x, y) => '  [MAP] ⚠ Hostile detected at [' + x + ',' + y + ']',
  mapTargetLocked:    (x, y) => '  [MAP] Target locked: [' + x + ',' + y + ']',
  scanTargetLocked:   (x, y) => '  [SCAN] Target locked: [' + x + ',' + y + ']',
  scanNoTarget:       () => '  [SCAN] No cell selected.',
  scanTargetStatus:   (x, y) => '  [SCAN] Target: [' + x + ',' + y + '] — pending exec',
  scanNoCell:         () => '  [ERR] No target selected.',
  scanOOB:            () => '  [ERR] Coordinates out of range (0-4).',
  scanSelf:           () => '  [WARN] Cannot target player position.',
  editorSaved:        () => '  [OK] File saved.',
  editorObjSaved:     (name) => '  [OK] ' + name + ' saved.',
  editorExited:       () => '  [EDITOR] Exited.',
  editorSavedExited:  () => '  [EDITOR] Saved and exited.',
  editorLineUpdated:  (n) => '  [OK] Line ' + n + ' updated.',
  editorLineReplace:  () => '  [OK] Line replaced. :wq to save.',
  editorBadLine:      () => '  [ERR] Invalid line.',
  editorFileMissing:  () => '  [ERR] File missing.',
  accessDenied:       (lvl) => '  [ERR] ACCESS DENIED — LEVEL-' + lvl + ' clearance required.',
  accessDeniedEdit:   (lvl) => ['  [ERR] ACCESS DENIED — LEVEL-' + lvl + ' clearance required.', '  [SYS] Run minesweeper to earn clearance keys.'],
  missionNotFound:    (id) => '  [ERR] Mission ' + id + ' not found.',
  missionNavJump:     (path) => '  [NAV] Jumped to ' + path,
  objComplete:        (id) => '  [SYS] ' + id + ' is COMPLETE.',
  objAccessDenied:    (lvl) => ['  [ERR] CLEARANCE DENIED — LEVEL-' + lvl + ' required.', '  [SYS] Use: minesweeper  to earn clearance keys.'],
  objClearanceDenied: (lvl) => '  [ERR] CLEARANCE DENIED — LEVEL-' + lvl + ' required.',
  enemyLured:         (x, y) => '  [SCAN] Signal detected by enemy — luring to [' + x + ',' + y + '].',
  enemyDecoyReached:  () => '  [WARN] Enemy reached scan decoy — resuming patrol.',
  enemyStatus:        (ex, ey, px, py) => '  [ENEMY] Hostile at [' + ex + ',' + ey + '] — player at [' + px + ',' + py + ']',
  enemyNone:          () => '  [ENEMY] No hostile detected.',
  enemyLocked:        () => ['  [LOCKED] Enemy system inactive — complete your first task to enable threats.'],
  sessionActive:      () => '  [SYS] Session active. Use shutdown to terminate.',
  shutdownInit:       () => '  [SYS] Initiating system shutdown...',
  shutdownHalted:     () => '  [SYS] System halted.',
  keyApplying:        (lvl) => '  [KEY] Valid key detected: GRANT_LEVEL=' + lvl,
  keyUpgrading:       () => '  [SYS] Initiating clearance upgrade...',
  rebootApplying:     () => ['  [SYS] Applying clearance key...', '  [SYS] Rebooting system...'],
  grepNoArgs:         () => '  Usage: grep <pattern> <file>',
  grepNoMatch:        (pat) => '  (no matches for "' + pat + '")',
  clearanceUsage:     () => ['  Usage:', '    clearance --status', '    clearance --apply <keyfile>'],
  scanUsage:          () => ['  Usage:', '    scan --select x,y', '    scan --exec', '    scan --status'],
  scanUnknown:        () => '  scan: unknown option. Try: scan --help',
  enemyUsage:         () => ['  Usage:', '    enemy --status    show enemy position', '  [SYS] Use scan + map to deter enemies.'],
  objUsage:           () => '  Usage: obj  (toggle overlay) | obj --active',
  objActiveNone:      () => '  No active objective.',
  objActive:          (id, p) => '  Active: ' + id + ' (' + p + '%)',
  missionUsage:       () => '  Usage: mission <id>',
  hostnameResult:     () => '  SPARK-node-01',
  whoamiResult:       (lvl) => '  root  [CLEARANCE LEVEL-' + lvl + ']',
  pwdResult:          (cwd) => '  ' + cwd,
};