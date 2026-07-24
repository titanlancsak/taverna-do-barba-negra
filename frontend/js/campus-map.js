// ============================================================
//  CAMPUS DE HACHIOJI — layout recriado com formas (editável)
// ============================================================
//  Baseado na disposição do campus real. Tudo em PIXELS no mundo.
//  Ajuste x/y/w/h pra encaixar do jeito que quiser.

const CAMPUS_WORLD = { w: 3600, h: 2500 };
const CAMPUS_SPAWN = { x: 1900, y: 1450 };

// ---- Terreno (desenhado por baixo dos prédios) ----
//  type: 'zone'(verde), 'track'(pista/campo), 'tennis', 'water'(colide),
//        'garden'(jardim circular), 'path'(caminho), 'road'(estrada)
const CAMPUS_TERRAIN = [
  { type: 'zone',   x: 2650, y: 1350, w: 950, h: 1150, color: 0x4f8f3e },
  { type: 'path',   x: 1780, y: 860,  w: 300, h: 1250 },            // eixo central
  { type: 'path',   x: 460,  y: 1150, w: 2650, h: 120 },            // eixo horizontal
  { type: 'path',   x: 1000, y: 300,  w: 120, h: 900 },             // caminho esquerda
  { type: 'road',   points: [[3450,180],[3520,1000],[3320,1750],[2550,2380],[1300,2430]], width: 70 },
  { type: 'track',  x: 560,  y: 800,  w: 820, h: 660 },             // 総合グラウンド
  { type: 'tennis', x: 150,  y: 430,  w: 390, h: 300, cols: 3, rows: 2 }, // テニスコート
  { type: 'water',  x: 600,  y: 560,  w: 240, h: 120 },            // プール
  { type: 'garden', x: 1560, y: 1540, r: 300 },                    // 庭園
  { type: 'water',  x: 3000, y: 1500, w: 540, h: 680, round: true } // 池
];

// ---- Prédios (blocos 2.5D com nome). color = telhado ----
const CAMPUS_BUILDINGS = [
  { name: '体育館',                             x: 470,  y: 300,  w: 360, h: 220, color: 0xbfc6cd },
  { name: 'スタジオ棟',                          x: 540,  y: 660,  w: 380, h: 110, color: 0xc9cfd6 },
  { name: '片柳記念ホール',                       x: 1700, y: 220,  w: 470, h: 150, color: 0xd7dee6 },
  { name: '講義棟D',                            x: 1660, y: 410,  w: 380, h: 110, color: 0xcdd4dc },
  { name: '講義棟E',                            x: 2120, y: 410,  w: 320, h: 110, color: 0xcdd4dc },
  { name: '研究棟B',                            x: 1700, y: 590,  w: 430, h: 270, color: 0xc4ccd4, round: true },
  { name: '講義棟C',                            x: 2250, y: 640,  w: 340, h: 100, color: 0xcdd4dc },
  { name: '講義棟B',                            x: 2250, y: 840,  w: 340, h: 100, color: 0xcdd4dc },
  { name: 'ものづくり工房',                       x: 2740, y: 300,  w: 420, h: 120, color: 0xc9cfd6 },
  { name: 'メディアホール',                       x: 2840, y: 720,  w: 380, h: 110, color: 0xc4ccd4 },
  { name: '自動車整備実習場',                     x: 2840, y: 860,  w: 380, h: 110, color: 0xc9cfd6 },
  { name: 'コンピュータ＆テクノロジーセンター',     x: 2500, y: 1010, w: 470, h: 110, color: 0xb9c8d6 },
  { name: '厚生棟',                             x: 1510, y: 1080, w: 280, h: 110, color: 0xd0d6dc },
  { name: '食堂',                               x: 1560, y: 1210, w: 280, h: 90,  color: 0xd0d6dc },
  { name: '図書館棟',                           x: 2020, y: 1120, w: 340, h: 110, color: 0xbcc9d6 },
  { name: 'FOODS・FUU',                         x: 1350, y: 1300, w: 420, h: 140, color: 0xe0913f },
  { name: 'アーキテクト・ビルダー・スタジオ',       x: 2400, y: 1560, w: 420, h: 130, color: 0xb7c4d0 },
  { name: '片柳研究所棟',                        x: 1970, y: 1920, w: 470, h: 210, color: 0xc4ccd4, round: true }
];
