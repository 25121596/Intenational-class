import {
  TOWER_DEFS, BLOCKER_DEFS, ENEMY_PROTO, PATH_NAMES, LEVELS, CAMPAIGNS,
  ENDLESS_LEVEL, generateEndlessWave,
} from './config.js';
import {
  computePathLengths, getPositionOnPath, findNearestPathPoint, findNearestFreeSlot,
  spawnParticles, updateParticles, generateTrees, generateRoadStones,
  spawnEnemy, buildSpawnQueue, getEnemyMoveAmount,
  generateClouds, updateClouds, generateBirds, updateBirds,
} from './helpers.js';
import { playShoot, playExplosion, playDeath, playWaveStart, playPerfect, playUpgrade } from './audio.js';

// 飞行单位在绘制时抬高 28px，命中判定统一对齐
const FLY_Y_OFFSET = 28;

// ---- 升级系统 ----
const MAX_UPGRADE = 3;

export function getUpgradeCost(unitType, isTower) {
  const def = isTower ? TOWER_DEFS[unitType] : BLOCKER_DEFS[unitType];
  if (!def) return 999;
  return Math.floor(def.cost * 1.3);
}

function applyUpgradeStats(unit, def, level) {
  // 伤害 +25%/级, HP上限 +10%/级
  unit.damage = Math.floor(def.damage * (1 + 0.25 * level));
  unit.maxHp = Math.floor(def.hp * (1 + 0.10 * level));
  // 立即回复50%最大血量
  unit.hp = Math.min(unit.maxHp, unit.hp + Math.floor(unit.maxHp * 0.5));
  // 射程 +5%/级 (塔), 溅射 +8%/级 (步兵炮), 攻速 +5%/级 (阻挡)
  if (unit.isSplash !== undefined) {
    // Tower
    if (unit.isSplash) {
      unit.splashRadius = Math.floor(def.splashRadius * (1 + 0.08 * level));
    } else {
      unit.range = Math.floor(def.range * (1 + 0.05 * level));
    }
  } else {
    // Blocker — reduce attack interval = faster attacks
    unit.attackInterval = Math.floor(def.attackInterval * (1 - 0.05 * level));
  }
}

// ---- 游戏状态 ----
export function createGameState() {
  return {
    levelIndex: 0, level: null, pathLengths: [], slots: [],
    wave: 1, hp: 20, gold: 200, kills: 0,
    enemies: [], towers: [], blockers: [], projectiles: [], enemyProjectiles: [],
    particles: [], deployments: [], damageNumbers: [],
    spawnCount: 0, spawnMax: 0, spawnTimer: 0, spawnQueue: [], spawnInterval: 60,
    frame: 0,
    isWaveActive: false, waveComplete: false, levelComplete: false,
    gameOver: false, gameWin: false,
    selectedType: 'infantry', sellMode: false, upgradeMode: false,
    slotMenuOpen: false, selectedSlot: null, slotMenuOptions: [],
    announcement: null, announcementTimer: 0,
    mouseX: -100, mouseY: -100,
    bossEnemy: null,
    waveAutoTimer: -1, waveAutoTotal: 0,
    paused: false, menuOpen: true,
    trees: [], roadStones: [],
    clouds: [], birds: [],
    activeCampaign: null,
    difficulty: 'private',
    endless: false,
    airstrikeCd: 0, airstrikeMax: 900, airstrikeArming: false,
    airstrikeDmg: 55, airstrikeRadius: 120,
    levelStars: 0, isPerfectClear: false,
    goldTickTimer: 0,
    towersPlaced: 0, blockersPlaced: 0, unitsLost: 0, goldEarned: 0,
    shakeX: 0, shakeY: 0, shakeTimer: 0, shakeIntensity: 0, shakeMax: 0,
  };
}

// ---- 屏幕震动 ----
export function triggerShake(game, intensity, duration) {
  game.shakeIntensity = Math.max(game.shakeIntensity, intensity);
  game.shakeTimer = Math.max(game.shakeTimer, duration);
  game.shakeMax = Math.max(game.shakeMax, duration);
}

/** 计算星级：>=18血=3星, 6-17=2星, 1-5=1星 */
export function calculateStars(hp, startHp) {
  if (hp >= 18) return 3;
  if (hp >= 6) return 2;
  if (hp >= 1) return 1;
  return 0;
}

// ---- 关卡管理 ----
export function loadLevel(game, index) {
  if (index === 'endless') {
    game.levelIndex = -1;
    game.level = ENDLESS_LEVEL;
    game.endless = true;
  } else {
    game.levelIndex = index;
    game.level = LEVELS[index];
    game.endless = false;
  }
  game.activeCampaign = game.level.campaignId || null;
  game.pathLengths = computePathLengths(game.level.paths);
  game.slots = game.level.towerSlots.map(s => ({ x: s.x, y: s.y, occupied: false, tower: null }));
  game.trees = generateTrees(game.level, 900, 600);
  game.roadStones = generateRoadStones(game.level.paths);
  game.clouds = generateClouds(900, 600);
  game.birds = generateBirds(900, 600);
  game.hp = game.level.startHp;
  game.gold = game.level.startGold;
  game.wave = 1; game.kills = 0;
  game.enemies = []; game.towers = []; game.blockers = [];
  game.projectiles = []; game.enemyProjectiles = []; game.particles = []; game.deployments = [];
  game.spawnCount = 0; game.spawnMax = 0; game.spawnTimer = 0; game.spawnQueue = [];
  game.damageNumbers = [];
  game.slotMenuOpen = false; game.slotMenuOptions = []; game.selectedSlot = null;
  game.isWaveActive = false; game.waveComplete = false; game.levelComplete = false;
  game.gameOver = false; game.gameWin = false;
  game.bossEnemy = null;
  game.waveAutoTimer = -1; game.waveAutoTotal = 0;
  game.announcement = `${game.level.name} — ${game.level.desc}`;
  game.announcementTimer = 130;
  game.goldTickTimer = 0;
  game.towersPlaced = 0; game.blockersPlaced = 0; game.unitsLost = 0; game.goldEarned = 0;
  game.menuOpen = false;
  game.paused = false;
  game.airstrikeArming = false; game.airstrikeCd = 0;
  game.shakeX = 0; game.shakeY = 0; game.shakeTimer = 0; game.shakeIntensity = 0; game.shakeMax = 0;
  game.selectedType = game.level.availableTowers.includes('infantry') ? 'infantry' : game.level.availableTowers[0];
}

export function startWave(game) {
  if (game.isWaveActive || game.gameOver || game.gameWin || game.levelComplete) return;
  const cfg = game.endless ? generateEndlessWave(game.wave) : game.level.waves[game.wave - 1];
  game.spawnMax = cfg.enemies.reduce((s, e) => s + e.c, 0);
  game.spawnInterval = cfg.spawnInterval;
  game.spawnCount = 0;
  game.spawnTimer = 15;
  game.spawnQueue = buildSpawnQueue(game, cfg);
  game.isWaveActive = true;
  game.waveComplete = false;
  game.waveAutoTimer = -1; game.waveAutoTotal = 0;
  const pathStr = cfg.availablePaths.map(p => PATH_NAMES[p]).join('/');
  game.announcement = `⚔️ 第${game.wave}波: ${cfg.name}  [路线 ${pathStr}]`;
  game.announcementTimer = 100;
  playWaveStart();
}

export function completeWave(game) {
  game.isWaveActive = false;
  game.waveComplete = true;
  game.enemyProjectiles = [];
  const bonus = 30 + game.wave * 12;
  game.gold += bonus;
  game.goldEarned += bonus;
  spawnParticles(game, 450, 300, 36, '#ffd93d', [1, 4], [18, 35]);

  if (game.endless) {
    game.wave++;
    game.waveAutoTimer = 540;
    game.waveAutoTotal = 0;
    game.announcement = `✅ 第${game.wave - 1}波清剿! +${bonus}💰 准备下一波`;
    game.announcementTimer = 100;
    return;
  }

  if (game.wave >= game.level.waves.length) {
    // 计算星级
    game.levelStars = calculateStars(game.hp, game.level.startHp);
    game.isPerfectClear = (game.hp === game.level.startHp);

    if (game.levelIndex >= LEVELS.length - 1) {
      game.gameWin = true;
      game.levelComplete = true;
      game.waveAutoTimer = -1;
      const perfectMsg = game.isPerfectClear ? '\n⭐ 完美作战！' : '';
      game.announcement = `🏆 钢铁之心！帝国覆灭！${perfectMsg}`;
      game.announcementTimer = 9999;
      spawnParticles(game, 450, 300, 90, '#ffd93d', [2, 7], [25, 50]);
      spawnParticles(game, 450, 300, 50, '#ff6b6b', [1, 5], [20, 40]);
    } else {
      game.levelComplete = true;
      game.waveAutoTimer = -1;
      const starsStr = '⭐'.repeat(game.levelStars);
      if (game.isPerfectClear) {
        playPerfect();
        game.announcement = `⭐ 完美作战！本关完成! +${bonus}💰\n点击"下一关"继续`;
      } else {
        game.announcement = `${starsStr} 本关完成! +${bonus}💰 点击"下一关"继续`;
      }
      game.announcementTimer = 200;
    }
  } else {
    game.wave++;
    game.waveAutoTimer = 540;
    game.waveAutoTotal = 540;
    game.announcement = `✅ 第${game.wave - 1}波完成! +${bonus}💰`;
    game.announcementTimer = 100;
  }
}

// ---- 部署系统 ----
function getDeployTime() { return 48 + Math.floor(Math.random() * 13); } // 48-60 frames ≈ 0.8-1.0s

export function placeTower(game, mx, my) {
  if (game.gameOver) return;
  const x = mx, y = my;
  const slot = findNearestFreeSlot(x, y, 34, game);
  if (!slot) { game.announcement = '只能建在空闲炮位上！'; game.announcementTimer = 60; return; }
  // check not already deploying on this slot
  for (const d of game.deployments) { if (d.slotX === slot.x && d.slotY === slot.y) return; }
  const def = TOWER_DEFS[game.selectedType];
  if (game.gold < def.cost) return;
  game.gold -= def.cost;
  const deployTime = getDeployTime();
  game.deployments.push({
    x: slot.x, y: slot.y, isTower: true, type: game.selectedType,
    timer: deployTime, maxTimer: deployTime,
    slotX: slot.x, slotY: slot.y,
  });
  spawnParticles(game, slot.x, slot.y, 8, '#ffffff', [0.3, 1.5], [6, 12]);
  game.announcement = '⏳ 部署中...';
  game.announcementTimer = 30;
}

export function placeBlocker(game, mx, my) {
  if (game.gameOver) return;
  const x = mx, y = my;
  const nearest = findNearestPathPoint(x, y, game);
  if (nearest.dist > 35) { game.announcement = '阻挡单位需部署在路径上！'; game.announcementTimer = 60; return; }
  for (const b of game.blockers) {
    if (b.pathIndex === nearest.pathIndex && Math.abs(b.pathProgress - nearest.progress) < 0.025) return;
    if (Math.hypot(b.x - nearest.x, b.y - nearest.y) < 25) return;
  }
  for (const t of game.towers) { if (Math.hypot(t.x - nearest.x, t.y - nearest.y) < 28) return; }
  for (const d of game.deployments) { if (Math.hypot(d.x - nearest.x, d.y - nearest.y) < 25) return; }
  const def = BLOCKER_DEFS[game.selectedType];
  if (game.gold < def.cost) return;
  game.gold -= def.cost;
  const deployTime = getDeployTime();
  game.deployments.push({
    x: nearest.x, y: nearest.y, isTower: false, type: game.selectedType,
    timer: deployTime, maxTimer: deployTime,
    pathIndex: nearest.pathIndex, pathProgress: nearest.progress,
  });
  spawnParticles(game, nearest.x, nearest.y, 8, '#7bed9f', [0.3, 1.5], [6, 12]);
  game.announcement = '⏳ 部署中...';
  game.announcementTimer = 30;
}

function finalizeTowerDeployment(game, dep) {
  const slot = game.slots.find(s => s.x === dep.slotX && s.y === dep.slotY);
  if (!slot || slot.occupied) return;
  const def = TOWER_DEFS[dep.type];
  const tower = {
    x: slot.x, y: slot.y, type: dep.type, cooldown: 0,
    range: def.range, damage: def.damage, color: def.color,
    bulletColor: def.bulletColor, bulletSpeed: def.bulletSpeed, size: def.size,
    isSplash: def.isSplash, splashRadius: def.splashRadius, splashDamagePct: def.splashDamagePct,
    canTargetFlying: def.canTargetFlying || false,
    cooldownMax: def.cooldown, hp: def.hp, maxHp: def.hp, flashTimer: 0, isDead: false,
    upgradeLevel: 0, angle: 0, buildAnim: 18,
  };
  game.towers.push(tower);
  slot.occupied = true; slot.tower = tower;
  game.towersPlaced++;
  spawnParticles(game, slot.x, slot.y, 16, '#ffffff', [0.8, 3], [10, 20]);
  game.announcement = '✅ 部署完成！';
  game.announcementTimer = 40;
}

// ---- 击杀辅助（统一死亡动画） ----
function killEnemy(game, e) {
  if (e.isDead || e.dyingTimer > 0) return;
  e.dyingTimer = 24; // 0.4s 死亡动画
  e.isDead = true;    // 标记死亡但不立即 splice
  game.gold += e.reward;
  game.goldEarned += e.reward;
  game.kills++;
  playDeath();
  const ep = getPositionOnPath(e.progress, e.pathIndex, game);
  spawnDamageNumber(game, ep.x, ep.y, `+${e.reward}💰`, '#ffd700');
  spawnParticles(game, ep.x, ep.y, 14, '#ffcc44', [1.5, 4], [10, 22]);
}

// ---- 伤害数字 ----
function spawnDamageNumber(game, x, y, text, color) {
  game.damageNumbers.push({
    x: x + (Math.random() - 0.5) * 16,
    y: y - 8 - Math.random() * 12,
    text, color,
    life: 45, maxLife: 45,
    vy: -1.2 - Math.random() * 0.8,
  });
}

function updateDamageNumbers(game) {
  for (let i = game.damageNumbers.length - 1; i >= 0; i--) {
    const dn = game.damageNumbers[i];
    dn.y += dn.vy;
    dn.life--;
    if (dn.life <= 0) game.damageNumbers.splice(i, 1);
  }
}

function finalizeBlockerDeployment(game, dep) {
  const def = BLOCKER_DEFS[dep.type];
  game.blockers.push({
    x: dep.x, y: dep.y, pathIndex: dep.pathIndex, pathProgress: dep.pathProgress,
    type: dep.type, hp: def.hp, maxHp: def.hp, damage: def.damage,
    attackInterval: def.attackInterval, attackCooldown: 0,
    blockCount: def.blockCount, size: def.size, color: def.color,
    isDead: false, flashTimer: 0, upgradeLevel: 0, buildAnim: 18,
    rCooldown: def.rng ? def.rInterval : 0,
  });
  game.blockersPlaced++;
  spawnParticles(game, dep.x, dep.y, 16, '#7bed9f', [0.8, 3], [10, 22]);
  game.announcement = '✅ 部署完成！';
  game.announcementTimer = 40;
}

export function sellUnit(game, mx, my) {
  const x = mx, y = my;
  // check for deployments in progress to cancel
  for (let i = game.deployments.length - 1; i >= 0; i--) {
    const d = game.deployments[i];
    if (d.isTower && Math.hypot(d.x - x, d.y - y) < 22) {
      game.gold += Math.floor((d.isTower ? TOWER_DEFS[d.type].cost : BLOCKER_DEFS[d.type].cost) * 0.6);
      spawnParticles(game, d.x, d.y, 12, '#ffd93d', [1, 3], [8, 16]);
      game.deployments.splice(i, 1);
      game.announcement = '🚫 部署已取消，返还60%';
      game.announcementTimer = 50;
      return true;
    }
  }
  for (let i = game.towers.length - 1; i >= 0; i--) {
    const t = game.towers[i];
    if (Math.hypot(t.x - x, t.y - y) < t.size + 6) {
      game.gold += Math.floor(TOWER_DEFS[t.type].cost * 0.6);
      spawnParticles(game, t.x, t.y, 16, '#ffd93d', [1, 3.5], [10, 22]);
      for (const s of game.slots) { if (s.tower === t) { s.occupied = false; s.tower = null; } }
      game.towers.splice(i, 1);
      return true;
    }
  }
  for (let i = game.blockers.length - 1; i >= 0; i--) {
    const b = game.blockers[i];
    if (Math.hypot(b.x - x, b.y - y) < b.size + 6) {
      for (const e of game.enemies) { if (e.blockingUnit === b) { e.blocked = false; e.blockingUnit = null; } }
      game.gold += Math.floor(BLOCKER_DEFS[b.type].cost * 0.6);
      spawnParticles(game, b.x, b.y, 16, '#ffd93d', [1, 3.5], [10, 22]);
      game.blockers.splice(i, 1);
      return true;
    }
  }
  return false;
}

// ---- 升级系统 ----
export function startUpgrade(game, unit, isTower) {
  if (!unit || unit.isDead || unit.upgradeLevel >= MAX_UPGRADE) return false;
  const cost = getUpgradeCost(unit.type, isTower);
  if (game.gold < cost) { game.announcement = '💰 金币不足！'; game.announcementTimer = 40; return false; }
  game.gold -= cost;
  const deployTime = 36; // 0.6s at 60fps
  game.deployments.push({
    x: unit.x, y: unit.y, isUpgrade: true, isTower,
    type: unit.type, timer: deployTime, maxTimer: deployTime,
    targetUnit: unit,
  });
  spawnParticles(game, unit.x, unit.y, 8, '#ffd700', [0.5, 2], [6, 14]);
  game.announcement = '⬆️ 升级中...';
  game.announcementTimer = 30;
  return true;
}

function finalizeUpgrade(game, dep) {
  const unit = dep.targetUnit;
  if (!unit || unit.isDead) return;
  const def = dep.isTower ? TOWER_DEFS[dep.type] : BLOCKER_DEFS[dep.type];
  unit.upgradeLevel = (unit.upgradeLevel || 0) + 1;
  applyUpgradeStats(unit, def, unit.upgradeLevel);
  playUpgrade();
  spawnParticles(game, unit.x, unit.y, 22, '#ffd700', [1.5, 5], [12, 28]);
  const lvlStr = '⭐'.repeat(unit.upgradeLevel);
  game.announcement = `⬆️ 升级完成！${lvlStr} Lv.${unit.upgradeLevel + 1}`;
  game.announcementTimer = 50;
}

// ---- 空袭技能 ----
export function armAirstrike(game) {
  if (game.gameOver || game.gameWin || game.levelComplete || game.menuOpen || game.paused) return false;
  if (game.airstrikeCd > 0 || game.airstrikeArming) return false;
  game.airstrikeArming = true;
  return true;
}

export function triggerAirstrike(game, x, y) {
  game.airstrikeArming = false;
  let hit = 0;
  for (const e of game.enemies) {
    if (e.isDead) continue;
    const ep = getPositionOnPath(e.progress, e.pathIndex, game);
    if (Math.hypot(ep.x - x, ep.y - y) <= game.airstrikeRadius) {
      e.hp -= game.airstrikeDmg; hit++;
      if (e.hp <= 0 && !e.isDead) { killEnemy(game, e); }
    }
  }
  game.airstrikeCd = game.airstrikeMax;
  triggerShake(game, 10, 25);
  spawnParticles(game, x, y, 40, '#ffaa44', [2, 6], [12, 30]);
  spawnParticles(game, x, y, 20, '#ff6633', [1, 4], [8, 20]);
  playExplosion();
  game.announcement = `🛩️ 空袭覆盖！命中 ${hit} 个目标`;
  game.announcementTimer = 80;
}

// ---- 主更新循环 ----
export function update(game) {
  if (game.gameOver) return;
  game.frame++;
  if (game.announcementTimer > 0) {
    game.announcementTimer--;
    if (game.announcementTimer <= 0) game.announcement = null;
  }

  // 被动金币收入（波次间隙每秒+1）
  if (!game.isWaveActive && !game.gameOver && !game.gameWin && !game.levelComplete) {
    game.goldTickTimer++;
    if (game.goldTickTimer >= 60) {
      game.goldTickTimer = 0;
      game.gold += 1;
      game.goldEarned += 1;
    }
  }

  // 伤害数字更新
  updateDamageNumbers(game);

  // 部署进度
  for (let i = game.deployments.length - 1; i >= 0; i--) {
    const d = game.deployments[i];
    d.timer--;
    if (d.timer <= 0) {
      if (d.isUpgrade) finalizeUpgrade(game, d);
      else if (d.isTower) finalizeTowerDeployment(game, d);
      else finalizeBlockerDeployment(game, d);
      game.deployments.splice(i, 1);
    }
  }

  // 自动波次倒计时
  if (game.waveAutoTimer > 0 && !game.isWaveActive && !game.gameOver && !game.gameWin && !game.levelComplete) {
    game.waveAutoTimer--;
    if (game.waveAutoTimer <= 0) {
      game.waveAutoTimer = -1;
      startWave(game);
    }
  }

  // Boss检查 + 鼠式技能
  if (game.bossEnemy && game.bossEnemy.isDead) {
    game.bossEnemy = null;
    if (game.wave === game.level.waves.length && game.levelIndex === LEVELS.length - 1) {
      game.announcement = '💥 鼠式坦克被击毁！胜利在望！';
      game.announcementTimer = 120;
      spawnParticles(game, 450, 100, 60, '#ffaa00', [3, 8], [20, 45]);
    }
  }
  if (game.bossEnemy && !game.bossEnemy.isDead) {
    game.bossEnemy.skillCooldown--;
    if (game.bossEnemy.skillCooldown <= 0) {
      game.bossEnemy.skillCooldown = game.bossEnemy.skillInterval;
      const cfg = game.endless ? generateEndlessWave(game.wave) : game.level.waves[game.wave - 1];
      for (let k = 0; k < 2; k++) {
        const pi = cfg.availablePaths[Math.floor(Math.random() * cfg.availablePaths.length)];
        const proto = ENEMY_PROTO['tank'];
        const buffed = { ...proto, hp: Math.floor(proto.hp * 1.4), speed: proto.speed * 1.25, reward: proto.reward + 10 };
        const e = spawnEnemy(game, buffed, pi);
        e.speed = buffed.speed; // 仅覆盖速度，HP由spawnEnemy统一处理（含难度加成）
      }
      game.announcement = '🐭 鼠式召唤增援！+2强化坦克';
      game.announcementTimer = 90;
      triggerShake(game, 6, 20);
      const bossPos = getPositionOnPath(game.bossEnemy.progress, game.bossEnemy.pathIndex, game);
      spawnParticles(game, bossPos.x, bossPos.y, 30, '#ff3300', [2, 6], [12, 28]);
    }
  }

  // 生成敌人
  if (game.isWaveActive && game.spawnQueue.length > 0) {
    game.spawnTimer--;
    if (game.spawnTimer <= 0) {
      const def = game.spawnQueue.shift();
      const cfg = game.endless ? generateEndlessWave(game.wave) : game.level.waves[game.wave - 1];
      const pathIdx = cfg.availablePaths[Math.floor(Math.random() * cfg.availablePaths.length)];
      spawnEnemy(game, def, pathIdx);
      if (def.type === 'maus') { game.announcement = '🐭 鼠式坦克 正在逼近！'; game.announcementTimer = 150; triggerShake(game, 8, 30); }
      game.spawnCount++;
      game.spawnTimer = Math.floor(Math.max(8, game.spawnInterval - Math.floor(game.spawnCount / 5)));
    }
  }
  const aliveEnemies = game.enemies.filter(e => !e.isDead || e.dyingTimer > 0).length;
  if (game.isWaveActive && game.spawnQueue.length === 0 && aliveEnemies === 0 && game.spawnCount >= game.spawnMax) {
    completeWave(game);
  }

  // 敌人死亡动画计时
  for (const e of game.enemies) {
    if (e.dyingTimer > 0) e.dyingTimer--;
  }

  // 敌人移动 + 远程攻击
  for (let i = game.enemies.length - 1; i >= 0; i--) {
    const e = game.enemies[i];
    if (e.dyingTimer > 0) continue; // 死亡动画中，跳过逻辑

    // 坦克远程攻击
    if (e.ranged && e.rCooldown <= 0) {
      let bestTarget = null, bestDist = Infinity;
      const ePos = getPositionOnPath(e.progress, e.pathIndex, game);
      for (const b of game.blockers) {
        if (b.isDead) continue;
        const d = Math.hypot(b.x - ePos.x, b.y - ePos.y);
        if (d < e.rRange && d < bestDist) { bestDist = d; bestTarget = { type: 'blocker', unit: b, x: b.x, y: b.y }; }
      }
      if (!bestTarget) {
        for (const t of game.towers) {
          if (t.isDead) continue;
          const d = Math.hypot(t.x - ePos.x, t.y - ePos.y);
          if (d < e.rRange && d < bestDist) { bestDist = d; bestTarget = { type: 'tower', unit: t, x: t.x, y: t.y }; }
        }
      }
      if (bestTarget) {
        game.enemyProjectiles.push({
          x: ePos.x, y: ePos.y, px: ePos.x, py: ePos.y,
          targetX: bestTarget.x, targetY: bestTarget.y,
          targetType: bestTarget.type, targetUnit: bestTarget.unit,
          speed: e.rSpeed, damage: e.rDmg, color: e.rColor, size: e.rSize,
        });
        e.rCooldown = e.rInterval;
        spawnParticles(game, ePos.x, ePos.y, 4, e.rColor, [1, 3], [4, 8]);
      }
    }
    if (e.rCooldown > 0) e.rCooldown--;

    // 移动/被阻挡
    if (e.blocked) {
      if (e.blockingUnit && !e.blockingUnit.isDead) {
        e.atkCooldown--;
        if (e.atkCooldown <= 0) {
          e.blockingUnit.hp -= e.atkDmg;
          e.blockingUnit.flashTimer = 8;
          e.atkCooldown = e.atkInterval;
          spawnParticles(game, e.blockingUnit.x, e.blockingUnit.y - 5, 3, '#ff6644', [0.5, 2], [4, 10]);
          if (e.blockingUnit.hp <= 0) {
            e.blockingUnit.isDead = true;
            for (const e2 of game.enemies) { if (e2.blockingUnit === e.blockingUnit) { e2.blocked = false; e2.blockingUnit = null; } }
          }
        }
      } else { e.blocked = false; e.blockingUnit = null; }
    } else {
      const moveAmount = getEnemyMoveAmount(e, game);
      const oldProgress = e.progress;
      e.progress += moveAmount;
      if (!e.flying) {
        for (const b of game.blockers) {
          if (b.isDead || b.pathIndex !== e.pathIndex) continue;
          if (oldProgress < b.pathProgress && e.progress >= b.pathProgress) {
            let blockedCount = 0;
            for (const e2 of game.enemies) { if (e2.blockingUnit === b && !e2.isDead) blockedCount++; }
            if (blockedCount < b.blockCount) {
              e.progress = b.pathProgress;
              e.blocked = true; e.blockingUnit = b;
              e.atkCooldown = Math.floor(e.atkInterval * 0.5);
              break;
            }
          }
        }
      }
      if (e.progress >= 1) {
        const dmg = Math.max(1, Math.floor(e.maxHp / 28));
        game.hp -= dmg;
        game.enemies.splice(i, 1);
        const endP = game.level.paths[e.pathIndex][game.level.paths[e.pathIndex].length - 1];
        spawnParticles(game, endP.x - 10, endP.y, 10, '#ff4444', [1, 3], [10, 20]);
        if (game.hp <= 0) {
          game.hp = 0; game.gameOver = true; game.isWaveActive = false; game.waveAutoTimer = -1;
          game.announcement = '💀 防线崩溃! 点击画布重新开始';
          game.announcementTimer = 9999;
          return;
        }
      }
    }
  }

  // 医疗兵治疗光环
  for (const e of game.enemies) {
    if (e.isDead || !e.healer) continue;
    if (e.healCooldown > 0) { e.healCooldown--; continue; }
    const ep = getPositionOnPath(e.progress, e.pathIndex, game);
    let healed = false;
    for (const o of game.enemies) {
      if (o.isDead || o === e) continue;
      const op = getPositionOnPath(o.progress, o.pathIndex, game);
      if (Math.hypot(op.x - ep.x, op.y - ep.y) <= e.healRange && o.hp < o.maxHp) {
        o.hp = Math.min(o.maxHp, o.hp + e.healAmount); healed = true;
      }
    }
    if (healed) {
      e.healCooldown = e.healInterval;
      spawnParticles(game, ep.x, ep.y - 14, 6, '#7CFC00', [0.5, 2], [8, 16]);
    }
  }

  // 空袭冷却
  if (game.airstrikeCd > 0) game.airstrikeCd--;

  // 地形装饰更新
  if (!game.menuOpen) { updateClouds(game.clouds, 900); updateBirds(game.birds, 900, 600); }

  // 敌方炮弹飞行
  for (let i = game.enemyProjectiles.length - 1; i >= 0; i--) {
    const ep = game.enemyProjectiles[i];
    const dx = ep.targetX - ep.x, dy = ep.targetY - ep.y, dist = Math.hypot(dx, dy);
    if (dist < 10 || !ep.targetUnit || ep.targetUnit.isDead) {
      spawnParticles(game, ep.x, ep.y, 8, ep.color, [1, 4], [6, 14]);
      if (ep.targetUnit && !ep.targetUnit.isDead) {
        ep.targetUnit.hp -= ep.damage; ep.targetUnit.flashTimer = 6;
        if (ep.targetUnit.hp <= 0 && !ep.targetUnit.isDead) {
          ep.targetUnit.isDead = true;
          spawnParticles(game, ep.targetUnit.x, ep.targetUnit.y, 18, '#ff4444', [1.5, 5], [10, 24]);
          if (ep.targetType === 'tower') {
            for (const s of game.slots) { if (s.tower === ep.targetUnit) { s.occupied = false; s.tower = null; } }
          }
        }
      }
      game.enemyProjectiles.splice(i, 1);
      continue;
    }
    const step = Math.min(ep.speed, dist);
    ep.px = ep.x; ep.py = ep.y;
    ep.x += (dx / dist) * step; ep.y += (dy / dist) * step;
  }

  // 阻挡单位近战 + 掷弹兵远程
  for (const b of game.blockers) {
    if (b.isDead) continue;
    if (b.flashTimer > 0) b.flashTimer--;
    b.attackCooldown--;
    if (b.attackCooldown <= 0) {
      for (const e of game.enemies) {
        if (e.blockingUnit === b && !e.isDead) {
          e.hp -= b.damage;
          b.attackCooldown = b.attackInterval;
          const ePos = getPositionOnPath(e.progress, e.pathIndex, game);
          spawnDamageNumber(game, ePos.x, ePos.y, `-${b.damage}`, '#ff9944');
          spawnParticles(game, ePos.x, ePos.y, 4, '#ffdd55', [0.5, 2], [4, 10]);
          if (e.hp <= 0 && !e.isDead) { killEnemy(game, e); }
          break;
        }
      }
    }
    // 掷弹兵远程
    if (b.type === 'defender' && b.rCooldown !== undefined) {
      b.rCooldown--;
      if (b.rCooldown <= 0) {
        const def = BLOCKER_DEFS['defender'];
        let bestTarget = null, bestDist = def.rng;
        for (const e of game.enemies) {
          if (e.isDead) continue;
          const ePos = getPositionOnPath(e.progress, e.pathIndex, game);
          const d = Math.hypot(ePos.x - b.x, ePos.y - b.y);
          if (d < bestDist) { bestDist = d; bestTarget = { enemy: e, pos: ePos }; }
        }
        if (bestTarget) {
          game.projectiles.push({
            x: b.x, y: b.y, px: b.x, py: b.y, targetEnemy: bestTarget.enemy,
            targetX: bestTarget.pos.x, targetY: bestTarget.pos.y,
            speed: def.rSpeed, damage: def.rDmg, color: def.rColor, size: def.rSize,
            isSplash: false, splashRadius: 0, splashDamagePct: 1,
          });
          b.rCooldown = def.rInterval;
          spawnParticles(game, b.x, b.y, 4, def.rColor, [0.5, 2], [4, 8]);
        }
      }
    }
  }

  // 塔攻击
  for (const tower of game.towers) {
    if (tower.isDead) continue;
    if (tower.flashTimer > 0) tower.flashTimer--;
    if (tower.cooldown > 0) { tower.cooldown--; continue; }
    let bestTarget = null, bestProgress = -1;
    for (const e of game.enemies) {
      if (e.isDead) continue;
      if (e.flying && !tower.canTargetFlying) continue;
      const pos = getPositionOnPath(e.progress, e.pathIndex, game);
      const dist = Math.hypot(pos.x - tower.x, pos.y - tower.y);
      if (dist < tower.range && e.progress > bestProgress) { bestProgress = e.progress; bestTarget = { enemy: e, pos }; }
    }
    if (bestTarget) {
      game.projectiles.push({
        x: tower.x, y: tower.y, px: tower.x, py: tower.y,
        targetEnemy: tower.isSplash ? null : bestTarget.enemy,
        targetX: bestTarget.pos.x, targetY: bestTarget.pos.y,
        speed: tower.bulletSpeed, damage: tower.damage, color: tower.bulletColor,
        size: tower.isSplash ? 7 : 5,
        isSplash: tower.isSplash, splashRadius: tower.splashRadius, splashDamagePct: tower.splashDamagePct,
      });
      tower.cooldown = tower.cooldownMax;
      playShoot();
    }
  }

  // 子弹飞行
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    const p = game.projectiles[i];
    let targetX, targetY;
    if (!p.isSplash && p.targetEnemy && !p.targetEnemy.isDead) {
      const ePos = getPositionOnPath(p.targetEnemy.progress, p.targetEnemy.pathIndex, game);
      targetX = ePos.x; targetY = ePos.y;
    } else if (p.isSplash) { targetX = p.targetX; targetY = p.targetY; }
    else { game.projectiles.splice(i, 1); continue; } // 目标已死，移除子弹
    const dx = targetX - p.x, dy = targetY - p.y, dist = Math.hypot(dx, dy);
    if (dist < (p.isSplash ? 10 : 8)) {
      if (p.isSplash) {
        spawnParticles(game, p.x, p.y, 20, '#ff8833', [2, 6], [12, 28]);
        spawnParticles(game, p.x, p.y, 10, '#ffcc44', [1, 3], [8, 18]);
        playExplosion(); triggerShake(game, 4, 10);
        for (const e of game.enemies) {
          if (e.isDead) continue;
          const ePos = getPositionOnPath(e.progress, e.pathIndex, game);
          const edist = Math.hypot(ePos.x - p.x, ePos.y - p.y);
          if (edist <= p.splashRadius) {
            const dmg = edist < 20 ? p.damage : Math.floor(p.damage * p.splashDamagePct);
            e.hp -= dmg;
            spawnDamageNumber(game, ePos.x, ePos.y, `-${dmg}`, '#ff8833');
            if (e.hp <= 0 && !e.isDead) { killEnemy(game, e); }
          }
        }
      } else {
        if (p.targetEnemy && !p.targetEnemy.isDead) {
          p.targetEnemy.hp -= p.damage;
          spawnDamageNumber(game, p.x, p.y, `-${p.damage}`, '#ff6644');
          spawnParticles(game, p.x, p.y, 6, '#ffdd77', [0.8, 2.5], [6, 14]);
          if (p.targetEnemy.hp <= 0 && !p.targetEnemy.isDead) { killEnemy(game, p.targetEnemy); }
        }
      }
      game.projectiles.splice(i, 1);
      continue;
    }
    const step = Math.min(p.speed, dist);
    p.px = p.x; p.py = p.y;
    p.x += (dx / dist) * step; p.y += (dy / dist) * step;
  }

  // 清理
  game.enemies = game.enemies.filter(e => !e.isDead || e.dyingTimer > 0);
  game.blockers = game.blockers.filter(b => {
    if (b.isDead) { for (const e of game.enemies) { if (e.blockingUnit === b) { e.blocked = false; e.blockingUnit = null; } } game.unitsLost++; spawnParticles(game, b.x, b.y, 20, '#ff4444', [1, 4], [10, 25]); return false; }
    return true;
  });
  game.towers = game.towers.filter(t => {
    if (t.isDead) { for (const s of game.slots) { if (s.tower === t) { s.occupied = false; s.tower = null; } } game.unitsLost++; spawnParticles(game, t.x, t.y, 22, '#ff4444', [1.5, 5], [12, 26]); return false; }
    return true;
  });

  updateParticles(game);
}
