const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let players = new Map()
let gameState = {
  isRunning: false,
  lavaHeight: 100,
  lavaSpeed: 0,
  obstacles: [],
  obstacleSpeed: 2 
}

const STUN_DURATION = 1500
const INVINCIBLE_DURATION = 500

io.on('connection', (socket) => {
  console.log('Nouveau joueur connecté')

  socket.emit('gameConstants', { STUN_DURATION, INVINCIBLE_DURATION });

  socket.on('join', (playerName) => {
    players.set(socket.id, {
      id: socket.id,
      name: playerName,
      x: Math.random() * 800,
      y: 500,
      isStunned: false,
      isInvincible: false
    })

    io.emit('players', Array.from(players.values()))
    io.emit('playersCount', players.size)
  })

  socket.on('requestStart', () => {
    if (players.size >= 2 && !gameState.isRunning) {
      startGame()
      io.emit('gameStarted')
    }
  })

  socket.on('move', (position) => {
    const player = players.get(socket.id)
    if (player && !player.isStunned) {
      player.x = position.x;
      player.y = position.y;
    }
  })

  socket.on('disconnect', () => {
    players.delete(socket.id)
    if (players.size < 2) {
      resetGame()
    }
    io.emit('players', Array.from(players.values()))
  })
})

function startGame() {
  gameState.isRunning = true
  gameState.lavaHeight = 100
  gameState.lavaSpeed = 0
  gameState.obstacles = []

  const gameLoop = setInterval(() => {
    if (!gameState.isRunning) {
      clearInterval(gameLoop)
      return
    }

    gameState.obstacles.forEach(obstacle => {
      obstacle.y -= gameState.obstacleSpeed
    })

    for (const [_, player] of players) {
      player.y -= gameState.obstacleSpeed
      
      if (player.y < 0) {
        eliminatePlayer(player.id)
      }
    }

    gameState.obstacles = gameState.obstacles.filter(obstacle => obstacle.y > -obstacle.height)

    if (Math.random() < 0.03) {
      gameState.obstacles.push(createNewObstacle())
    }

    checkLavaCollisions()
    checkObstacleCollisions()

    io.emit('gameState', gameState)
    io.emit('players', Array.from(players.values()))
  }, 1000 / 60)
}

function createNewObstacle() {
  return {
    x: Math.random() * (800 - 150), 
    y: 600,
    width: 50 + Math.random() * 100,
    height: 20
  }
}

function checkLavaCollisions() {
  for (const [id, player] of players) {
    if (player.y <= gameState.lavaHeight) {
      eliminatePlayer(id)
    }
  }

  const alivePlayers = Array.from(players.values()).filter(p => !p.eliminated)
  if (alivePlayers.length === 1) {
    io.emit('gameOver', alivePlayers[0])
    resetGame()
  }
}

function eliminatePlayer(playerId) {
  const player = players.get(playerId);
  if (player) {
    player.eliminated = true;
    io.to(playerId).emit('eliminated')
  }
}

function checkObstacleCollisions() {
  for (const [id, player] of players) {
    if (player.eliminated || player.isStunned || player.isInvincible) continue

    for (const obstacle of gameState.obstacles) {
      if (checkCollision(player, obstacle)) {
        stunPlayer(id)
        break
      }
    }
  }
}

function checkCollision(player, obstacle) {
  const playerRadius = 20
  const closestX = Math.max(obstacle.x, Math.min(player.x, obstacle.x + obstacle.width))
  const closestY = Math.max(obstacle.y, Math.min(player.y, obstacle.y + obstacle.height))

  const distanceX = player.x - closestX
  const distanceY = player.y - closestY

  return (distanceX * distanceX + distanceY * distanceY) < (playerRadius * playerRadius)
}

function stunPlayer(playerId) {
  const player = players.get(playerId)
  if (player && !player.isStunned && !player.isInvincible) {
    player.isStunned = true
    io.to(playerId).emit('stunned')
    
    setTimeout(() => {
      if (players.has(playerId)) {
        const player = players.get(playerId)
        player.isStunned = false
        player.isInvincible = true
        
        io.emit('players', Array.from(players.values()))
        io.to(playerId).emit('unstunned')
        
        setTimeout(() => {
          if (players.has(playerId)) {
            players.get(playerId).isInvincible = false
            io.emit('players', Array.from(players.values()))
          }
        }, INVINCIBLE_DURATION)
      }
    }, STUN_DURATION)
  }
}

function resetGame() {
  gameState.isRunning = false
  gameState.lavaHeight = 100
  gameState.lavaSpeed = 0
  gameState.obstacles = []
  players.clear()
  io.emit('gameReset')
}

const PORT = process.env.PORT || 3000
http.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`)
})