# Personal Portfolio Website

An immersive, interactive personal portfolio featuring a 3D camping scene that transitions into a macOS-inspired desktop interface with AI-powered chat assistance.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)
![Three.js](https://img.shields.io/badge/Three.js-0.153.0-000000?logo=three.js)

## ✨ Features

- **3D Camping Scene** - Interactive Three.js 3D environment as entry point
- **macOS Desktop Interface** - Draggable, resizable windows with authentic macOS design
- **Terminal Resume** - Interactive terminal-style resume viewer with commands
- **AI Chat Assistant** - OpenAI-powered chat for visitor interaction
- **Interactive Maps** - Leaflet-based maps showing work and travel locations
- **PDF Resume Viewer** - Built-in PDF viewer with download functionality
- **Notes App** - Digital notepad for quick information
- **Mobile Responsive** - Optimized for both desktop and mobile devices
- **Secure Backend** - Rate-limited API proxy protecting sensitive keys

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ and npm
- OpenAI API key (optional, for Messages app)

### Local Development

1. **Clone the repository**
```bash
git clone <repository-url>
cd personal-website
```

2. **Install dependencies**
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

3. **Configure environment variables**
```bash
# Frontend .env
echo "REACT_APP_API_URL=http://localhost:8007" > .env

# Backend .env
cd backend
cp .env.example .env
# Edit backend/.env and add your OPENAI_API_KEY
```

4. **Run development servers**
```bash
# Terminal 1: Frontend (port 3000)
npm start

# Terminal 2: Backend (port 8007)
cd backend
npm run dev
```

5. **Open browser**
```
http://localhost:3000
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build

# Access at http://localhost:3007
```

## 📁 Project Structure

```
personal-website/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── data/              # Static data (resume, projects)
│   └── services/          # API and security services
├── backend/               # Node.js Express backend
│   ├── server.js         # API server with security
│   └── .env.example      # Environment template
├── public/               # Static assets
│   ├── camping.glb      # 3D camping model
│   └── Resume.pdf       # PDF resume
├── PLANNING.md          # Architecture documentation
├── TASK.md              # Task tracking
└── CLAUDE.md            # AI assistant guidelines
```

## 🎮 How to Use

1. **Landing Scene**: Starts with an animated 3D camping scene
2. **Click Computer**: Click the laptop in the scene to enter desktop mode
3. **Desktop Apps**:
   - **Terminal**: Type commands like `about`, `experience`, `skills`, `projects`
   - **Messages**: Chat with AI assistant (requires OpenAI API key)
   - **Maps**: View work and travel locations on interactive map
   - **Notes**: Quick notepad for information
   - **Resume**: View and download PDF resume
4. **Mobile**: Apps open in fullscreen mode for optimal mobile experience

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **React Router** - Client-side routing
- **Three.js + React Three Fiber** - 3D rendering
- **Leaflet** - Interactive maps
- **Custom CSS** - No UI framework, full creative control

### Backend
- **Node.js + Express** - API server
- **OpenAI API** - AI chat functionality
- **Helmet** - Security headers
- **CORS** - Cross-origin protection
- **Express Rate Limit** - API rate limiting

### DevOps
- **Docker** - Containerization
- **Multi-stage builds** - Optimized production images

## 🔐 Security

This project implements comprehensive security measures:
- **Backend API Proxy** - API keys never exposed to frontend
- **Rate Limiting** - Both frontend and backend layers
- **Input Validation** - Sanitization and suspicious content filtering
- **Client Fingerprinting** - Track and block suspicious activity
- **CORS Protection** - Restricted origins in production

See [SECURITY.md](SECURITY.md) for detailed security implementation.

## 📝 Environment Variables

### Frontend (.env)
```bash
REACT_APP_API_URL=http://localhost:8007
```

### Backend (backend/.env)
```bash
OPENAI_API_KEY=your_openai_api_key_here
NODE_ENV=development
PORT=8007
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3007
CHAT_RATE_LIMIT=10
CHAT_RATE_WINDOW=60000
GLOBAL_RATE_LIMIT=100
GLOBAL_RATE_WINDOW=3600000
```

## 🚢 Deployment

### Option 1: Docker (Recommended)
```bash
docker-compose up --build -d
```

### Option 2: Manual Deployment
```bash
# Build frontend
npm run build

# Start backend (serves API + static files)
cd backend
NODE_ENV=production npm start
```

### Production Considerations
- Set `NODE_ENV=production`
- Configure `ALLOWED_ORIGINS` with your domain
- Use environment-specific API keys
- Enable HTTPS
- Set up monitoring and logging

## 🎯 Future Enhancements

- [ ] Python FastAPI services for RAG training
- [ ] Supabase database integration
- [ ] Real-time data streaming with WebSockets
- [ ] Blog functionality
- [ ] Advanced analytics
- [ ] TypeScript migration
- [ ] Unit and E2E tests
- [ ] CI/CD pipeline

See [TASK.md](TASK.md) for complete roadmap.

## 📚 Documentation

- **[PLANNING.md](PLANNING.md)** - Comprehensive architecture and design decisions
- **[TASK.md](TASK.md)** - Task tracking and development roadmap
- **[SECURITY.md](SECURITY.md)** - Security implementation details
- **[CLAUDE.md](CLAUDE.md)** - AI assistant development guidelines

## 🤝 Contributing

This is a personal portfolio project, but suggestions and feedback are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👤 Author

**Sira Srisasitorn**

- Portfolio: [Your Portfolio URL]
- GitHub: [@sirasasitorn](https://github.com/sirasasitorn)
- LinkedIn: [Your LinkedIn]

## 🙏 Acknowledgments

- Three.js community for excellent 3D rendering tools
- OpenAI for AI capabilities
- React Three Fiber for seamless React-Three.js integration
- OpenStreetMap for map tiles

---

**Note**: This project requires an OpenAI API key for the Messages app. The app will work without it, but chat functionality will be disabled. Get your key at [OpenAI Platform](https://platform.openai.com/).