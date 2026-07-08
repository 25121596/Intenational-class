import './style.css';
import { createGameState, loadLevel, startWave,
         placeTower, placeBlocker, sellUnit, forceSpawnEnemy, update, startUpgrade, getUpgradeCost } from './game.js';
import { draw } from './draw.js';
import { setupUI } from './ui.js';
import { LEVELS, CAMPAIGNS, TOWER_DEFS } from './config.js';
import { computePathLengths, generateTrees, generateRoadStones } from './helpers.js';
import { initAudio } from './audio.js';

const game = createGameState();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

/** 查找当前战役中的下一关 */
function getNextLevelInCampaign(g) {
  const campaign = CAMPAIGNS.find(c => c.id === g.activeCampaign);
  if (!campaign) {
    // fallback: global next
    if (g.levelIndex >= LEVELS.length - 1) return -1;
    return g.levelIndex + 1;
  }
  const posInCampaign = campaign.levels.indexOf(g.levelIndex);
  if (posInCampaign < 0 || posInCampaign >= campaign.levels.length - 1) return -1;
  return campaign.levels[posInCampaign + 1];
}

const ui = setupUI(game, {
  onCanvasClick(x, y) {
    // 初始化音效（首次交互）
    initAudio();

    // 1. 塔位弹出菜单：点击菜单选项
    if (game.slotMenuOpen && game.slotMenuOptions.length > 0) {
      for (const opt of game.slotMenuOptions) {
        if (x >= opt.x && x <= opt.x + opt.w && y >= opt.y && y <= opt.y + opt.h) {
          if (opt.isUpgrade) {
            startUpgrade(game, opt.unit, true);
          } else {
            placeTower(game, opt.slot.x, opt.slot.y);
          }
          game.slotMenuOpen = false;
          game.slotMenuOptions = [];
          ui.updateUI();
          return;
        }
      }
      // 点击菜单外部 → 关闭
      game.slotMenuOpen = false;
      game.slotMenuOptions = [];
      return;
    }

    // 2. 出售模式
    if (game.sellMode) {
      if (sellUnit(game, x, y)) {
        game.sellMode = false;
        document.getElementById('sellModeBtn').classList.remove('sell-active');
        canvas.classList.remove('sell-mode', 'blocker-mode');
        ui.selectUnit(game.selectedType);
      }
      return;
    }

    // 3. Shift+点击 → 升级近战单位
    if (game._shiftHeld) {
      for (const b of game.blockers) {
        if (!b.isDead && Math.hypot(b.x - x, b.y - y) < b.size + 10) {
          if (startUpgrade(game, b, false)) { ui.updateUI(); }
          return;
        }
      }
    }

    // 4. 点击已占用的塔位 → 显示升级菜单
    for (const s of game.slots) {
      if (s.occupied && s.tower && !s.tower.isDead && Math.hypot(s.x - x, s.y - y) < 22) {
        const tower = s.tower;
        const cost = getUpgradeCost(tower.type, true);
        if (tower.upgradeLevel < 3) {
          const ox = s.x - 42, oy = s.y > 420 ? s.y - 72 : s.y + 28;
          const opt = { x: ox, y: oy, w: 84, h: 62, isUpgrade: true, unit: tower, isTower: true, cost, level: tower.upgradeLevel };
          game.selectedSlot = s;
          game.slotMenuOptions = [opt];
          game.slotMenuBounds = { x: ox, y: oy, w: 84, h: 62 };
          game.slotMenuOpen = true;
        }
        return;
      }
    }

    // 5. 点击空闲塔位 → 显示建造菜单
    const slot = findNearestFreeSlot(x, y, 28, game);
    if (slot) {
      const types = game.level.availableTowers.filter(t => TOWER_DEFS[t]);
      if (types.length === 0) return;
      const cardW = 72, cardH = 62, gap = 6;
      const totalW = types.length * cardW + (types.length - 1) * gap;
      const menuX = Math.max(6, Math.min(894 - totalW, slot.x - totalW / 2));
      const menuY = slot.y > 420 ? slot.y - 82 : slot.y + 30;
      const options = [];
      types.forEach((type, i) => {
        options.push({
          x: menuX + i * (cardW + gap), y: menuY, w: cardW, h: cardH,
          type, isUpgrade: false, slot, def: TOWER_DEFS[type],
        });
      });
      game.selectedSlot = slot;
      game.slotMenuOptions = options;
      game.slotMenuBounds = { x: menuX, y: menuY, w: totalW, h: cardH };
      game.slotMenuOpen = true;
      return;
    }

    // 6. 阻挡单位（近战）— 保持原有方式
    placeBlocker(game, x, y);
    ui.updateUI();
  },
  onCanvasRightClick(x, y) { sellUnit(game, x, y); ui.updateUI(); },
  onNextWave() {
    // 游戏胜利 → 回主菜单
    if (game.gameWin) {
      game.gameWin = false; game.gameOver = false; game.levelComplete = false;
      ui.showCampaignSelect();
      return;
    }
    // 关卡完成 → 进入战役中的下一关
    if (game.levelComplete) {
      const nextIdx = getNextLevelInCampaign(game);
      if (nextIdx >= 0) {
        loadLevel(game, nextIdx);
        game.announcement = `🗺️ ${game.level.name}\n🔓 新解锁单位已就绪`;
        game.announcementTimer = 180;
        ui.updateUI(); ui.buildWaveBadges(); ui.updateTowerButtonLocks();
        ui.updateButtonState(); ui.updateTimerDisplay();
      } else {
        // 战役完成
        game.announcement = '🏆 战役完成！返回战场选择...';
        game.announcementTimer = 150;
        game.levelComplete = false;
        game.gameWin = false;
        ui.updateUI(); ui.updateButtonState(); ui.updateTimerDisplay();
        setTimeout(() => {
          game.announcement = null;
          game.announcementTimer = 0;
          ui.showCampaignSelect();
        }, 2500);
      }
      return;
    }
    if (game.isWaveActive) { forceSpawnEnemy(game); }
    else { game.waveAutoTimer = -1; game.waveAutoTotal = 0; ui.updateTimerDisplay(); ui.updateButtonState(); startWave(game); }
    ui.updateWaveBadges(); ui.updateButtonState(); ui.updateUI();
  },
  onMenuReturn() { ui.showMainMenu(); },
  onPause() { /* handled in ui.js */ },
  onRestart(idx) {
    const levelIdx = typeof idx === 'number' ? idx : 0;
    loadLevel(game, levelIdx);
    ui.selectUnit(game.selectedType);
    ui.buildWaveBadges(); ui.updateTowerButtonLocks();
    ui.updateUI(); ui.updateButtonState(); ui.updateTimerDisplay();
    document.getElementById('pauseBtn').classList.remove('pause-active');
    document.getElementById('pauseBtn').textContent = '⏯️ 暂停';
  },
  onAdvanceLevel() {
    const nextIdx = getNextLevelInCampaign(game);
    if (nextIdx >= 0) {
      loadLevel(game, nextIdx);
      game.announcement = `${game.level.name}\n新解锁单位已就绪`;
      game.announcementTimer = 180;
      ui.updateUI(); ui.buildWaveBadges(); ui.updateTowerButtonLocks();
      ui.updateButtonState(); ui.updateTimerDisplay();
    } else {
      ui.showCampaignSelect();
    }
  },
});

// 初始加载（默认第一关用于画布渲染）
game.level = LEVELS[0];
game.activeCampaign = game.level.campaignId;
game.pathLengths = computePathLengths(game.level.paths);
game.slots = game.level.towerSlots.map(s => ({ x: s.x, y: s.y, occupied: false, tower: null }));
game.trees = generateTrees(game.level, 900, 600);
game.roadStones = generateRoadStones(game.level.paths);
game.hp = game.level.startHp;
game.gold = game.level.startGold;
game.wave = 1;
game.menuOpen = true;
game.isWaveActive = false;
game.waveAutoTimer = -1;

// 初始显示一级主页面
document.getElementById('mainMenuOverlay').classList.remove('hidden');
document.getElementById('menuOverlay').classList.add('hidden');
document.getElementById('campaignOverlay').classList.add('hidden');
document.getElementById('saveOverlay').classList.add('hidden');

ui.buildWaveBadges();
ui.updateTowerButtonLocks();
ui.updateUI();
ui.updateButtonState();
document.getElementById('timerStat').style.display = 'none';

// 固定时间步长游戏循环（解决高刷显示器游戏加速问题）
const FIXED_DT = 1000 / 60; // 16.67ms = 60fps
let lastTime = 0;
let accumulator = 0;

function gameLoop(timestamp) {
  if (lastTime === 0) lastTime = timestamp;
  let elapsed = timestamp - lastTime;
  lastTime = timestamp;

  // 防止切后台回来时的大跳跃（最多积压200ms）
  if (elapsed > 200) elapsed = 200;

  if (!game.menuOpen && !game.paused) {
    accumulator += elapsed;
    while (accumulator >= FIXED_DT) {
      update(game);
      accumulator -= FIXED_DT;
    }
    ui.updateUI();
    ui.updateButtonState();
    ui.updateTimerDisplay();
  }

  draw(game, ctx, 900, 600);
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
