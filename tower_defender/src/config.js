// 战役定义
export const CAMPAIGNS = [
  {
    id: 'europe',
    name: '为了自由',
    subtitle: '欧美战役',
    description: '从诺曼底滩头到柏林，解放欧洲大陆',
    levels: [0, 1, 2, 4], // LV.1, LV.2, LV.3, LV.5 (0-indexed)
    unlocked: true,
    unitNames: {
      machine: '刘易斯MG',
      cannon: 'M5-76AT',
      defender: '装甲游骑兵',
    },
  },
  {
    id: 'soviet',
    name: '誓死坚守',
    subtitle: '苏联战役',
    description: '斯大林格勒的城市巷战，血与钢铁的交锋',
    levels: [3], // LV.4 (0-indexed)
    unlocked: true,
    unitNames: {
      machine: 'DP-28 机枪班',
      cannon: 'ZiS-3 AT',
      defender: '近卫掷弹兵',
    },
  },
  {
    id: 'germany',
    name: '女武神的骑行',
    subtitle: '德国战役',
    description: '东线防御，坚守第三帝国最后的防线',
    levels: [5], // 1 playable + more coming
    unlocked: true,
  },
];

// 塔定义（远程单位）
export const TOWER_DEFS = {
  machine: {
    name: 'MG42 机枪班', cost: 50, range: 145, cooldown: 24, damage: 14,
    color: '#4a7db5', bulletColor: '#ffe478', bulletSpeed: 8, size: 13,
    isSplash: false, splashRadius: 0, splashDamagePct: 1, hp: 80,
    canTargetFlying: true,
  },
  cannon: {
    name: 'Flak 36 AT', cost: 80, range: 200, cooldown: 62, damage: 55,
    color: '#b5654a', bulletColor: '#ff8855', bulletSpeed: 6, size: 17,
    isSplash: false, splashRadius: 0, splashDamagePct: 1, hp: 100,
  },
  howitzer: {
    name: 'SIG 33 步兵炮', cost: 100, range: 175, cooldown: 84, damage: 32,
    color: '#6b8a5e', bulletColor: '#ffaa44', bulletSpeed: 3.5, size: 19,
    isSplash: true, splashRadius: 85, splashDamagePct: 0.6, hp: 120,
  },
  aa: {
    name: '防空炮', cost: 90, range: 200, cooldown: 28, damage: 24,
    color: '#9aa6c0', bulletColor: '#fff2a8', bulletSpeed: 12, size: 15,
    isSplash: false, splashRadius: 0, splashDamagePct: 1, hp: 95,
    canTargetFlying: true,
  },
};

// 阻挡单位定义（近战 + 掷弹兵远程）
export const BLOCKER_DEFS = {
  infantry: {
    name: '轻步兵团', cost: 60, hp: 320, damage: 22, attackInterval: 24,
    blockCount: 1, color: '#4a8db5', size: 14,
  },
  defender: {
    name: '重装掷弹兵', cost: 120, hp: 680, damage: 15, attackInterval: 30,
    blockCount: 2, color: '#5a8a4a', size: 17,
    rng: 130, rDmg: 18, rInterval: 55, rSpeed: 4, rColor: '#aa8844', rSize: 4,
  },
};

/**
 * 根据战役获取单位的显示名称
 * @param {string} type - 单位类型键
 * @param {string} campaignId - 战役ID
 * @returns {string} 显示名称
 */
export function getUnitDisplayName(type, campaignId) {
  if (!campaignId) return TOWER_DEFS[type]?.name || BLOCKER_DEFS[type]?.name || type;
  const campaign = CAMPAIGNS.find(c => c.id === campaignId);
  if (campaign?.unitNames?.[type]) return campaign.unitNames[type];
  return TOWER_DEFS[type]?.name || BLOCKER_DEFS[type]?.name || type;
}

// 敌人原型
export const ENEMY_PROTO = {
  rifleman: { type: 'rifleman', hp: 55, speed: 1.05, reward: 15, size: 12, atkDmg: 5, atkInterval: 30, ranged: false },
  assault: { type: 'assault', hp: 80, speed: 1.6, reward: 22, size: 13, atkDmg: 8, atkInterval: 25, ranged: false },
  armored: { type: 'armored', hp: 160, speed: 0.72, reward: 40, size: 16, atkDmg: 12, atkInterval: 35, ranged: false },
  tank: {
    type: 'tank', hp: 300, speed: 0.44, reward: 65, size: 22, atkDmg: 22, atkInterval: 40,
    ranged: true, range: 210, rDmg: 22, rInterval: 55, rSpeed: 3.5, rColor: '#ff5533', rSize: 6,
  },
  boss_tank: {
    type: 'boss_tank', hp: 580, speed: 0.3, reward: 150, size: 28, atkDmg: 35, atkInterval: 38,
    ranged: true, range: 250, rDmg: 34, rInterval: 48, rSpeed: 3.2, rColor: '#ff3311', rSize: 8,
  },
  maus: {
    type: 'maus', hp: 3200, speed: 0.18, reward: 800, size: 34, atkDmg: 55, atkInterval: 32,
    ranged: true, range: 300, rDmg: 50, rInterval: 35, rSpeed: 3.0, rColor: '#ff1100', rSize: 10,
  },
  plane: {
    type: 'plane', hp: 75, speed: 2.4, reward: 28, size: 14, atkDmg: 0, atkInterval: 30, ranged: false,
    flying: true,
  },
  medic: {
    type: 'medic', hp: 95, speed: 0.85, reward: 32, size: 14, atkDmg: 6, atkInterval: 35, ranged: false,
    healer: true, healRange: 95, healAmount: 5, healInterval: 48,
  },
};

export const BASE_SPEED = 1.5;
export const PATH_NAMES = ['A', 'B', 'C'];
export const PATH_ENTRY_COLORS = ['#4a9edb', '#db6b4a', '#5aad6b'];

// 难度设定
export const DIFFICULTIES = {
  private: { name: '列兵', hpMult: 1.0, desc: '标准难度' },
  sergeant: { name: '中士', hpMult: 1.15, desc: '敌人血量+15%' },
  colonel: { name: '上校', hpMult: 1.4, desc: '敌人血量+40%' },
};
export const DIFFICULTY_ORDER = ['private', 'sergeant', 'colonel'];

export const LEVELS = [
  {
    campaignId: 'europe',
    name: 'LV.1 诺曼底 · 滩头阵地', desc: '单路防御 · 教学关',
    startGold: 180, startHp: 20,
    paths: [[{ x: -25, y: 300 }, { x: 260, y: 300 }, { x: 260, y: 140 }, { x: 560, y: 140 }, { x: 560, y: 460 }, { x: 925, y: 460 }]],
    towerSlots: [
      { x: 130, y: 210 }, { x: 130, y: 390 }, { x: 350, y: 220 }, { x: 410, y: 90 },
      { x: 660, y: 300 }, { x: 700, y: 560 }, { x: 820, y: 380 }, { x: 430, y: 520 },
    ],
    availableTowers: ['machine', 'infantry'],
    waves: [
      { name: '侦察巡逻', spawnInterval: 42, availablePaths: [0], enemies: [{ t: 'rifleman', c: 6 }] },
      { name: '步兵推进', spawnInterval: 36, availablePaths: [0], enemies: [{ t: 'rifleman', c: 10 }] },
      { name: '顽强抵抗', spawnInterval: 30, availablePaths: [0], enemies: [{ t: 'rifleman', c: 14 }] },
    ],
  },
  {
    campaignId: 'europe',
    name: 'LV.2 突出部 · 双路夹击', desc: '双路夹击 · 解锁Flak 36',
    startGold: 230, startHp: 20,
    paths: [
      [{ x: -25, y: 140 }, { x: 380, y: 140 }, { x: 380, y: 260 }, { x: 925, y: 260 }],
      [{ x: -25, y: 500 }, { x: 380, y: 500 }, { x: 380, y: 360 }, { x: 925, y: 360 }],
    ],
    towerSlots: [
      { x: 130, y: 90 }, { x: 130, y: 300 }, { x: 130, y: 560 }, { x: 500, y: 200 },
      { x: 500, y: 440 }, { x: 700, y: 200 }, { x: 700, y: 440 }, { x: 820, y: 310 }, { x: 250, y: 300 },
    ],
    availableTowers: ['machine', 'infantry', 'cannon'],
    waves: [
      { name: '两翼骚扰', spawnInterval: 38, availablePaths: [0, 1], enemies: [{ t: 'rifleman', c: 6 }, { t: 'rifleman', c: 4 }] },
      { name: '突击登场', spawnInterval: 32, availablePaths: [0, 1], enemies: [{ t: 'rifleman', c: 8 }, { t: 'assault', c: 3 }] },
      { name: '装甲试探', spawnInterval: 28, availablePaths: [0, 1], enemies: [{ t: 'assault', c: 6 }, { t: 'armored', c: 3 }] },
      { name: '钢铁双流', spawnInterval: 23, availablePaths: [0, 1], enemies: [{ t: 'assault', c: 6 }, { t: 'armored', c: 4 }, { t: 'tank', c: 1 }] },
    ],
  },
  { // ★ NEW LV.3
    campaignId: 'europe',
    name: 'LV.3 跨越莱茵 · 莱茵河大桥', desc: '三桥争夺 · 两路交叉 · 解锁M5-76AT',
    startGold: 260, startHp: 22,
    river: {
      yStart: 230, yEnd: 370,
      color: '#3a6b8c',
      bridges: [
        { x: 190, w: 80, color: '#8B7355', name: '雷马根桥' },
        { x: 420, w: 80, color: '#808080', name: '鲁登道夫桥' },
        { x: 620, w: 80, color: '#5A5A5A', name: '铁桥' },
      ],
    },
    paths: [
      // Path 0: NW入口 → 雷马根桥向南 → SE出口
      [{ x: -25, y: 150 }, { x: 180, y: 150 }, { x: 220, y: 230 }, { x: 220, y: 370 }, { x: 260, y: 370 }, { x: 260, y: 420 }, { x: 500, y: 420 }, { x: 700, y: 420 }, { x: 925, y: 400 }],
      // Path 1: SW入口 → 鲁登道夫桥向北 → NE出口
      [{ x: -25, y: 430 }, { x: 350, y: 430 }, { x: 440, y: 370 }, { x: 440, y: 230 }, { x: 480, y: 230 }, { x: 480, y: 160 }, { x: 650, y: 160 }, { x: 800, y: 200 }, { x: 925, y: 200 }],
      // Path 2: SW入口 → 铁桥向北 → NE出口
      [{ x: -25, y: 470 }, { x: 550, y: 470 }, { x: 640, y: 370 }, { x: 640, y: 230 }, { x: 680, y: 230 }, { x: 680, y: 160 }, { x: 800, y: 200 }, { x: 925, y: 200 }],
    ],
    towerSlots: [
      // 桥1附近（雷马根桥 x=190-270）：北侧 y<230，南侧 y>370
      { x: 130, y: 140 }, { x: 240, y: 180 },
      { x: 130, y: 470 }, { x: 260, y: 440 },
      // 桥2附近（鲁登道夫桥 x=420-500）
      { x: 370, y: 140 }, { x: 480, y: 180 },
      { x: 370, y: 470 }, { x: 480, y: 440 },
      // 桥3附近（铁桥 x=620-700）
      { x: 600, y: 140 }, { x: 690, y: 180 },
      { x: 600, y: 470 }, { x: 690, y: 440 },
    ],
    availableTowers: ['machine', 'infantry', 'cannon', 'howitzer'],
    waves: [
      { name: '边境侦查', spawnInterval: 40, availablePaths: [0, 1], enemies: [{ t: 'rifleman', c: 8 }] },
      { name: '步兵突进', spawnInterval: 34, availablePaths: [0, 1, 2], enemies: [{ t: 'rifleman', c: 10 }, { t: 'assault', c: 3 }] },
      { name: '装甲试探', spawnInterval: 28, availablePaths: [0, 1], enemies: [{ t: 'rifleman', c: 6 }, { t: 'armored', c: 4 }] },
      { name: '双线夹击', spawnInterval: 24, availablePaths: [0, 1, 2], enemies: [{ t: 'assault', c: 8 }, { t: 'armored', c: 5 }] },
      { name: '钢铁渡河', spawnInterval: 20, availablePaths: [0, 1, 2], enemies: [{ t: 'assault', c: 6 }, { t: 'armored', c: 4 }, { t: 'tank', c: 3 }] },
      { name: '装甲突破', spawnInterval: 16, availablePaths: [0, 1, 2], enemies: [{ t: 'assault', c: 4 }, { t: 'tank', c: 2 }, { t: 'boss_tank', c: 1 }] },
    ],
  },
  { // was LV.3 → now LV.4
    campaignId: 'soviet',
    name: 'LV.4 斯大林格勒 · 城市巷战', desc: '双路交汇 · 坦克登场 · 解锁重火力', theme: 'snow',
    startGold: 280, startHp: 22,
    paths: [
      [{ x: -25, y: 160 }, { x: 220, y: 160 }, { x: 220, y: 300 }, { x: 480, y: 300 }, { x: 480, y: 150 }, { x: 720, y: 150 }, { x: 720, y: 300 }, { x: 925, y: 300 }],
      [{ x: -25, y: 440 }, { x: 220, y: 440 }, { x: 220, y: 320 }, { x: 480, y: 320 }, { x: 480, y: 460 }, { x: 720, y: 460 }, { x: 720, y: 300 }, { x: 925, y: 300 }],
    ],
    towerSlots: [
      { x: 100, y: 100 }, { x: 100, y: 250 }, { x: 100, y: 400 }, { x: 100, y: 530 },
      { x: 320, y: 200 }, { x: 320, y: 380 }, { x: 320, y: 500 },
      { x: 580, y: 200 }, { x: 580, y: 380 }, { x: 580, y: 500 },
      { x: 800, y: 200 }, { x: 800, y: 380 },
    ],
    availableTowers: ['machine', 'infantry', 'cannon', 'howitzer', 'defender', 'aa'],
    waves: [
      { name: '城区侦查', spawnInterval: 36, availablePaths: [0, 1], enemies: [{ t: 'rifleman', c: 8 }, { t: 'assault', c: 3 }] },
      { name: '装甲巡逻', spawnInterval: 30, availablePaths: [0, 1], enemies: [{ t: 'assault', c: 6 }, { t: 'armored', c: 4 }, { t: 'rifleman', c: 4 }] },
      { name: '坦克突袭', spawnInterval: 25, availablePaths: [0, 1], enemies: [{ t: 'armored', c: 6 }, { t: 'tank', c: 3 }, { t: 'assault', c: 4 }] },
      { name: '钢铁巨兽', spawnInterval: 20, availablePaths: [0, 1], enemies: [{ t: 'tank', c: 5 }, { t: 'boss_tank', c: 1 }, { t: 'armored', c: 5 }, { t: 'assault', c: 4 }, { t: 'medic', c: 2 }] },
      { name: '红色风暴', spawnInterval: 14, availablePaths: [0, 1], enemies: [{ t: 'rifleman', c: 12 }, { t: 'assault', c: 8 }, { t: 'boss_tank', c: 2 }, { t: 'plane', c: 4 }] },
    ],
  },
  { // was LV.4 → now LV.5 (欧洲战役第4关)
    campaignId: 'europe',
    name: 'LV.4 柏林 · 三面围攻', desc: '三路汇聚 · 最终决战 · 鼠式Boss',
    startGold: 420, startHp: 25,
    paths: [
      [{ x: -25, y: 110 }, { x: 300, y: 110 }, { x: 300, y: 200 }, { x: 600, y: 200 }, { x: 925, y: 300 }],
      [{ x: -25, y: 300 }, { x: 925, y: 300 }],
      [{ x: -25, y: 490 }, { x: 300, y: 490 }, { x: 300, y: 400 }, { x: 600, y: 400 }, { x: 925, y: 300 }],
    ],
    towerSlots: [
      { x: 130, y: 110 }, { x: 130, y: 300 }, { x: 130, y: 490 }, { x: 450, y: 250 },
      { x: 450, y: 350 }, { x: 700, y: 250 }, { x: 700, y: 350 }, { x: 820, y: 300 }, { x: 200, y: 200 }, { x: 200, y: 400 },
    ],
    availableTowers: ['machine', 'infantry', 'cannon', 'howitzer', 'defender', 'aa'],
    waves: [
      { name: '三面警戒', spawnInterval: 34, availablePaths: [0, 1, 2], enemies: [{ t: 'rifleman', c: 8 }, { t: 'assault', c: 4 }] },
      { name: '装甲突破', spawnInterval: 28, availablePaths: [0, 1, 2], enemies: [{ t: 'assault', c: 6 }, { t: 'armored', c: 5 }, { t: 'rifleman', c: 5 }] },
      { name: '铁壁压境', spawnInterval: 24, availablePaths: [0, 1, 2], enemies: [{ t: 'armored', c: 8 }, { t: 'tank', c: 3 }] },
      { name: '坦克洪流', spawnInterval: 20, availablePaths: [0, 1, 2], enemies: [{ t: 'tank', c: 6 }, { t: 'assault', c: 6 }] },
      { name: '⚡ 鼠式 · 终焉一击', spawnInterval: 14, availablePaths: [0, 1, 2], enemies: [{ t: 'tank', c: 4 }, { t: 'armored', c: 6 }, { t: 'assault', c: 6 }, { t: 'maus', c: 1 }, { t: 'plane', c: 5 }, { t: 'medic', c: 2 }] },
    ],
  },
  { // ★ 德国战役第1关
    campaignId: 'germany',
    name: 'LV.1 东线 · 库尔斯克草原', desc: '单路防御 · 苏军装甲洪流',
    startGold: 220, startHp: 20,
    paths: [
      [{ x: -25, y: 280 }, { x: 200, y: 280 }, { x: 200, y: 160 }, { x: 450, y: 160 }, { x: 450, y: 440 }, { x: 700, y: 440 }, { x: 700, y: 280 }, { x: 925, y: 280 }],
    ],
    towerSlots: [
      { x: 120, y: 200 }, { x: 120, y: 380 }, { x: 300, y: 100 },
      { x: 320, y: 480 }, { x: 540, y: 100 }, { x: 550, y: 500 },
      { x: 780, y: 200 }, { x: 780, y: 380 }, { x: 820, y: 500 },
    ],
    availableTowers: ['machine', 'infantry', 'cannon', 'aa'],
    waves: [
      { name: '苏联侦察兵', spawnInterval: 40, availablePaths: [0], enemies: [{ t: 'rifleman', c: 8 }] },
      { name: '步兵冲锋', spawnInterval: 34, availablePaths: [0], enemies: [{ t: 'rifleman', c: 12 }] },
      { name: '突击队', spawnInterval: 28, availablePaths: [0], enemies: [{ t: 'rifleman', c: 6 }, { t: 'assault', c: 6 }] },
      { name: '装甲先锋', spawnInterval: 24, availablePaths: [0], enemies: [{ t: 'assault', c: 4 }, { t: 'armored', c: 4 }] },
      { name: 'T-34 登场', spawnInterval: 20, availablePaths: [0], enemies: [{ t: 'armored', c: 4 }, { t: 'tank', c: 2 }, { t: 'plane', c: 4 }] },
    ],
  },
];

// ---- 无尽模式（复用 LV.3 莱茵河大桥地图） ----
export function generateEndlessWave(waveNum) {
  const interval = Math.max(8, Math.round(42 - waveNum * 0.9));
  const availablePaths = [0, 1, 2];
  const enemies = [];
  const add = (t, c, hpScale = 1) => enemies.push({ t, c, hpScale });
  add('rifleman', 6 + Math.floor(waveNum * 1.1));
  if (waveNum >= 2) add('assault', 3 + Math.floor(waveNum * 0.7));
  if (waveNum >= 3) add('medic', 1 + Math.floor(waveNum / 7));
  if (waveNum >= 3) add('armored', 2 + Math.floor(waveNum * 0.45), 1 + waveNum * 0.05);
  if (waveNum >= 4) add('plane', 1 + Math.floor(waveNum * 0.5), 1 + waveNum * 0.05);
  if (waveNum >= 5) add('tank', 1 + Math.floor(waveNum * 0.35), 1 + waveNum * 0.06);
  if (waveNum >= 8 && waveNum % 5 === 0) add('boss_tank', 1, 1 + waveNum * 0.08);
  if (waveNum >= 12 && waveNum % 8 === 0) add('maus', 1, 1 + waveNum * 0.1);
  const name = (waveNum % 10 === 0) ? `第${waveNum}波 · 装甲洪流` : `第${waveNum}波`;
  return { name, spawnInterval: interval, availablePaths, enemies, endless: true };
}

export const ENDLESS_LEVEL = {
  campaignId: 'endless',
  name: '无尽 · 莱茵河防线', desc: '莱茵河大桥 · 无限波次生存',
  endless: true,
  startGold: 340, startHp: 30,
  paths: LEVELS[2].paths,
  river: LEVELS[2].river,
  towerSlots: LEVELS[2].towerSlots,
  availableTowers: ['machine', 'infantry', 'cannon', 'howitzer', 'defender', 'aa'],
  waves: [],
};
