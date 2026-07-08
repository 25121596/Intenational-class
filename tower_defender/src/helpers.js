import { BASE_SPEED, ENEMY_PROTO, DIFFICULTIES } from './config.js';

// ---- 路径计算 ----
export function computePathLengths(paths) {
  return paths.map(p => {
    let total = 0;
    for (let i = 1; i < p.length; i++) total += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
    return total;
  });
}

export function getPositionOnPath(progress, pathIndex, game) {
  const path = game.level.paths[pathIndex];
  const totalLen = game.pathLengths[pathIndex];
  const clamped = Math.max(0, Math.min(1, progress));
  const targetDist = clamped * totalLen;
  let cumDist = 0;
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1], curr = path[i];
    const segLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    if (cumDist + segLen >= targetDist || i === path.length - 1) {
      const t = segLen > 0 ? (targetDist - cumDist) / segLen : 0;
      return {
        x: prev.x + (curr.x - prev.x) * Math.max(0, Math.min(1, t)),
        y: prev.y + (curr.y - prev.y) * Math.max(0, Math.min(1, t)),
      };
    }
    cumDist += segLen;
  }
  const last = path[path.length - 1];
  return { x: last.x, y: last.y };
}

export function findNearestPathPoint(x, y, game) {
  let best = { pathIndex: 0, progress: 0, x: 0, y: 0, dist: Infinity };
  for (let pi = 0; pi < game.level.paths.length; pi++) {
    for (let t = 0; t <= 1; t += 0.004) {
      const p = getPositionOnPath(t, pi, game);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < best.dist) best = { pathIndex: pi, progress: t, x: p.x, y: p.y, dist: d };
    }
  }
  return best;
}

export function findNearestFreeSlot(x, y, threshold, game) {
  let best = null, bestD = Infinity;
  for (const s of game.slots) {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < bestD) { bestD = d; best = s; }
  }
  if (best && bestD <= threshold && !best.occupied) {
    // also check no deployment is happening on this slot
    for (const dep of game.deployments) {
      if (dep.isTower && dep.slotX === best.x && dep.slotY === best.y) return null;
    }
    return best;
  }
  return null;
}

// ---- 粒子 ----
export function spawnParticles(game, x, y, count, color, speedRange, lifeRange) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);
    game.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: lifeRange[0] + Math.random() * (lifeRange[1] - lifeRange[0]),
      maxLife: lifeRange[1],
      color,
      size: 2 + Math.random() * 4,
    });
  }
}

export function updateParticles(game) {
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.94; p.vy *= 0.94;
    p.life--;
    if (p.life <= 0) game.particles.splice(i, 1);
  }
}

// ---- 场景生成 ----
export function generateTrees(level, canvasW, canvasH) {
  const trees = [];
  for (let attempt = 0; attempt < 200; attempt++) {
    const tx = 40 + Math.random() * (canvasW - 80);
    const ty = 40 + Math.random() * (canvasH - 80);
    let tooClose = false;
    for (const path of level.paths) {
      for (let i = 0; i < path.length - 1; i++) {
        if (Math.hypot(tx - (path[i].x + path[i + 1].x) / 2, ty - (path[i].y + path[i + 1].y) / 2) < 55) { tooClose = true; break; }
      }
      if (tooClose) break;
    }
    if (tooClose) continue;
    for (const s of level.towerSlots) {
      if (Math.hypot(tx - s.x, ty - s.y) < 40) { tooClose = true; break; }
    }
    if (tooClose) continue;
    // 不在河里长树（除非在桥附近）
    if (level.river) {
      if (ty > level.river.yStart - 18 && ty < level.river.yEnd + 18) {
        let nearBridge = false;
        for (const br of level.river.bridges) {
          if (tx > br.x - 30 && tx < br.x + br.w + 30) { nearBridge = true; break; }
        }
        if (!nearBridge) tooClose = true;
      }
    }
    if (tooClose) continue;
    for (const t of trees) {
      if (Math.hypot(tx - t.x, ty - t.y) < 50) { tooClose = true; break; }
    }
    if (!tooClose) trees.push({ x: tx, y: ty, size: 10 + Math.random() * 16, shade: Math.random() });
  }
  return trees;
}

export function generateRoadStones(paths) {
  const stones = [];
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const segLen = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
      const steps = Math.floor(segLen / 14);
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        stones.push({
          x: path[i].x + (path[i + 1].x - path[i].x) * t + (Math.random() - 0.5) * 16,
          y: path[i].y + (path[i + 1].y - path[i].y) * t + (Math.random() - 0.5) * 16,
          r: 1.2 + Math.random() * 1.5,
          dark: Math.random() > 0.5,
        });
      }
    }
  }
  return stones;
}

// ---- 敌人生成 ----
export function spawnEnemy(game, enemyDef, pathIndex) {
  const diffMult = DIFFICULTIES[game.difficulty]?.hpMult || 1.0;
  const scaledHp = Math.floor(enemyDef.hp * diffMult);
  const enemy = {
    progress: 0, pathIndex,
    hp: scaledHp, maxHp: scaledHp,
    speed: enemyDef.speed, reward: enemyDef.reward,
    size: enemyDef.size, enemyType: enemyDef.type,
    isDead: false, blocked: false, blockingUnit: null,
    atkDmg: enemyDef.atkDmg, atkInterval: enemyDef.atkInterval, atkCooldown: 0,
    ranged: enemyDef.ranged || false,
    rRange: enemyDef.range || 0, rDmg: enemyDef.rDmg || 0,
    rInterval: enemyDef.rInterval || 60, rCooldown: 0,
    rSpeed: enemyDef.rSpeed || 3, rColor: enemyDef.rColor || '#ff4444', rSize: enemyDef.rSize || 5,
    flying: enemyDef.flying || false, dyingTimer: 0,
    healer: enemyDef.healer || false,
    healRange: enemyDef.healRange || 0, healAmount: enemyDef.healAmount || 0,
    healInterval: enemyDef.healInterval || 60, healCooldown: 0,
  };
  if (enemyDef.type === 'maus') {
    game.bossEnemy = enemy;
    enemy.skillCooldown = 600;
    enemy.skillInterval = 1200;
  }
  // 出场特效：路径入口散发烟雾粒子
  const entryP = game.level.paths[pathIndex][0];
  const fx = entryP.x < 0 ? 14 : entryP.x;
  spawnParticles(game, fx, entryP.y, 10, '#888', [0.4, 1.2], [8, 18]);
  spawnParticles(game, fx, entryP.y, 5, '#fff', [0.2, 0.8], [4, 10]);

  game.enemies.push(enemy);
  return enemy;
}

export function buildSpawnQueue(game, cfg) {
  // cfg 可以是 wave config 对象 或 waveIndex（兼容旧调用）
  if (typeof cfg === 'number') cfg = game.level.waves[cfg];
  const queue = [];
  for (const e of cfg.enemies) {
    const proto = ENEMY_PROTO[e.t];
    const hpScale = e.hpScale || 1;
    for (let i = 0; i < e.c; i++) {
      const entry = { ...proto };
      if (hpScale !== 1) { entry.hp = Math.floor(entry.hp * hpScale); entry.maxHp = entry.hp; }
      queue.push(entry);
    }
  }
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return queue;
}

// ---- 地形装饰 ----
export function generateClouds(canvasW, canvasH) {
  const clouds = [];
  for (let i = 0; i < 6; i++) {
    clouds.push({
      x: Math.random() * canvasW,
      y: 20 + Math.random() * 140,
      w: 60 + Math.random() * 100,
      h: 18 + Math.random() * 22,
      speed: 0.15 + Math.random() * 0.35,
      alpha: 0.08 + Math.random() * 0.1,
    });
  }
  return clouds;
}

export function updateClouds(clouds, canvasW) {
  for (const c of clouds) {
    c.x += c.speed;
    if (c.x > canvasW + 120) c.x = -c.w - 20;
  }
}

export function generateBirds(canvasW, canvasH) {
  const birds = [];
  for (let i = 0; i < 5; i++) {
    birds.push({
      x: Math.random() * canvasW,
      y: 30 + Math.random() * 100,
      vx: 0.4 + Math.random() * 0.8,
      vy: (Math.random() - 0.5) * 0.3,
      wing: Math.random() * Math.PI * 2,
      size: 4 + Math.random() * 3,
    });
  }
  return birds;
}

export function updateBirds(birds, canvasW, canvasH) {
  for (const b of birds) {
    b.x += b.vx; b.y += b.vy;
    b.wing += 0.08;
    if (b.x > canvasW + 30) { b.x = -30; b.y = 30 + Math.random() * 100; }
  }
}

// ---- 单位移动速度 ----
export function getEnemyMoveAmount(enemy, game) {
  return (BASE_SPEED * enemy.speed) / game.pathLengths[enemy.pathIndex];
}
