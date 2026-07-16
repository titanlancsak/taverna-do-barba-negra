// ============================================================
//  MAPA DO CAMPUS  —  EDITE ESTE ARQUIVO PARA MONTAR A FACULDADE
// ============================================================
//
// Cada caractere abaixo = 1 tile (quadrado) de CAMPUS_TILE pixels.
// É só "desenhar" o campus digitando. Legenda dos caracteres:
//
//   .  gramado        (anda por cima)
//   P  caminho        (anda por cima)
//   @  ponto de spawn (onde você aparece; anda por cima)
//   #  prédio/parede  (COLIDE — não passa)
//   T  árvore         (COLIDE)
//   ~  água           (COLIDE)
//
// Dicas:
//  - Pode aumentar/diminuir o mapa à vontade (mais linhas/colunas = campus maior).
//  - As linhas NÃO precisam ter exatamente o mesmo tamanho: o que faltar
//    à direita vira gramado automaticamente.
//  - Nomes de prédios NÃO vão dentro da grade (quebraria o alinhamento).
//    Coloque-os em CAMPUS_LABELS, com a posição em TILES (coluna x, linha y).

const CAMPUS_TILE = 64;

const CAMPUS_MAP = `
........................................
.TT...####............####.........TT...
.TT...####..PPPPPPPPPP..####........TT..
............P........P..................
.....####...P........P...####...........
.....####...P........P...####...........
.PPPPPPPPPPPPP........PPPPPPPPPPPPPPPPPP.
.P.................@..................P..
.P....TT......######...........TT....P..
.P............######.....PPPPPPPPPPPPPP..
.P............######.....P...........P..
.P.......................P...........P..
.PPPPPPPPPPPPPPPPPPPPPPPPPP...........P..
.P.................................TTP..
.P...####..............####........TTP..
.P...####.....TT.......####..........P..
.P...####..............####..........P..
.PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP..
........................................
`;

// Nomes dos prédios — posição em TILES (x = coluna, y = linha), começando do 0.
const CAMPUS_LABELS = [
  { x: 7,  y: 4,  text: '図書館' },
  { x: 25, y: 4,  text: '講義棟' },
  { x: 16, y: 9,  text: '食堂' },
  { x: 7,  y: 15, text: '体育館' },
  { x: 25, y: 15, text: '研究室' }
];
