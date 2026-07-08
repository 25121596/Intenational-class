import { TOWER_DEFS, BLOCKER_DEFS, ENEMY_PROTO, LEVELS, CAMPAIGNS, getUnitDisplayName, generateEndlessWave, TOWER_BRANCHES } from './config.js';
import { toggleMute, isMuted } from './music.js';

// ---- 存档系统 ----
const SAVE_KEY = 'iron_hearts_saves_v2';

function loadSaves() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { slots: [null, null, null], progress: {} };
    return JSON.parse(raw);
  } catch { return { slots: [null, null, null], progress: {} }; }
}

function saveSaves(data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch {}
}

function getCampaignProgress(data, campaignId) {
  if (!data.progress[campaignId]) {
    data.progress[campaignId] = { completedLevels: [], unlocked: true };
  }
  return data.progress[campaignId];
}

function markLevelCompleted(data, campaignId, levelIndex, stars) {
  const prog = getCampaignProgress(data, campaignId);
  if (!prog.completedLevels.includes(levelIndex)) {
    prog.completedLevels.push(levelIndex);
  }
  // 保存星级（保留最佳成绩）
  if (!prog.stars) prog.stars = {};
  const prevStars = prog.stars[levelIndex] || 0;
  if ((stars || 0) > prevStars) {
    prog.stars[levelIndex] = stars;
  }
  saveSaves(data);
}

export function setupUI(game, callbacks) {
  const {
    onSelectUnit, onSellMode, onNextWave, onMenuReturn, onPause,
    onCanvasClick, onCanvasRightClick, onRestart, onAdvanceLevel,
  } = callbacks;

  // ====== DOM refs ======
  const canvas = document.getElementById('gameCanvas');
  const hpSpan = document.getElementById('hpDisplay');
  const goldSpan = document.getElementById('goldDisplay');
  const waveSpan = document.getElementById('waveDisplay');
  const waveMaxSpan = document.getElementById('waveMaxDisplay');
  const killSpan = document.getElementById('killDisplay');
  const lvSpan = document.getElementById('lvDisplay');
  const lvTotalSpan = document.getElementById('lvTotalDisplay');
  const levelNameSpan = document.getElementById('levelName');
  const waveBadgesContainer = document.getElementById('waveBadges');
  const nextWaveBtn = document.getElementById('nextWaveBtn');
  const sellModeBtn = document.getElementById('sellModeBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const muteBtn = document.getElementById('muteBtn');
  const restartBtn = document.getElementById('restartBtn');
  const timerStat = document.getElementById('timerStat');
  const timerDisplay = document.getElementById('timerDisplay');
  const wavePreview = document.getElementById('wavePreview');
  const airstrikeBtn = document.getElementById('airstrikeBtn');

  // Overlays
  const mainMenuOverlay = document.getElementById('mainMenuOverlay');
  const saveOverlay = document.getElementById('saveOverlay');
  const campaignOverlay = document.getElementById('campaignOverlay');
  const menuOverlay = document.getElementById('menuOverlay');

  // Main menu
  const mainStartBtn = document.getElementById('mainStartBtn');
  const mainSaveMgrBtn = document.getElementById('mainSaveMgrBtn');
  const mainTutorialBtn = document.getElementById('mainTutorialBtn');
  const mainQuitBtn = document.getElementById('mainQuitBtn');

  // Difficulty selector
  const diffBtns = document.querySelectorAll('.diff-btn');

  // Save page
  const saveSlots = document.getElementById('saveSlots');
  const saveBackBtn = document.getElementById('saveBackBtn');
  const saveClearAllBtn = document.getElementById('saveClearAllBtn');

  // Campaign page
  const campaignGrid = document.getElementById('campaignGrid');
  const campaignBackBtn = document.getElementById('campaignBackBtn');

  // Level grid
  const menuLevelGrid = document.getElementById('menuLevelGrid');
  const menuCampaignTitle = document.getElementById('menuCampaignTitle');
  const menuCampaignSubtitle = document.getElementById('menuCampaignSubtitle');
  const menuBackToCampaignBtn = document.getElementById('menuBackToCampaignBtn');
  const menuTutorialBtn2 = document.getElementById('menuTutorialBtn2');
  const menuReturnBtn = document.getElementById('menuReturnBtn');

  // Encyclopedia
  const encyOverlay = document.getElementById('encyclopediaOverlay');
  const encyContent = document.getElementById('encyContent');
  const encyTabs = document.getElementById('encyTabs');
  const encyBackBtn = document.getElementById('encyBackBtn');

  // Blocker buttons (塔按钮已移除，改为点击炮位弹出菜单)
  const blockerButtons = {
    infantry: document.getElementById('btnInfantry'),
    defender: document.getElementById('btnDefender'),
  };

  // ====== 存档数据 ======
  let saveData = loadSaves();
  let selectedCampaignId = null;

  // ====== 坐标转换 ======
  function getCanvasCoords(mx, my) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (mx - rect.left) * scaleX, y: (my - rect.top) * scaleY };
  }

  // ====== UI 更新 ======
  function updateUI() {
    hpSpan.textContent = Math.max(0, Math.floor(game.hp));
    const newGold = Math.floor(game.gold);
    if (newGold !== parseInt(goldSpan.textContent)) {
      goldSpan.parentElement.classList.remove('bounce');
      void goldSpan.parentElement.offsetWidth; // reflow
      goldSpan.parentElement.classList.add('bounce');
    }
    goldSpan.textContent = newGold;
    waveSpan.textContent = Math.min(game.wave, game.level.waves.length);
    waveMaxSpan.textContent = game.level.waves.length;
    killSpan.textContent = game.kills;
    lvSpan.textContent = game.levelIndex + 1;
    if (lvTotalSpan) lvTotalSpan.textContent = LEVELS.length;
    levelNameSpan.textContent = game.level.name + ' — ' + game.level.desc;
    updateTowerButtonLabels();
  }

  /** 根据当前战役更新阻挡按钮的文字 */
  function updateTowerButtonLabels() {
    const cid = game.activeCampaign;
    if (blockerButtons.infantry) {
      blockerButtons.infantry.textContent = '🛡️ 轻步兵 60💰';
    }
    if (blockerButtons.defender) {
      const dName = getUnitDisplayName('defender', cid);
      blockerButtons.defender.textContent = `🪖 ${dName} 120💰`;
    }
  }

  function updateButtonState() {
    if (game.gameWin) { nextWaveBtn.disabled = false; nextWaveBtn.textContent = '↩️ 返回战役选择'; nextWaveBtn.classList.remove('auto-countdown'); return; }
    if (game.levelComplete) {
      nextWaveBtn.disabled = false; nextWaveBtn.textContent = '▶ 进入下一关'; nextWaveBtn.classList.remove('auto-countdown');
      // 自动存档
      autoSave();
      return;
    }
    if (game.isWaveActive) {
        nextWaveBtn.disabled = true; nextWaveBtn.textContent = '🔥 战斗中...'; nextWaveBtn.classList.remove('auto-countdown');
    }
    else if (game.waveAutoTimer > 0) { nextWaveBtn.disabled = false; nextWaveBtn.textContent = `⚡ 下一波 (${Math.ceil(game.waveAutoTimer / 60)}s)`; nextWaveBtn.classList.add('auto-countdown'); }
    else { const totalW = game.endless ? '∞' : game.level.waves.length; nextWaveBtn.disabled = false; nextWaveBtn.textContent = `⚡ 下一波 (${game.wave}/${totalW})`; nextWaveBtn.classList.remove('auto-countdown'); }
  }

  function updateTimerDisplay() {
    if (game.waveAutoTimer > 0 && !game.isWaveActive && !game.gameOver && !game.gameWin && !game.levelComplete) {
      timerStat.style.display = 'flex'; timerDisplay.textContent = Math.ceil(game.waveAutoTimer / 60);
    } else { timerStat.style.display = 'none'; }
    waveMaxSpan.textContent = game.endless ? '∞' : game.level.waves.length;
    updateWavePreview();
  }

  function updateWavePreview() {
    if (!wavePreview || game.gameOver || game.gameWin || game.levelComplete) {
      if (wavePreview) wavePreview.style.display = 'none';
      return;
    }
    const actualNext = game.isWaveActive ? game.wave + 1 : game.wave;
    const enemyNames = { rifleman: '步兵', assault: '突击兵', armored: '装甲兵', tank: '坦克', boss_tank: '红坦克', maus: '鼠式', plane: '飞机', medic: '医疗兵' };
    let cfg;
    if (game.endless) {
      cfg = generateEndlessWave(actualNext);
    } else {
      if (actualNext > game.level.waves.length) { wavePreview.style.display = 'none'; return; }
      cfg = game.level.waves[actualNext - 1];
    }
    if (!cfg) { wavePreview.style.display = 'none'; return; }
    const parts = cfg.enemies.map(e => `${enemyNames[e.t] || e.t}×${e.c}`).join(' · ');
    const totalWaves = game.endless ? '∞' : game.level.waves.length;
    const label = game.isWaveActive ? `👁 下一波(${actualNext}/${totalWaves}): ` : `👁 第${actualNext}波: `;
    wavePreview.textContent = label + parts;
    wavePreview.style.display = 'inline-block';
  }

  function selectUnit(type) {
    game.selectedType = type; game.sellMode = false; game.upgradeMode = false;
    game.slotMenuOpen = false; game.slotMenuOptions = [];
    sellModeBtn.classList.remove('sell-active');
    canvas.classList.remove('sell-mode', 'blocker-mode');
    for (const b of Object.values(blockerButtons)) b.classList.remove('active-blocker');
    const btn = blockerButtons[type];
    if (btn) btn.classList.add('active-blocker');
    if (BLOCKER_DEFS[type]) canvas.classList.add('blocker-mode');
  }

  function buildWaveBadges() {
    waveBadgesContainer.innerHTML = '';
    for (let i = 1; i <= game.level.waves.length; i++) {
      const dot = document.createElement('span');
      dot.className = 'wave-dot current'; dot.dataset.wave = i; dot.textContent = i;
      waveBadgesContainer.appendChild(dot);
    }
  }

  function updateWaveBadges() {
    waveBadgesContainer.querySelectorAll('.wave-dot').forEach(dot => {
      const w = parseInt(dot.dataset.wave);
      dot.classList.remove('done', 'active', 'current');
      if (w < game.wave || (game.waveComplete && w === game.wave && !game.levelComplete)) dot.classList.add('done');
      else if (w === game.wave && game.isWaveActive) dot.classList.add('active');
      else if (w === game.wave && !game.isWaveActive && !game.levelComplete) dot.classList.add('current');
    });
  }

  function updateTowerButtonLocks() {
    for (const [type, btn] of Object.entries(blockerButtons)) btn.disabled = !game.level.availableTowers.includes(type);
  }

  function updateAirstrikeUI() {
    if (!airstrikeBtn) return;
    if (game.airstrikeArming) {
      airstrikeBtn.textContent = '🛩️ 取消空袭';
      airstrikeBtn.classList.add('active-tower');
      airstrikeBtn.disabled = false;
      return;
    }
    airstrikeBtn.classList.remove('active-tower');
    if (game.airstrikeCd > 0) {
      airstrikeBtn.textContent = `🛩️ 空袭(${Math.ceil(game.airstrikeCd / 60)}s)`;
      airstrikeBtn.disabled = true;
    } else {
      airstrikeBtn.textContent = `🛩️ 空袭(${game.airstrikeDmg})`;
      airstrikeBtn.disabled = (game.gameOver || game.gameWin || game.levelComplete);
    }
  }

  function togglePause() {
    if (game.menuOpen || game.gameOver || game.gameWin || game.levelComplete) return;
    game.paused = !game.paused;
    if (game.paused) { pauseBtn.classList.add('pause-active'); pauseBtn.textContent = '▶ 继续'; game.announcement = '⏸️ 游戏暂停'; game.announcementTimer = 9999; }
    else { pauseBtn.classList.remove('pause-active'); pauseBtn.textContent = '⏯️ 暂停'; game.announcement = null; game.announcementTimer = 0; }
  }

  // ====== 页面导航 ======
  function hideAllOverlays() {
    mainMenuOverlay.classList.add('hidden');
    saveOverlay.classList.add('hidden');
    campaignOverlay.classList.add('hidden');
    menuOverlay.classList.add('hidden');
    encyOverlay.classList.add('hidden');
  }

  function showMainMenu() {
    hideAllOverlays();
    mainMenuOverlay.classList.remove('hidden');
    game.menuOpen = true; game.paused = false;
    game.airstrikeArming = false; canvas.classList.remove('airstrike-arming');
    game.isWaveActive = false; game.waveAutoTimer = -1;
    pauseBtn.classList.remove('pause-active'); pauseBtn.textContent = '⏯️ 暂停';
    updateButtonState(); updateTimerDisplay(); timerStat.style.display = 'none';
  }

  function showSaveManager() {
    hideAllOverlays();
    saveOverlay.classList.remove('hidden');
    renderSaveSlots();
  }

  function showCampaignSelect() {
    hideAllOverlays();
    campaignOverlay.classList.remove('hidden');
    game.menuOpen = true; game.paused = false;
    renderCampaignGrid();
  }

  function showLevelGrid(campaignId) {
    hideAllOverlays();
    selectedCampaignId = campaignId;
    const campaign = CAMPAIGNS.find(c => c.id === campaignId);
    menuCampaignTitle.textContent = `⚔️ ${campaign.name}`;
    menuCampaignSubtitle.textContent = campaign.subtitle;
    menuOverlay.classList.remove('hidden');
    renderLevelGrid();
  }

  function showGame() {
    hideAllOverlays();
    game.menuOpen = false;
    game.paused = false;
  }

  // ====== 存档渲染 ======
  function renderSaveSlots() {
    saveSlots.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const slotData = saveData.slots[i];
      const div = document.createElement('div');
      div.className = 'save-slot';
      if (slotData) {
        const lvl = LEVELS[slotData.levelIndex];
        const campaign = CAMPAIGNS.find(c => c.id === slotData.campaignId);
        const date = new Date(slotData.timestamp).toLocaleString('zh-CN');
        div.innerHTML = `
          <div class="save-info">
            <div class="save-name">📁 存档 ${i + 1}</div>
            <div class="save-meta">${campaign ? campaign.name : '?'} · ${lvl ? lvl.name : '?'} · 第${slotData.wave}波 · 💰${slotData.gold} · ${date}</div>
          </div>
          <div class="save-actions">
            <button class="load-btn" data-action="load" data-slot="${i}">📥 读取</button>
            <button class="del-btn" data-action="delete" data-slot="${i}">🗑️</button>
          </div>`;
        // Load
        div.querySelector('.load-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          loadGameFromSlot(i);
        });
        // Delete
        div.querySelector('.del-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`确定删除存档 ${i + 1}？`)) {
            saveData.slots[i] = null;
            saveSaves(saveData);
            renderSaveSlots();
          }
        });
      } else {
        div.classList.add('empty');
        div.innerHTML = `💾 存档 ${i + 1} — 空`;
        div.addEventListener('click', () => {
          saveGameToSlot(i);
          renderSaveSlots();
        });
      }
      saveSlots.appendChild(div);
    }
  }

  function saveGameToSlot(slotIndex) {
    if (!game.level || game.gameOver) {
      alert('请先在游戏中开始一关再存档！');
      return;
    }
    saveData.slots[slotIndex] = {
      campaignId: game.activeCampaign || game.level.campaignId,
      levelIndex: game.levelIndex,
      wave: game.wave,
      hp: game.hp,
      gold: game.gold,
      kills: game.kills,
      difficulty: game.difficulty,
      timestamp: Date.now(),
    };
    // Also record progress
    if (game.levelComplete || game.wave > 1) {
      const prog = getCampaignProgress(saveData, game.activeCampaign || game.level.campaignId);
      // Mark all prior levels in this campaign as completed
      const camp = CAMPAIGNS.find(c => c.id === (game.activeCampaign || game.level.campaignId));
      if (camp) {
        for (const li of camp.levels) {
          if (li < game.levelIndex && !prog.completedLevels.includes(li)) {
            prog.completedLevels.push(li);
          }
        }
      }
      // Save current level's stars if available
      if (game.levelStars > 0) {
        if (!prog.stars) prog.stars = {};
        const prev = prog.stars[game.levelIndex] || 0;
        if (game.levelStars > prev) prog.stars[game.levelIndex] = game.levelStars;
      }
    }
    saveSaves(saveData);
  }

  function autoSave() {
    if (!game.level || game.gameOver) return;
    // Auto-save to slot 0
    saveData.slots[0] = {
      campaignId: game.activeCampaign || game.level.campaignId,
      levelIndex: game.levelComplete ? Math.min(game.levelIndex + 1, LEVELS.length - 1) : game.levelIndex,
      wave: 1,
      hp: game.levelComplete ? LEVELS[Math.min(game.levelIndex + 1, LEVELS.length - 1)].startHp : game.hp,
      gold: game.levelComplete ? LEVELS[Math.min(game.levelIndex + 1, LEVELS.length - 1)].startGold : game.gold,
      kills: game.kills,
      difficulty: game.difficulty,
      timestamp: Date.now(),
    };
    // Record campaign progress + star rating
    const cid = game.activeCampaign || game.level.campaignId;
    markLevelCompleted(saveData, cid, game.levelIndex, game.levelStars || 0);
    saveSaves(saveData);
  }

  function loadGameFromSlot(slotIndex) {
    const slotData = saveData.slots[slotIndex];
    if (!slotData) return;
    if (!callbacks.onRestart) return;
    // Load the saved level
    const idx = slotData.levelIndex;
    if (idx < 0 || idx >= LEVELS.length) return;
    callbacks.onRestart(idx);
    game.hp = slotData.hp;
    game.gold = slotData.gold;
    game.kills = slotData.kills || 0;
    game.difficulty = slotData.difficulty || 'private';
    updateDiffButtons();
    game.wave = slotData.wave || 1;
    game.isWaveActive = false;
    game.waveComplete = false;
    game.levelComplete = false;
    game.gameOver = false;
    game.gameWin = false;
    game.menuOpen = false;
    game.paused = false;
    game.enemies = [];
    game.projectiles = [];
    game.enemyProjectiles = [];
    game.particles = [];
    game.deployments = [];
    game.towers = [];
    game.blockers = [];
    game.slots = game.level.towerSlots.map(s => ({ x: s.x, y: s.y, occupied: false, tower: null }));
    game.waveAutoTimer = -1;
    game.waveAutoTotal = 0;
    hideAllOverlays();
    updateUI();
    buildWaveBadges();
    updateTowerButtonLocks();
    updateButtonState();
    updateTimerDisplay();
    timerStat.style.display = 'none';
  }

  // ====== 战役网格渲染 ======
  function renderCampaignGrid() {
    campaignGrid.innerHTML = '';
    CAMPAIGNS.forEach(camp => {
      const card = document.createElement('div');
      card.className = 'campaign-card';
      if (!camp.unlocked) card.classList.add('locked');

      const icons = { europe: '🗽', soviet: '⭐', germany: '⚡' };
      const icon = icons[camp.id] || '🗺️';
      const completedCount = saveData.progress[camp.id]?.completedLevels?.length || 0;
      const totalLevels = camp.levels.length;
      const progressText = camp.levels.length === 0
        ? '开发中'
        : `${completedCount}/${totalLevels} 关已通过`;

      card.innerHTML = `
        <div class="campaign-icon">${icon}</div>
        <div class="campaign-info">
          <div class="campaign-name">${camp.name}</div>
          <div class="campaign-sub">${camp.subtitle}</div>
          <div class="campaign-desc">${camp.description}</div>
        </div>
        <div class="campaign-badge ${camp.levels.length === 0 ? 'coming-soon' : 'available'}">${progressText}</div>
      `;

      if (camp.unlocked && camp.levels.length > 0) {
        card.addEventListener('click', () => showLevelGrid(camp.id));
      } else if (camp.unlocked && camp.levels.length === 0) {
        card.addEventListener('click', () => {
          alert('🚧 更多关卡开发中，敬请期待！');
        });
      }

      campaignGrid.appendChild(card);
    });
  }

  // ====== 关卡网格渲染 ======
  function renderLevelGrid() {
    menuLevelGrid.innerHTML = '';
    const campaign = CAMPAIGNS.find(c => c.id === selectedCampaignId);
    if (!campaign) return;

    const prog = getCampaignProgress(saveData, selectedCampaignId);

    campaign.levels.forEach((levelIdx, posInCampaign) => {
      const lvl = LEVELS[levelIdx];
      if (!lvl) return;
      const card = document.createElement('div');
      card.className = 'menu-level-card';

      const isCompleted = prog.completedLevels.includes(levelIdx);
      const stars = (prog.stars && prog.stars[levelIdx]) || 0;
      // First level or first uncompleted level gets recommended
      if (posInCampaign === 0 && !isCompleted) card.classList.add('recommended');
      if (isCompleted) card.classList.add('completed');

      const starsHTML = isCompleted
        ? `<div class="lv-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>`
        : `<div class="lv-stars">☆☆☆</div>`;

      card.innerHTML = `
        <div class="lv-num">LV.${levelIdx + 1}</div>
        <div class="lv-name">${lvl.name.split('. ')[1] || lvl.name}</div>
        <div class="lv-desc">${lvl.desc}</div>
        <div class="lv-waves">${lvl.waves.length}波 | ${lvl.startGold}金币 | ${lvl.startHp}生命</div>
        ${starsHTML}
      `;

      // Level is unlocked if it's the first, or the previous level is completed
      const isUnlocked = posInCampaign === 0 || prog.completedLevels.includes(campaign.levels[posInCampaign - 1]);
      if (!isUnlocked && !isCompleted) {
        card.classList.add('locked');
        card.addEventListener('click', () => {
          alert('🔒 请先通过前一关！');
        });
      } else {
        card.addEventListener('click', () => {
          if (callbacks.onRestart) callbacks.onRestart(levelIdx);
          showGame();
        });
      }

      menuLevelGrid.appendChild(card);
    });
  }

  // ====== 事件绑定 ======

  // 主菜单
  mainStartBtn.addEventListener('click', showCampaignSelect);
  mainSaveMgrBtn.addEventListener('click', showSaveManager);
  mainQuitBtn.addEventListener('click', () => {
    if (confirm('确定要退出游戏吗？')) document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#1a1e2a;color:#8892a8;font-family:sans-serif;font-size:1.2rem;">游戏已关闭，可关闭此标签页</div>';
  });

  // 难度选择
  diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const diff = btn.dataset.diff;
      if (!diff) return;
      game.difficulty = diff;
      updateDiffButtons();
    });
  });

  function updateDiffButtons() {
    diffBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.diff === game.difficulty);
    });
  }
  // 初始同步难度按钮状态
  updateDiffButtons();

  // 存档页面
  saveBackBtn.addEventListener('click', showMainMenu);
  saveClearAllBtn.addEventListener('click', () => {
    if (confirm('确定要清除全部存档吗？此操作不可撤销！')) {
      saveData = { slots: [null, null, null], progress: {} };
      saveSaves(saveData);
      renderSaveSlots();
    }
  });

  // 战场选择
  campaignBackBtn.addEventListener('click', showMainMenu);

  // 关卡选择
  menuBackToCampaignBtn.addEventListener('click', showCampaignSelect);

  // 返回主菜单按钮(游戏内)
  menuReturnBtn.addEventListener('click', showMainMenu);

  // ---- 图鉴 ----
  function showEncyclopedia(fromPage) {
    hideAllOverlays();
    encyOverlay.classList.remove('hidden');
    game.menuOpen = true; game.paused = false;
    renderEncyTab('friendly');
  }

  function renderEncyTab(tab) {
    encyTabs.querySelectorAll('.ency-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    if (tab === 'friendly') renderFriendlyTab();
    else if (tab === 'enemy') renderEnemyTab();
    else if (tab === 'skills') renderSkillsTab();
    else if (tab === 'hotkeys') renderHotkeysTab();
  }

  function renderFriendlyTab() {
    const units = [
      ...Object.entries(TOWER_DEFS).map(([k, v]) => ({ ...v, key: k, isTower: true })),
      ...Object.entries(BLOCKER_DEFS).map(([k, v]) => ({ ...v, key: k, isTower: false })),
    ];
    encyContent.innerHTML = units.map(u => {
      const branches = u.isTower ? TOWER_BRANCHES[u.key] : null;
      const branchHTML = branches ? `
        <div class="ec-desc" style="margin-top:4px;color:#ffd700;">🔀 3级分支:</div>
        <div class="ec-stats" style="color:#b89840;">
          ${branches.a.icon} ${branches.a.name}: ${branches.a.desc}<br>
          ${branches.b.icon} ${branches.b.name}: ${branches.b.desc}
        </div>` : '';
      return `
      <div class="ency-card">
        <div class="ec-name">${u.isTower ? '🏰' : '🛡️'} ${u.name}</div>
        <div class="ec-desc">${u.isTower ? '远程炮塔' : '近战阻挡单位'} ${u.rng ? '· 带远程攻击' : ''} ${u.isSplash ? '· 范围溅射' : ''} ${u.canTargetFlying ? '· 可对空' : ''}</div>
        <div class="ec-stats">
          伤害:${u.damage} | 范围:${u.range || u.rng || '-'} | 攻速:${u.cooldown || u.attackInterval}frames<br>
          血量:${u.hp} | ${u.isTower ? '溅射:' + (u.splashRadius || '无') : '阻挡:' + u.blockCount + '敌'}
        </div>
        <div class="ec-cost">💰 ${u.cost} 金币</div>
        ${branchHTML}
      </div>`;
    }).join('');
  }

  function renderEnemyTab() {
    const enemies = Object.entries(ENEMY_PROTO).map(([k, v]) => ({ ...v, key: k }));
    encyContent.innerHTML = enemies.map(e => `
      <div class="ency-card">
        <div class="ec-name">${e.flying ? '✈️' : e.healer ? '✚' : e.ranged ? '🔫' : '👤'} ${e.type === 'maus' ? '鼠式坦克' : e.type === 'boss_tank' ? '红坦克' : e.type === 'tank' ? '坦克' : e.type === 'armored' ? '装甲兵' : e.type === 'assault' ? '突击兵' : e.type === 'plane' ? '轰炸机' : e.type === 'medic' ? '医疗兵' : '步兵'}</div>
        <div class="ec-desc">${e.flying ? '飞行单位·免疫近战阻挡' : e.healer ? '治疗周围友军' : e.ranged ? '远程攻击' : '近战攻击'} | 速度:${e.speed.toFixed(2)}</div>
        <div class="ec-stats">
          血量:${e.hp} | 伤害:${e.atkDmg} | 击杀奖励:${e.reward}💰
          ${e.ranged ? ` | 远程:${e.rDmg}伤害 ${e.range}范围` : ''}
          ${e.healer ? ` | 治疗:${e.healAmount}/跳 ${e.healRange}范围` : ''}
        </div>
        <div class="ec-cost">💰 击杀奖励: ${e.reward} 金币</div>
      </div>`).join('');
  }

  function renderSkillsTab() {
    encyContent.innerHTML = `
      <div class="ency-card" style="grid-column:1/-1">
        <div class="ec-name">🛩️ 空袭技能</div>
        <div class="ec-desc">点击空袭按钮后选择目标地点，对范围内所有敌人造成伤害</div>
        <div class="ec-stats">伤害:55 | 范围:120 | 冷却:15秒</div>
      </div>
      <div class="ency-card" style="grid-column:1/-1">
        <div class="ec-name">⬆️ 单位升级</div>
        <div class="ec-desc">Lv.1→2: 伤害+25% HP+10% 射程+5% | Lv.2→3: 二选一分支升级</div>
        <div class="ec-stats">最多⭐⭐⭐ | 费用:部署费×1.3(分支×1.15) | 升级回复50%血量</div>
      </div>
      <div class="ency-card" style="grid-column:1/-1">
        <div class="ec-name">⭐ 星级评价</div>
        <div class="ec-desc">通关时根据剩余血量评定: ⭐⭐⭐(≥18血) ⭐⭐(6-17) ⭐(1-5) 满血=完美作战</div>
      </div>
    `;
  }

  function renderHotkeysTab() {
    const keys = [
      ['1', '选择轻步兵'], ['2', '选择掷弹兵/游骑兵'],
      ['S', '出售模式'], ['U', '升级模式'],
      ['Space', '暂停/继续'], ['Esc', '暂停/返回菜单'],
      ['Shift+点击', '快速升级单位'], ['右键', '出售单位'],
      ['点击炮位', '建造/升级塔'], ['点击路径', '部署阻挡兵'],
    ];
    encyContent.innerHTML = keys.map(([k, v]) => `
      <div class="ency-hotkey-row"><span>${v}</span><span class="key">${k}</span></div>
    `).join('');
  }

  encyTabs.querySelectorAll('.ency-tab').forEach(tab => {
    tab.addEventListener('click', () => renderEncyTab(tab.dataset.tab));
  });
  encyBackBtn.addEventListener('click', showMainMenu);
  mainTutorialBtn.addEventListener('click', () => showEncyclopedia('main'));
  menuTutorialBtn2.addEventListener('click', () => showEncyclopedia('level'));

  // Canvas
  canvas.addEventListener('click', (e) => {
    if (game.menuOpen) return;
    if (game.paused && !game.gameOver && !game.gameWin && !game.levelComplete) { togglePause(); return; }
    if (game.gameOver) { callbacks.onRestart(); return; }
    if (game.gameWin) return;
    if (game.levelComplete) { callbacks.onAdvanceLevel(); return; }
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    callbacks.onCanvasClick(x, y);
  });
  canvas.addEventListener('mousemove', (e) => {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    game.mouseX = x; game.mouseY = y;
  });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (game.menuOpen || game.paused || game.gameOver || game.gameWin || game.levelComplete) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    callbacks.onCanvasRightClick(x, y);
  });

  // Blocker buttons
  for (const [type, btn] of Object.entries(blockerButtons)) {
    btn.addEventListener('click', () => {
      if (btn.disabled || game.menuOpen || game.paused) return;
      selectUnit(type);
    });
  }

  pauseBtn.addEventListener('click', togglePause);
  muteBtn.addEventListener('click', () => {
    const nowMuted = toggleMute();
    muteBtn.textContent = nowMuted ? '🔇' : '🔊';
  });
  sellModeBtn.addEventListener('click', () => {
    if (game.menuOpen || game.paused) return;
    game.sellMode = !game.sellMode;
    game.slotMenuOpen = false; game.slotMenuOptions = [];
    if (game.sellMode) {
      sellModeBtn.classList.add('sell-active');
      canvas.classList.add('sell-mode');
      canvas.classList.remove('blocker-mode');
      for (const b of Object.values(blockerButtons)) b.classList.remove('active-blocker');
    } else {
      sellModeBtn.classList.remove('sell-active');
      canvas.classList.remove('sell-mode');
      selectUnit(game.selectedType);
    }
  });

  airstrikeBtn.addEventListener('click', () => {
    if (game.airstrikeArming) {
      game.airstrikeArming = false; canvas.classList.remove('airstrike-arming');
      airstrikeBtn.textContent = '🛩️ 空袭'; return;
    }
    if (game.airstrikeCd > 0 || game.gameOver || game.gameWin || game.levelComplete || game.menuOpen || game.paused) return;
    game.airstrikeArming = true;
    canvas.classList.add('airstrike-arming');
    game.announcement = '🛩️ 点击地图选择空袭目标'; game.announcementTimer = 120;
  });

  restartBtn.addEventListener('click', () => {
    if (game.menuOpen) return;
    if (game.paused) { togglePause(); }
    if (confirm('确定要重新开始本关吗？当前进度将丢失。')) {
      callbacks.onRestart(game.endless ? 'endless' : game.levelIndex);
      updateUI(); buildWaveBadges(); updateTowerButtonLocks();
      updateButtonState(); updateTimerDisplay();
    }
  });

  nextWaveBtn.addEventListener('click', () => {
    if (game.menuOpen || game.paused) return;
    callbacks.onNextWave();
  });

  // Keyboard
  // Shift键追踪（用于快速升级）
  document.addEventListener('keydown', (e) => { if (e.key === 'Shift') game._shiftHeld = true; });
  document.addEventListener('keyup', (e) => { if (e.key === 'Shift') game._shiftHeld = false; });

  document.addEventListener('keydown', (e) => {
    // Global: Escape always goes to main menu
    if (e.key === 'Escape') {
      if (!mainMenuOverlay.classList.contains('hidden')) return;
      if (!saveOverlay.classList.contains('hidden')) { showMainMenu(); return; }
      if (!campaignOverlay.classList.contains('hidden')) { showMainMenu(); return; }
      if (!menuOverlay.classList.contains('hidden')) { showCampaignSelect(); return; }
      // 游戏中：Esc 切换暂停
      if (!game.menuOpen && !game.gameOver && !game.gameWin && !game.levelComplete) {
        togglePause(); return;
      }
      showMainMenu();
      return;
    }

    if (game.menuOpen) {
      if (!menuOverlay.classList.contains('hidden')) {
        if (e.key >= '1' && e.key <= '9') {
          const campaign = CAMPAIGNS.find(c => c.id === selectedCampaignId);
          if (campaign) {
            const posInCampaign = parseInt(e.key) - 1;
            if (posInCampaign < campaign.levels.length) {
              const prog = getCampaignProgress(saveData, selectedCampaignId);
              const isUnlocked = posInCampaign === 0 || prog.completedLevels.includes(campaign.levels[posInCampaign - 1]);
              if (isUnlocked) {
                callbacks.onRestart(campaign.levels[posInCampaign]);
                showGame();
              }
            }
          }
        }
      }
      return;
    }
    if (game.gameOver || game.gameWin || game.levelComplete || game.paused) return;
    const keyMap = { '1': 'infantry', '2': 'defender' };
    if (keyMap[e.key] && game.level.availableTowers.includes(keyMap[e.key])) {
      selectUnit(keyMap[e.key]);
      return;
    }
    if (e.key.toLowerCase() === 's') {
      game.sellMode = !game.sellMode;
      game.slotMenuOpen = false; game.slotMenuOptions = [];
      if (game.sellMode) {
        sellModeBtn.classList.add('sell-active');
        canvas.classList.add('sell-mode');
        canvas.classList.remove('blocker-mode');
        for (const b of Object.values(blockerButtons)) b.classList.remove('active-blocker');
      } else {
        sellModeBtn.classList.remove('sell-active');
        canvas.classList.remove('sell-mode');
        selectUnit(game.selectedType);
      }
    } else if (e.key === ' ') {
      e.preventDefault();
      togglePause();
    }
  });

  // ====== 旧的 renderMenu 兼容 ======
  function renderMenuCompat() {
    // Just redirect to level grid for the default campaign
    showCampaignSelect();
  }

  return {
    updateUI, updateButtonState, updateTimerDisplay, updateAirstrikeUI,
    selectUnit, buildWaveBadges, updateWaveBadges,
    updateTowerButtonLocks, showMainMenu, renderMenu: renderMenuCompat,
    getCanvasCoords, togglePause,
    showCampaignSelect, showLevelGrid, showGame,
    updateTowerButtonLabels,
  };
}
