# Personal Portfolio Website

A modern, responsive personal portfolio website built with React, TypeScript, and Tailwind CSS. Inspired by contemporary developer portfolios, featuring a clean design and smooth user experience.

## 🌟 Features

- **Modern Design**: Clean, professional layout with smooth animations
- **Responsive**: Fully responsive design that works on all devices
- **TypeScript**: Type-safe development with full TypeScript support
- **Fast Performance**: Optimized for speed and accessibility
- **SEO Friendly**: Structured data and meta tags for better search visibility
- **Accessible**: WCAG 2.1 compliant with proper semantic HTML

## 🛠️ Tech Stack

### Frontend
- **React 19** - UI library
- **TypeScript** - Type safety and better developer experience
- **Tailwind CSS** - Utility-first CSS framework
- **React Hooks** - Modern React patterns

### Backend
- **FastAPI** - Python web framework
- **Pydantic** - Data validation
- **Docker** - Containerization

### Development
- **Docker Compose** - Local development environment
- **ESLint & Prettier** - Code formatting and linting
- **Jest** - Testing framework

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.9+ (for local development)

### Using Docker (Recommended)

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd personal-website
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the development environment:**
   ```bash
   docker-compose up --build
   ```

4. **Access the application:**
   - Frontend: http://localhost:3007
   - Backend API: http://localhost:8007
   - API Documentation: http://localhost:8007/docs

### Local Development

#### Frontend Setup
```bash
cd frontend
npm install
npm start
```

#### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8007
```

## 📁 Project Structure

```
personal-website/
├── frontend/                 # React TypeScript frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── Navigation.tsx
│   │   │   ├── Hero.tsx
│   │   │   ├── About.tsx
│   │   │   ├── Experience.tsx
│   │   │   ├── Projects.tsx
│   │   │   └── Contact.tsx
│   │   ├── types/           # TypeScript type definitions
│   │   ├── utils/           # Utility functions
│   │   ├── hooks/           # Custom React hooks
│   │   ├── data/            # Static data and configuration
│   │   └── App.tsx
│   ├── package.json
│   ├── tailwind.config.js
│   └── tsconfig.json
├── backend/                  # FastAPI Python backend
│   ├── app/
│   │   ├── models/          # Pydantic models
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic
│   │   └── utils/           # Utilities
│   ├── tests/               # Test files
│   └── requirements.txt
├── docker-compose.yml        # Docker services configuration
├── PLANNING.md              # Project architecture and goals
├── TASK.md                  # Task management
└── README.md
```

## 🎨 Customization

### Personal Information
Edit `frontend/src/data/portfolio.ts` to customize:
- Personal information (name, title, bio, contact)
- Work experience
- Projects and portfolio items
- Skills and technologies
- Social media links

### Styling
- **Colors**: Modify `frontend/tailwind.config.js` for color themes
- **Typography**: Update font choices in the config
- **Components**: Customize individual components in `frontend/src/components/`

### Content Sections
Each section can be customized by editing the respective component:
- **Hero**: Introduction and call-to-action
- **About**: Biography and skills
- **Experience**: Work history and roles
- **Projects**: Portfolio projects and descriptions
- **Contact**: Contact information and social links

## 🧪 Testing

### Frontend Tests
```bash
cd frontend
npm test                 # Run tests
npm run test:coverage    # Run tests with coverage
```

### Backend Tests
```bash
cd backend
python -m pytest                    # Run tests
python -m pytest --cov=app         # Run tests with coverage
```

### Docker Tests
```bash
docker-compose exec frontend npm test
docker-compose exec backend python -m pytest
```

## 📱 Responsive Design

The website is designed to work seamlessly across all device sizes:
- **Mobile**: 320px and up
- **Tablet**: 768px and up
- **Desktop**: 1024px and up
- **Large screens**: 1280px and up

## ♿ Accessibility

- Semantic HTML structure
- ARIA labels and descriptions
- Keyboard navigation support
- Color contrast compliance
- Screen reader friendly
- Focus management

## 🚢 Deployment

### Production Build
```bash
# Frontend
cd frontend
npm run build

# Backend
cd backend
docker build -t personal-website-backend .
```

### Environment Variables
Required environment variables for production:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
REACT_APP_API_URL=your_api_url
```

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

If you have any questions or need help customizing the website:
- Create an issue in the repository
- Check the documentation in `PLANNING.md`
- Review the project structure and examples

---

Built with ❤️ using React, TypeScript, and modern web technologies.
# sirasasitorn-website
