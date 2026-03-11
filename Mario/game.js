const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const scoreEl = document.getElementById('score');
const coinsEl = document.getElementById('coins');
const timeEl = document.getElementById('time');
const livesEl = document.getElementById('lives');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');

const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const jumpBtn = document.getElementById('jumpBtn');

const TILE = 48;
const GRAVITY = 0.52;
const EXTRA_LENGTH_TILES = 36;
const MAP = [
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '...P............................................................................',
  '################################################################################',
  '################################################################################'
];

let running = false;
let elapsedMs = 0;
let clock = 400;
let score = 0;
let coins = 0;
let lives = 3;
let reverseMode = false;
let routePhase = 1;

const keys = {
  left: false,
  right: false,
  jump: false,
  fire: false
};

const player = {
  x: 0,
  y: 0,
  w: 34,
  h: 42,
  smallH: 42,
  bigH: 58,
  isBig: false,
  vx: 0,
  vy: 0,
  speed: 4.2,
  jumpForce: 11.8,
  jumpBoost: 0.34,
  maxJumpHoldMs: 150,
  jumpHoldMs: 0,
  onGround: false,
  face: 1,
  canShootRed: false,
  lastShotMs: 0,
  invulnUntil: 0
};

const world = {
  width: MAP[0].length * TILE,
  height: MAP.length * TILE,
  solids: [],
  coins: [],
  mushrooms: [],
  redShots: [],
  popCoins: [],
  decorations: [],
  pipes: [],
  skipPortal: null,
  enemies: [],
  castle: null,
  flag: null,
  cameraX: 0,
  spawnX: TILE,
  spawnY: TILE * 9
};

const ASSET_PATHS = {
  forest: ['forest.png', 'ready_materials/forest.png'],
  marioRight: 'mario.png',
  marioLeft: 'marioL.png',
  jumpRight: 'jumps.png',
  jumpLeft: 'jumpsL.png',
  ground: 'ready_materials/ground_1.png',
  brick: 'ready_materials/brick_cube1.png',
  question: 'ready_materials/mark_block1.png',
  usedBlock: 'ready_materials/special_cube.png',
  coin: 'ready_materials/coin.png',
  mushroom: 'ready_materials/mushroom.png',
  enemy1: 'ready_materials/enemy1.1.png',
  enemy2: 'ready_materials/enemy1.2.png',
  pipe1: 'ready_materials/pipe1.png',
  pipe2: 'ready_materials/pipe2.png',
  flag: 'ready_materials/flag.png',
  cloud1: 'ready_materials/cloud1.png',
  cloud2: 'ready_materials/cloud2.png',
  cloud3: 'ready_materials/cloud3.png',
  flowers: ['flowers.png', 'ready_materials/flowers.png', 'ready_materials/flower.png'],
  bush1: 'ready_materials/bush1.png',
  bush2: 'ready_materials/bush2.png',
  hill1: 'ready_materials/hill1.png',
  hill2: 'ready_materials/hill2.png',
  castle: 'ready_materials/castle.png'
};

const assets = {};
let assetsReady = false;

const SPRITES = {
  player: {
    idle: [
      '....RRRR....',
      '...RKKKKR...',
      '...RSSSSR...',
      '..RSSSSSSR..',
      '..SOOOOOSS..',
      '..SOOOOOSS..',
      '..SOOOOOSS..',
      '..SSOOOOSS..',
      '...SOOOSS...',
      '...B....B...',
      '..BB....BB..',
      '..BB....BB..',
      '...B....B...',
      '............'
    ],
    walk1: [
      '....RRRR....',
      '...RKKKKR...',
      '...RSSSSR...',
      '..RSSSSSSR..',
      '..SOOOOOSS..',
      '..SOOOOOSS..',
      '..SOOOOOSS..',
      '..SSOOOOSS..',
      '...SOOOSS...',
      '...B...BB...',
      '..BB....B...',
      '..BB...BB...',
      '....B..BB...',
      '............'
    ],
    walk2: [
      '....RRRR....',
      '...RKKKKR...',
      '...RSSSSR...',
      '..RSSSSSSR..',
      '..SOOOOOSS..',
      '..SOOOOOSS..',
      '..SOOOOOSS..',
      '..SSOOOOSS..',
      '...SOOOSS...',
      '..BB...B....',
      '...B....BB..',
      '..BB...BB...',
      '...BB..B....',
      '............'
    ],
    jump: [
      '....RRRR....',
      '...RKKKKR...',
      '...RSSSSR...',
      '..RSSSSSSR..',
      '..SOOOOOSS..',
      '..SOOOOOSS..',
      '...SOOOOS...',
      '...SSOOSS...',
      '..B.SOO.SB..',
      '...B....B...',
      '..BB....BB..',
      '...BB..BB...',
      '............',
      '............'
    ]
  },
  enemy: {
    walk1: [
      '................',
      '.....MMMMMM.....',
      '...MMMMMMMMMM...',
      '..MMTTMMMMTTMM..',
      '..MMMMMMMMMMMM..',
      '.MMMMMMMMMMMMMM.',
      '.MMMMBBBBBBMMMM.',
      '.MMMBMMMMMMBMMM.',
      '.MMMBBBBBBBBMMM.',
      '..MMMBBBBBBMMM..',
      '..MM........MM..',
      '.BBB........BBB.',
      '.BBB........BBB.',
      '................',
      '................',
      '................'
    ],
    walk2: [
      '................',
      '.....MMMMMM.....',
      '...MMMMMMMMMM...',
      '..MMTTMMMMTTMM..',
      '..MMMMMMMMMMMM..',
      '.MMMMMMMMMMMMMM.',
      '.MMMMBBBBBBMMMM.',
      '.MMMBMMMMMMBMMM.',
      '.MMMBBBBBBBBMMM.',
      '..MMMBBBBBBMMM..',
      '..MM........MM..',
      '..BBB......BBB..',
      '.BBB........BBB.',
      '................',
      '................',
      '................'
    ]
  },
  coin: {
    spin1: [
      '...YY...',
      '..YWWY..',
      '..YWWY..',
      '..YWWY..',
      '..YWWY..',
      '..YWWY..',
      '...YY...',
      '........'
    ],
    spin2: [
      '..YYYY..',
      '.YWWWWY.',
      '.YWWWWY.',
      '.YWWWWY.',
      '.YWWWWY.',
      '.YWWWWY.',
      '..YYYY..',
      '........'
    ],
    spin3: [
      '...YY...',
      '..YWWY..',
      '.YWYYWY.',
      '.YWYYWY.',
      '.YWYYWY.',
      '..YWWY..',
      '...YY...',
      '........'
    ]
  }
};

const PALETTE = {
  R: '#dc2626',
  K: '#111827',
  S: '#fed7aa',
  O: '#f59e0b',
  B: '#7c2d12',
  M: '#8a4b24',
  T: '#111111',
  Y: '#facc15',
  W: '#fde68a'
};

const PLAYER_NUMERIC_SPRITE = [
  [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 2, 2, 2, 3, 3, 2, 3, 0, 0, 0, 0, 0],
  [0, 0, 0, 2, 3, 2, 3, 3, 3, 2, 3, 3, 3, 0, 0, 0],
  [0, 0, 0, 2, 3, 2, 2, 3, 3, 3, 2, 3, 3, 3, 0, 0],
  [0, 0, 0, 2, 2, 3, 3, 3, 3, 2, 2, 2, 2, 0, 0, 0],
  [0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 2, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1, 0, 0],
  [0, 0, 3, 3, 1, 2, 3, 2, 2, 3, 2, 1, 3, 3, 0, 0],
  [0, 0, 3, 3, 3, 2, 2, 2, 2, 2, 2, 3, 3, 3, 0, 0],
  [0, 0, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 0, 0],
  [0, 0, 0, 0, 2, 2, 2, 0, 0, 2, 2, 2, 0, 0, 0, 0],
  [0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0],
  [0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0]
];

const PLAYER_NUMERIC_PALETTE = {
  1: '#dc2626',
  2: '#f5c69a',
  3: '#7c2d12'
};

const WEATHER_STATES = ['clear', 'rain', 'fog', 'storm'];
const WEATHER_CYCLE_MS = 12000;
const WEATHER_TRANSITION_MS = 3200;
const WEATHER_META = {
  clear: { rain: 0, fog: 0.05, storm: 0, tint: 'rgba(255,255,255,0)' },
  rain: { rain: 1, fog: 0.18, storm: 0.2, tint: 'rgba(191,219,254,0.10)' },
  fog: { rain: 0.15, fog: 1, storm: 0.15, tint: 'rgba(241,245,249,0.22)' },
  storm: { rain: 0.85, fog: 0.25, storm: 1, tint: 'rgba(15,23,42,0.24)' }
};

function loadAssets() {
  // Preload all image assets once so render() can draw synchronously every frame.
  const entries = Object.entries(ASSET_PATHS);
  const loads = entries.map(([key, pathOrPaths]) => new Promise((resolve) => {
    const candidates = Array.isArray(pathOrPaths) ? pathOrPaths : [pathOrPaths];
    let index = 0;

    function tryNext() {
      if (index >= candidates.length) {
        resolve();
        return;
      }

      const img = new Image();
      img.onload = () => {
        assets[key] = img;
        resolve();
      };
      img.onerror = () => {
        index += 1;
        tryNext();
      };
      img.src = candidates[index];
    }

    tryNext();
  }));

  return Promise.all(loads).then(() => {
    assetsReady = true;
  });
}

function drawImageFitted(img, x, y, w, h, flipX = false) {
  if (!img) return;

  ctx.save();
  if (flipX) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
  ctx.restore();
}

function parseMap() {
  // Build/reset all world data for the current route phase.
  const baseWidthTiles = MAP[0].length;
  const totalWidthTiles = baseWidthTiles + EXTRA_LENGTH_TILES;
  world.width = totalWidthTiles * TILE;
  world.solids = [];
  world.coins = [];
  world.mushrooms = [];
  world.redShots = [];
  world.popCoins = [];
  world.decorations = [];
  world.pipes = [];
  world.skipPortal = null;
  world.enemies = [];
  world.castle = null;
  world.flag = null;

  for (let row = 0; row < MAP.length; row += 1) {
    for (let col = 0; col < MAP[row].length; col += 1) {
      const ch = MAP[row][col];
      const x = col * TILE;
      const y = row * TILE;

      if (ch === '#') world.solids.push({ x, y, w: TILE, h: TILE, kind: 'ground' });
      if (ch === 'B') world.solids.push({ x, y, w: TILE, h: TILE, kind: 'brick' });
      if (ch === '?') world.solids.push({ x, y, w: TILE, h: TILE, kind: 'question', used: false, bumpMs: 0 });
      if (ch === 'C') world.coins.push({ x: x + 12, y: y + 12, w: 24, h: 24, taken: false });
      if (ch === 'P') {
        player.x = x;
        player.y = y - 8;
        world.spawnX = player.x;
        world.spawnY = player.y;
      }
      if (ch === 'F') {
        world.flag = { x: x + 14, y: y - TILE * 2, w: 16, h: TILE * 3 };
      }
    }
  }

  // Build jumpable pits (1-5 tiles wide) and use them when laying ground.
  const pitRanges = [];
  const plannedPipes = [
    { col: 35, width: 2, height: 2, kind: 'pipe1' },
    { col: 48, width: 2, height: 3, kind: 'pipe1' },
    { col: 60, width: 2, height: 4, kind: 'pipe2' }
  ];

  const stairAStart = Math.floor(totalWidthTiles * 0.55);
  const stairBStart = Math.floor(totalWidthTiles * 0.72);
  const highWallCols = new Set();
  for (let c = stairAStart; c < stairAStart + 4; c += 1) highWallCols.add(c);
  for (let c = stairBStart; c < stairBStart + 4; c += 1) highWallCols.add(c);

  function blocksViewBeforePit(col) {
    // Rule: do not start a pit immediately after a pipe or high wall.
    const prev = col - 1;
    const pipeBefore = plannedPipes.some((p) => prev >= p.col && prev < p.col + p.width);
    return pipeBefore || highWallCols.has(prev);
  }

  function addPit(startCol, width) {
    // Clamp to valid jumpable widths and shift if rule constraints are violated.
    const clampedWidth = Math.max(1, Math.min(5, width));
    let col = startCol;

    while (blocksViewBeforePit(col) && col < totalWidthTiles - clampedWidth - 2) {
      col += 1;
    }

    pitRanges.push({ start: col, end: col + clampedWidth - 1 });
  }

  // Requested pit profile:
  // small (safe): width 1 at x=10
  // medium (safe): width 3 at x=25
  // large (max): width 5 at x=50
  // Placement rule: never immediately after a pipe/high-wall column.
  addPit(10, 1);
  addPit(25, 3);
  addPit(50, 5);

  function isPitCol(col) {
    return pitRanges.some((pit) => col >= pit.start && col <= pit.end);
  }

  // Remove parsed map ground where pits were cut.
  world.solids = world.solids.filter((solid) => {
    if (solid.kind !== 'ground') return true;
    const col = Math.round(solid.x / TILE);
    return !isPitCol(col);
  });

  // Extend the level with ground while preserving pit gaps.
  for (let col = baseWidthTiles; col < totalWidthTiles; col += 1) {
    if (isPitCol(col)) continue;
    world.solids.push({ x: col * TILE, y: 11 * TILE, w: TILE, h: TILE, kind: 'ground' });
    world.solids.push({ x: col * TILE, y: 12 * TILE, w: TILE, h: TILE, kind: 'ground' });
  }

  function addBlock(col, row, kind) {
    // Question blocks keep runtime state (used/bump animation), other blocks are static.
    if (kind === 'question') {
      world.solids.push({
        x: col * TILE,
        y: row * TILE,
        w: TILE,
        h: TILE,
        kind: 'question',
        used: false,
        bumpMs: 0
      });
      return;
    }

    world.solids.push({ x: col * TILE, y: row * TILE, w: TILE, h: TILE, kind });
  }

  const playableEndCol = totalWidthTiles - 20;

  function addRun(startCol, row, kinds) {
    for (let i = 0; i < kinds.length; i += 1) {
      addBlock(startCol + i, row, kinds[i]);
    }
  }

  // Question blocks at y=7/y=8 so small Mario can hit from ground.
  for (let col = 16; col < playableEndCol; col += 12) {
    addRun(col, 8, ['brick', 'question', 'brick']);
    addRun(col + 5, 7, ['question', 'brick', 'question']);
  }

  // RGB power block: hit from below to unlock red-circle shooting.
  world.solids = world.solids.filter((solid) => !(solid.x === 18 * TILE && solid.y === 8 * TILE));
  addBlock(18, 8, 'rgb');

  // Brick ceilings and multi-tier paths.
  for (let col = 24; col < playableEndCol - 8; col += 26) {
    addRun(col, 6, ['brick', 'brick', 'brick', 'brick']);
    addRun(col + 2, 5, ['brick', 'brick', 'brick']);
  }

  // Lead-in blocks before max-width pit for fair sprint jump.
  addRun(44, 9, ['brick', 'brick', 'brick']);
  addRun(47, 8, ['question', 'brick']);

  // Pipes: width 2-3 tiles, height 2-4 tiles, with jump space between groups.
  function addPipeGroup(startCol, widthTiles, heightTiles, kind) {
    world.pipes.push({
      col: startCol,
      x: startCol * TILE,
      y: 11 * TILE - heightTiles * TILE,
      w: widthTiles * TILE,
      h: heightTiles * TILE,
      kind
    });

    for (let w = 0; w < widthTiles; w += 1) {
      world.solids.push({
        x: (startCol + w) * TILE,
        y: 11 * TILE - heightTiles * TILE,
        w: TILE,
        h: heightTiles * TILE,
        kind
      });
    }
  }

  // Pipes using standard heights 2, 3, and 4 tiles.
  const pipeGroups = plannedPipes;

  for (const pipe of pipeGroups) {
    if (pipe.col < playableEndCol - 10) {
      addPipeGroup(pipe.col, pipe.width, pipe.height, pipe.kind);
    }
  }

  function highestSolidTopAt(centerX) {
    // Find the highest top surface under a given x position for safe enemy placement.
    let topY = null;
    for (const solid of world.solids) {
      if (centerX < solid.x || centerX >= solid.x + solid.w) continue;
      if (topY === null || solid.y < topY) topY = solid.y;
    }
    return topY;
  }

  function isInsideAnySolid(entity) {
    return world.solids.some((solid) => intersects(entity, solid));
  }

  const enemyCols = [];

  function enemiesInSpan(col) {
    const span = Math.floor(col / 16);
    return enemyCols.filter((c) => Math.floor(c / 16) === span).length;
  }

  function findValidEnemyCol(preferredCol, minDistTiles = 1) {
    // Enforce safe zone, spacing, and per-span density to keep enemy rhythm fair.
    let col = Math.max(16, preferredCol);
    while (col < playableEndCol - 4) {
      const tooClose = enemyCols.some((c) => Math.abs(c - col) < minDistTiles);
      const spanCrowded = enemiesInSpan(col) >= 4;
      if (!tooClose && !spanCrowded) return col;
      col += 1;
    }
    return Math.max(16, preferredCol);
  }

  function placeGroundEnemy(col, kind, speed, minDistTiles = 1) {
    const safeCol = findValidEnemyCol(col, minDistTiles);
    enemyCols.push(safeCol);

    const x = safeCol * TILE + 8;
    const centerX = x + 16;
    const topY = highestSolidTopAt(centerX);
    const y = (topY ?? 11 * TILE) - 32;
    const enemy = {
      x,
      y,
      w: 32,
      h: 32,
      vx: -Math.abs(speed),
      vy: 0,
      onGround: true,
      alive: true,
      type: kind
    };

    // Ensure enemy does not start inside blocks/pipes.
    while (isInsideAnySolid(enemy)) {
      enemy.y -= TILE;
      if (enemy.y < 0) break;
    }

    world.enemies.push(enemy);
  }

  function placeFlyingEnemy(col, row, speed) {
    const safeCol = findValidEnemyCol(col, 1.5);
    enemyCols.push(safeCol);

    const enemy = {
      x: safeCol * TILE + 8,
      y: row * TILE,
      w: 32,
      h: 32,
      vx: Math.abs(speed),
      vy: 0,
      onGround: false,
      alive: true,
      type: 'flying',
      flying: true,
      homeY: row * TILE,
      flyPhase: 0
    };

    while (isInsideAnySolid(enemy)) {
      enemy.y -= TILE;
      if (enemy.y < 0) break;
    }

    world.enemies.push(enemy);
  }

  // NES-style enemy placement with rhythm rules.
  // Safe zone: no enemies in first 16 tiles.
  // Goombas in groups of 1 or 2.
  placeGroundEnemy(13, 'goomba', 3.1); // auto-shifted to safe zone if needed
  placeGroundEnemy(31, 'goomba', 3.0, 0.75);
  placeGroundEnemy(52, 'goomba', 3.2);

  // Green koopas on flatter stretches (walk off edges).
  placeGroundEnemy(28, 'koopa-green', 2.8);
  placeGroundEnemy(55, 'koopa-green', 2.9);

  // Red koopas on elevated platforms (edge-patrol).
  placeGroundEnemy(45, 'koopa-red', 2.4);
  placeGroundEnemy(66, 'koopa-red', 2.4);

  // Flying enemy over platform/pit area.
  placeFlyingEnemy(40, 5, 2.8);

  // Piranha plants inside pipes.
  for (const pipe of world.pipes) {
    const safeCol = findValidEnemyCol(pipe.col + pipe.w / TILE, 1);
    enemyCols.push(safeCol);
    world.enemies.push({
      x: pipe.x + pipe.w * 0.5 - 14,
      y: pipe.y + 2,
      w: 28,
      h: 30,
      vx: 0,
      vy: 0,
      onGround: false,
      alive: true,
      type: 'piranha',
      pipe,
      emergeOffset: 0,
      emergeDir: 1,
      emergeHoldMs: 0
    });
  }

  // 4x4 inert (special) stair pyramids.
  function addInertPyramid(startCol) {
    for (let step = 0; step < 4; step += 1) {
      for (let stack = 0; stack <= step; stack += 1) {
        addBlock(startCol + step, 10 - stack, 'special');
      }
    }
  }

  addInertPyramid(stairAStart);
  addInertPyramid(stairBStart);

  // Ensure safe landings after staircases (no immediate pit after over-jump).
  for (let col = stairAStart + 4; col <= stairAStart + 7; col += 1) {
    if (!isPitCol(col)) {
      addBlock(col, 10, 'ground');
    }
  }
  for (let col = stairBStart + 4; col <= stairBStart + 7; col += 1) {
    if (!isPitCol(col)) {
      addBlock(col, 10, 'ground');
    }
  }

  if (routePhase === 1) {
    // Skip marker: brick block + flower + text trigger.
    const skipCol = 6;
    const skipRow = 8;
    addBlock(skipCol, skipRow, 'brick');
    world.decorations.push({
      x: skipCol * TILE + 9,
      y: (skipRow - 1) * TILE + 6,
      w: 30,
      h: 30,
      type: 'flowers'
    });
    world.skipPortal = {
      x: skipCol * TILE - 14,
      y: (skipRow - 2) * TILE,
      w: TILE + 28,
      h: TILE * 2,
      used: false
    };
  }

  // Mushroom pickup on top of a brick near the start.
  addBlock(22, 10, 'brick');
  world.mushrooms.push({ x: 22 * TILE + 10, y: 9 * TILE + 12, w: 28, h: 28, taken: false });

  // Keep very end clear for castle and flag approach.
  for (let col = totalWidthTiles - 15; col < totalWidthTiles - 7; col += 1) {
    addBlock(col, 8, 'brick');
  }

  // Keep very end clear for castle and flag approach.
  for (let col = totalWidthTiles - 15; col < totalWidthTiles - 7; col += 1) {
    addBlock(col, 8, 'brick');
  }

  // Place castle at level end, grounded and 3x bigger.
  const groundTopY = 11 * TILE;
  const castleSize = 540;
  world.castle = {
    x: world.width - castleSize - TILE,
    y: groundTopY - castleSize,
    w: castleSize,
    h: castleSize
  };

  // Place flag in front of castle: 8px to the left, 2.5x larger.
  const flagScale = 2.5;
  const flagWidth = Math.round(22 * flagScale);
  const flagHeight = Math.round(TILE * 4 * flagScale);
  world.flag = {
    x: world.castle.x - 8 - flagWidth,
    y: groundTopY - flagHeight,
    w: flagWidth,
    h: flagHeight
  };

  if (reverseMode) {
    // Route 2/3 rebuilds are mirrored to reverse traversal direction.
    mirrorWorld();
  }
}

function mirrorEntityX(entity) {
  entity.x = world.width - (entity.x + entity.w);
}

function mirrorWorld() {
  // Mirror all x-based entities so the full route can be played in reverse.
  for (const solid of world.solids) {
    mirrorEntityX(solid);
  }
  for (const coin of world.coins) {
    mirrorEntityX(coin);
  }
  for (const mushroom of world.mushrooms) {
    mirrorEntityX(mushroom);
  }
  for (const pop of world.popCoins) {
    mirrorEntityX(pop);
  }
  for (const deco of world.decorations) {
    mirrorEntityX(deco);
  }
  for (const pipe of world.pipes) {
    mirrorEntityX(pipe);
    if (typeof pipe.col === 'number') {
      pipe.col = Math.round(pipe.x / TILE);
    }
  }
  for (const enemy of world.enemies) {
    mirrorEntityX(enemy);
    if (typeof enemy.vx === 'number') enemy.vx *= -1;
    if (typeof enemy.homeY === 'number') {
      // keep vertical anchor, only mirror x
    }
  }
  if (world.castle) mirrorEntityX(world.castle);
  if (world.flag) mirrorEntityX(world.flag);
  if (world.skipPortal) mirrorEntityX(world.skipPortal);

  world.spawnX = world.width - (world.spawnX + player.w);
  player.x = world.spawnX;
  player.y = world.spawnY;
  player.face = -1;
}

function resetRun() {
  // Start a fresh run of the current route phase.
  elapsedMs = 0;
  clock = 400;
  score = 0;
  coins = 0;
  parseMap();
  player.isBig = false;
  player.h = player.smallH;
  player.vx = 0;
  player.vy = 0;
  player.canShootRed = false;
  player.lastShotMs = 0;
  player.jumpHoldMs = 0;
  player.onGround = false;
  world.cameraX = 0;
  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(score).padStart(6, '0');
  coinsEl.textContent = String(coins).padStart(2, '0');
  timeEl.textContent = String(Math.max(0, clock));
  livesEl.textContent = String(lives);
}

function intersects(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function moveAndCollide(entity, axis) {
  for (const solid of world.solids) {
    if (!intersects(entity, solid)) continue;

    if (axis === 'x') {
      if (entity.vx > 0) entity.x = solid.x - entity.w;
      if (entity.vx < 0) entity.x = solid.x + solid.w;
      entity.vx = 0;
    } else {
      if (entity.vy > 0) {
        entity.y = solid.y - entity.h;
        entity.onGround = true;
      }
      if (entity.vy < 0) {
        entity.y = solid.y + solid.h;
        if (solid.kind === 'question' && !solid.used && entity === player) {
          solid.used = true;
          solid.bumpMs = 120;
          world.popCoins.push({
            x: solid.x + 12,
            y: solid.y - 8,
            w: 24,
            h: 24,
            vy: -6.4,
            lifeMs: 420
          });
          coins += 1;
          score += 200;
        }

        if (solid.kind === 'rgb' && !solid.used && entity === player) {
          solid.used = true;
          solid.bumpMs = 140;
          player.canShootRed = true;
          score += 500;
        }
      }
      entity.vy = 0;
    }
  }
}

function hurtPlayer(ignoreInvulnerability = false) {
  // Base damage path: lose life, respawn, and reset to small state.
  const now = performance.now();
  if (!ignoreInvulnerability && now < player.invulnUntil) return;

  lives -= 1;
  player.invulnUntil = now + 1500;

  if (lives <= 0) {
    running = false;
    overlay.innerHTML = '<h1>GAME OVER</h1><p>Press start to try again.</p><button id="startBtn">Restart</button>';
    overlay.style.display = 'grid';
    document.getElementById('startBtn').addEventListener('click', startGame, { once: true });
    lives = 3;
    return;
  }

  player.x = world.spawnX;
  player.y = world.spawnY;
  player.isBig = false;
  player.h = player.smallH;
  player.vx = 0;
  player.vy = 0;
  player.jumpHoldMs = 0;
  world.cameraX = Math.max(0, Math.min(world.spawnX - canvas.width * 0.3, world.width - canvas.width));
}

function growPlayer() {
  // Power-up growth keeps feet anchored by shifting y upward.
  if (player.isBig) return;
  const oldH = player.h;
  player.isBig = true;
  player.h = player.bigH;
  player.y -= (player.h - oldH);
}

function shrinkPlayer() {
  // Shrink back to small form while keeping ground contact visually stable.
  if (!player.isBig) return;
  const oldH = player.h;
  player.isBig = false;
  player.h = player.smallH;
  player.y += (oldH - player.h);
}

function damagePlayer(ignoreInvulnerability = false) {
  // If big, first hit only shrinks; otherwise it costs a life.
  const now = performance.now();
  if (!ignoreInvulnerability && now < player.invulnUntil) return;

  if (player.isBig) {
    shrinkPlayer();
    player.invulnUntil = now + 1500;
    return;
  }

  hurtPlayer(ignoreInvulnerability);
}

function shootRedProjectile() {
  if (!running || !player.canShootRed) return;

  const now = performance.now();
  if (now - player.lastShotMs < 220) return;
  if (world.redShots.length >= 3) return;

  const dir = player.face < 0 ? -1 : 1;
  const shotRadius = player.isBig ? 11 : 7;
  world.redShots.push({
    x: player.x + (dir === 1 ? player.w - 4 : -10),
    y: player.y + player.h * 0.42,
    r: shotRadius,
    vx: 8 * dir,
    vy: -0.8,
    alive: true
  });
  player.lastShotMs = now;
}

function hasAnySolidBelow(x, minY) {
  return world.solids.some((solid) => (
    x >= solid.x &&
    x < solid.x + solid.w &&
    solid.y >= minY
  ));
}

function hasGroundAtWorldBottom(x) {
  return world.solids.some((solid) => (
    solid.kind === 'ground' &&
    x >= solid.x &&
    x < solid.x + solid.w &&
    solid.y >= world.height - TILE
  ));
}

function winLevel() {
  running = false;
  overlay.innerHTML = '<h1>YOU WIN!</h1><p>Course cleared.</p><button id="startBtn">Play Again</button>';
  overlay.style.display = 'grid';
  document.getElementById('startBtn').addEventListener('click', startGame, { once: true });
}

function startReverseRun() {
  // Rebuild route for phase 2/3 and restart movement/timer state.
  reverseMode = routePhase === 2;
  running = true;
  elapsedMs = 0;
  clock = 400;
  parseMap();
  player.vx = 0;
  player.vy = 0;
  player.jumpHoldMs = 0;
  player.onGround = false;
  world.cameraX = Math.max(0, Math.min(player.x - canvas.width * 0.3, world.width - canvas.width));
  updateHud();
}

function update(dt) {
  if (!running) return;

  if (keys.fire) {
    shootRedProjectile();
  }

  elapsedMs += dt;
  if (elapsedMs >= 1000) {
    elapsedMs = 0;
    clock -= 1;
    if (clock <= 0) hurtPlayer();
  }

  player.vx = 0;
  if (keys.left) {
    player.vx = -player.speed;
    player.face = -1;
  }
  if (keys.right) {
    player.vx = player.speed;
    player.face = 1;
  }

  if (keys.jump && player.onGround) {
    player.vy = -player.jumpForce;
    player.jumpHoldMs = 0;
    player.onGround = false;
  }

  // Holding jump adds a brief upward boost for higher jumps.
  if (keys.jump && player.vy < 0 && player.jumpHoldMs < player.maxJumpHoldMs) {
    player.vy -= player.jumpBoost;
    player.jumpHoldMs += dt;
  }

  // Releasing jump early cuts upward speed for short hops.
  if (!keys.jump && player.vy < -4) {
    player.vy = -4;
    player.jumpHoldMs = player.maxJumpHoldMs;
  }

  player.x += player.vx;
  moveAndCollide(player, 'x');

  player.vy += GRAVITY;
  player.y += player.vy;
  player.onGround = false;
  moveAndCollide(player, 'y');

  const leftFootX = player.x + 3;
  const rightFootX = player.x + player.w - 3;
  const feetY = player.y + player.h;
  const leftVoidColumn = !hasAnySolidBelow(leftFootX, feetY + 2);
  const rightVoidColumn = !hasAnySolidBelow(rightFootX, feetY + 2);
  const inVoidColumn = leftVoidColumn && rightVoidColumn;
  const nearBottom = player.y + player.h >= world.height - TILE * 0.25;
  const noGroundBottom = !hasGroundAtWorldBottom(leftFootX) && !hasGroundAtWorldBottom(rightFootX);

  if (player.vy > 0 && nearBottom && (noGroundBottom || inVoidColumn)) {
    hurtPlayer(true);
    return;
  }

  if (player.y + player.h > world.height) {
    hurtPlayer(true);
    return;
  }

  for (const coin of world.coins) {
    if (!coin.taken && intersects(player, coin)) {
      coin.taken = true;
      coins += 1;
      score += 200;
    }
  }

  for (const mushroom of world.mushrooms) {
    // Mushroom pickup grants big form and bonus score.
    if (mushroom.taken) continue;
    if (intersects(player, mushroom)) {
      mushroom.taken = true;
      score += 500;
      growPlayer();
    }
  }

  for (let i = world.popCoins.length - 1; i >= 0; i -= 1) {
    const pop = world.popCoins[i];
    pop.lifeMs -= dt;
    pop.vy += GRAVITY * 0.52;
    pop.y += pop.vy;
    if (pop.lifeMs <= 0) {
      world.popCoins.splice(i, 1);
    }
  }

  for (let i = world.redShots.length - 1; i >= 0; i -= 1) {
    const shot = world.redShots[i];
    if (!shot.alive) {
      world.redShots.splice(i, 1);
      continue;
    }

    shot.vy += GRAVITY * 0.15;
    shot.x += shot.vx;
    shot.y += shot.vy;

    const shotBox = {
      x: shot.x - shot.r,
      y: shot.y - shot.r,
      w: shot.r * 2,
      h: shot.r * 2
    };

    if (world.solids.some((solid) => intersects(shotBox, solid))) {
      shot.alive = false;
      continue;
    }

    for (const enemy of world.enemies) {
      if (!enemy.alive || enemy.active === false) continue;
      if (enemy.type === 'piranha' && enemy.emergeOffset < 6) continue;
      if (!intersects(shotBox, enemy)) continue;
      enemy.alive = false;
      shot.alive = false;
      score += 250;
      break;
    }

    if (
      shot.x < world.cameraX - 140 ||
      shot.x > world.cameraX + canvas.width + 140 ||
      shot.y > world.height + 80 ||
      shot.y < -80
    ) {
      shot.alive = false;
    }
  }

  for (const solid of world.solids) {
    if (solid.kind !== 'question' || solid.bumpMs <= 0) continue;
    solid.bumpMs = Math.max(0, solid.bumpMs - dt);
  }

  for (const enemy of world.enemies) {
    if (!enemy.alive) continue;
    if (enemy.active === false) {
      enemy.spawnDelayMs -= dt;
      if (enemy.spawnDelayMs > 0) continue;
      enemy.active = true;
      if (typeof enemy.fromPipeX === 'number') enemy.x = enemy.fromPipeX;
      if (Math.abs(enemy.vx) < 0.01) enemy.vx = -3;
    }

    if (enemy.flying) {
      // Flying enemies hover vertically while patrolling horizontally.
      enemy.flyPhase += dt * 0.006;
      enemy.y = enemy.homeY + Math.sin(enemy.flyPhase) * 18;

      enemy.x += enemy.vx;
      for (const solid of world.solids) {
        if (!intersects(enemy, solid)) continue;
        if (enemy.vx > 0) enemy.x = solid.x - enemy.w;
        if (enemy.vx < 0) enemy.x = solid.x + solid.w;
        enemy.vx *= -1;
        break;
      }

      if (intersects(player, enemy)) {
        const stomp = player.vy > 0 && player.y + player.h - enemy.y < 22;
        if (stomp) {
          enemy.alive = false;
          player.vy = -8;
          score += 300;
        } else {
          damagePlayer();
        }
      }
      continue;
    }

    if (enemy.type === 'piranha') {
      // 1985-style behavior: do not emerge while player is near/on pipe.
      const pipe = enemy.pipe;
      const playerNearPipe = (
        player.x + player.w > pipe.x - TILE &&
        player.x < pipe.x + pipe.w + TILE
      );
      const playerOnPipeTop = (
        player.x + player.w > pipe.x &&
        player.x < pipe.x + pipe.w &&
        Math.abs((player.y + player.h) - pipe.y) < 8
      );
      const blocked = playerNearPipe || playerOnPipeTop;

      if (blocked) {
        enemy.emergeDir = -1;
      } else if (enemy.emergeHoldMs > 0) {
        enemy.emergeHoldMs -= dt;
      } else {
        enemy.emergeDir *= -1;
        enemy.emergeHoldMs = 900;
      }

      enemy.emergeOffset += enemy.emergeDir * dt * 0.04;
      enemy.emergeOffset = Math.max(0, Math.min(26, enemy.emergeOffset));
      enemy.x = pipe.x + pipe.w * 0.5 - enemy.w * 0.5;
      enemy.y = pipe.y + 2 - enemy.emergeOffset;

      if (enemy.emergeOffset > 8 && intersects(player, enemy)) {
        damagePlayer();
      }
      continue;
    }

    enemy.vy += GRAVITY * 0.9;

    enemy.x += enemy.vx;
    let hitWall = false;
    for (const solid of world.solids) {
      if (!intersects(enemy, solid)) continue;
      hitWall = true;
      if (enemy.vx > 0) enemy.x = solid.x - enemy.w;
      if (enemy.vx < 0) enemy.x = solid.x + solid.w;
      enemy.vx *= -1;
      break;
    }

    enemy.y += enemy.vy;
    enemy.onGround = false;
    for (const solid of world.solids) {
      if (!intersects(enemy, solid)) continue;
      if (enemy.vy > 0) {
        enemy.y = solid.y - enemy.h;
        enemy.onGround = true;
      } else if (enemy.vy < 0) {
        enemy.y = solid.y + solid.h;
      }
      enemy.vy = 0;
    }

    if (enemy.onGround && !hitWall && enemy.type !== 'koopa-green') {
      // Red/regular walkers turn around at platform edges; green koopas can fall off.
      const probeX = enemy.vx > 0 ? enemy.x + enemy.w + 2 : enemy.x - 2;
      const probe = { x: probeX, y: enemy.y + enemy.h + 1, w: 2, h: 2 };
      const hasFloorAhead = world.solids.some((s) => intersects(probe, s));
      if (!hasFloorAhead) enemy.vx *= -1;
    }

    if (enemy.y > world.height + 200) {
      enemy.alive = false;
      continue;
    }

    if (intersects(player, enemy)) {
      const stomp = player.vy > 0 && player.y + player.h - enemy.y < 22;
      if (stomp) {
        enemy.alive = false;
        player.vy = -8;
        score += 300;
      } else {
        damagePlayer();
      }
    }
  }

  if (world.skipPortal && !world.skipPortal.used && intersects(player, world.skipPortal)) {
    // Optional skip trigger teleports player to flag approach.
    world.skipPortal.used = true;
    if (world.flag) {
      player.x = world.flag.x + 2;
      player.y = world.flag.y + world.flag.h - player.h;
      player.vx = 0;
      player.vy = 0;
      world.cameraX = Math.max(0, Math.min(player.x - canvas.width * 0.3, world.width - canvas.width));
    }
  }

  if (world.flag && intersects(player, world.flag)) {
    // Route flow: phase 1 -> phase 2 -> phase 3 -> win.
    score += Math.max(0, clock) * 10;
    updateHud();
    if (routePhase === 1) {
      routePhase = 2;
      startReverseRun();
    } else if (routePhase === 2) {
      routePhase = 3;
      startReverseRun();
    } else {
      winLevel();
    }
  }

  const targetCam = player.x - canvas.width * 0.3;
  world.cameraX += (targetCam - world.cameraX) * 0.16;
  world.cameraX = Math.max(0, Math.min(world.cameraX, world.width - canvas.width));

  updateHud();
}

function drawBlock(solid) {
  const x = solid.x;
  const y = solid.y - (solid.bumpMs > 0 ? 6 : 0);
  const kind = solid.kind;

  if (routePhase === 3) {
    // Third route visual style: black fill with bright outlines.
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, solid.w, solid.h);
    ctx.strokeStyle = kind === 'question' ? '#facc15' : '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, solid.w - 2, solid.h - 2);
    return;
  }

  if (assetsReady) {
    if (kind === 'ground' && assets.ground) {
      drawImageFitted(assets.ground, x, y, TILE, TILE);
      return;
    }

    if (kind === 'brick' && assets.brick) {
      drawImageFitted(assets.brick, x, y, TILE, TILE);
      return;
    }

    if (kind === 'special' && assets.usedBlock) {
      drawImageFitted(assets.usedBlock, x, y, TILE, TILE);
      return;
    }

    if (kind === 'pipe1' && assets.pipe1) {
      drawImageFitted(assets.pipe1, x, y, solid.w, solid.h);
      return;
    }

    if (kind === 'pipe2' && assets.pipe2) {
      drawImageFitted(assets.pipe2, x, y, solid.w, solid.h);
      return;
    }

    if (kind === 'question' && assets.question) {
      if (solid.used && assets.usedBlock) {
        drawImageFitted(assets.usedBlock, x, y, TILE, TILE);
      } else {
        const framePulse = Math.floor(performance.now() / 180) % 2 === 0 ? 0 : 2;
        drawImageFitted(assets.question, x, y - framePulse, TILE, TILE);
      }
      return;
    }
  }

  if (kind === 'ground') {
    ctx.fillStyle = '#1f8f43';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#14532d';
    for (let i = 0; i < TILE; i += 8) {
      ctx.fillRect(x + i, y + TILE - 8, 4, 8);
    }
    return;
  }

  if (kind === 'question') {
    ctx.fillStyle = solid.used ? '#78716c' : '#f59e0b';
    ctx.fillRect(x, y, TILE, TILE);
    if (!solid.used) {
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(x + 16, y + 12, 16, 8);
      ctx.fillRect(x + 20, y + 24, 8, 8);
    }
    return;
  }

  if (kind === 'rgb') {
    if (solid.used) {
      ctx.fillStyle = '#52525b';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = '#a1a1aa';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
      return;
    }

    const grad = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
    grad.addColorStop(0, '#ef4444');
    grad.addColorStop(0.5, '#22c55e');
    grad.addColorStop(1, '#3b82f6');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x + 12, y + 12, 24, 5);
    ctx.fillRect(x + 12, y + 21, 24, 5);
    ctx.fillRect(x + 12, y + 30, 24, 5);
    return;
  }

  if (kind === 'special') {
    ctx.fillStyle = '#a8a29e';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = '#57534e';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
    return;
  }

  if (kind === 'pipe1' || kind === 'pipe2') {
    ctx.fillStyle = kind === 'pipe1' ? '#1d8a3a' : '#15703d';
    ctx.fillRect(x, y, solid.w, solid.h);
    ctx.strokeStyle = '#0f5132';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, solid.w - 4, solid.h - 4);
    return;
  }

  ctx.fillStyle = '#b45309';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = '#7c2d12';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
  ctx.beginPath();
  ctx.moveTo(x + 2, y + TILE / 2);
  ctx.lineTo(x + TILE - 2, y + TILE / 2);
  ctx.stroke();
}

function drawSpriteFrame(frame, x, y, pixelSize, flipX = false) {
  const rows = frame.length;
  const cols = frame[0].length;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const code = frame[row][col];
      if (code === '.') continue;

      const drawCol = flipX ? cols - 1 - col : col;
      const px = Math.round(x + drawCol * pixelSize);
      const py = Math.round(y + row * pixelSize);
      ctx.fillStyle = PALETTE[code] || '#ff00ff';
      ctx.fillRect(px, py, pixelSize, pixelSize);
    }
  }
}

function drawNumericSpriteFrame(frame, x, y, pixelSize, flipX = false) {
  const rows = frame.length;
  const cols = frame[0].length;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const code = frame[row][col];
      if (code === 0) continue;

      const drawCol = flipX ? cols - 1 - col : col;
      const px = x + drawCol * pixelSize;
      const py = y + row * pixelSize;
      ctx.fillStyle = PLAYER_NUMERIC_PALETTE[code] || '#ff00ff';
      ctx.fillRect(px, py, pixelSize, pixelSize);
    }
  }
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothStep(t) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

function getWeatherBlend(nowMs) {
  const phaseMs = nowMs % (WEATHER_CYCLE_MS * WEATHER_STATES.length);
  const fromIndex = Math.floor(phaseMs / WEATHER_CYCLE_MS) % WEATHER_STATES.length;
  const toIndex = (fromIndex + 1) % WEATHER_STATES.length;
  const stateElapsed = phaseMs % WEATHER_CYCLE_MS;
  const transitionStart = WEATHER_CYCLE_MS - WEATHER_TRANSITION_MS;

  let blend = 0;
  if (stateElapsed > transitionStart) {
    const transitionProgress = (stateElapsed - transitionStart) / WEATHER_TRANSITION_MS;
    blend = smoothStep(transitionProgress);
  }

  return {
    from: WEATHER_STATES[fromIndex],
    to: WEATHER_STATES[toIndex],
    blend
  };
}

function resolveWeatherIntensity(nowMs) {
  const blendInfo = getWeatherBlend(nowMs);
  const fromMeta = WEATHER_META[blendInfo.from];
  const toMeta = WEATHER_META[blendInfo.to];

  return {
    from: blendInfo.from,
    to: blendInfo.to,
    blend: blendInfo.blend,
    rain: lerp(fromMeta.rain, toMeta.rain, blendInfo.blend),
    fog: lerp(fromMeta.fog, toMeta.fog, blendInfo.blend),
    storm: lerp(fromMeta.storm, toMeta.storm, blendInfo.blend),
    tintFrom: fromMeta.tint,
    tintTo: toMeta.tint
  };
}

function drawWeatherVisuals(nowMs) {
  const t = nowMs * 0.001;
  const weather = resolveWeatherIntensity(nowMs);

  const tintAlpha = 0.05 + weather.fog * 0.12 + weather.storm * 0.1;
  if (tintAlpha > 0.01) {
    ctx.fillStyle = `rgba(30, 41, 59, ${tintAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const gust = Math.sin(t * 0.9) * 0.5 + Math.sin(t * 0.27 + 0.7) * 0.5;
  const rainIntensity = clamp01(weather.rain + weather.storm * 0.2);
  const dropCount = Math.floor(16 + rainIntensity * 78);
  if (dropCount > 0) {
    ctx.strokeStyle = `rgba(186, 230, 253, ${(0.18 + rainIntensity * 0.42).toFixed(3)})`;
    ctx.lineWidth = 1.5 + rainIntensity * 0.9;

    for (let i = 0; i < dropCount; i += 1) {
      const layer = i % 3;
      const speed = 250 + layer * 90 + rainIntensity * 220;
      const drift = (gust * 10) + (layer - 1) * 3;
      const x = (i * 29 + t * (120 + layer * 35)) % (canvas.width + 60) - 30;
      const y = (i * 17 + t * speed) % (canvas.height + 40) - 20;
      const len = 10 + rainIntensity * 14 + layer * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4 - drift, y + len);
      ctx.stroke();
    }
  }

  const fogIntensity = clamp01(weather.fog + weather.storm * 0.15);
  const fogBands = Math.floor(2 + fogIntensity * 7);
  if (fogBands > 0) {
    for (let i = 0; i < fogBands; i += 1) {
      const bandY = 26 + i * 54 + Math.sin(t * (0.35 + i * 0.06) + i * 0.9) * (10 + fogIntensity * 18);
      const bandH = 56 + fogIntensity * 32;
      const grad = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
      const alphaMid = 0.06 + fogIntensity * 0.26;
      grad.addColorStop(0, 'rgba(241,245,249,0)');
      grad.addColorStop(0.5, `rgba(241,245,249,${alphaMid.toFixed(3)})`);
      grad.addColorStop(1, 'rgba(241,245,249,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, bandY, canvas.width, bandH);
    }
  }

  const stormDarkness = clamp01(weather.storm);
  if (stormDarkness > 0.08) {
    ctx.fillStyle = `rgba(2, 6, 23, ${(stormDarkness * 0.24).toFixed(3)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const pulse = Math.sin(t * 8.2) * 0.5 + 0.5;
    const flashGate = pulse > 0.92 ? (pulse - 0.92) / 0.08 : 0;
    const flashAlpha = flashGate * stormDarkness * 0.45;
    if (flashAlpha > 0.02) {
      ctx.fillStyle = `rgba(248, 250, 252, ${flashAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  ctx.font = '11px "Press Start 2P", cursive';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.strokeStyle = 'rgba(17, 24, 39, 0.85)';
  ctx.lineWidth = 3;
  const stateLabel = weather.blend > 0.02
    ? `WEATHER: ${weather.from.toUpperCase()} > ${weather.to.toUpperCase()}`
    : `WEATHER: ${weather.from.toUpperCase()}`;
  ctx.strokeText(stateLabel, 12, 22);
  ctx.fillText(stateLabel, 12, 22);
}

function render() {
  // Draw order: background -> solids/decor -> pickups -> enemies -> flag/castle -> player.
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const nowMs = performance.now();

  if (routePhase === 3) {
    // Third route switches to high-contrast black scene.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (assetsReady && assets.forest) {
    drawImageFitted(assets.forest, 0, 0, canvas.width, canvas.height);
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, '#82cfff');
    sky.addColorStop(1, '#d7f0ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Parallax background sprites from ready_materials.
  if (routePhase !== 3 && assetsReady && !assets.forest) {
    const cam = world.cameraX;
    if (assets.cloud1) drawImageFitted(assets.cloud1, 120 + cam * 0.08, 60, 92, 44);
    if (assets.cloud2) drawImageFitted(assets.cloud2, 460 + cam * 0.08, 90, 120, 56);
    if (assets.cloud3) drawImageFitted(assets.cloud3, 820 + cam * 0.08, 50, 142, 60);

    if (assets.hill1) drawImageFitted(assets.hill1, 60 - cam * 0.16, canvas.height - 210, 186, 120);
    if (assets.hill2) drawImageFitted(assets.hill2, 520 - cam * 0.16, canvas.height - 240, 220, 140);
    if (assets.bush1) drawImageFitted(assets.bush1, 260 - cam * 0.28, canvas.height - 136, 124, 64);
    if (assets.bush2) drawImageFitted(assets.bush2, 760 - cam * 0.28, canvas.height - 148, 152, 72);
  }

  drawWeatherVisuals(nowMs);

  ctx.save();
  ctx.translate(-world.cameraX, 0);

  for (const solid of world.solids) {
    drawBlock(solid);
  }

  for (const deco of world.decorations) {
    if (deco.type === 'flowers' && assetsReady && assets.flowers) {
      drawImageFitted(assets.flowers, deco.x, deco.y, deco.w, deco.h);
    }
    if (deco.type === 'pipe1' && assetsReady && assets.pipe1) {
      drawImageFitted(assets.pipe1, deco.x, deco.y, deco.w, deco.h);
    }
    if (deco.type === 'pipe2' && assetsReady && assets.pipe2) {
      drawImageFitted(assets.pipe2, deco.x, deco.y, deco.w, deco.h);
    }
  }

  if (world.skipPortal && !world.skipPortal.used) {
    ctx.font = '12px "Press Start 2P", cursive';
    ctx.fillStyle = '#fff7cc';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3;
    const labelX = world.skipPortal.x - 8;
    const labelY = world.skipPortal.y - 8;
    ctx.strokeText('- "skip stage"', labelX, labelY);
    ctx.fillText('- "skip stage"', labelX, labelY);
  }

  for (const coin of world.coins) {
    if (coin.taken) continue;
    if (routePhase === 3) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(coin.x + 4, coin.y + 4, 14, 14);
      continue;
    }
    if (assetsReady && assets.coin) {
      const frame = Math.floor(performance.now() / 120) % 3;
      const scales = [0.75, 1, 0.6];
      const sw = 22 * scales[frame];
      const sx = coin.x + (24 - sw) * 0.5;
      drawImageFitted(assets.coin, sx, coin.y, sw, 24);
    } else {
      const coinFrameIdx = Math.floor(performance.now() / 110) % 3;
      const coinFrames = [SPRITES.coin.spin1, SPRITES.coin.spin2, SPRITES.coin.spin3];
      drawSpriteFrame(coinFrames[coinFrameIdx], coin.x, coin.y, 3);
    }
  }

  for (const mushroom of world.mushrooms) {
    if (mushroom.taken) continue;
    if (routePhase === 3) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(mushroom.x, mushroom.y, mushroom.w, mushroom.h);
      continue;
    }
    if (assetsReady && assets.mushroom) {
      drawImageFitted(assets.mushroom, mushroom.x, mushroom.y, mushroom.w, mushroom.h);
    } else {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(mushroom.x, mushroom.y + 8, mushroom.w, mushroom.h - 8);
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(mushroom.x + 2, mushroom.y, mushroom.w - 4, 12);
    }
  }

  for (const pop of world.popCoins) {
    if (assetsReady && assets.coin) {
      const frame = Math.floor(performance.now() / 100) % 3;
      const scales = [0.7, 1, 0.7];
      const sw = 22 * scales[frame];
      drawImageFitted(assets.coin, pop.x + (24 - sw) * 0.5, pop.y, sw, 24);
    } else {
      const coinFrames = [SPRITES.coin.spin1, SPRITES.coin.spin2, SPRITES.coin.spin3];
      const frame = Math.floor(performance.now() / 100) % 3;
      drawSpriteFrame(coinFrames[frame], pop.x, pop.y, 3);
    }
  }

  for (const enemy of world.enemies) {
    if (!enemy.alive || enemy.active === false) continue;
    if (routePhase === 3) {
      ctx.fillStyle = '#ff1f1f';
      ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
      continue;
    }

    if (enemy.type === 'piranha') {
      if (assetsReady && assets.flowers) {
        drawImageFitted(assets.flowers, enemy.x - 2, enemy.y - 2, enemy.w + 4, enemy.h + 4);
      } else {
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
        ctx.fillStyle = '#14532d';
        ctx.fillRect(enemy.x + 10, enemy.y + enemy.h - 8, 8, 8);
      }
      continue;
    }

    if (assetsReady && assets.enemy1 && assets.enemy2) {
      const stepFrame = Math.floor(performance.now() / 1000) % 2 === 0 ? assets.enemy1 : assets.enemy2;
      drawImageFitted(stepFrame, enemy.x - 6, enemy.y - 14, 44, 44, enemy.vx > 0);
    } else {
      const enemyFrame = Math.floor(performance.now() / 1000) % 2 === 0 ? SPRITES.enemy.walk1 : SPRITES.enemy.walk2;
      const enemyX = enemy.x - 4;
      const enemyY = enemy.y - 10;
      drawSpriteFrame(enemyFrame, enemyX, enemyY, 2, enemy.vx > 0);
    }
  }

  for (const shot of world.redShots) {
    if (!shot.alive) continue;
    if (shot.r >= 10) {
      ctx.fillStyle = 'rgba(254, 202, 202, 0.28)';
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, shot.r + 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (world.flag) {
    if (routePhase === 3) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.strokeRect(world.flag.x, world.flag.y, world.flag.w, world.flag.h);
    } else if (assetsReady && assets.flag) {
      drawImageFitted(assets.flag, world.flag.x, world.flag.y, world.flag.w, world.flag.h);
    } else {
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(world.flag.x, world.flag.y, Math.max(5, Math.round(world.flag.w * 0.18)), world.flag.h);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(
        world.flag.x + Math.round(world.flag.w * 0.18),
        world.flag.y + Math.round(world.flag.h * 0.08),
        Math.round(world.flag.w * 0.52),
        Math.round(world.flag.h * 0.12)
      );
    }
  }

  if (world.castle && routePhase === 3) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(world.castle.x, world.castle.y, world.castle.w, world.castle.h);
  } else if (world.castle && assetsReady && assets.castle) {
    drawImageFitted(assets.castle, world.castle.x, world.castle.y, world.castle.w, world.castle.h);
  }

  const blinking = performance.now() < player.invulnUntil && Math.floor(performance.now() / 80) % 2 === 0;
  if (!blinking) {
    if (routePhase === 3) {
      // Player becomes RGB silhouette in route 3.
      const bodyX = player.x + 2;
      const bodyY = player.y + (player.isBig ? -2 : 2);
      const bodyW = player.w - 4;
      const bodyH = player.h - 2;

      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ff2d2d';
      ctx.fillRect(bodyX - 2, bodyY, bodyW, bodyH);
      ctx.fillStyle = '#32ff7e';
      ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
      ctx.fillStyle = '#2da1ff';
      ctx.fillRect(bodyX + 2, bodyY, bodyW, bodyH);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(bodyX, bodyY, bodyW, bodyH);
    } else {
      const moving = player.onGround && Math.abs(player.vx) > 0.2;
      const useImageSprites = assetsReady && assets.marioRight && assets.marioLeft && assets.jumpRight && assets.jumpLeft;

      if (useImageSprites) {
        // Use provided sprite sheets; walking is a generated 2-frame bob/stride cycle.
        const walkFrame = Math.floor(performance.now() / 140) % 2;
        const isLeft = player.face < 0;
        const jumpImg = isLeft ? assets.jumpLeft : assets.jumpRight;
        const idleImg = isLeft ? assets.marioLeft : assets.marioRight;
        const spriteImg = player.onGround ? idleImg : jumpImg;

        const walkBob = moving ? (walkFrame === 0 ? 0 : 1.4) : 0;
        const walkStride = moving ? (walkFrame === 0 ? -1 : 1) : 0;
        const drawW = player.isBig ? 46 : 40;
        const drawH = (player.isBig ? 62 : 46) - (moving && walkFrame === 1 ? 1 : 0);
        const yOffset = player.isBig ? -4 : -2;

        drawImageFitted(spriteImg, player.x - 3 + walkStride, player.y + yOffset + walkBob, drawW, drawH);
      } else {
        const spriteSize = player.isBig ? 2.6 : 2.25;
        const bob = moving ? Math.sin(performance.now() / 90) * 0.8 : 0;
        const yOffset = player.isBig ? -6 : 0;
        drawNumericSpriteFrame(PLAYER_NUMERIC_SPRITE, player.x - 1, player.y + yOffset + bob, spriteSize, player.face < 0);
      }
    }
  }

  ctx.restore();
}

let last = 0;
function loop(ts) {
  const dt = Math.min(34, ts - last);
  last = ts;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function setKeyState(code, isDown) {
  if (code === 'ArrowLeft' || code === 'KeyA') keys.left = isDown;
  if (code === 'ArrowRight' || code === 'KeyD') keys.right = isDown;
  if (code === 'ArrowUp' || code === 'KeyW') keys.jump = isDown;
  if (code === 'KeyT') keys.fire = isDown;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyT') {
    keys.fire = true;
    shootRedProjectile();
  }

  setKeyState(e.code, true);
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyT'].includes(e.code)) {
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyT') {
    keys.fire = false;
  }
  setKeyState(e.code, false);
});

function bindTouch(button, onDown, onUp) {
  button.addEventListener('touchstart', (e) => {
    e.preventDefault();
    onDown();
  }, { passive: false });
  button.addEventListener('touchend', (e) => {
    e.preventDefault();
    onUp();
  });
  button.addEventListener('mousedown', onDown);
  button.addEventListener('mouseup', onUp);
  button.addEventListener('mouseleave', onUp);
}

bindTouch(leftBtn, () => { keys.left = true; }, () => { keys.left = false; });
bindTouch(rightBtn, () => { keys.right = true; }, () => { keys.right = false; });
bindTouch(jumpBtn, () => { keys.jump = true; }, () => { keys.jump = false; });

function startGame() {
  overlay.style.display = 'none';
  lives = 3;
  routePhase = 1;
  reverseMode = false;
  player.jumpHoldMs = 0;
  resetRun();
  running = true;
}

startBtn.addEventListener('click', startGame);

resetRun();
loadAssets().finally(() => {
  requestAnimationFrame(loop);
});
