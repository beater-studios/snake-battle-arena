export interface Position {
  x: number;
  y: number;
}

export interface Direction extends Position {}

export interface SnakeSegment extends Position {}

export interface Food extends Position {
  type: "normal" | "golden";
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
  gameState: "waiting" | "playing" | "finished" | "disconnected";
  gameStartTime?: number;
  gameTimeLeft?: number;
}

export interface RoomInfo {
  roomId: string;
  roomCode: string;
  roomName: string;
  playerCount: number;
  maxPlayers: number;
  gameState: "waiting" | "playing" | "finished";
  isPrivate: boolean;
  createdAt: Date;
}

export interface NotificationType {
  id: number;
  message: string;
  type: "success" | "error" | "warning" | "info";
}

export interface GameConstants {
  GRID_SIZE: number;
  CANVAS_WIDTH: number;
  CANVAS_HEIGHT: number;
}

export interface ServerToClientEvents {
  connect: () => void;
  disconnect: () => void;
  gameJoined: (data: {
    playerId: string;
    gameState: GameState;
    roomInfo: RoomInfo;
  }) => void;
  roomCreated: (data: { roomCode: string; roomInfo: RoomInfo }) => void;
  roomJoinError: (message: string) => void;
  roomsList: (rooms: RoomInfo[]) => void;
  gameUpdate: (gameState: GameState) => void;
  gameStarted: () => void;
  gameEnded: (data: { winner: string }) => void;
  playerJoined: (playerName: string) => void;
  playerLeft: (playerId: string) => void;
}

export interface ClientToServerEvents {
  joinGame: (playerName: string) => void;
  createRoom: (data: { playerName: string; roomName: string }) => void;
  joinRoom: (data: { playerName: string; roomCode: string }) => void;
  joinQuickGame: (playerName: string) => void;
  listRooms: () => void;
  updateDirection: (direction: Direction) => void;
  addBot: () => void;
  leaveRoom: () => void;
}
