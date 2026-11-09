'use strict';

/*
 * Piškvorky – web version of the tkinter game.
 *
 * Kept from tkinter:
 *   - 15×15 board, 40 px cells (the SVG uses the same 600×600 coordinates, it just scales)
 *   - board values 1 = kolečko (red O), 2 = křížek (blue X)
 *   - either symbol may start, then the symbols strictly alternate
 *   - mouse: left button = kolečko, right button = křížek (the wrong button is ignored)
 *   - texts "Zadejte první tah", "Na tahu jsou křížky / kolečka"
 * Built from the unfinished drafts:
 *   - Hráč 1 / Hráč 2 in the header, X / O / +2 bar (Swap2 opening), win banner
 * Added for touch screens:
 *   - one tap places the symbol that is on turn, first tap = preview, second tap = confirm
 *   - Zpět (undo), Nová hra, the game survives a page reload
 */

const N = 15;
const CELL = 40;
const O = 1;              // kolečko
const X = 2;              // křížek
const PLUS2 = 'plus2';
const NAMES = { [O]: 'kolečka', [X]: 'křížky' };
const RED = '#ff0000';
const BLUE = '#0000ff';
const SVG_NS = 'http://www.w3.org/2000/svg';
const STORE_KEY = 'piskvorky.v1';

const other = (s) => (s === O ? X : O);
const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

/* ================= game rules (no DOM in here) =================

   A game is fully described by its mode and the list of actions taken so far.
   Undo = drop the last action and replay the rest.

   Phases:
     open3   – Swap2: Hráč 1 places the first 3 stones
     choose2 – Swap2: Hráč 2 picks X, O or +2
     open2   – Swap2: Hráč 2 places 2 more stones
     choose1 – Swap2: Hráč 1 picks X or O
     play    – normal game (in free mode the game starts here)
     over    – somebody has five in a row, or the board is full
*/

function newGame(mode) {
  return {
    mode,
    board: Array.from({ length: N }, () => Array(N).fill(0)),
    moves: [],                 // [{ r, c, s }]
    phase: mode === 'swap2' ? 'open3' : 'play',
    owner: { [O]: 0, [X]: 0 }, // which player (1 or 2) plays each symbol, 0 = not decided yet
    winner: 0,
    winLine: null,
    draw: false,
  };
}

/** Symbol that has to be placed next; 0 before the first move (either may start). */
function symbolToMove(g) {
  return g.moves.length ? other(g.moves[g.moves.length - 1].s) : 0;
}

function canPlaceStone(g) {
  return g.phase === 'open3' || g.phase === 'open2' || g.phase === 'play';
}

/** Player (1 or 2) who has to do something now, 0 when the game is over. */
function activePlayer(g) {
  switch (g.phase) {
    case 'open3':
    case 'choose1':
      return 1;
    case 'choose2':
    case 'open2':
      return 2;
    case 'play':
      return g.moves.length ? g.owner[symbolToMove(g)] : 1;
    default:
      return 0;
  }
}

function isLegal(g, a) {
  if (!a || typeof a !== 'object') return false;
  if (a.t === 'place') {
    if (!canPlaceStone(g)) return false;
    if (!Number.isInteger(a.r) || !Number.isInteger(a.c) || !inside(a.r, a.c)) return false;
    if (g.board[a.r][a.c] !== 0) return false;
    if (a.s !== O && a.s !== X) return false;
    return g.moves.length === 0 || a.s === symbolToMove(g);
  }
  if (a.t === 'choose') {
    if (g.phase === 'choose2') return a.o === O || a.o === X || a.o === PLUS2;
    if (g.phase === 'choose1') return a.o === O || a.o === X;
  }
  return false;
}

function apply(g, a) {
  if (a.t === 'place') {
    g.board[a.r][a.c] = a.s;
    g.moves.push({ r: a.r, c: a.c, s: a.s });

    // free game: whoever places the first stone is Hráč 1
    if (g.mode === 'free' && g.moves.length === 1) {
      g.owner[a.s] = 1;
      g.owner[other(a.s)] = 2;
    }

    const line = findFive(g.board, a.r, a.c);
    if (line) {
      g.winner = a.s;
      g.winLine = line;
      g.phase = 'over';
    } else if (g.moves.length === N * N) {
      g.draw = true;
      g.phase = 'over';
    } else if (g.phase === 'open3' && g.moves.length === 3) {
      g.phase = 'choose2';
    } else if (g.phase === 'open2' && g.moves.length === 5) {
      g.phase = 'choose1';
    }
    return;
  }

  // a.t === 'choose'
  if (a.o === PLUS2) {
    g.phase = 'open2';
  } else {
    const chooser = g.phase === 'choose2' ? 2 : 1;
    g.owner[a.o] = chooser;
    g.owner[other(a.o)] = 3 - chooser;
    g.phase = 'play';
  }
}

/** Five or more equal stones in a row through (r, c)? Returns the cells, or null. */
function findFive(board, r, c) {
  const s = board[r][c];
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const line = [[r, c]];
    for (const k of [1, -1]) {
      let rr = r + dr * k;
      let cc = c + dc * k;
      while (inside(rr, cc) && board[rr][cc] === s) {
        line.push([rr, cc]);
        rr += dr * k;
        cc += dc * k;
      }
    }
    if (line.length >= 5) return line.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  }
  return null;
}

/** Rebuild a game from its actions; stops at the first illegal one. */
function replay(mode, actions) {
  const g = newGame(mode);
  const valid = [];
  for (const a of actions) {
    if (!isLegal(g, a)) break;
    apply(g, a);
    valid.push(a);
  }
  return { game: g, actions: valid };
}

/* ================= app state ================= */

let mode = 'swap2';
let startSymbol = O;      // which symbol the first tap places (touch); mouse decides by button
let actions = [];
let game = newGame(mode);
let preview = null;       // { r, c, s } – stone shown faded, waiting for the second tap
let bannerHidden = false;
let flash = null;         // short message shown instead of the hint
let flashTimer = 0;
let lastPointer = matchMedia('(hover: hover) and (pointer: fine)').matches ? 'mouse' : 'touch';

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ mode, startSymbol, actions }));
  } catch (e) { /* private mode etc. – the game still works, it just won't survive a reload */ }
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!data) return;
    if (data.mode === 'swap2' || data.mode === 'free') mode = data.mode;
    if (data.startSymbol === O || data.startSymbol === X) startSymbol = data.startSymbol;
    const restored = replay(mode, Array.isArray(data.actions) ? data.actions : []);
    game = restored.game;
    actions = restored.actions;
  } catch (e) {
    game = newGame(mode);
    actions = [];
  }
}

function act(a) {
  if (!isLegal(game, a)) return;
  actions.push(a);
  apply(game, a);
  preview = null;
  bannerHidden = false;
  clearFlash();
  if (a.t === 'place' && navigator.vibrate) navigator.vibrate(12);
  save();
  render();
}

function undo() {
  if (!actions.length) return;
  actions.pop();
  game = replay(mode, actions).game;
  preview = null;
  bannerHidden = false;
  clearFlash();
  save();
  render();
}

function startNewGame(newMode) {
  mode = newMode;
  actions = [];
  game = newGame(mode);
  preview = null;
  bannerHidden = false;
  clearFlash();
  save();
  render();
}

function showFlash(text) {
  flash = text;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { flash = null; render(); }, 2600);
  render();
}

function clearFlash() {
  flash = null;
  clearTimeout(flashTimer);
}

/* ================= board input ================= */

/**
 * A tap / click on a cell.
 * mouseSymbol: O for the left button, X for the right button, null for touch and pen.
 */
function onCellTap(r, c, mouseSymbol) {
  if (!canPlaceStone(game)) return;

  const toMove = symbolToMove(game);
  const s = mouseSymbol || toMove || startSymbol;

  // same rule as tkinter: the button for the symbol that is not on turn does nothing
  if (toMove && s !== toMove) {
    showFlash(toMove === X
      ? 'Na tahu jsou křížky – pravé tlačítko myši'
      : 'Na tahu jsou kolečka – levé tlačítko myši');
    return;
  }

  if (game.board[r][c] !== 0) {
    if (preview) { preview = null; render(); }
    return;
  }

  if (preview && preview.r === r && preview.c === c && preview.s === s) {
    act({ t: 'place', r, c, s });
    return;
  }

  preview = { r, c, s };
  if (!toMove) startSymbol = s;   // first move with the mouse also flips the "Začínají" switch
  clearFlash();
  render();
}

function cellFromEvent(e) {
  const rect = boardSvg.getBoundingClientRect();
  const c = Math.floor(((e.clientX - rect.left) / rect.width) * N);
  const r = Math.floor(((e.clientY - rect.top) / rect.height) * N);
  return inside(r, c) ? { r, c } : null;
}

/* ================= drawing ================= */

const $ = (id) => document.getElementById(id);
const boardSvg = $('board');

function el(tag, attrs, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(node);
  return node;
}

function drawO(parent, r, c, extraClass = '') {
  const x = c * CELL;
  const y = r * CELL;
  el('circle', { cx: x + 20, cy: y + 20, r: 12, class: ('stone-o ' + extraClass).trim() }, parent);
}

function drawX(parent, r, c, extraClass = '') {
  const x = c * CELL;
  const y = r * CELL;
  const g = el('g', { class: ('stone-x ' + extraClass).trim() }, parent);
  el('line', { x1: x + 8, y1: y + 8, x2: x + 32, y2: y + 32 }, g);
  el('line', { x1: x + 32, y1: y + 8, x2: x + 8, y2: y + 32 }, g);
}

function drawStone(parent, r, c, s, extraClass) {
  (s === O ? drawO : drawX)(parent, r, c, extraClass);
}

function cellRect(parent, r, c, cls) {
  el('rect', { x: c * CELL, y: r * CELL, width: CELL, height: CELL, class: cls }, parent);
}

// layers, back to front
let layerCells, layerStones, layerPreview, layerWin, hoverRect;

/** Same job as herni_pole() in tkinter: grid lines and the frame. */
function herniPole() {
  boardSvg.textContent = '';
  el('rect', { x: 0, y: 0, width: 600, height: 600, fill: '#fff' }, boardSvg);
  layerCells = el('g', {}, boardSvg);
  const grid = el('g', { class: 'grid' }, boardSvg);
  for (let i = 1; i < N; i++) {
    el('line', { x1: 0, y1: i * CELL, x2: 600, y2: i * CELL }, grid);
    el('line', { x1: i * CELL, y1: 0, x2: i * CELL, y2: 600 }, grid);
  }
  el('rect', { x: 0, y: 0, width: 600, height: 600, class: 'frame' }, boardSvg);
  hoverRect = el('rect', { width: CELL, height: CELL, class: 'hover-cell', visibility: 'hidden' }, boardSvg);
  layerStones = el('g', {}, boardSvg);
  layerPreview = el('g', {}, boardSvg);
  layerWin = el('g', {}, boardSvg);
}

function renderBoard() {
  layerCells.textContent = '';
  layerStones.textContent = '';
  layerPreview.textContent = '';
  layerWin.textContent = '';

  // cell backgrounds: row/column guide + highlighted cell for the preview, last move, winning five
  if (preview) {
    el('rect', { x: 0, y: preview.r * CELL, width: 600, height: CELL, class: 'guide' }, layerCells);
    el('rect', { x: preview.c * CELL, y: 0, width: CELL, height: 600, class: 'guide' }, layerCells);
  }
  const last = game.moves[game.moves.length - 1];
  if (last && !game.winLine) cellRect(layerCells, last.r, last.c, 'last-cell');
  if (game.winLine) for (const [r, c] of game.winLine) cellRect(layerCells, r, c, 'win-cell');
  if (preview) cellRect(layerCells, preview.r, preview.c, 'preview-cell');

  for (const m of game.moves) drawStone(layerStones, m.r, m.c, m.s);

  if (preview) drawStone(layerPreview, preview.r, preview.c, preview.s, 'ghost');

  if (game.winLine) {
    const [r1, c1] = game.winLine[0];
    const [r2, c2] = game.winLine[game.winLine.length - 1];
    el('line', {
      x1: c1 * CELL + 20, y1: r1 * CELL + 20,
      x2: c2 * CELL + 20, y2: r2 * CELL + 20,
      class: 'win-line',
      stroke: game.winner === O ? RED : BLUE,
    }, layerWin);
  }

  boardSvg.style.cursor = canPlaceStone(game) ? 'pointer' : 'default';
}

/** Header icon: the player's symbol, or O and X on top of each other while it is not decided. */
function renderPlayerIcon(svg, symbol) {
  svg.textContent = '';
  if (!symbol || symbol === O) {
    el('circle', { cx: 20, cy: 20, r: 20, fill: 'none', stroke: RED, 'stroke-width': 6 }, svg);
  }
  if (!symbol || symbol === X) {
    el('line', { x1: 0, y1: 0, x2: 40, y2: 40, stroke: BLUE, 'stroke-width': 6 }, svg);
    el('line', { x1: 0, y1: 40, x2: 40, y2: 0, stroke: BLUE, 'stroke-width': 6 }, svg);
  }
}

function symbolOf(player) {
  if (game.owner[O] === player) return O;
  if (game.owner[X] === player) return X;
  return 0;
}

function statusText() {
  const g = game;
  if (g.phase === 'over') return g.draw ? 'Remíza' : `Vyhrály ${NAMES[g.winner]}!!!`;
  if (g.phase === 'choose2') return 'Hráč 2 si vybírá';
  if (g.phase === 'choose1') return 'Hráč 1 si vybírá';
  if (!g.moves.length) return 'Zadejte první tah';
  return `Na tahu jsou ${NAMES[symbolToMove(g)]}`;
}

function hintText() {
  if (flash) return flash;
  if (preview) {
    return lastPointer === 'mouse'
      ? 'Klikněte znovu na stejné pole pro potvrzení'
      : 'Klepněte znovu na stejné pole pro potvrzení';
  }
  const g = game;
  const n = g.moves.length;
  switch (g.phase) {
    case 'open3': return `Hráč 1 pokládá 3 úvodní kameny (${n}/3)`;
    case 'choose2': return 'X = hrát za křížky · O = za kolečka · +2 = položit další 2 kameny';
    case 'open2': return `Hráč 2 pokládá 2 další kameny (${n - 3}/2)`;
    case 'choose1': return 'X = hrát za křížky · O = hrát za kolečka';
    case 'play':
      if (!n) return lastPointer === 'mouse' ? 'Levé tlačítko = kolečko, pravé = křížek' : 'Kdo začíná, zvolte dole';
      return `Hraje Hráč ${activePlayer(g)}`;
    case 'over':
      if (g.draw) return 'Deska je plná';
      return g.owner[g.winner] ? `Vyhrál Hráč ${g.owner[g.winner]}` : '';
    default: return '';
  }
}

const btnX = $('choose-x');
const btnO = $('choose-o');
const btnPlus2 = $('choose-plus2');
const choiceBox = document.querySelector('.choice');

function renderChoiceBar() {
  const g = game;
  const atStart = g.moves.length === 0 && canPlaceStone(g);
  let caption = '';
  let enabled = [false, false, false];

  if (atStart) {
    caption = 'Začínají:';
    enabled = [true, true, false];
  } else if (g.phase === 'choose2') {
    caption = 'Hráč 2 vybírá:';
    enabled = [true, true, true];
  } else if (g.phase === 'choose1') {
    caption = 'Hráč 1 vybírá:';
    enabled = [true, true, false];
  } else if (g.owner[O]) {
    caption = `Hráč ${g.owner[O]} = kolečka · Hráč ${g.owner[X]} = křížky`;
  } else {
    caption = 'Volba symbolů (Swap2)';
  }

  $('choice-caption').textContent = caption;
  [btnX, btnO, btnPlus2].forEach((b, i) => { b.disabled = !enabled[i]; });
  btnX.setAttribute('aria-pressed', String(atStart && startSymbol === X));
  btnO.setAttribute('aria-pressed', String(atStart && startSymbol === O));
  btnPlus2.removeAttribute('aria-pressed');
  choiceBox.classList.toggle('deciding', g.phase === 'choose2' || g.phase === 'choose1');
}

function renderBanner() {
  const banner = $('banner');
  const show = game.phase === 'over' && !bannerHidden;
  banner.hidden = !show;
  if (!show) return;
  $('banner-text').textContent = game.draw ? 'Remíza!' : `Vyhrály ${NAMES[game.winner]}!!!`;
  $('banner-sub').textContent = !game.draw && game.owner[game.winner] ? `Hráč ${game.owner[game.winner]}` : '';
}

function render() {
  renderBoard();

  const active = activePlayer(game);
  const winnerPlayer = game.winner ? game.owner[game.winner] : 0;
  for (const p of [1, 2]) {
    const card = $('p' + p);
    renderPlayerIcon(card.querySelector('svg'), symbolOf(p));
    card.classList.toggle('active', p === active || p === winnerPlayer);
  }

  $('ukazatel').textContent = statusText();
  const hint = $('hint');
  hint.textContent = hintText();
  hint.classList.toggle('flash', Boolean(flash));

  renderChoiceBar();
  renderBanner();
  $('undo').disabled = actions.length === 0;
}

/* ================= wiring ================= */

function setupBoardInput() {
  let down = null;

  boardSvg.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, button: e.button, type: e.pointerType };
  });

  boardSvg.addEventListener('pointerup', (e) => {
    if (!down || down.id !== e.pointerId) return;
    const d = down;
    down = null;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 14) return;   // finger slid away: not a tap
    const cell = cellFromEvent(e);
    if (!cell) return;
    lastPointer = d.type === 'mouse' ? 'mouse' : 'touch';
    const mouseSymbol = d.type === 'mouse' ? (d.button === 2 ? X : O) : null;
    onCellTap(cell.r, cell.c, mouseSymbol);
  });

  boardSvg.addEventListener('pointercancel', () => { down = null; });
  boardSvg.addEventListener('contextmenu', (e) => e.preventDefault());   // right click / long press

  // thin outline under the mouse (desktop only)
  boardSvg.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const cell = cellFromEvent(e);
    if (!cell || !canPlaceStone(game) || game.board[cell.r][cell.c] !== 0) {
      hoverRect.setAttribute('visibility', 'hidden');
      return;
    }
    hoverRect.setAttribute('x', cell.c * CELL);
    hoverRect.setAttribute('y', cell.r * CELL);
    hoverRect.setAttribute('visibility', 'visible');
  });
  boardSvg.addEventListener('pointerleave', () => hoverRect.setAttribute('visibility', 'hidden'));
}

function onChoice(symbolOrPlus2) {
  if (game.moves.length === 0 && canPlaceStone(game)) {
    // before the first stone the X / O buttons choose who starts
    if (symbolOrPlus2 === PLUS2) return;
    startSymbol = symbolOrPlus2;
    if (preview) preview.s = startSymbol;
    save();
    render();
    return;
  }
  act({ t: 'choose', o: symbolOrPlus2 });
}

const MODE_HELP = {
  swap2: 'Hráč 1 položí 3 kameny, Hráč 2 si pak vybere symbol, nebo položí další 2 kameny a výběr nechá na Hráči 1.',
  free: 'Kdo položí první kámen, je Hráč 1. Pak se hráči střídají.',
};

function setupDialogs() {
  const newDialog = $('new-dialog');
  const form = newDialog.querySelector('form');
  const radios = form.querySelectorAll('input[name="mode"]');
  const updateHelp = () => {
    const checked = form.querySelector('input[name="mode"]:checked');
    $('mode-help').textContent = MODE_HELP[checked ? checked.value : mode];
  };
  radios.forEach((r) => r.addEventListener('change', updateHelp));

  $('new-btn').addEventListener('click', () => {
    radios.forEach((r) => { r.checked = r.value === mode; });
    updateHelp();
    $('new-warn').hidden = actions.length === 0 || game.phase === 'over';
    newDialog.returnValue = '';
    newDialog.showModal();
  });
  newDialog.addEventListener('close', () => {
    if (newDialog.returnValue !== 'start') return;
    const checked = form.querySelector('input[name="mode"]:checked');
    startNewGame(checked ? checked.value : mode);
  });

  const rulesDialog = $('rules-dialog');
  $('rules-btn').addEventListener('click', () => rulesDialog.showModal());

  // tap on the dark backdrop closes a dialog
  for (const d of [newDialog, rulesDialog]) {
    d.addEventListener('click', (e) => {
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      if (outside) d.close('cancel');
    });
  }
}

function init() {
  load();
  herniPole();
  setupBoardInput();
  setupDialogs();

  btnX.addEventListener('click', () => onChoice(X));
  btnO.addEventListener('click', () => onChoice(O));
  btnPlus2.addEventListener('click', () => onChoice(PLUS2));
  $('undo').addEventListener('click', undo);
  $('again').addEventListener('click', () => startNewGame(mode));
  $('view-board').addEventListener('click', () => { bannerHidden = true; render(); });

  // Ctrl/Cmd+Z = Zpět on a keyboard
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !document.querySelector('dialog[open]')) {
      e.preventDefault();
      undo();
    }
    if (e.key === 'Escape' && preview) { preview = null; render(); }
  });

  render();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
