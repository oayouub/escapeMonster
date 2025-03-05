const socket = io()
const canvas = document.getElementById('gameCanvas')
const ctx = canvas.getContext('2d')
const loginScreen = document.getElementById('login-screen')
const playerNameInput = document.getElementById('player-name')
const joinBtn = document.getElementById('join-btn')
const startBtn = document.getElementById('start-btn')
const playersCountDiv = document.getElementById('players-count')

canvas.width = 800
canvas.height = 600

let players = []
let gameState = null
let myPlayer = null

const keys = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  ArrowDown: false
}

const directions = ['down', 'left', 'up'];
const frames = ['0', '1', '2', '3'];
const playerImages = {};

directions.forEach((dir) => {
  playerImages[dir] = {};
  frames.forEach((frame) => {
    playerImages[dir][frame] = new Image();

    if (frame === '0' || frame === '2') {
      playerImages[dir][frame].src = `assets/skins/p-1/${dir}/0.png`;
    } else {
      playerImages[dir][frame].src = `assets/skins/p-1/${dir}/${frame}.png`;
    }
  });
});

function getPlayerImage(player, animationFrame) {
  if (player.isStunned) {
    return playerImages['down']['0'];
  } else if (player.isInvincible) {
    return Date.now() % 200 < 100 ? playerImages['down']['0'] : playerImages['down']['0'];
  }

  let direction = player.direction || 'down';
  let frame = animationFrame % 2 === 0 ? '0' : (animationFrame % 4 === 1 ? '1' : '2');
  return playerImages[direction]?.[frame] || playerImages['down']['0'];
}

let animationFrame = 0

// join
joinBtn.addEventListener('click', () => {
  const playerName = playerNameInput.value.trim()
  if (playerName) {
    socket.emit('join', playerName)
    joinBtn.style.display = 'none'
    playerNameInput.style.display = 'none'
    startBtn.style.display = 'block'
  }
})

startBtn.addEventListener('click', () => {
  socket.emit('requestStart')
})

socket.on('playersCount', (count) => {
  playersCountDiv.textContent = `Joueurs connectés: ${count}/4`
  startBtn.disabled = count < 2
})

socket.on('gameStarted', () => {
  loginScreen.style.display = 'none'
  canvas.style.display = 'block'
})

socket.on('players', (updatedPlayers) => {
  players = updatedPlayers.map(player => ({
    ...player,
    direction: player.direction
  }));
  myPlayer = players.find(p => p.id === socket.id);
});


socket.on('gameState', (state) => {
  gameState = state
})

//restart
function resetInterface() {
  canvas.style.display = 'none'

  loginScreen.style.display = 'block'
  playerNameInput.style.display = 'block'
  joinBtn.style.display = 'block'
  startBtn.style.display = 'none'

  playerNameInput.value = ''

  playersCountDiv.textContent = 'Joueurs connectés: 0/4'

  players = []
  gameState = null
  myPlayer = null
}

socket.on('eliminated', () => {
  alert('Vous avez été éliminé !')
})

socket.on('gameOver', (winner) => {
  alert(`${winner.name} a gagné la partie !`)
  resetInterface()
})

socket.on('gameReset', () => {
  resetInterface()
})

// stun
socket.on('stunned', () => {
  if (myPlayer) {
    myPlayer.isStunned = true
  }
})
socket.on('unstunned', () => {
  if (myPlayer) {
    myPlayer.isStunned = false
  }
})

document.addEventListener('keydown', (e) => {
  if (keys.hasOwnProperty(e.key)) {
    keys[e.key] = true
  }
})
document.addEventListener('keyup', (e) => {
  if (keys.hasOwnProperty(e.key)) {
    keys[e.key] = false
  }
})

function gameLoop() {
  if (myPlayer && !myPlayer.isStunned) {
    let newDirection = null

    if (keys.ArrowLeft) {
      myPlayer.x -= 5;
      newDirection = 'left';
    }
    if (keys.ArrowRight) {
      myPlayer.x += 5;
      newDirection = 'right';
    }
    if (keys.ArrowUp) {
      myPlayer.y -= 5;
      newDirection = 'up';
    }
    if (keys.ArrowDown) {
      myPlayer.y += 5;
      newDirection = 'down';
    }

    if (!keys.ArrowLeft && !keys.ArrowRight && !keys.ArrowUp && !keys.ArrowDown) {
      newDirection = myPlayer.direction; // Ne change pas la direction
    }

    myPlayer.x = Math.max(0, Math.min(canvas.width, myPlayer.x));
    myPlayer.y = Math.max(0, Math.min(canvas.height, myPlayer.y));

    // Seulement envoyer si la direction change
    if (newDirection !== myPlayer.direction) {
      myPlayer.direction = newDirection;
      socket.emit('move', {x: myPlayer.x, y: myPlayer.y, direction: newDirection});
    } else {
      console.log('default', myPlayer.direction, newDirection)
    }

    animationFrame = (animationFrame + 1) % 4;
  }

  render();
  requestAnimationFrame(gameLoop);
}

function render() {
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  if (gameState && gameState.obstacles) {
    ctx.fillStyle = '#666'
    for (const obstacle of gameState.obstacles) {
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height)
    }
  }

  if (gameState) {
    ctx.fillStyle = '#ff4400'
    ctx.fillRect(0, 0, canvas.width, 100)
  }

  // player
  players.forEach(player => {
    let playerImage = getPlayerImage(player, animationFrame);
    let playerDirection = player.direction; // On s'assure qu'une direction existe

    if (player.isStunned) {
      playerImage = playerImages.normal;
    } else if (player.isInvincible) {
      playerImage = Date.now() % 200 < 100 ? playerImages.normal : playerImages.normal;
    } else {
      if (player.direction === 'right') {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(playerImage, -player.x - 20, player.y - 20, 40, 40);
        ctx.restore();
      } else {
        ctx.drawImage(playerImage, player.x - 20, player.y - 20, 40, 40);
      }
    }

    ctx.drawImage(playerImage, player.x - 20, player.y - 20, 40, 40);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(player.name, player.x, player.y - 30);

    if (player.isStunned) {
      ctx.fillText('STUN!', player.x, player.y - 45);
    } else if (player.isInvincible) {
      ctx.fillText('INVINCIBLE!', player.x, player.y - 45);
    }
  });
}

gameLoop()