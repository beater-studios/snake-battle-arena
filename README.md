# Snake Battle Arena

A multiplayer snake game in the browser! Face other players in an arena.

![Status](https://img.shields.io/badge/Status-Online-brightgreen)
![Players](https://img.shields.io/badge/Players-2--8-blue)
![Tech](https://img.shields.io/badge/Tech-React%20%2B%20TypeScript%20%2B%20Socket.io-purple)

## About the Game

**Snake Battle Arena** is a modernized version of the classic snake game with competitive multiplayer elements:

- **Real-time Multiplayer**: Up to 8 players simultaneously
- **Room System**: Quick matches or private rooms with codes
- **AI**: Bot system with different difficulty levels
- **Respawn System**: Dead players respawn after 3 seconds
- **Scoring System**: Normal food (1pt) and golden food (5pts)
- **Mobile Support**: Touch controls with virtual joystick

## How to Play

### Game Modes

1. **Quick Match**: Automatically enter a public room
2. **Create Room**: Create a private room with custom code
3. **Join Room**: Use a code to enter a private room

### Controls

**Desktop:**
- `WASD` or `Arrow keys` to move your snake

**Mobile:**
- Virtual joystick on screen to control direction

## Installation and Setup

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Quick Installation

```bash
# Clone the repository
git clone <your-repository>
cd game-prot

# Install all dependencies
npm run install-all

# Run the game
npm run dev
```

### Step by Step Setup

```bash
# 1. Install server dependencies
npm install

# 2. Install client dependencies
cd client
npm install
cd ..

# 3. Run server (Terminal 1)
npm run server:dev

# 4. Run client (Terminal 2)
npm run client

# OR run both simultaneously
npm run dev
```

### Access

- **Client**: http://localhost:3000
- **Server**: http://localhost:5001

## Technologies Used

### Frontend
- **React 18 + TypeScript** - Modern and type-safe interface
- **Socket.io Client** - Real-time communication
- **HTML5 Canvas** - Smooth game rendering
- **CSS3** - Cyberpunk animations and effects
- **Web Audio API** - Immersive audio system

### Backend
- **Node.js + Express + TypeScript** - Robust and type-safe server
- **Socket.io** - WebSocket for multiplayer
- **Room System** - Public and private match management
- **Bot AI** - Intelligent automated opponents system

## Project Structure

```
game-prot/
│
├── server/
│   ├── index.ts          # TypeScript server + multiplayer logic
│   ├── types/
│   │   └── game.ts       # Game interfaces and types
│   └── tsconfig.json     # Server TypeScript configuration
│
├── client/               # React + TypeScript App
│   ├── public/
│   │   ├── index.html
│   │   └── manifest.json
│   ├── src/
│   │   ├── App.tsx       # Main TypeScript component
│   │   ├── App.css       # Cyberpunk styles
│   │   ├── index.tsx     # TypeScript entry point
│   │   ├── index.css
│   │   ├── types/
│   │   │   └── game.ts   # Shared interfaces
│   │   └── utils/
│   │       └── audioManager.ts # Audio management
│   ├── package.json
│   └── tsconfig.json     # Client TypeScript configuration
│
├── package.json          # Main configuration
└── README.md
```

## Debugging

### Common Issues

**Server not connecting:**
```bash
# Check if ports are free
lsof -i :3000
lsof -i :5001

# Kill processes if necessary
kill -9 <PID>
```

**Client not updating:**
```bash
# Clear React cache
cd client
rm -rf node_modules package-lock.json
npm install
```

**Socket.io not connecting:**
- Check if server is running on port 5001
- Verify CORS settings on server
- Test connection at http://localhost:5001

## Contributing

Contributions are welcome! To contribute:

1. Fork the project
2. Create a branch (`git checkout -b feature/NewFeature`)
3. Commit your changes (`git commit -m 'Add: Amazing new feature'`)
4. Push to the branch (`git push origin feature/NewFeature`)
5. Open a Pull Request

## License

This project is under the MIT license. See the `LICENSE` file for more details.

## Credits

Developed with ❤️ and lots of caffeine ☕

- **Engine**: HTML5 Canvas + Socket.io
- **Gameplay**: Based on classic Snake with multiplayer twist
- **AI**: Intelligent bot system for dynamic gameplay
