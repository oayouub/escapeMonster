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
  players = updatedPlayers
  myPlayer = players.find(p => p.id === socket.id)
})

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
    if (keys.ArrowLeft) myPlayer.x -= 5
    if (keys.ArrowRight) myPlayer.x += 5
    if (keys.ArrowUp) myPlayer.y -= 5
    if (keys.ArrowDown) myPlayer.y += 5

    myPlayer.x = Math.max(0, Math.min(canvas.width, myPlayer.x))
    myPlayer.y = Math.max(0, Math.min(canvas.height, myPlayer.y))

    socket.emit('move', { x: myPlayer.x, y: myPlayer.y })
  }

  render()
  requestAnimationFrame(gameLoop)
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
    let playerColor
    if (player.isStunned) {
      playerColor = '#888888'
    } else if (player.isInvincible) {
      playerColor = Date.now() % 200 < 100 ? '#ffff00' : '#ff9900'
    } else {
      playerColor = player.id === socket.id ? '#00ff00' : '#ff0000'
    }
    
    ctx.fillStyle = playerColor
    ctx.beginPath()
    ctx.arc(player.x, player.y, 20, 0, Math.PI * 2)
    ctx.fill();
    
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.fillText(player.name, player.x, player.y - 30)
    
    if (player.isStunned) {
      ctx.fillText('STUN!', player.x, player.y - 45)
    } else if (player.isInvincible) {
      ctx.fillText('INVINCIBLE!', player.x, player.y - 45)
    }
  })
}

gameLoop()