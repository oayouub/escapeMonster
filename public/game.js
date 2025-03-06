const socket = io()
const canvas = document.getElementById('gameCanvas')
const ctx = canvas.getContext('2d')
const loginScreen = document.getElementById('login-screen')
const playerNameInput = document.getElementById('player-name')
const joinBtn = document.getElementById('join-btn')
const startBtn = document.getElementById('start-btn')
const playersCountDiv = document.getElementById('players-count')

const backgroundMusic = document.getElementById('backgroundMusic')
const soundToggle = document.getElementById('soundToggle')
const soundOnIcon = soundToggle.querySelector('.sound-on')
const soundOffIcon = soundToggle.querySelector('.sound-off')

const winModal = document.getElementById('win-modal');
const winnerText = document.getElementById('winner-text');
const returnLobbyBtn = document.getElementById('return-lobby');

backgroundMusic.volume = 0.5;
soundToggle.addEventListener('click', () => {
    if (backgroundMusic.paused) {
        backgroundMusic.play();
        soundOnIcon.style.display = 'block'
        soundOffIcon.style.display = 'none'
    } else {
        backgroundMusic.pause();
        soundOnIcon.style.display = 'none'
        soundOffIcon.style.display = 'block'
    }
});

document.addEventListener('click', () => {
    if (backgroundMusic.paused) {
        backgroundMusic.play()
    }
}, { once: true })

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

const directions = ['down', 'left', 'up', 'right'];
const frames = ['0', '1', '2', '3'];
const playerImages = {};

let STUN_DURATIO
let INVINCIBLE_DURATION

let stunEndTime = 0
let invincibleEndTime = 0

let isStunned = false
let isInvincible = false

const rockImage = new Image()
rockImage.src = 'assets/rockEscape.png'

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
  if (direction === 'right') direction = 'left';
  
  let frame = animationFrame % 2 === 0 ? '0' : (animationFrame % 4 === 1 ? '1' : '2');
  return playerImages[direction]?.[frame] || playerImages['down']['0'];
}

let animationFrame = 0
let lastDirection = null;

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
  playersCountDiv.textContent = `CONNECTED PLAYERS: ${count}/4`
  startBtn.disabled = count < 2
})

socket.on('gameStarted', () => {
  loginScreen.style.display = 'none'
  canvas.style.display = 'block'
  document.getElementById('game-title').style.display = 'none'
})

socket.on('players', (updatedPlayers) => {
  players = updatedPlayers.map(player => ({
    ...player,
    direction: player.direction || 'down'
  }));
  
  myPlayer = players.find(p => p.id === socket.id);
  if (myPlayer) {
    if (!isStunned && !isInvincible) {
      isStunned = myPlayer.isStunned || false
      isInvincible = myPlayer.isInvincible || false
    }
  }
});

socket.on('gameState', (state) => {
  gameState = state
})

//restart
function resetInterface() {
  winModal.style.display = 'none';
  canvas.style.display = 'none';
  loginScreen.style.display = 'block';
  playerNameInput.style.display = 'block';
  joinBtn.style.display = 'block';
  startBtn.style.display = 'none';
  document.getElementById('game-title').style.display = 'block';
  
  playerNameInput.value = '';
  playersCountDiv.textContent = 'CONNECTED PLAYERS: 0/4';
  players = [];
  gameState = null;
  myPlayer = null;
}

socket.on('eliminated', () => {
  if (myPlayer) {
    myPlayer.eliminated = true;
    isStunned = true;
  }
});

socket.on('gameOver', (winner) => {
  winModal.style.display = 'flex';
  winnerText.textContent = `${winner.name} WINS!`;
})

socket.on('gameReset', () => {
  if (winModal.style.display !== 'flex') {
    resetInterface();
  }
})

// stun
socket.on('stunned', () => {
  if (myPlayer) {
    isStunned = true;
    stunEndTime = Date.now() + STUN_DURATION
  }
})

socket.on('unstunned', () => {
  if (myPlayer) {
    isStunned = false
    isInvincible = true
    invincibleEndTime = Date.now() + INVINCIBLE_DURATION
  }
})

socket.on('gameConstants', (constants) => {
  STUN_DURATION = constants.STUN_DURATION
  INVINCIBLE_DURATION = constants.INVINCIBLE_DURATION
})

// Ajouter l'événement pour le bouton de retour
returnLobbyBtn.addEventListener('click', () => {
  resetInterface();
  socket.emit('returnToLobby');
});

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
  if (myPlayer && !myPlayer.eliminated && !isStunned) {
    let direction = null;
    let hasMoved = false;

    // Déterminer la direction et envoyer au serveur
    if (keys.ArrowLeft) {
      direction = 'left';
      hasMoved = true;
    }
    else if (keys.ArrowRight) {
      direction = 'right';
      hasMoved = true;
    }
    else if (keys.ArrowUp) {
      direction = 'up';
      hasMoved = true;
    }
    else if (keys.ArrowDown) {
      direction = 'down';
      hasMoved = true;
    }

    if (hasMoved) {
      socket.emit('move', { direction });
      myPlayer.direction = direction;
      
      // Mise à jour locale de la position
      switch (direction) {
        case 'left':
          myPlayer.x = Math.max(0, myPlayer.x - 5);
          break;
        case 'right':
          myPlayer.x = Math.min(canvas.width, myPlayer.x + 5);
          break;
        case 'up':
          myPlayer.y = Math.max(0, myPlayer.y - 5);
          break;
        case 'down':
          myPlayer.y = Math.min(canvas.height, myPlayer.y + 5);
          break;
      }
      
      animationFrame = (animationFrame + 1) % 4;
    } else {
      animationFrame = 0;
    }
  }

  render();
  requestAnimationFrame(gameLoop);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  ctx.fillStyle = '#2E7D32'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  if (gameState) {
    const lavaGradient = ctx.createLinearGradient(0, 0, 0, gameState.lavaHeight)
    lavaGradient.addColorStop(0, '#FF4500')    
    lavaGradient.addColorStop(0.3, '#FF6B00')  
    lavaGradient.addColorStop(0.6, '#FF2400')  
    lavaGradient.addColorStop(1, '#8B0000')    

    ctx.fillStyle = lavaGradient
    ctx.fillRect(0, 0, canvas.width, gameState.lavaHeight)
  }

  // Obstacles
  if (gameState && gameState.obstacles) {
    for (const obstacle of gameState.obstacles) {
      ctx.drawImage(rockImage, obstacle.x, obstacle.y, obstacle.width, obstacle.height)
    }
  }

  // player
  players.forEach(player => {
    if (!player.eliminated) {
      let playerImage = getPlayerImage(player, animationFrame)
      if (player.isStunned) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.7)'
        ctx.beginPath()
        ctx.arc(player.x, player.y, 25, 0, Math.PI * 2)
        ctx.fill()
      } else if (player.isInvincible) {
        ctx.fillStyle = 'rgba(0, 255, 255, 0.5)'
        ctx.beginPath()
        ctx.arc(player.x, player.y, 25, 0, Math.PI * 2)
        ctx.fill()
      }

      if (player.direction === 'right') {
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(playerImage, -player.x - 20, player.y - 20, 40, 40)
        ctx.restore()
      } else {
        ctx.drawImage(playerImage, player.x - 20, player.y - 20, 40, 40)
      }

      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.fillText(player.name, player.x, player.y - 30)

      if (player.isStunned) {
        ctx.fillText('STUN!', player.x, player.y - 45)
      } else if (player.isInvincible) {
        ctx.fillText('INVINCIBLE!', player.x, player.y - 45)
      }
    }
  })
}

// Ajouter l'événement pour recevoir les mouvements des autres joueurs
socket.on('playerMove', (data) => {
  const player = players.find(p => p.id === data.id);
  if (player && player !== myPlayer) {
    player.x = data.x;
    player.y = data.y;
    player.direction = data.direction;
  }
});

gameLoop()