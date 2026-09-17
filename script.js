const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');

const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');

const holdCanvas = document.getElementById('hold');
const holdContext = holdCanvas.getContext('2d');

context.scale(20, 20);
nextContext.scale(20, 20);
holdContext.scale(20, 20);

// Paleta Neon Pro
const colors = [
  null,
  '#00f3ff', // I (Ciano)
  '#0070f3', // J (Azul)
  '#ffbf00', // L (Laranja/Amarelo)
  '#ffff00', // O (Amarelo)
  '#00ff66', // S (Verde)
  '#9d00ff', // T (Roxo)
  '#ff0055'  // Z (Vermelho)
];

function createPiece(type) {
  switch (type) {
    case 'I': return [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]];
    case 'J': return [[0,2,0],[0,2,0],[2,2,0]];
    case 'L': return [[0,3,0],[0,3,0],[0,3,3]];
    case 'O': return [[4,4],[4,4]];
    case 'S': return [[0,5,5],[5,5,0],[0,0,0]];
    case 'T': return [[0,6,0],[6,6,6],[0,0,0]];
    case 'Z': return [[7,7,0],[0,7,7],[0,0,0]];
  }
}

function createMatrix(w, h) {
  const matrix = [];
  while (h--) matrix.push(new Array(w).fill(0));
  return matrix;
}

const arena = createMatrix(12, 20);

const player = {
  pos: {x: 0, y: 0},
  matrix: null,
  nextMatrix: null,
  holdMatrix: null,
  canHold: true,
  score: 0,
  lines: 0,
  level: 1,
};

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let isPaused = false;
let isGameOver = false;

// Controle Fluido Teclado (DAS - Delayed Auto-Shift)
const keys = {};
let dasTimer = 0;
const DAS_DELAY = 160; // ms de atraso antes de repetir
const ARR_RATE = 40;   // taxa de repetição em ms

// Desenha Elementos do Jogo
function draw() {
  context.fillStyle = '#080812';
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Grade de fundo
  context.strokeStyle = 'rgba(255, 255, 255, 0.02)';
  context.lineWidth = 0.05;
  for (let x = 0; x < arena[0].length; x++) {
    for (let y = 0; y < arena.length; y++) {
      context.strokeRect(x, y, 1, 1);
    }
  }

  drawMatrix(arena, {x: 0, y: 0});
  
  if (player.matrix && !isGameOver) {
    drawGhostPiece();
    drawMatrix(player.matrix, player.pos);
  }

  drawMiniCanvas(nextContext, nextCanvas, player.nextMatrix);
  drawMiniCanvas(holdContext, holdCanvas, player.holdMatrix);
}

function drawMiniCanvas(ctx, cnv, matrix) {
  ctx.fillStyle = '#080812';
  ctx.fillRect(0, 0, cnv.width, cnv.height);

  if (matrix) {
    const offsetX = (4 - matrix[0].length) / 2;
    const offsetY = (4 - matrix.length) / 2;
    drawMatrix(matrix, {x: offsetX, y: offsetY}, ctx);
  }
}

function drawGhostPiece() {
  const ghostPos = {x: player.pos.x, y: player.pos.y};
  while (!collide(arena, {pos: ghostPos, matrix: player.matrix})) {
    ghostPos.y++;
  }
  ghostPos.y--;

  drawMatrix(player.matrix, ghostPos, context, true);
}

function drawMatrix(matrix, offset, ctx = context, isGhost = false) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        const px = x + offset.x;
        const py = y + offset.y;

        if (isGhost) {
          ctx.strokeStyle = colors[value];
          ctx.lineWidth = 0.08;
          ctx.strokeRect(px + 0.1, py + 0.1, 0.8, 0.8);
        } else {
          // Bloco Principal com Degradê
          ctx.fillStyle = colors[value];
          ctx.fillRect(px + 0.05, py + 0.05, 0.9, 0.9);

          // Brilho Interior
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.fillRect(px + 0.1, py + 0.1, 0.8, 0.15);
          ctx.fillRect(px + 0.1, py + 0.1, 0.15, 0.8);

          // Sombra Interior
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.fillRect(px + 0.1, py + 0.75, 0.8, 0.15);
          ctx.fillRect(px + 0.75, py + 0.1, 0.15, 0.8);
        }
      }
    });
  });
}

function collide(arena, player) {
  const [m, o] = [player.matrix, player.pos];
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
        return true;
      }
    }
  }
  return false;
}

function merge(arena, player) {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        arena[y + player.pos.y][x + player.pos.x] = value;
      }
    });
  });
}

function playerMove(dir) {
  if (isPaused || isGameOver) return;
  player.pos.x += dir;
  if (collide(arena, player)) {
    player.pos.x -= dir;
  }
}

function playerReset() {
  const pieces = 'IJLOSTZ';
  if (!player.nextMatrix) {
    player.nextMatrix = createPiece(pieces[pieces.length * Math.random() | 0]);
  }

  player.matrix = player.nextMatrix;
  player.nextMatrix = createPiece(pieces[pieces.length * Math.random() | 0]);
  player.pos.y = 0;
  player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
  player.canHold = true;

  if (collide(arena, player)) {
    gameOver();
  }
}

function playerHold() {
  if (!player.canHold || isPaused || isGameOver) return;

  if (!player.holdMatrix) {
    player.holdMatrix = createPiece(getPieceType(player.matrix));
    playerReset();
  } else {
    const temp = createPiece(getPieceType(player.matrix));
    player.matrix = createPiece(getPieceType(player.holdMatrix));
    player.holdMatrix = temp;
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
  }

  player.canHold = false;
}

function getPieceType(matrix) {
  const str = JSON.stringify(matrix);
  if (str.includes('1')) return 'I';
  if (str.includes('2')) return 'J';
  if (str.includes('3')) return 'L';
  if (str.includes('4')) return 'O';
  if (str.includes('5')) return 'S';
  if (str.includes('6')) return 'T';
  if (str.includes('7')) return 'Z';
}

function playerDrop() {
  if (isPaused || isGameOver) return;
  player.pos.y++;
  if (collide(arena, player)) {
    player.pos.y--;
    merge(arena, player);
    playerReset();
    arenaSweep();
  }
  dropCounter = 0;
}

function playerHardDrop() {
  if (isPaused || isGameOver) return;
  while (!collide(arena, player)) {
    player.pos.y++;
  }
  player.pos.y--;
  merge(arena, player);
  playerReset();
  arenaSweep();
  dropCounter = 0;
}

function playerRotate(dir) {
  if (isPaused || isGameOver) return;
  const pos = player.pos.x;
  let offset = 1;
  rotate(player.matrix, dir);
  while (collide(arena, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      rotate(player.matrix, -dir);
      player.pos.x = pos;
      return;
    }
  }
}

function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; ++y) {
    for (let x = 0; x < y; ++x) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (dir > 0) matrix.forEach(row => row.reverse());
  else matrix.reverse();
}

function arenaSweep() {
  let rowCount = 0;
  outer: for (let y = arena.length - 1; y >= 0; --y) {
    for (let x = 0; x < arena[y].length; ++x) {
      if (arena[y][x] === 0) continue outer;
    }

    const row = arena.splice(y, 1)[0].fill(0);
    arena.unshift(row);
    ++y;
    rowCount++;
  }

  if (rowCount > 0) {
    const lineScores = [0, 100, 300, 500, 800];
    player.score += lineScores[rowCount] * player.level;
    player.lines += rowCount;
    player.level = Math.floor(player.lines / 10) + 1;
    dropInterval = Math.max(80, 1000 - (player.level - 1) * 85);

    if (rowCount === 4) showCombo("TETRIS!");
    else if (rowCount >= 2) showCombo(`${rowCount}X COMBO!`);

    updateScore();
  }
}

function showCombo(text) {
  const popup = document.getElementById('combo-popup');
  popup.innerText = text;
  popup.classList.remove('hidden');
  setTimeout(() => popup.classList.add('hidden'), 800);
}

function updateScore() {
  document.getElementById('score').innerText = player.score;
  document.getElementById('lines').innerText = player.lines;
  document.getElementById('level').innerText = player.level;
}

function update(time = 0) {
  const deltaTime = time - lastTime;
  lastTime = time;

  if (!isPaused && !isGameOver) {
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
      playerDrop();
    }
    handleInput(deltaTime);
  }

  draw();
  requestAnimationFrame(update);
}

// Manipulação Suave dos Botões Mantidos Pressionados
function handleInput(dt) {
  if (keys['ArrowLeft'] || keys['KeyA']) {
    processKey('left', -1, dt);
  } else {
    keys.leftHeld = false;
  }

  if (keys['ArrowRight'] || keys['KeyD']) {
    processKey('right', 1, dt);
  } else {
    keys.rightHeld = false;
  }

  if (keys['ArrowDown'] || keys['KeyS']) {
    playerDrop();
  }
}

function processKey(keyName, dir, dt) {
  if (!keys[keyName + 'Held']) {
    playerMove(dir);
    keys[keyName + 'Held'] = true;
    dasTimer = 0;
  } else {
    dasTimer += dt;
    if (dasTimer >= DAS_DELAY) {
      playerMove(dir);
      dasTimer -= ARR_RATE;
    }
  }
}

function togglePause() {
  if (isGameOver) return;
  isPaused = !isPaused;
  const overlay = document.getElementById('overlay');
  if (isPaused) {
    document.getElementById('overlay-title').innerText = "PAUSADO";
    document.getElementById('overlay-msg').innerText = "Pressione P para Continuar";
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

function gameOver() {
  isGameOver = true;
  document.getElementById('overlay-title').innerText = "GAME OVER";
  document.getElementById('overlay-msg').innerText = `Pontos Final: ${player.score}`;
  document.getElementById('overlay').classList.remove('hidden');
}

function resetGame() {
  arena.forEach(row => row.fill(0));
  player.score = 0;
  player.lines = 0;
  player.level = 1;
  player.holdMatrix = null;
  dropInterval = 1000;
  isGameOver = false;
  isPaused = false;
  document.getElementById('overlay').classList.add('hidden');
  updateScore();
  playerReset();
}

// Eventos Teclado
document.addEventListener('keydown', e => {
  if (e.repeat && e.code !== 'ArrowDown') return;
  keys[e.code] = true;

  if (e.code === 'ArrowUp' || e.code === 'KeyW') playerRotate(1);
  if (e.code === 'Space') playerHardDrop();
  if (e.code === 'KeyC' || e.code === 'ShiftLeft') playerHold();
  if (e.code === 'KeyP') togglePause();
});

document.addEventListener('keyup', e => {
  keys[e.code] = false;
});

// Eventos Touch Mobile
document.getElementById('btn-left').addEventListener('click', () => playerMove(-1));
document.getElementById('btn-right').addEventListener('click', () => playerMove(1));
document.getElementById('btn-down').addEventListener('click', () => playerDrop());
document.getElementById('btn-rotate').addEventListener('click', () => playerRotate(1));
document.getElementById('btn-drop').addEventListener('click', () => playerHardDrop());
document.getElementById('btn-hold').addEventListener('click', () => playerHold());
document.getElementById('btn-pause').addEventListener('click', togglePause);

document.getElementById('pause-btn').addEventListener('click', togglePause);
document.getElementById('restart-btn').addEventListener('click', resetGame);

// Start
playerReset();
updateScore();
update();