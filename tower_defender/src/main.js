import './style.css';
import { createGameState, loadLevel, startWave,
         placeTower, placeBlocker, sellUnit, forceSpawnEnemy, update, startUpgrade } from './game.js';
import { draw } from './draw.js';
import { setupUI } from './ui.js';
import { LEVELS, CAMPAIGNS } from './config.js';
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
    if (game.sellMode) {
      if (sellUnit(game, x, y)) {
        game.sellMode = false;
        document.getElementById('sellModeBtn').classList.remove('sell-active');
        canvas.classList.remove('sell-mode', 'blocker-mode');
        ui.selectUnit(game.selectedType);
      }
      return;
    }
    if (game.upgradeMode || game._shiftHeld) {
      // 升级模式 或 Shift+点击 → 升级单位
      let found = null; let isTower = true;
      for (const t of game.towers) {
        if (!t.isDead && Math.hypot(t.x - x, t.y - y) < t.size + 10) { found = t; isTower = true; break; }
      }
      if (!found) {
        for (const b of game.blockers) {
          if (!b.isDead && Math.hypot(b.x - x, b.y - y) < b.size + 10) { found = b; isTower = false; break; }
        }
      }
      if (found && startUpgrade(game, found, isTower)) {
        ui.updateUI();
      }
      return;
    }
    if (game.selectedType in { machine:1, cannon:1, howitzer:1 }) {
      if (!game.level.availableTowers.includes(game.selectedType)) return;
      placeTower(game, x, y);
      ui.updateUI();
    } else {
      placeBlocker(game, x, y);
    }
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
