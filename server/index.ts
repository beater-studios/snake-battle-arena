import cors from "cors";
import express from "express";
import { createServer } from "http";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import {
  Direction,
  Food,
  GameConstants,
  GameRoomConfig,
  GameState,
  Player,
  Position,
  RoomInfo,
  SnakeSegment,
} from "./types/game";

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.static(path.join(__dirname, "../client/build")));

const GAME_CONSTANTS: GameConstants = {
  GRID_SIZE: 20,
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 600,
  GAME_SPEED: 80,
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 8,
  MIN_FOOD_COUNT: 3,
  GOLDEN_FOOD_CHANCE: 0.1,
  RESPAWN_COOLDOWN: 3000,
  GAME_DURATION: 300000,
  COLORS: [
    "#3b82f6",
    "#22c55e",
    "#f97316",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#f59e0b",
    "#10b981",
  ],
};

const gameRooms = new Map<string, GameRoom>();
const quickMatchRoom = "quick-match-room";

function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function findRoomByCode(code: string): GameRoom | undefined {
  for (const room of gameRooms.values()) {
    if (room.config.roomCode === code) {
      return room;
    }
  }
  return undefined;
}

class GameRoom {
  public roomId: string;
  public players = new Map<string, Player>();
  public food: Food[] = [];
  public gameState: "waiting" | "playing" | "finished" = "waiting";
  private gameLoop: NodeJS.Timeout | null = null;
  private lastUpdate: number = Date.now();
  private gameStartTime: number = 0;
  public config: GameRoomConfig;

  constructor(roomId: string, config?: Partial<GameRoomConfig>) {
    this.roomId = roomId;
    this.config = {
      roomId,
      maxPlayers: GAME_CONSTANTS.MAX_PLAYERS,
      gridSize: GAME_CONSTANTS.GRID_SIZE,
      canvasWidth: GAME_CONSTANTS.CANVAS_WIDTH,
      canvasHeight: GAME_CONSTANTS.CANVAS_HEIGHT,
      gameSpeed: GAME_CONSTANTS.GAME_SPEED,
      minFoodCount: GAME_CONSTANTS.MIN_FOOD_COUNT,
      ...config,
    };
    this.generateFood(5);
  }

  public addPlayer(playerId: string, playerName: string): void {
    const usedColors = Array.from(this.players.values()).map((p) => p.color);
    const availableColor =
      GAME_CONSTANTS.COLORS.find((c: string) => !usedColors.includes(c)) ||
      GAME_CONSTANTS.COLORS[0];

    const x =
      Math.floor(
        Math.random() * (this.config.canvasWidth! / this.config.gridSize! - 10)
      ) + 5;
    const y =
      Math.floor(
        Math.random() * (this.config.canvasHeight! / this.config.gridSize! - 10)
      ) + 5;

    const player: Player = {
      id: playerId,
      name: playerName,
      snake: [{ x: x * this.config.gridSize!, y: y * this.config.gridSize! }],
      direction: { x: this.config.gridSize!, y: 0 },
      color: availableColor,
      alive: true,
      score: 0,
      lastDirectionChange: Date.now(),
    };

    this.players.set(playerId, player);

    if (
      this.players.size >= GAME_CONSTANTS.MIN_PLAYERS &&
      this.gameState === "waiting"
    ) {
      this.startGame();
    }
  }

  public removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    this.players.delete(playerId);

    if (player && !player.isBot) {
      this.removeBots(1);
    }

    if (this.gameState === "playing" && this.getHumanPlayerCount() < 1) {
      this.resetToWaiting();
    } else if (this.gameState === "playing" && this.getAlivePlayerCount() < 2) {
      this.endGame();
    }
  }

  public addBot(): string {
    const botId = `bot-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 5)}`;
    const botNames = [
      "🤖 CyberBot",
      "🔥 NeonBot",
      "⚡ VoltBot",
      "💎 CrystalBot",
      "🌟 StarBot",
      "🚀 TurboBot",
      "🎯 PrecisionBot",
      "⭐ NovaBot",
    ];

    const usedNames = Array.from(this.players.values()).map((p) => p.name);
    const availableNames = botNames.filter((name) => !usedNames.includes(name));
    const botName =
      availableNames.length > 0
        ? availableNames[Math.floor(Math.random() * availableNames.length)]
        : `🤖 Bot${Math.floor(Math.random() * 1000)}`;

    const colors = GAME_CONSTANTS.COLORS.filter(
      (color) =>
        !Array.from(this.players.values()).some((p) => p.color === color)
    );
    const botColor = colors.length > 0 ? colors[0] : GAME_CONSTANTS.COLORS[0];

    const x =
      Math.floor(
        Math.random() * (this.config.canvasWidth! / this.config.gridSize! - 10)
      ) + 5;
    const y =
      Math.floor(
        Math.random() * (this.config.canvasHeight! / this.config.gridSize! - 10)
      ) + 5;

    const bot: Player = {
      id: botId,
      name: botName,
      color: botColor,
      snake: [{ x: x * this.config.gridSize!, y: y * this.config.gridSize! }],
      direction: { x: this.config.gridSize!, y: 0 },
      alive: true,
      score: 0,
      isBot: true,
      lastDirectionChange: Date.now(),
    };

    this.players.set(botId, bot);

    if (
      this.gameState === "waiting" &&
      this.players.size >= GAME_CONSTANTS.MIN_PLAYERS
    ) {
      this.startGame();
    }

    return botId;
  }

  private removeBots(count: number = 1): void {
    const bots = Array.from(this.players.values()).filter((p) => p.isBot);
    for (let i = 0; i < Math.min(count, bots.length); i++) {
      this.players.delete(bots[i].id);
    }
  }

  private getHumanPlayerCount(): number {
    return Array.from(this.players.values()).filter((p) => !p.isBot).length;
  }

  private getAlivePlayerCount(): number {
    return Array.from(this.players.values()).filter((p) => p.alive).length;
  }

  private resetToWaiting(): void {
    this.gameState = "waiting";
    this.food = [];
    this.generateFood(5);

    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }

    for (const player of this.players.values()) {
      const x =
        Math.floor(
          Math.random() *
            (this.config.canvasWidth! / this.config.gridSize! - 10)
        ) + 5;
      const y =
        Math.floor(
          Math.random() *
            (this.config.canvasHeight! / this.config.gridSize! - 10)
        ) + 5;

      player.snake = [
        { x: x * this.config.gridSize!, y: y * this.config.gridSize! },
      ];
      player.direction = { x: this.config.gridSize!, y: 0 };
      player.alive = true;
      player.score = 0;
      player.lastDirectionChange = Date.now();
    }
  }

  private updateBotAI(): void {
    const bots = Array.from(this.players.values()).filter(
      (p) => p.isBot && p.alive
    );
    const humans = Array.from(this.players.values()).filter((p) => !p.isBot);
    const now = Date.now();

    const leadingHumanScore =
      humans.length > 0 ? Math.max(...humans.map((p) => p.score)) : 0;
    const leadingHumanLength =
      humans.length > 0 ? Math.max(...humans.map((p) => p.snake.length)) : 1;

    for (const bot of bots) {
      const baseDifficulty = 1.5;
      const difficultyMultiplier =
        baseDifficulty + (leadingHumanLength - 1) * 0.1;
      const baseCooldown = Math.max(80, 200 - leadingHumanScore * 8);
      const DIRECTION_CHANGE_COOLDOWN = baseCooldown + Math.random() * 150;

      if (
        bot.lastDirectionChange &&
        now - bot.lastDirectionChange < DIRECTION_CHANGE_COOLDOWN
      ) {
        continue;
      }

      const head = bot.snake[0];
      const currentDirection = bot.direction;

      const possibleDirections = [
        { x: this.config.gridSize!, y: 0 },
        { x: -this.config.gridSize!, y: 0 },
        { x: 0, y: this.config.gridSize! },
        { x: 0, y: -this.config.gridSize! },
      ];

      const safeDirections = possibleDirections.filter((dir) => {
        if (dir.x === -bot.direction.x && dir.y === -bot.direction.y)
          return false;

        const newHead = { x: head.x + dir.x, y: head.y + dir.y };

        if (
          newHead.x < 0 ||
          newHead.x >= this.config.canvasWidth! ||
          newHead.y < 0 ||
          newHead.y >= this.config.canvasHeight!
        )
          return false;

        if (
          bot.snake.some(
            (segment) => segment.x === newHead.x && segment.y === newHead.y
          )
        )
          return false;

        for (const player of this.players.values()) {
          if (
            player.id !== bot.id &&
            player.snake.some(
              (segment) => segment.x === newHead.x && segment.y === newHead.y
            )
          )
            return false;
        }

        return true;
      });

      if (safeDirections.length === 0) {
        const emergencyDirections = possibleDirections.filter(
          (dir) => !(dir.x === -bot.direction.x && dir.y === -bot.direction.y)
        );
        if (emergencyDirections.length > 0) {
          bot.direction =
            emergencyDirections[
              Math.floor(Math.random() * emergencyDirections.length)
            ];
          bot.lastDirectionChange = now;
        }
        continue;
      }

      let bestDirection = safeDirections[0];
      let bestScore = -Infinity;

      for (const dir of safeDirections) {
        let directionScore = 0;
        const newHead = { x: head.x + dir.x, y: head.y + dir.y };

        let closestFoodDistance = Infinity;
        let targetFood = null;

        for (const food of this.food) {
          const foodDistance =
            Math.abs(newHead.x - food.x) + Math.abs(newHead.y - food.y);

          if (foodDistance < closestFoodDistance) {
            closestFoodDistance = foodDistance;
            targetFood = food;
          }
        }

        if (targetFood) {
          const foodValue = targetFood.type === "golden" ? 5 : 1;
          const maxDistance =
            this.config.canvasWidth! + this.config.canvasHeight!;
          const distanceScore =
            (maxDistance - closestFoodDistance) / maxDistance;

          directionScore +=
            distanceScore * foodValue * 100 * difficultyMultiplier;

          if (targetFood.type === "golden" && difficultyMultiplier > 1.5) {
            directionScore += 50;
          }
        }

        const lookAheadSteps = Math.max(
          2,
          Math.min(4, Math.floor(difficultyMultiplier))
        );
        let futureHead = { ...newHead };
        let pathClear = true;

        for (let step = 0; step < lookAheadSteps && pathClear; step++) {
          futureHead.x += dir.x;
          futureHead.y += dir.y;

          if (
            futureHead.x < 0 ||
            futureHead.x >= this.config.canvasWidth! ||
            futureHead.y < 0 ||
            futureHead.y >= this.config.canvasHeight!
          ) {
            pathClear = false;
          }

          for (const player of this.players.values()) {
            if (
              player.snake.some(
                (segment) =>
                  segment.x === futureHead.x && segment.y === futureHead.y
              )
            ) {
              pathClear = false;
              break;
            }
          }
        }

        if (pathClear) {
          directionScore += 25 * difficultyMultiplier;
        }

        if (!pathClear) {
          directionScore -= 1000;
        }

        const spaceBonus = this.calculateSpaceScore(newHead, bot);
        directionScore += spaceBonus * difficultyMultiplier;

        if (difficultyMultiplier > 1.8) {
          const aggressionBonus = this.calculateAggressionScore(
            newHead,
            humans
          );
          directionScore += aggressionBonus;
        }

        if (directionScore > bestScore) {
          bestScore = directionScore;
          bestDirection = dir;
        }
      }

      const randomChance = Math.max(
        0.03,
        0.12 - (difficultyMultiplier - baseDifficulty) * 0.08
      );
      if (Math.random() < randomChance) {
        bestDirection =
          safeDirections[Math.floor(Math.random() * safeDirections.length)];
      }

      if (
        bestDirection.x !== bot.direction.x ||
        bestDirection.y !== bot.direction.y
      ) {
        bot.direction = bestDirection;
        bot.lastDirectionChange = now;
      }
    }
  }

  private calculateSpaceScore(position: Position, bot: Player): number {
    const gridSize = this.config.gridSize!;
    let spaceScore = 0;

    for (let dx = -gridSize * 2; dx <= gridSize * 2; dx += gridSize) {
      for (let dy = -gridSize * 2; dy <= gridSize * 2; dy += gridSize) {
        const checkPos = { x: position.x + dx, y: position.y + dy };

        if (
          checkPos.x >= 0 &&
          checkPos.x < this.config.canvasWidth! &&
          checkPos.y >= 0 &&
          checkPos.y < this.config.canvasHeight!
        ) {
          let occupied = false;
          for (const player of this.players.values()) {
            if (
              player.snake.some(
                (segment) =>
                  segment.x === checkPos.x && segment.y === checkPos.y
              )
            ) {
              occupied = true;
              break;
            }
          }

          if (!occupied) {
            spaceScore += 1;
          }
        }
      }
    }

    return spaceScore;
  }

  private calculateAggressionScore(
    position: Position,
    humans: Player[]
  ): number {
    let aggressionScore = 0;

    for (const human of humans) {
      if (human.alive && human.snake.length > 0) {
        const humanHead = human.snake[0];
        const distance =
          Math.abs(position.x - humanHead.x) +
          Math.abs(position.y - humanHead.y);

        if (distance > 40 && distance < 120) {
          aggressionScore += 15;
        }
      }
    }

    return aggressionScore;
  }

  private generateFood(count: number = 1): void {
    for (let i = 0; i < count; i++) {
      let foodPosition: Position;
      let validPosition = false;

      for (let attempts = 0; attempts < 50 && !validPosition; attempts++) {
        foodPosition = {
          x:
            Math.floor(
              Math.random() * (this.config.canvasWidth! / this.config.gridSize!)
            ) * this.config.gridSize!,
          y:
            Math.floor(
              Math.random() *
                (this.config.canvasHeight! / this.config.gridSize!)
            ) * this.config.gridSize!,
        };

        validPosition = true;
        for (const player of this.players.values()) {
          for (const segment of player.snake) {
            if (
              segment.x === foodPosition!.x &&
              segment.y === foodPosition!.y
            ) {
              validPosition = false;
              break;
            }
          }
          if (!validPosition) break;
        }

        if (validPosition) {
          const now = Date.now();
          const isGolden = Math.random() < GAME_CONSTANTS.GOLDEN_FOOD_CHANCE;

          const food: Food = {
            x: foodPosition!.x,
            y: foodPosition!.y,
            type: isGolden ? "golden" : "normal",
            spawnTime: now,
            expiresAt: isGolden ? now + 15000 : undefined,
          };
          this.food.push(food);
        }
      }
    }
  }

  private killPlayer(player: Player): void {
    player.alive = false;
    player.deathTime = Date.now();
    player.score = 0;
    player.respawnCooldown = GAME_CONSTANTS.RESPAWN_COOLDOWN;
  }

  private respawnPlayer(player: Player): void {
    let attempts = 0;
    let spawnPosition: Position;

    do {
      const x =
        Math.floor(
          Math.random() *
            (this.config.canvasWidth! / this.config.gridSize! - 10)
        ) + 5;
      const y =
        Math.floor(
          Math.random() *
            (this.config.canvasHeight! / this.config.gridSize! - 10)
        ) + 5;
      spawnPosition = {
        x: x * this.config.gridSize!,
        y: y * this.config.gridSize!,
      };
      attempts++;
    } while (this.isPositionOccupied(spawnPosition) && attempts < 50);

    player.snake = [spawnPosition];
    player.direction = { x: this.config.gridSize!, y: 0 };
    player.alive = true;
    player.deathTime = undefined;
    player.respawnCooldown = undefined;
    player.lastDirectionChange = Date.now();
  }

  private isPositionOccupied(position: Position): boolean {
    for (const player of this.players.values()) {
      if (
        player.alive &&
        player.snake.some(
          (segment) => segment.x === position.x && segment.y === position.y
        )
      ) {
        return true;
      }
    }
    return false;
  }

  public updatePlayer(playerId: string, direction: Direction): void {
    const player = this.players.get(playerId);
    if (!player || !player.alive || player.isBot) return;

    if (
      direction.x === -player.direction.x &&
      direction.y === -player.direction.y
    ) {
      return;
    }

    player.direction = direction;
    player.lastDirectionChange = Date.now();
  }

  private update(): void {
    if (this.gameState !== "playing") return;

    const now = Date.now();
    if (now - this.lastUpdate < this.config.gameSpeed!) return;
    this.lastUpdate = now;

    const alivePlayers = Array.from(this.players.values()).filter(
      (p) => p.alive
    );

    this.updateBotAI();

    const deadPlayers = Array.from(this.players.values()).filter(
      (p) => !p.alive
    );
    for (const player of deadPlayers) {
      if (
        player.deathTime &&
        now - player.deathTime >= GAME_CONSTANTS.RESPAWN_COOLDOWN
      ) {
        this.respawnPlayer(player);
      }
    }

    const nextPositions = new Map<string, Position>();
    for (const player of alivePlayers) {
      const head = { ...player.snake[0] };
      head.x += player.direction.x;
      head.y += player.direction.y;
      nextPositions.set(player.id, head);
    }

    const frontalCollisions = new Set<string>();
    for (const player1 of alivePlayers) {
      for (const player2 of alivePlayers) {
        if (player1.id !== player2.id) {
          const pos1 = nextPositions.get(player1.id)!;
          const pos2 = nextPositions.get(player2.id)!;

          if (
            pos1.x === player2.snake[0].x &&
            pos1.y === player2.snake[0].y &&
            pos2.x === player1.snake[0].x &&
            pos2.y === player1.snake[0].y
          ) {
            frontalCollisions.add(player1.id);
            frontalCollisions.add(player2.id);
          }
        }
      }
    }

    for (const player of alivePlayers) {
      const head = nextPositions.get(player.id)!;

      if (frontalCollisions.has(player.id)) {
        this.killPlayer(player);
        continue;
      }

      if (
        head.x < 0 ||
        head.x >= this.config.canvasWidth! ||
        head.y < 0 ||
        head.y >= this.config.canvasHeight!
      ) {
        this.killPlayer(player);
        continue;
      }

      if (
        player.snake.some(
          (segment) => segment.x === head.x && segment.y === head.y
        )
      ) {
        this.killPlayer(player);
        continue;
      }

      for (const otherPlayer of alivePlayers) {
        if (
          otherPlayer.id !== player.id &&
          !frontalCollisions.has(otherPlayer.id)
        ) {
          if (
            otherPlayer.snake.some(
              (segment: SnakeSegment) =>
                segment.x === head.x && segment.y === head.y
            )
          ) {
            this.killPlayer(player);
            break;
          }
        }
      }

      if (!player.alive) continue;

      player.snake.unshift(head);

      let foodEaten = false;
      for (let i = this.food.length - 1; i >= 0; i--) {
        const food = this.food[i];
        if (head.x === food.x && head.y === food.y) {
          const scoreGain = food.type === "golden" ? 5 : 1;
          player.score += scoreGain;
          this.food.splice(i, 1);
          foodEaten = true;
          break;
        }
      }

      if (!foodEaten) {
        player.snake.pop();
      }
    }

    this.food = this.food.filter((food) => {
      if (food.type === "golden" && food.expiresAt && now > food.expiresAt) {
        return false;
      }
      return true;
    });

    if (this.food.length < this.config.minFoodCount!) {
      this.generateFood(2);
    }

    if (now - this.gameStartTime >= GAME_CONSTANTS.GAME_DURATION) {
      this.endGame();
      return;
    }
  }

  public startGame(): void {
    this.gameState = "playing";
    this.gameStartTime = Date.now();
    this.gameLoop = setInterval(() => this.update(), 80);
    io.to(this.roomId).emit("gameStarted");
  }

  public endGame(): void {
    this.gameState = "finished";
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }

    const players = Array.from(this.players.values()).filter((p) => !p.isBot);
    let winner = players.length > 0 ? players[0] : null;

    for (const player of players) {
      if (!winner || player.score > winner.score) {
        winner = player;
      }
    }

    const winnerMessage = winner
      ? `${winner.name} (${winner.score} pontos)`
      : "Ninguém";

    io.to(this.roomId).emit("gameEnded", { winner: winnerMessage });

    setTimeout(() => {
      this.resetGame();
    }, 5000);
  }

  private resetGame(): void {
    this.gameState = "waiting";
    this.food = [];
    this.generateFood(5);

    for (const player of this.players.values()) {
      const x =
        Math.floor(
          Math.random() *
            (this.config.canvasWidth! / this.config.gridSize! - 10)
        ) + 5;
      const y =
        Math.floor(
          Math.random() *
            (this.config.canvasHeight! / this.config.gridSize! - 10)
        ) + 5;

      player.snake = [
        { x: x * this.config.gridSize!, y: y * this.config.gridSize! },
      ];
      player.direction = { x: this.config.gridSize!, y: 0 };
      player.alive = true;
      player.score = 0;
      player.lastDirectionChange = Date.now();
      player.deathTime = undefined;
      player.respawnCooldown = undefined;
    }

    if (this.players.size >= GAME_CONSTANTS.MIN_PLAYERS) {
      this.startGame();
    }
  }

  public getGameState(): GameState {
    const now = Date.now();
    const timeLeft =
      this.gameState === "playing"
        ? Math.max(0, GAME_CONSTANTS.GAME_DURATION - (now - this.gameStartTime))
        : GAME_CONSTANTS.GAME_DURATION;

    return {
      players: Array.from(this.players.values()),
      food: this.food,
      gameState: this.gameState,
      gameStartTime: this.gameStartTime,
      gameTimeLeft: timeLeft,
    };
  }

  public getRoomInfo(): RoomInfo {
    return {
      roomId: this.roomId,
      roomCode: this.config.roomCode || "",
      roomName: this.config.roomName || "Sala",
      playerCount: this.players.size,
      maxPlayers: this.config.maxPlayers || GAME_CONSTANTS.MAX_PLAYERS,
      gameState: this.gameState,
      isPrivate: this.config.isPrivate || false,
      createdAt: this.config.createdAt || new Date(),
    };
  }
}

io.on("connection", (socket) => {
  console.log("Jogador conectado:", socket.id);

  socket.on("joinQuickGame", (playerName: string) => {
    if (!gameRooms.has(quickMatchRoom)) {
      const roomCode = generateRoomCode();
      gameRooms.set(
        quickMatchRoom,
        new GameRoom(quickMatchRoom, {
          roomCode: roomCode,
          roomName: "Partida Rápida",
          isPrivate: false,
          createdAt: new Date(),
        })
      );
    }

    const room = gameRooms.get(quickMatchRoom)!;
    socket.join(quickMatchRoom);
    (socket as any).roomId = quickMatchRoom;

    room.addPlayer(socket.id, playerName || `Jogador${socket.id.slice(0, 4)}`);

    socket.emit("gameJoined", {
      playerId: socket.id,
      gameState: room.getGameState(),
      roomInfo: room.getRoomInfo(),
    });

    socket.to(quickMatchRoom).emit("playerJoined", playerName);
  });

  socket.on("joinGame", (playerName: string) => {
    socket.emit("joinQuickGame", playerName);
  });

  socket.on("createRoom", (data: { playerName: string; roomName: string }) => {
    const roomCode = generateRoomCode();
    const roomId = `room-${roomCode}`;

    let attempts = 0;
    while (findRoomByCode(roomCode) && attempts < 10) {
      attempts++;
    }

    const room = new GameRoom(roomId, {
      roomCode,
      roomName: data.roomName || "Sala Privada",
      isPrivate: true,
      createdAt: new Date(),
      createdBy: socket.id,
    });

    gameRooms.set(roomId, room);
    socket.join(roomId);
    (socket as any).roomId = roomId;

    room.addPlayer(
      socket.id,
      data.playerName || `Jogador${socket.id.slice(0, 4)}`
    );

    socket.emit("roomCreated", {
      roomCode,
      roomInfo: room.getRoomInfo(),
    });

    socket.emit("gameJoined", {
      playerId: socket.id,
      gameState: room.getGameState(),
      roomInfo: room.getRoomInfo(),
    });
  });

  socket.on("joinRoom", (data: { playerName: string; roomCode: string }) => {
    const room = findRoomByCode(data.roomCode.toUpperCase());

    if (!room) {
      socket.emit("roomJoinError", "Sala não encontrada. Verifique o código.");
      return;
    }

    if (
      room.players.size >=
      (room.config.maxPlayers || GAME_CONSTANTS.MAX_PLAYERS)
    ) {
      socket.emit("roomJoinError", "Sala está cheia.");
      return;
    }

    if (room.gameState === "playing") {
      socket.emit("roomJoinError", "Jogo já está em andamento.");
      return;
    }

    socket.join(room.roomId);
    (socket as any).roomId = room.roomId;

    room.addPlayer(
      socket.id,
      data.playerName || `Jogador${socket.id.slice(0, 4)}`
    );

    socket.emit("gameJoined", {
      playerId: socket.id,
      gameState: room.getGameState(),
      roomInfo: room.getRoomInfo(),
    });

    socket.to(room.roomId).emit("playerJoined", data.playerName);
  });

  socket.on("listRooms", () => {
    const rooms: RoomInfo[] = [];
    for (const room of gameRooms.values()) {
      if (!room.config.isPrivate && room.players.size > 0) {
        rooms.push(room.getRoomInfo());
      }
    }
    socket.emit("roomsList", rooms);
  });

  socket.on("updateDirection", (direction: Direction) => {
    const roomId = (socket as any).roomId;
    if (roomId && gameRooms.has(roomId)) {
      const room = gameRooms.get(roomId)!;
      room.updatePlayer(socket.id, direction);
    }
  });

  socket.on("addBot", () => {
    const roomId = (socket as any).roomId;
    if (roomId && gameRooms.has(roomId)) {
      const room = gameRooms.get(roomId)!;
      const botId = room.addBot();

      io.to(roomId).emit("playerJoined", `Bot entrou no jogo`);
      io.to(roomId).emit("gameUpdate", room.getGameState());
    }
  });

  socket.on("leaveRoom", () => {
    const roomId = (socket as any).roomId;
    if (roomId && gameRooms.has(roomId)) {
      const room = gameRooms.get(roomId)!;
      room.removePlayer(socket.id);

      socket.leave(roomId);
      socket.to(roomId).emit("playerLeft", socket.id);
      socket.to(roomId).emit("gameUpdate", room.getGameState());

      if (room.players.size === 0 && roomId !== quickMatchRoom) {
        gameRooms.delete(roomId);
      }
    }
    (socket as any).roomId = null;
  });

  socket.on("disconnect", () => {
    console.log("Jogador desconectado:", socket.id);

    const roomId = (socket as any).roomId;
    if (roomId && gameRooms.has(roomId)) {
      const room = gameRooms.get(roomId)!;
      room.removePlayer(socket.id);

      socket.to(roomId).emit("playerLeft", socket.id);
      socket.to(roomId).emit("gameUpdate", room.getGameState());

      if (room.players.size === 0 && roomId !== quickMatchRoom) {
        gameRooms.delete(roomId);
      }
    }
  });
});

setInterval(() => {
  for (const room of gameRooms.values()) {
    if (room.gameState === "playing") {
      io.to(room.roomId).emit("gameUpdate", room.getGameState());
    }
  }
}, 50);

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🚀 Servidor TypeScript rodando na porta ${PORT}`);
  console.log(`🎮 Snake Battle Arena está online!`);
});
