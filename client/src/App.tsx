import React, { useCallback, useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import './App.css';
import {
  ClientToServerEvents,
  Direction,
  GameConstants,
  GameState,
  NotificationType,
  Player,
  RoomInfo,
  ServerToClientEvents
} from './types/game';
import { audioManager, initAudio } from './utils/audioManager';

const GAME_CONSTANTS: GameConstants = {
  GRID_SIZE: 20,
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 600
};

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

  const [gameState, setGameState] = useState<GameState>({
    players: [],
    food: [],
    gameState: 'disconnected'
  });
  const [playerName, setPlayerName] = useState<string>('');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [currentRoom, setCurrentRoom] = useState<RoomInfo | null>(null);
  const [showRoomSelection, setShowRoomSelection] = useState<boolean>(true);
  const [roomCode, setRoomCode] = useState<string>('');
  const [roomName, setRoomName] = useState<string>('');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [warnedGoldenFood, setWarnedGoldenFood] = useState<Set<string>>(new Set());

  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [joystickActive, setJoystickActive] = useState<boolean>(false);
  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  const enableAudio = (): void => {
    if (!audioEnabled) {
      initAudio();
      setAudioEnabled(true);
    }
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    socketRef.current = io('http://localhost:5001');

    socketRef.current.on('connect', () => {
      setIsConnected(true);
      addNotification('Conectado ao servidor!', 'success');
      audioManager.play('ui_success');
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
      addNotification('Desconectado do servidor', 'error');
      audioManager.play('ui_error');
    });

    socketRef.current.on('gameJoined', (data: { playerId: string; gameState: GameState; roomInfo: RoomInfo }) => {
      setPlayerId(data.playerId);
      setGameState(data.gameState);
      setCurrentRoom(data.roomInfo);
      setShowRoomSelection(false);
      addNotification('Você entrou no jogo!', 'success');
      audioManager.play('room_join');
    });

    socketRef.current.on('roomCreated', (data: { roomCode: string; roomInfo: RoomInfo }) => {
      addNotification(`🎉 Sala criada! Código: ${data.roomCode}`, 'success');
      audioManager.play('room_create');
    });

    socketRef.current.on('roomJoinError', (message: string) => {
      addNotification(`❌ ${message}`, 'error');
      audioManager.play('ui_error');
    });

    socketRef.current.on('gameUpdate', (newGameState: GameState) => {
      if (gameState && playerId) {
        const oldPlayer = gameState.players.find(p => p.id === playerId);
        const newPlayer = newGameState.players.find(p => p.id === playerId);

        if (oldPlayer && newPlayer && newPlayer.score > oldPlayer.score) {
          const scoreIncrease = newPlayer.score - oldPlayer.score;
          if (scoreIncrease >= 5) {
            audioManager.play('food_golden');
          } else {
            audioManager.play('food_eat');
          }
        }

        const oldAlivePlayers = gameState.players.filter(p => p.alive).length;
        const newAlivePlayers = newGameState.players.filter(p => p.alive).length;

        if (newAlivePlayers < oldAlivePlayers) {
          audioManager.play('collision');
        }
      }

      newGameState.food.forEach(food => {
        if (food.type === 'golden' && food.expiresAt) {
          const now = Date.now();
          const timeLeft = food.expiresAt - now;
          const foodId = `${food.x}-${food.y}`;

          if (timeLeft <= 5000 && timeLeft > 4500 && !warnedGoldenFood.has(foodId)) {
            audioManager.play('golden_warning');
            setWarnedGoldenFood(prev => new Set(prev.add(foodId)));
          }
        }
      });

      setGameState(newGameState);
    });

    socketRef.current.on('gameStarted', () => {
      addNotification('Jogo iniciado! Boa sorte!', 'info');
      audioManager.play('game_start');
    });

    socketRef.current.on('gameEnded', (data: { winner: string }) => {
      addNotification(`🏆 Vencedor: ${data.winner}!`, 'success');
      audioManager.play('game_end');
    });

    socketRef.current.on('playerJoined', (name: string) => {
      addNotification(`${name} entrou no jogo`, 'info');
      audioManager.play('player_join');
    });

    socketRef.current.on('playerLeft', () => {
      addNotification('Um jogador saiu do jogo', 'warning');
      audioManager.play('player_leave');
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const addNotification = (message: string, type: NotificationType['type']): void => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  };

  const joinQuickGame = (): void => {
    if (!isConnected || !playerName.trim() || !socketRef.current) return;
    enableAudio();
    audioManager.play('ui_click');
    socketRef.current.emit('joinQuickGame', playerName.trim());
  };

  const createRoom = (): void => {
    if (!isConnected || !playerName.trim() || !roomName.trim() || !socketRef.current) return;
    enableAudio();
    audioManager.play('ui_click');
    socketRef.current.emit('createRoom', {
      playerName: playerName.trim(),
      roomName: roomName.trim()
    });
  };

  const joinRoom = (): void => {
    if (!isConnected || !playerName.trim() || !roomCode.trim() || !socketRef.current) return;
    enableAudio();
    audioManager.play('ui_click');
    socketRef.current.emit('joinRoom', {
      playerName: playerName.trim(),
      roomCode: roomCode.trim().toUpperCase()
    });
  };

  const backToRoomSelection = (): void => {
    audioManager.play('ui_click');
    if (socketRef.current) {
      socketRef.current.emit('leaveRoom');
    }
    setPlayerId(null);
    setCurrentRoom(null);
    setShowRoomSelection(true);
    setGameState({
      players: [],
      food: [],
      gameState: 'disconnected'
    });
  };

  const addBot = (): void => {
    if (!socketRef.current) return;
    audioManager.play('ui_click');
    socketRef.current.emit('addBot');
    addNotification('🤖 Bot adicionado!', 'success');
  };

  const handleKeyPress = useCallback((e: KeyboardEvent): void => {
    if (gameState.gameState !== 'playing' || !playerId || !socketRef.current) return;

    const directions: Record<string, Direction> = {
      'ArrowUp': { x: 0, y: -GAME_CONSTANTS.GRID_SIZE },
      'ArrowDown': { x: 0, y: GAME_CONSTANTS.GRID_SIZE },
      'ArrowLeft': { x: -GAME_CONSTANTS.GRID_SIZE, y: 0 },
      'ArrowRight': { x: GAME_CONSTANTS.GRID_SIZE, y: 0 },
      'w': { x: 0, y: -GAME_CONSTANTS.GRID_SIZE },
      's': { x: 0, y: GAME_CONSTANTS.GRID_SIZE },
      'a': { x: -GAME_CONSTANTS.GRID_SIZE, y: 0 },
      'd': { x: GAME_CONSTANTS.GRID_SIZE, y: 0 }
    };

    const direction = directions[e.key] || directions[e.key.toLowerCase()];
    if (direction) {
      e.preventDefault();
      socketRef.current.emit('updateDirection', direction);
    }
  }, [gameState.gameState, playerId]);

  const sendDirection = useCallback((direction: Direction): void => {
    if (gameState.gameState !== 'playing' || !playerId || !socketRef.current) return;
    socketRef.current.emit('updateDirection', direction);
  }, [gameState.gameState, playerId]);

  const handleJoystickStart = useCallback((e: React.TouchEvent | React.MouseEvent): void => {
    e.preventDefault();
    setJoystickActive(true);
    enableAudio();
  }, []);

  const handleJoystickMove = useCallback((e: React.TouchEvent | React.MouseEvent): void => {
    if (!joystickActive || !joystickRef.current || !knobRef.current) return;

    const joystick = joystickRef.current;
    const knob = knobRef.current;
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let clientX: number, clientY: number;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const maxDistance = rect.width / 2 - 20;

    const limitedDistance = Math.min(distance, maxDistance);
    const angle = Math.atan2(deltaY, deltaX);
    const knobX = Math.cos(angle) * limitedDistance;
    const knobY = Math.sin(angle) * limitedDistance;

    knob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

    if (limitedDistance > 20) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      let direction: Direction;
      if (absX > absY) {
        direction = deltaX > 0
          ? { x: GAME_CONSTANTS.GRID_SIZE, y: 0 }
          : { x: -GAME_CONSTANTS.GRID_SIZE, y: 0 };
      } else {
        direction = deltaY > 0
          ? { x: 0, y: GAME_CONSTANTS.GRID_SIZE }
          : { x: 0, y: -GAME_CONSTANTS.GRID_SIZE };
      }

      sendDirection(direction);
    }
  }, [joystickActive, sendDirection]);

  const handleJoystickEnd = useCallback((): void => {
    setJoystickActive(false);
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate(-50%, -50%)';
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  useEffect(() => {
    if (!isMobile) return;

    const handleGlobalMove = (e: TouchEvent | MouseEvent): void => {
      if (joystickActive) {
        handleJoystickMove(e as any);
      }
    };

    const handleGlobalEnd = (): void => {
      if (joystickActive) {
        handleJoystickEnd();
      }
    };

    if (joystickActive) {
      document.addEventListener('touchmove', handleGlobalMove, { passive: false });
      document.addEventListener('touchend', handleGlobalEnd);
      document.addEventListener('mousemove', handleGlobalMove);
      document.addEventListener('mouseup', handleGlobalEnd);
    }

    return () => {
      document.removeEventListener('touchmove', handleGlobalMove);
      document.removeEventListener('touchend', handleGlobalEnd);
      document.removeEventListener('mousemove', handleGlobalMove);
      document.removeEventListener('mouseup', handleGlobalEnd);
    };
  }, [isMobile, joystickActive, handleJoystickMove, handleJoystickEnd]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, GAME_CONSTANTS.CANVAS_WIDTH, GAME_CONSTANTS.CANVAS_HEIGHT);

    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for (let x = 0; x <= GAME_CONSTANTS.CANVAS_WIDTH; x += GAME_CONSTANTS.GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, GAME_CONSTANTS.CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= GAME_CONSTANTS.CANVAS_HEIGHT; y += GAME_CONSTANTS.GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(GAME_CONSTANTS.CANVAS_WIDTH, y);
      ctx.stroke();
    }

    gameState.food.forEach(food => {
      ctx.fillStyle = food.type === 'golden' ? '#ffd700' : '#ff4444';
      ctx.fillRect(food.x + 2, food.y + 2, GAME_CONSTANTS.GRID_SIZE - 4, GAME_CONSTANTS.GRID_SIZE - 4);

      ctx.shadowColor = food.type === 'golden' ? '#ffd700' : '#ff4444';
      ctx.shadowBlur = 10;
      ctx.fillRect(food.x + 4, food.y + 4, GAME_CONSTANTS.GRID_SIZE - 8, GAME_CONSTANTS.GRID_SIZE - 8);
      ctx.shadowBlur = 0;

      if (food.type === 'golden' && food.expiresAt) {
        const now = Date.now();
        const timeLeft = Math.max(0, food.expiresAt - now);
        const totalTime = 15000;
        const progress = timeLeft / totalTime;

        ctx.strokeStyle = progress > 0.3 ? '#ffd700' : '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          food.x + GAME_CONSTANTS.GRID_SIZE / 2,
          food.y + GAME_CONSTANTS.GRID_SIZE / 2,
          GAME_CONSTANTS.GRID_SIZE / 2 + 3,
          -Math.PI / 2,
          -Math.PI / 2 + (2 * Math.PI * progress)
        );
        ctx.stroke();

        if (progress < 0.3) {
          const pulseIntensity = Math.sin(now / 100) * 0.5 + 0.5;
          ctx.shadowColor = '#ff6b6b';
          ctx.shadowBlur = 5 + pulseIntensity * 10;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
    });

    gameState.players.forEach(player => {
      if (!player.alive && gameState.gameState === 'playing') {
        ctx.globalAlpha = 0.3;
      }

      player.snake.forEach((segment, index) => {
        ctx.fillStyle = player.color;

        if (index === 0) {
          ctx.shadowColor = player.color;
          ctx.shadowBlur = 15;
          ctx.fillRect(segment.x + 1, segment.y + 1, GAME_CONSTANTS.GRID_SIZE - 2, GAME_CONSTANTS.GRID_SIZE - 2);
          ctx.shadowBlur = 0;

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(segment.x + 4, segment.y + 4, 3, 3);
          ctx.fillRect(segment.x + 13, segment.y + 4, 3, 3);
        } else {
          ctx.fillRect(segment.x + 2, segment.y + 2, GAME_CONSTANTS.GRID_SIZE - 4, GAME_CONSTANTS.GRID_SIZE - 4);
        }
      });

      ctx.globalAlpha = 1;
    });

    const deadPlayers = gameState.players.filter(p => !p.alive && p.deathTime && p.respawnCooldown);
    deadPlayers.forEach((player, index) => {
      const timeLeft = Math.max(0, player.respawnCooldown! - (Date.now() - player.deathTime!));
      const seconds = Math.ceil(timeLeft / 1000);

      if (seconds > 0) {
        const centerX = GAME_CONSTANTS.CANVAS_WIDTH / 2;
        const centerY = GAME_CONSTANTS.CANVAS_HEIGHT / 2 - 50 + (index * 30);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(centerX - 120, centerY - 15, 240, 25);

        ctx.fillStyle = '#ff6b6b';
        ctx.font = 'bold 16px Orbitron, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`💀 ${player.name} respawn em ${seconds}s`, centerX, centerY + 5);
      }
    });
  }, [gameState]);

  const currentPlayer: Player | undefined = gameState.players.find(p => p.id === playerId);

  const handlePlayerNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setPlayerName(e.target.value);
  };

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setRoomCode(e.target.value.toUpperCase());
  };

  const handleRoomNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setRoomName(e.target.value);
  };

  return (
    <div className="App">
      <div className="game-header">
        <h1>🐍 Snake Battle Arena</h1>
        <div className="connection-status">
          <span className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Online' : '🔴 Offline'}
          </span>
        </div>
      </div>

      {!playerId && showRoomSelection ? (
        <div className="join-screen">
          <div className="join-form room-selection">
            <h2>🏠 Escolha como Jogar</h2>

            <div className="player-name-section">
              <input
                type="text"
                placeholder="Seu nome"
                value={playerName}
                onChange={handlePlayerNameChange}
                maxLength={20}
                className="player-name-input"
              />
            </div>

            <div className="room-options">
              <div className="room-option quick-match">
                <h3>⚡ Partida Rápida</h3>
                <p>Entre em uma partida imediatamente</p>
                <button
                  onClick={joinQuickGame}
                  disabled={!isConnected || !playerName.trim()}
                  className="room-btn quick-btn"
                >
                  🚀 Jogar Agora
                </button>
              </div>

              <div className="room-option create-room">
                <h3>🏗️ Criar Sala</h3>
                <p>Crie uma sala privada para seus amigos</p>
                <input
                  type="text"
                  placeholder="Nome da sala"
                  value={roomName}
                  onChange={handleRoomNameChange}
                  maxLength={30}
                  className="room-input"
                />
                <button
                  onClick={createRoom}
                  disabled={!isConnected || !playerName.trim() || !roomName.trim()}
                  className="room-btn create-btn"
                >
                  🏠 Criar Sala
                </button>
              </div>

              <div className="room-option join-room">
                <h3>🔐 Entrar em Sala</h3>
                <p>Use o código da sala para entrar</p>
                <input
                  type="text"
                  placeholder="Código da sala"
                  value={roomCode}
                  onChange={handleRoomCodeChange}
                  maxLength={6}
                  className="room-input code-input"
                />
                <button
                  onClick={joinRoom}
                  disabled={!isConnected || !playerName.trim() || !roomCode.trim()}
                  className="room-btn join-btn"
                >
                  🔓 Entrar na Sala
                </button>
              </div>
            </div>

            <div className="game-info">
              <h3>🎮 Como Jogar:</h3>
              <ul>
                <li>Use <kbd>WASD</kbd> ou <kbd>setas</kbd> para mover</li>
                <li>Coma a comida 🟥 para crescer</li>
                <li>Comida dourada 🟨 vale 5 pontos</li>
                <li>Evite paredes e outros jogadores</li>
                <li>Último vivo ganha!</li>
              </ul>
            </div>
          </div>
        </div>
      ) : !playerId ? (
        <div className="loading-screen">
          <h2>Conectando...</h2>
        </div>
      ) : (
        <div className="game-screen">
          <div className="game-info-bar">
            {currentRoom && (
              <div className="room-info">
                <div className="room-header">
                  <h3>🏠 {currentRoom.roomName}</h3>
                  <button
                    onClick={backToRoomSelection}
                    className="leave-room-btn"
                    title="Sair da sala"
                  >
                    🚪 Sair
                  </button>
                </div>
                {currentRoom.roomCode && (
                  <div className="room-code">
                    <strong>Código:</strong>
                    <span className="code-display">{currentRoom.roomCode}</span>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(currentRoom.roomCode);
                          addNotification('Código copiado!', 'success');
                          audioManager.play('code_copy');
                        } catch (err) {
                          addNotification('Erro ao copiar código', 'error');
                          audioManager.play('ui_error');
                        }
                      }}
                      className="copy-btn"
                      title="Copiar código"
                    >
                      📋
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="players-list">
              <h3>Jogadores ({gameState.players.length})</h3>
              {gameState.players.map(player => (
                <div key={player.id} className="player-info">
                  <span
                    className="player-color"
                    style={{ backgroundColor: player.color }}
                  ></span>
                  <span className={`player-name ${!player.alive ? 'dead' : ''}`}>
                    {player.name} {player.id === playerId && '(você)'} {player.isBot && '🤖'}
                  </span>
                  <span className="player-score">{player.score}pts</span>
                  {!player.alive && <span className="dead-indicator">💀</span>}
                </div>
              ))}
            </div>

            <div className="game-status">
              <div className="status-item">
                <strong>Status:</strong>
                <span className={`game-state ${gameState.gameState}`}>
                  {gameState.gameState === 'waiting' && '⏳ Aguardando jogadores...'}
                  {gameState.gameState === 'playing' && '🎮 Jogando!'}
                  {gameState.gameState === 'finished' && '🏁 Finalizado'}
                </span>
              </div>

              {currentPlayer && (
                <div className="status-item">
                  <strong>Seu Status:</strong>
                  <span className={currentPlayer.alive ? 'alive' : 'dead'}>
                    {currentPlayer.alive ? '❤️ Vivo' : '💀 Morto'}
                  </span>
                </div>
              )}

              {gameState.gameState === 'waiting' && (
                <>
                  <div className="waiting-message">
                    Precisamos de pelo menos 2 jogadores para começar!
                  </div>
                  {gameState.players.filter(p => !p.isBot).length === 1 && (
                    <div className="bot-controls">
                      <button
                        onClick={addBot}
                        className="add-bot-btn"
                        title="Adicionar um bot para começar a jogar"
                      >
                        🤖 Adicionar Bot
                      </button>
                      <p className="bot-hint">
                        O bot sairá quando outro jogador entrar
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {gameState.gameState === 'playing' && gameState.gameTimeLeft !== undefined && (
            <div className="game-timer">
              <div className={`timer-display ${(gameState.gameTimeLeft || 0) <= 30000 ? 'critical' :
                (gameState.gameTimeLeft || 0) <= 60000 ? 'warning' : ''
                }`}>
                ⏰ {Math.floor((gameState.gameTimeLeft || 0) / 60000)}:
                {String(Math.floor(((gameState.gameTimeLeft || 0) % 60000) / 1000)).padStart(2, '0')}
              </div>
            </div>
          )}

          <div className="game-canvas-container">
            <canvas
              ref={canvasRef}
              width={GAME_CONSTANTS.CANVAS_WIDTH}
              height={GAME_CONSTANTS.CANVAS_HEIGHT}
              className="game-canvas"
            />
            <div className="controls-hint">
              Use <kbd>WASD</kbd> ou <kbd>↑↓←→</kbd> para mover
            </div>
          </div>
        </div>
      )}

      <div className="notifications">
        {notifications.map(notif => (
          <div key={notif.id} className={`notification ${notif.type}`}>
            {notif.message}
          </div>
        ))}
      </div>

      {isMobile && playerId && gameState.gameState === 'playing' && (
        <div className="mobile-controls">
          <div
            ref={joystickRef}
            className="virtual-joystick"
            onTouchStart={handleJoystickStart}
            onMouseDown={handleJoystickStart}
          >
            <div
              ref={knobRef}
              className={`joystick-knob ${joystickActive ? 'active' : ''}`}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App; 