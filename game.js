const canvas = document.getElementById('goBoard');
const ctx = canvas.getContext('2d');
const statusElement = document.getElementById('status');

const boardSize = 9; 
const cellSize = canvas.width / (boardSize + 1);
const padding = cellSize;

let board = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
let currentPlayer = 'black';
let previousBoardState = null;
let isAiThinking = false; // no clicking while ai ponders

// --- DESSIN ---
function drawGrid() {
    ctx.beginPath(); ctx.strokeStyle = '#000';
    for (let i = 0; i < boardSize; i++) {
        let pos = padding + i * cellSize;
        ctx.moveTo(pos, padding); ctx.lineTo(pos, canvas.height - padding);
        ctx.moveTo(padding, pos); ctx.lineTo(canvas.width - padding, pos);
    }
    ctx.stroke();
}

function drawStone(x, y, color) {
    ctx.shadowBlur = 5; ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.arc(padding + x * cellSize, padding + y * cellSize, cellSize * 0.45, 0, 2 * Math.PI);
    ctx.fillStyle = color; ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    for (let i = 0; i < boardSize; i++) {
        for (let j = 0; j < boardSize; j++) {
            if (board[i][j]) drawStone(i, j, board[i][j]);
        }
    }
    statusElement.innerText = isAiThinking ? "AI pondering..." : `Current turn : ${currentPlayer === 'black' ? 'BLACK' : 'WHITE'}`;
    statusElement.className = currentPlayer === 'black' ? "turn-black" : "turn-white";
}

// --- CORE LOGICS ---
function copyBoard(b) { return b.map(row => [...row]); }

function getGroup(x, y, color, visited = new Set()) {
    const key = `${x},${y}`;
    if (x < 0 || x >= boardSize || y < 0 || y >= boardSize || visited.has(key) || board[x][y] !== color) return [];
    visited.add(key);
    let group = [{x, y}];
    group.push(...getGroup(x+1, y, color, visited), ...getGroup(x-1, y, color, visited), ...getGroup(x, y+1, color, visited), ...getGroup(x, y-1, color, visited));
    return group;
}

function countLiberties(group, tempBoard) {
    let liberties = new Set();
    group.forEach(s => {
        [{x:s.x+1, y:s.y}, {x:s.x-1, y:s.y}, {x:s.x, y:s.y+1}, {x:s.x, y:s.y-1}].forEach(n => {
            if (n.x >= 0 && n.x < boardSize && n.y >= 0 && n.y < boardSize && tempBoard[n.x][n.y] === null) liberties.add(`${n.x},${n.y}`);
        });
    });
    return liberties.size;
}

// --- BUTONS ---
function passTurn() {
    if (isAiThinking) return; 
    currentPlayer = (currentPlayer === 'black') ? 'white' : 'black';
    render();
    if (currentPlayer === 'white') askAI();
}

function resetGame() {
    if (confirm("Do you want to restart ?")) {
        board = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
        currentPlayer = 'black';
        previousBoardState = null;
        isAiThinking = false;
        render();
    }
}

async function finishGame() {
    if (isAiThinking) return;
    try {
        const response = await fetch("http://127.0.0.1:5000/score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ board: board, size: boardSize })
        });
        const result = await response.json();
        const winnerName = result.winner === 'black' ? 'BLACK' : 'WHITE';
        alert(`Game is over ! \n\nBlack score : ${result.black.total} \nWhite score : ${result.white.total} (including ${result.white.komi}  Komi)\n\nWinner : ${winnerName} !`);
    } catch (err) {
        console.error("Error loading the score :", err);
        alert("Impossible to call referee (server Python).");
    }
}

// --- Play ---
function makeMove(i, j) {
    if (board[i][j] !== null) return false;

    let nextBoard = copyBoard(board);
    nextBoard[i][j] = currentPlayer;
    let opponent = currentPlayer === 'black' ? 'white' : 'black';
    let capturedAny = false;

    // Logique de capture
    for (let x=0; x<boardSize; x++) {
        for (let y=0; y<boardSize; y++) {
            if (nextBoard[x][y] === opponent) {
                let oldBoard = board; board = nextBoard;
                let group = getGroup(x, y, opponent);
                if (countLiberties(group, nextBoard) === 0) {
                    group.forEach(s => nextBoard[s.x][s.y] = null);
                    capturedAny = true;
                }
                board = oldBoard;
            }
        }
    }

    // anti suicide
    if (JSON.stringify(nextBoard) === JSON.stringify(previousBoardState)) return false;
    
    previousBoardState = copyBoard(board);
    board = nextBoard;
    currentPlayer = opponent;
    render();

    if (currentPlayer === 'white') {
        askAI();
    }
    return true;
}

// --- Calling API HUGGING FACE / PYTHON ---
async function askAI() {
    isAiThinking = true;
    render();
    
    try {
        const response = await fetch('http://127.0.0.1:5000/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ board: board, size: boardSize })
        });
        
        const data = await response.json();
        
        if (data.status === "success") {
            isAiThinking = false; 
            makeMove(data.x, data.y); 
        } 
        else if (data.status === "pass") {
            console.log("AI is skipping its turn !");
            alert("AI skipping its turn. Your move !");
            currentPlayer = 'black'; // On rend la main au joueur
            isAiThinking = false;
            render();
        } 
        else {
            console.error("Error Python server :", data.message);
            isAiThinking = false;
            render();
        }
    } catch (err) {
        console.error("Erreur Backend:", err);
        isAiThinking = false;
        render();
    }
}

// --- ÉCOUTEURS D'ÉVÉNEMENTS ---
canvas.addEventListener('click', (event) => {
    if (currentPlayer === 'white' || isAiThinking) return; 
    const rect = canvas.getBoundingClientRect();
    const i = Math.round((event.clientX - rect.left - padding) / cellSize);
    const j = Math.round((event.clientY - rect.top - padding) / cellSize);
    if (i >= 0 && i < boardSize && j >= 0 && j < boardSize) {
        makeMove(i, j);
    }
});

// starting
render();