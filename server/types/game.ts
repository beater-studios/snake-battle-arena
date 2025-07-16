export interface Position {
  x: number;
  y: number;
}

export interface Direction extends Position {}

export interface SnakeSegment extends Position {}

export interface Food extends Position {
  type: 'normal' | 'golden';
  spawnTime?: number;
  expiresAt?: number;
}

export interface Player {
  id: string;
  name: string;
  snake: SnakeSegment[];
  direction: Direction;
  color: string;
  alive: boolean;
  score: number;
  isBot?: boolean;
  lastDirectionChange?: number;
  deathTime?: number;
  respawnCooldown?: number;
}

export interface GameState {
  players: Player[];
  food: Food[];
  gameState: 'waiting' | 'playing' | 'finished';
  gameStartTime?: number;
  gameTimeLeft?: number;
}

export interface GameRoomConfig {
  roomId: string;
  roomCode?: string;
  roomName?: string;
  isPrivate?: boolean;
  maxPlayers?: number;
  gridSize?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  gameSpeed?: number;
  minFoodCount?: number;
  createdAt?: Date;
  createdBy?: string;
}

export interface RoomInfo {
  roomId: string;
  roomCode: string;
  roomName: string;
  playerCount: number;
  maxPlayers: number;
  gameState: 'waiting' | 'playing' | 'finished';
  isPrivate: boolean;
  createdAt: Date;
}

export interface SocketEvents {
  joinGame: (playerName: string) => void;
  createRoom: (data: { playerName: string; roomName: string }) => void;
  joinRoom: (data: { playerName: string; roomCode: string }) => void;
  joinQuickGame: (playerName: string) => void;
  listRooms: () => void;
  updateDirection: (direction: Direction) => void;
  addBot: () => void;
  leaveRoom: () => void;
  
  connect: () => void;
  disconnect: () => void;
  gameJoined: (data: { playerId: string; gameState: GameState; roomInfo: RoomInfo }) => void;
  roomCreated: (data: { roomCode: string; roomInfo: RoomInfo }) => void;
  roomJoinError: (message: string) => void;
  roomsList: (rooms: RoomInfo[]) => void;
  gameUpdate: (gameState: GameState) => void;
  gameStarted: () => void;
  gameEnded: (data: { winner: string }) => void;
  playerJoined: (playerName: string) => void;
  playerLeft: (playerId: string) => void;
}

export interface GameConstants {
  GRID_SIZE: number;
  CANVAS_WIDTH: number;
  CANVAS_HEIGHT: number;
  GAME_SPEED: number;
  MIN_PLAYERS: number;
  MAX_PLAYERS: number;
  MIN_FOOD_COUNT: number;
  GOLDEN_FOOD_CHANCE: number;
  RESPAWN_COOLDOWN: number;
  GAME_DURATION: number;
  COLORS: string[];
} 