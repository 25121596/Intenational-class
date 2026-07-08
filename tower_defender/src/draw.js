import { TOWER_DEFS, BLOCKER_DEFS, PATH_NAMES, PATH_ENTRY_COLORS, getUnitDisplayName } from './config.js';
import { getPositionOnPath, findNearestFreeSlot } from './helpers.js';

// ---- 莱茵河绘制 ----
function drawRiver(game, ctx, canvasW, canvasH) {
  const r = game.level.river;
  const ry = r.yStart, rh = r.yEnd - r.yStart;

  // 1. 水面底色 + 渐变
  const waterGrad = ctx.createLinearGradient(0, ry, 0, r.yEnd);
  waterGrad.addColorStop(0, '#2a5580');
  waterGrad.addColorStop(0.3, '#3a6b8c');
  waterGrad.addColorStop(0.5, '#4a80a0');
  waterGrad.addColorStop(0.7, '#3a6b8c');
  waterGrad.addColorStop(1, '#2a5580');
  ctx.fillStyle = waterGrad;
  ctx.fillRect(0, ry, canvasW, rh);

  // 2. 水面波纹
  ctx.strokeStyle = 'rgba(180,210,240,0.25)';
  ctx.lineWidth = 1;
  for (let wy = ry + 8; wy < r.yEnd; wy += 14) {
    ctx.beginPath();
    for (let wx = 0; wx < canvasW; wx += 4) {
      const waveY = wy + Math.sin(wx * 0.04 + game.frame * 0.03 + wy * 0.3) * 3;
      if (wx === 0) ctx.moveTo(wx, waveY);
      else ctx.lineTo(wx, waveY);
    }
    ctx.stroke();
  }
  // 更亮的细波纹
  ctx.strokeStyle = 'rgba(200,225,250,0.15)';
  ctx.lineWidth = 0.8;
  for (let wy = ry + 4; wy < r.yEnd; wy += 28) {
    ctx.beginPath();
    for (let wx = 0; wx < canvasW; wx += 3) {
      const waveY = wy + Math.cos(wx * 0.05 + game.frame * 0.025 + wy) * 2.5;
      if (wx === 0) ctx.moveTo(wx, waveY);
      else ctx.lineTo(wx, waveY);
    }
    ctx.stroke();
  }

  // 3. 河岸线
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(canvasW, ry); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, r.yEnd); ctx.lineTo(canvasW, r.yEnd); ctx.stroke();
  // 河岸浅滩
  ctx.fillStyle = 'rgba(180,170,140,0.4)';
  ctx.fillRect(0, ry - 5, canvasW, 8);
  ctx.fillRect(0, r.yEnd - 3, canvasW, 8);

  // 4. 三座桥
  r.bridges.forEach((br, bi) => {
    const bx = br.x, bw = br.w;
    const by = ry, bh = rh;

    // 桥墩（两侧）
    ctx.fillStyle = '#3a3530';
    ctx.fillRect(bx - 6, by, 14, bh);           // 左桥墩
    ctx.fillRect(bx + bw - 8, by, 14, bh);      // 右桥墩
    // 桥墩高光
    ctx.fillStyle = '#4a4540';
    ctx.fillRect(bx - 3, by, 8, bh);
    ctx.fillRect(bx + bw - 5, by, 8, bh);

    // 桥面
    ctx.fillStyle = br.color;
    ctx.fillRect(bx, by + 8, bw, bh - 16);
    // 桥面纹理（横向木板/石板条纹）
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    for (let sx = bx + 8; sx < bx + bw; sx += 10) {
      ctx.beginPath(); ctx.moveTo(sx, by + 8); ctx.lineTo(sx, by + bh - 8); ctx.stroke();
    }
    // 桥面中央虚线
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([12, 16]);
    ctx.beginPath();
    ctx.moveTo(bx + 4, by + bh / 2);
    ctx.lineTo(bx + bw - 4, by + bh / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 桥面边框
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by + 6, bw, bh - 12);

    // 桥头护栏
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(bx - 4, by - 3, bw + 8, 8);
    ctx.fillRect(bx - 4, r.yEnd - 5, bw + 8, 8);

    // 桥名标签
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.font = 'bold 10px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    const labelY = bi === 1 ? ry - 16 : r.yEnd + 16; // middle bridge label above, others below
    ctx.fillText(br.name, bx + bw / 2, labelY);
    ctx.textAlign = 'start';
  });

  // 5. 水面反光（在桥之后画，覆盖在水面上）
  for (let i = 0; i < 12; i++) {
    const lx = (i * 73 + 37) % canvasW;
    const ly = ry + 20 + (i * 41) % (rh - 40);
    const alpha = 0.06 + 0.04 * Math.sin(game.frame * 0.04 + i);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(lx, ly, 20 + (i % 3) * 16, 2);
  }
}

// ---- 塔位弹出菜单 (王国保卫战风格) ----
function drawSlotMenu(game, ctx) {
  const b = game.slotMenuBounds;
  if (!b) return;

  // 背景
  ctx.fillStyle = 'rgba(16,18,24,0.93)';
  ctx.strokeStyle = '#6a5030'; ctx.lineWidth = 2;
  roundRect(ctx, b.x - 4, b.y - 4, b.w + 8, b.h + 8, 6);
  ctx.fill(); ctx.stroke();

  game.slotMenuOptions.forEach(opt => {
    const hover = game.mouseX >= opt.x && game.mouseX <= opt.x + opt.w &&
                  game.mouseY >= opt.y && game.mouseY <= opt.y + opt.h;
    if (hover) {
      ctx.fillStyle = 'rgba(180,140,60,0.3)';
      ctx.strokeStyle = '#b09050';
      ctx.lineWidth = 2;
      roundRect(ctx, opt.x - 2, opt.y - 2, opt.w + 4, opt.h + 4, 4);
      ctx.fill(); ctx.stroke();
    }

    if (opt.isUpgrade) {
      // 升级选项
      ctx.fillStyle = '#ffd700'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('⬆️', opt.x + opt.w / 2, opt.y + 20);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`升级 Lv.${opt.level+1}→${opt.level+2}`, opt.x + opt.w / 2, opt.y + 38);
      ctx.fillStyle = '#ffd700'; ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`${opt.cost}💰`, opt.x + opt.w / 2, opt.y + 55);
    } else {
      // 塔选项
      const def = opt.def;
      ctx.fillStyle = def.color; ctx.beginPath();
      ctx.arc(opt.x + opt.w / 2, opt.y + 18, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(opt.x + opt.w / 2, opt.y + 18, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
      const label = opt.type === 'machine' ? 'MG' : opt.type === 'cannon' ? 'AT' : 'SIG';
      ctx.fillText(label, opt.x + opt.w / 2, opt.y + 22);
      ctx.fillStyle = '#c0c4cc'; ctx.font = 'bold 10px sans-serif';
      const name = getUnitDisplayName(opt.type, game.activeCampaign);
      ctx.fillText(name.length > 6 ? name.substring(0, 5)+'..' : name, opt.x + opt.w / 2, opt.y + 40);
      const canAfford = game.gold >= def.cost;
      ctx.fillStyle = canAfford ? '#ffd700' : '#f87171';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(`${def.cost}💰`, opt.x + opt.w / 2, opt.y + 55);
    }
  });
  ctx.textAlign = 'start';
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ---- 通关统计面板 ----
function drawStatsPanel(game, ctx, canvasW, canvasH) {
  const cx = canvasW / 2, cy = canvasH / 2;
  const pw = 360, ph = 260;
  const px = cx - pw / 2, py = cy - ph / 2;

  // 背景
  ctx.fillStyle = 'rgba(10,12,18,0.92)'; ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#6a5030'; ctx.lineWidth = 2; ctx.strokeRect(px, py, pw, ph);
  ctx.strokeStyle = 'rgba(255,215,0,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(px + 3, py + 3, pw - 6, ph - 6);

  ctx.textAlign = 'center';

  // 标题
  ctx.fillStyle = '#ffd700'; ctx.font = 'bold 20px "Segoe UI", sans-serif';
  ctx.fillText('═══ 本关统计 ═══', cx, py + 35);

  // 星级
  const stars = game.levelStars || 0;
  const starLabel = stars >= 3 ? '⭐ 完美作战！' : '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
  ctx.fillStyle = '#ffd700'; ctx.font = 'bold 18px "Segoe UI", sans-serif';
  ctx.fillText(starLabel, cx, py + 65);

  // 统计数据（两列）
  const leftX = px + 60, rightX = px + 240;
  const row1 = py + 100, row2 = py + 130, row3 = py + 160, row4 = py + 190;
  ctx.font = 'bold 15px "Segoe UI", sans-serif';

  ctx.fillStyle = '#c0c4cc'; ctx.textAlign = 'left';
  ctx.fillText(`💀 击杀: ${game.kills}`, leftX, row1);
  ctx.fillText(`💰 获得金币: ${game.goldEarned}`, leftX, row2);
  ctx.fillText(`🏗️ 部署: ${game.towersPlaced}塔 ${game.blockersPlaced}兵`, leftX, row3);
  ctx.fillText(`📉 损失: ${game.unitsLost}`, leftX, row4);

  ctx.fillText(`❤️ 剩余生命: ${Math.floor(game.hp)}`, rightX, row1);
  ctx.fillText(`🌊 波次: ${game.wave}/${game.level.waves.length}`, rightX, row2);
  ctx.fillText(`🎖️ 难度: ${game.difficulty === 'private' ? '列兵' : game.difficulty === 'sergeant' ? '中士' : '上校'}`, rightX, row3);

  // 提示
  ctx.fillStyle = '#889098'; ctx.font = 'bold 13px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('点击"下一波"继续', cx, py + ph - 20);

  ctx.textAlign = 'start';
}

export function draw(game, ctx, canvasW, canvasH) {
  ctx.clearRect(0, 0, canvasW, canvasH);

  const isSnow = game.level.theme === 'snow';

  if (isSnow) {
    // 雪地背景
    ctx.fillStyle = '#d8dce0';
    ctx.fillRect(0, 0, canvasW, canvasH);
    // subtle snow texture
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let x = 0; x < canvasW; x += 60) {
      for (let y = 0; y < canvasH; y += 40) {
        ctx.beginPath(); ctx.arc(x + (y % 80 === 0 ? 0 : 30), y, 1.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.strokeStyle = 'rgba(180,185,195,0.5)'; ctx.lineWidth = 0.5;
    for (let x = 0; x < canvasW; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasH); ctx.stroke(); }
    for (let y = 0; y < canvasH; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasW, y); ctx.stroke(); }

    // 灰黑色高楼建筑群
    const buildings = [
      { x: 60, y: 520, w: 40, h: 100, c: '#3a3d44' },
      { x: 110, y: 500, w: 35, h: 120, c: '#2d3036' },
      { x: 160, y: 540, w: 50, h: 85, c: '#404348' },
      { x: 620, y: 510, w: 45, h: 110, c: '#33363c' },
      { x: 680, y: 480, w: 38, h: 140, c: '#2a2d33' },
      { x: 730, y: 530, w: 55, h: 95, c: '#3e4147' },
      { x: 790, y: 500, w: 42, h: 125, c: '#35383e' },
      { x: 340, y: 545, w: 36, h: 80, c: '#383b41' },
      { x: 390, y: 525, w: 48, h: 105, c: '#2f3238' },
      { x: 520, y: 530, w: 40, h: 95, c: '#3a3d43' },
      { x: 560, y: 540, w: 34, h: 78, c: '#41444a' },
      { x: 850, y: 490, w: 44, h: 130, c: '#2e3137' },
      { x: 15, y: 530, w: 35, h: 90, c: '#36393f' },
      { x: 210, y: 510, w: 30, h: 115, c: '#3c3f45' },
      { x: 240, y: 540, w: 40, h: 80, c: '#31343a' },
      { x: 450, y: 550, w: 38, h: 70, c: '#3b3e44' },
      { x: 650, y: 520, w: 28, h: 100, c: '#34373d' },
      { x: 600, y: 545, w: 42, h: 72, c: '#3d4046' },
      { x: 820, y: 535, w: 36, h: 88, c: '#393c42' },
      { x: 465, y: 520, w: 30, h: 95, c: '#2c2f35' },
    ];
    // simple hash for deterministic window lighting
    const hash = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };
    for (const bi of buildings) {
      const b = bi;
      // building body
      ctx.fillStyle = b.c;
      ctx.fillRect(b.x, b.y - b.h, b.w, b.h);
      // dark outline
      ctx.strokeStyle = '#1a1c20';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x, b.y - b.h, b.w, b.h);
      // windows (deterministic lit rectangles)
      const winW = 5, winH = 5, gapX = 9, gapY = 10;
      let wi = 0;
      for (let wy = b.y - b.h + 8; wy < b.y - 10; wy += gapY) {
        for (let wx = b.x + 6; wx < b.x + b.w - 8; wx += gapX) {
          wi++;
          const h = hash(b.x + wi, b.y + wi);
          if (h > 0.45) {
            ctx.fillStyle = h > 0.78 ? 'rgba(255,220,150,0.35)' : 'rgba(255,255,200,0.12)';
            ctx.fillRect(wx, wy, winW, winH);
          }
        }
      }
      // snow on roof
      ctx.fillStyle = 'rgba(240,242,248,0.7)';
      ctx.fillRect(b.x - 2, b.y - b.h - 3, b.w + 4, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(b.x - 1, b.y - b.h - 5, b.w + 2, 4);
    }

    // snow-covered bare trees
    for (const tree of game.trees) {
      const { x, y, size, shade } = tree;
      // trunk
      ctx.fillStyle = '#5a5048';
      ctx.fillRect(x - size * 0.12, y - size * 0.05, size * 0.24, size * 0.5);
      // bare branches
      ctx.strokeStyle = '#4a4038';
      ctx.lineWidth = 2;
      const branches = [
        { dx: -0.4, dy: -0.35, len: 0.45 },
        { dx: 0.35, dy: -0.3, len: 0.4 },
        { dx: -0.2, dy: -0.5, len: 0.35 },
        { dx: 0.25, dy: -0.45, len: 0.38 },
        { dx: -0.5, dy: -0.2, len: 0.3 },
      ];
      for (const br of branches) {
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.2);
        ctx.lineTo(x + br.dx * size, y + br.dy * size);
        ctx.stroke();
      }
      // snow caps on branch tips
      ctx.fillStyle = 'rgba(245,247,250,0.8)';
      for (const br of branches) {
        ctx.beginPath();
        ctx.arc(x + br.dx * size, y + br.dy * size, size * 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
      // ground snow shadow
      ctx.fillStyle = 'rgba(200,205,215,0.3)';
      ctx.beginPath(); ctx.ellipse(x + 2, y + size * 0.5, size * 0.6, size * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    // 草地（默认）
    ctx.fillStyle = '#5a7d62';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.strokeStyle = '#6b8f72';
    ctx.lineWidth = 0.6;
    for (let x = 0; x < canvasW; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasH); ctx.stroke(); }
    for (let y = 0; y < canvasH; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasW, y); ctx.stroke(); }

    // 树木
    for (const tree of game.trees) {
      const { x, y, size, shade } = tree;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(x + 3, y + size * 0.6, size * 0.7, size * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a3d2b';
      ctx.fillRect(x - size * 0.15, y - size * 0.1, size * 0.3, size * 0.55);
      const gb = shade > 0.5 ? '#3d6b3d' : '#4a7d4a';
      ctx.fillStyle = gb; ctx.beginPath(); ctx.arc(x, y - size * 0.35, size * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade > 0.5 ? '#4a8040' : '#5a9050';
      ctx.beginPath(); ctx.arc(x - size * 0.15, y - size * 0.5, size * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + size * 0.2, y - size * 0.42, size * 0.38, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---- 莱茵河渲染 ----
  if (game.level.river) {
    drawRiver(game, ctx, canvasW, canvasH);
  }

  // 路径
  for (let pi = 0; pi < game.level.paths.length; pi++) {
    const path = game.level.paths[pi];
    if (isSnow) {
      // snowy road: cleared asphalt with snow edges
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
      ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.strokeStyle = '#8a8d94'; ctx.lineWidth = 40; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.strokeStyle = '#5a5c63'; ctx.lineWidth = 28; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.setLineDash([14, 24]); ctx.strokeStyle = '#999a9e'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.setLineDash([]);
      // snow piles along road edge
      for (const stone of game.roadStones) {
        ctx.fillStyle = stone.dark ? '#c8ccd0' : '#dde0e4';
        ctx.beginPath(); ctx.arc(stone.x, stone.y, stone.r, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
      ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.strokeStyle = '#4a4a4a'; ctx.lineWidth = 36; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.strokeStyle = '#5c5c5c'; ctx.lineWidth = 26; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.setLineDash([16, 28]); ctx.strokeStyle = '#8a8a7a'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.setLineDash([]);
      for (const stone of game.roadStones) {
        ctx.fillStyle = stone.dark ? '#6e6e6e' : '#7a7a72';
        ctx.beginPath(); ctx.arc(stone.x, stone.y, stone.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    // 入口标记
    const sp = path[0];
    ctx.fillStyle = PATH_ENTRY_COLORS[pi]; ctx.shadowColor = PATH_ENTRY_COLORS[pi]; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(sp.x < 0 ? 14 : sp.x, sp.y, 13, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(PATH_NAMES[pi], sp.x < 0 ? 14 : sp.x, sp.y + 4);
    // 出口星标
    const ep = path[path.length - 1];
    const ex = ep.x > canvasW ? canvasW - 14 : ep.x;
    const pulse = 1 + 0.12 * Math.sin(game.frame * 0.08);
    ctx.save(); ctx.translate(ex, ep.y);
    ctx.fillStyle = isSnow ? '#3a5070' : '#2a6e3a';
    ctx.strokeStyle = isSnow ? '#8ab8e8' : '#7bed9f'; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 5; const a2 = a + Math.PI / 5; ctx.lineTo(Math.cos(a) * 15 * pulse, Math.sin(a) * 15 * pulse); ctx.lineTo(Math.cos(a2) * 7 * pulse, Math.sin(a2) * 7 * pulse); }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.fillStyle = isSnow ? '#8ab8e8' : '#7bed9f'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('🏰', ex, ep.y - 22);
  }
  ctx.textAlign = 'start';

  // 炮位
  for (const s of game.slots) {
    // check if slot is being deployed on
    const deploying = game.deployments.find(d => d.isTower && d.slotX === s.x && d.slotY === s.y);
    if (deploying || s.occupied) continue;
    ctx.strokeStyle = 'rgba(111,180,255,0.55)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(s.x, s.y, 19, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(111,180,255,0.12)'; ctx.beginPath(); ctx.arc(s.x, s.y, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(180,220,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(s.x - 6, s.y); ctx.lineTo(s.x + 6, s.y); ctx.moveTo(s.x, s.y - 6); ctx.lineTo(s.x, s.y + 6); ctx.stroke();
  }

  // 部署进度条
  for (const d of game.deployments) {
    const progress = 1 - (d.timer / d.maxTimer);
    const barW = 38, barH = 7;
    const barX = d.x - barW / 2, barY = d.y - 28;
    // background
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    // progress
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, '#f4a261'); grad.addColorStop(1, '#e76f51');
    ctx.fillStyle = grad; ctx.fillRect(barX, barY, barW * progress, barH);
    // border
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(barX, barY, barW, barH);
    // label
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    const unitName = d.isTower ? (getUnitDisplayName(d.type, game.activeCampaign)) : (getUnitDisplayName(d.type, game.activeCampaign));
    ctx.fillText(`${unitName}`, d.x, barY - 5);
    // pulsing circle
    const pulse = 1 + 0.15 * Math.sin(game.frame * 0.25);
    ctx.strokeStyle = 'rgba(244,162,97,0.7)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(d.x, d.y, 18 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(244,162,97,0.15)';
    ctx.beginPath(); ctx.arc(d.x, d.y, 16 * pulse, 0, Math.PI * 2); ctx.fill();
  }
  ctx.textAlign = 'start';

  // 悬停预览
  if (!game.sellMode && TOWER_DEFS[game.selectedType] && !game.gameOver && !game.gameWin) {
    const slot = findNearestFreeSlot(game.mouseX, game.mouseY, 34, game);
    if (slot) {
      const def = TOWER_DEFS[game.selectedType];
      ctx.strokeStyle = 'rgba(244,162,97,0.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.arc(slot.x, slot.y, def.range, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#f4a261'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(slot.x, slot.y, 22, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // 阻挡单位
  for (const b of game.blockers) {
    let blockedCount = 0;
    for (const e of game.enemies) { if (e.blockingUnit === b && !e.isDead) blockedCount++; }
    if (blockedCount > 0) { ctx.strokeStyle = 'rgba(255,80,80,0.4)'; ctx.lineWidth = 3; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(b.x, b.y, b.size + 8, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(b.x + 2, b.y + 3, b.size * 0.9, b.size * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    const fa = b.flashTimer > 0 ? b.flashTimer / 8 : 0;
    ctx.fillStyle = fa > 0 ? '#ff8888' : b.color; ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); ctx.stroke();
    let aimAngle = 0, hasTarget = false;
    for (const e of game.enemies) { if (e.blockingUnit === b && !e.isDead) { const ep = getPositionOnPath(e.progress, e.pathIndex, game); aimAngle = Math.atan2(ep.y - b.y, ep.x - b.x); hasTarget = true; break; } }
    if (hasTarget) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(b.x + Math.cos(aimAngle) * b.size * 0.4, b.y + Math.sin(aimAngle) * b.size * 0.4); ctx.lineTo(b.x + Math.cos(aimAngle) * (b.size + 6), b.y + Math.sin(aimAngle) * (b.size + 6)); ctx.stroke(); ctx.lineCap = 'butt'; }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
    const shortName = getUnitDisplayName(b.type, game.activeCampaign);
    const abbrev = shortName.length > 4 ? shortName.substring(0, 4) : shortName;
    ctx.fillText(abbrev, b.x, b.y + 3);
    const barW = b.size * 2.6, barH = 6, barY = b.y - b.size - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(b.x - barW / 2, barY, barW, barH);
    const hpPct = Math.max(0, b.hp / b.maxHp);
    ctx.fillStyle = hpPct > 0.55 ? '#4ade80' : hpPct > 0.25 ? '#facc15' : '#f87171';
    ctx.fillRect(b.x - barW / 2, barY, barW * hpPct, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.8; ctx.strokeRect(b.x - barW / 2, barY, barW, barH);
    ctx.fillStyle = blockedCount >= b.blockCount ? '#ff6b6b' : '#7bed9f';
    ctx.font = 'bold 9px sans-serif'; ctx.fillText(`${blockedCount}/${b.blockCount}`, b.x, barY - 4);
    // 升级星星
    if (b.upgradeLevel > 0) {
      ctx.fillStyle = '#ffd700'; ctx.font = 'bold 7px sans-serif';
      ctx.fillText('⭐'.repeat(b.upgradeLevel), b.x, barY - 14);
    }
    // 升级模式高亮
    if (game.upgradeMode && b.upgradeLevel < 3) {
      ctx.strokeStyle = 'rgba(255,215,0,0.7)'; ctx.lineWidth = 2.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(b.x, b.y, b.size + 9, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // 塔
  for (const tower of game.towers) {
    if (tower.isDead) continue;
    const tf = tower.flashTimer > 0 ? tower.flashTimer / 6 : 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 10]);
    ctx.beginPath(); ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    if (game.sellMode) { ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 3; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(tower.x, tower.y, tower.size + 8, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(tower.x + 2, tower.y + 3, tower.size + 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = tf > 0 ? '#ff8888' : tower.color; ctx.beginPath(); ctx.arc(tower.x, tower.y, tower.size, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tower.x, tower.y, tower.size, 0, Math.PI * 2); ctx.stroke();
    // 常驻血条（始终显示）
    const tw = tower.size * 2.4, th = 5, ty = tower.y - tower.size - 10;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(tower.x - tw / 2, ty, tw, th);
    const tpct = Math.max(0, tower.hp / tower.maxHp);
    ctx.fillStyle = tpct > 0.5 ? '#4ade80' : '#facc15'; ctx.fillRect(tower.x - tw / 2, ty, tw * tpct, th);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 0.6; ctx.strokeRect(tower.x - tw / 2, ty, tw, th);
    // 升级星星
    if (tower.upgradeLevel > 0) {
      ctx.fillStyle = '#ffd700'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('⭐'.repeat(tower.upgradeLevel), tower.x, ty - 6);
    }
    // 升级模式高亮
    if (game.upgradeMode && tower.upgradeLevel < 3) {
      ctx.strokeStyle = 'rgba(255,215,0,0.7)'; ctx.lineWidth = 2.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(tower.x, tower.y, tower.size + 9, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    let aimAngle = 0, minDist = Infinity;
    for (const e of game.enemies) { if (e.isDead) continue; const pos = getPositionOnPath(e.progress, e.pathIndex, game); const d = Math.hypot(pos.x - tower.x, pos.y - tower.y); if (d < minDist) { minDist = d; aimAngle = Math.atan2(pos.y - tower.y, pos.x - tower.x); } }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath();
    ctx.moveTo(tower.x + Math.cos(aimAngle) * tower.size * 0.45, tower.y + Math.sin(aimAngle) * tower.size * 0.45);
    ctx.lineTo(tower.x + Math.cos(aimAngle) * (tower.size + 7), tower.y + Math.sin(aimAngle) * (tower.size + 7)); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    const tShort = getUnitDisplayName(tower.type, game.activeCampaign);
    const tAbbrev = tShort.length > 5 ? tShort.substring(0, 5) : tShort;
    ctx.fillText(tAbbrev, tower.x, tower.y + 3.5);
  }

  // 敌人
  for (const e of game.enemies) {
    if (e.isDead) continue;
    const pos = getPositionOnPath(e.progress, e.pathIndex, game);
    if (e.blocked) { ctx.strokeStyle = 'rgba(255,60,60,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(pos.x, pos.y, e.size + 5, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    if (e.enemyType === 'maus') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(pos.x + 4, pos.y + 8, e.size * 1.1, e.size * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4d3d2d'; ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 20; ctx.fillRect(pos.x - e.size * 1.2, pos.y - e.size * 0.7, e.size * 2.4, e.size * 1.4); ctx.shadowBlur = 0;
      ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.ellipse(pos.x, pos.y - 4, e.size * 0.8, e.size * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(pos.x + e.size * 0.4, pos.y - 12, e.size * 1.0, 8);
      ctx.fillStyle = '#ffcc88'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('鼠式', pos.x, pos.y - e.size - 24);
      const bw = e.size * 2.8, bh = 8, by = pos.y - e.size - 18;
      ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(pos.x - bw / 2, by, bw, bh);
      const hpp = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = hpp > 0.6 ? '#4ade80' : hpp > 0.3 ? '#facc15' : '#f87171'; ctx.fillRect(pos.x - bw / 2, by, bw * hpp, bh);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(pos.x - bw / 2, by, bw, bh);
      ctx.textAlign = 'start';
      if (e.ranged) { ctx.strokeStyle = 'rgba(255,50,0,0.18)'; ctx.lineWidth = 1.5; ctx.setLineDash([8, 12]); ctx.beginPath(); ctx.arc(pos.x, pos.y, e.rRange, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    } else {
      const bw = e.size * 2.8, bh = 6, by = pos.y - e.size - 14;
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(pos.x - bw / 2, by, bw, bh);
      const hpp = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = hpp > 0.55 ? '#4ade80' : hpp > 0.25 ? '#facc15' : '#f87171'; ctx.fillRect(pos.x - bw / 2, by, bw * hpp, bh);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.8; ctx.strokeRect(pos.x - bw / 2, by, bw, bh);
      ctx.save(); ctx.translate(pos.x, pos.y);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(3, 3, e.size * 0.9, e.size * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      if (e.enemyType === 'tank' || e.enemyType === 'boss_tank') {
        const tw = e.size * 1.6, th = e.size * 1.1;
        ctx.fillStyle = e.enemyType === 'boss_tank' ? '#5a3a2a' : '#4a5a3a'; ctx.fillRect(-tw / 2, -th / 2, tw, th);
        ctx.fillStyle = e.enemyType === 'boss_tank' ? '#7a4a35' : '#5d6d4d'; ctx.fillRect(-tw / 2 + 3, -th / 2 + 2, tw - 6, th - 4);
        ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(0, -2, e.size * 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(e.size * 0.9, -8); ctx.stroke();
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-tw / 2 - 2, th / 2 - 4, tw + 4, 6);
      } else if (e.enemyType === 'armored') {
        ctx.fillStyle = '#4a5a3a'; ctx.beginPath(); ctx.ellipse(0, 2, e.size * 0.75, e.size * 0.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5c6b5c'; ctx.beginPath(); ctx.arc(0, -e.size * 0.25, e.size * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e.size * 0.4, -2); ctx.lineTo(e.size * 1.1, -6); ctx.stroke();
      } else {
        ctx.fillStyle = e.enemyType === 'assault' ? '#5a5040' : '#4a5a3a';
        ctx.beginPath(); ctx.ellipse(0, 3, e.size * 0.6, e.size * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a4a3a'; ctx.beginPath(); ctx.arc(0, -e.size * 0.3, e.size * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2d2d2d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e.size * 0.35, 1); ctx.lineTo(e.size * 1.0, -4); ctx.stroke();
        if (e.enemyType === 'assault') { ctx.fillStyle = '#c44545'; ctx.beginPath(); ctx.arc(e.size * 0.15, -2, 3, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
      if (e.ranged && (e.enemyType === 'tank' || e.enemyType === 'boss_tank')) { ctx.strokeStyle = 'rgba(255,80,30,0.15)'; ctx.lineWidth = 1; ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.arc(pos.x, pos.y, e.rRange, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    }
  }

  // 子弹
  for (const p of game.projectiles) {
    ctx.save(); ctx.shadowColor = p.color; ctx.shadowBlur = 12;
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.2, p.size * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  for (const ep of game.enemyProjectiles) {
    ctx.save(); ctx.shadowColor = ep.color; ctx.shadowBlur = 14;
    ctx.fillStyle = ep.color; ctx.beginPath(); ctx.arc(ep.x, ep.y, ep.size, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,150,0.4)'; ctx.beginPath(); ctx.arc(ep.x - ep.size * 0.3, ep.y - ep.size * 0.2, ep.size * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 粒子
  for (const p of game.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha; ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 伤害数字
  for (const dn of game.damageNumbers) {
    const alpha = Math.max(0, dn.life / dn.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = dn.color;
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 3;
    ctx.fillText(dn.text, dn.x, dn.y);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'start';

  // 通关统计面板
  if (game.levelComplete && !game.gameWin && game.announcementTimer > 60) {
    drawStatsPanel(game, ctx, canvasW, canvasH);
  }

  // Boss血条
  if (game.bossEnemy && !game.bossEnemy.isDead) {
    const bw = 600, bh = 28, bx = (canvasW - bw) / 2, by = 16;
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.shadowColor = '#ff3300'; ctx.shadowBlur = 25;
    ctx.fillRect(bx - 6, by - 6, bw + 12, bh + 12); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#8b0000'; ctx.lineWidth = 3; ctx.strokeRect(bx - 6, by - 6, bw + 12, bh + 12);
    const hpp = Math.max(0, game.bossEnemy.hp / game.bossEnemy.maxHp);
    ctx.fillStyle = hpp > 0.6 ? '#4ade80' : hpp > 0.3 ? '#facc15' : '#f87171';
    ctx.fillRect(bx, by, bw * hpp, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 8;
    ctx.fillText(`🐭 鼠式坦克  Maus  ${Math.floor(hpp*100)}%`, canvasW / 2, by + 22);
    ctx.shadowBlur = 0; ctx.textAlign = 'start';
  }

  // ---- 塔位弹出菜单 (王国保卫战风格) ----
  if (game.slotMenuOpen && game.slotMenuOptions.length > 0) {
    drawSlotMenu(game, ctx);
  }

  // 公告
  if (game.announcement && game.announcementTimer > 0) {
    const alpha = Math.min(1, game.announcementTimer / 30);
    const lines = game.announcement.split('\n');
    const fontSize = game.gameWin ? 30 : 22;
    ctx.textAlign = 'center';
    lines.forEach((line, li) => {
      const textW = line.length * fontSize * 0.56;
      const ty = canvasH / 2 - 40 + li * (fontSize + 10);
      ctx.fillStyle = `rgba(0,0,0,${0.55*alpha})`;
      ctx.fillRect(canvasW / 2 - textW / 2 - 12, ty - 5, textW + 24, fontSize + 12);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.font = `bold ${fontSize}px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillText(line, canvasW / 2, ty + fontSize - 4);
    });
    ctx.textAlign = 'start';
  }

  // 暂停/结束覆盖
  if (game.paused && !game.menuOpen) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = '#f4a261'; ctx.font = 'bold 42px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('⏸️ 暂停', canvasW / 2, canvasH / 2 - 10);
    ctx.fillStyle = '#fff'; ctx.font = '17px sans-serif';
    ctx.fillText('按 空格键 或点击按钮继续', canvasW / 2, canvasH / 2 + 35); ctx.textAlign = 'start';
  }
  if (game.gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 42px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('💀 防线崩溃', canvasW / 2, canvasH / 2 - 10);
    ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
    ctx.fillText('点击画布重新开始战役', canvasW / 2, canvasH / 2 + 35); ctx.textAlign = 'start';
  }
  if (game.gameWin && game.announcementTimer < 60) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('🏆 钢铁之心 · 战役胜利!', canvasW / 2, canvasH / 2 - 10);
    ctx.fillStyle = '#fff'; ctx.font = '17px sans-serif';
    ctx.fillText(`关卡: 4/4 | 总击杀: ${game.kills}`, canvasW / 2, canvasH / 2 + 35); ctx.textAlign = 'start';
  }
}
