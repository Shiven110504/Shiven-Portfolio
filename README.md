# MuJoCo Portfolio Website

A modern, interactive portfolio website featuring real-time MuJoCo physics simulation built with cutting-edge web technologies.

## ✨ Features

- **Interactive Physics Simulation**: Real-time MuJoCo physics with WebAssembly
- **3D Robot Interaction**: Click and drag to manipulate a humanoid robot
- **Smooth Animations**: Framer Motion for fluid, performant animations
- **Modern UI**: Shadcn/ui components with Tailwind CSS
- **TypeScript**: Full type safety throughout the application
- **Responsive Design**: Mobile-first approach with seamless experiences

## 🚀 Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + Shadcn/ui
- **Animations**: Framer Motion
- **Physics**: MuJoCo WebAssembly
- **3D Graphics**: Three.js

## 🛠 Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Homepage
├── components/            # Reusable components
│   ├── ui/               # Shadcn/ui components
│   ├── MuJoCoSimulator.tsx # Physics simulation
│   ├── DragStateManager.ts # Mouse interaction
│   └── MuJoCoUtils.ts     # Physics utilities
├── lib/                   # Utilities
│   ├── utils.ts           # General utilities
│   └── animations.ts      # Animation presets
└── types/                 # TypeScript definitions
    └── index.ts           # Global type definitions
```

## 🎯 Development Guidelines

This project follows specific development patterns outlined in [`.cursorrules`](./.cursorrules). Key principles:

### Component Development
- Use TypeScript interfaces for all props
- Implement Framer Motion for smooth animations
- Follow Shadcn/ui patterns for consistency
- Keep physics logic separate from React components

### Animation Standards
- Use `motion.div` for animating containers
- Implement `whileHover` and `whileTap` for interactions
- Keep animations performant (60fps target)
- Use predefined animation variants from `lib/animations.ts`

### Code Quality
- Strict TypeScript configuration
- ESLint for code quality
- Semantic component naming (PascalCase)
- Utility-first CSS with Tailwind

## 🎮 Interaction Guide

- **Mouse Drag**: Click and drag any part of the robot to apply physics forces
- **Camera Control**: Cmd/Ctrl + scroll to zoom, drag to rotate
- **Website Navigation**: Normal scroll works for browsing the portfolio

## 📚 Key Components

### MuJoCoSimulator
The main physics simulation component featuring:
- Real-time MuJoCo physics integration
- Interactive 3D humanoid model
- Force-based manipulation
- Optimized WebAssembly performance

### DragStateManager
Handles mouse interactions with physics objects:
- Raycasting for 3D object detection
- Force calculation and application
- Visual feedback with force arrows
- OrbitControls integration

## 🔧 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## 🚀 Deployment

Deploy to Vercel with zero configuration:

```bash
npm run build
```

The app is optimized for static generation and can be deployed to any hosting platform.

## 📖 Resources

- [Framer Motion](https://www.framer.com/motion/) - Animation library
- [Shadcn/ui](https://ui.shadcn.com/) - Component library
- [MuJoCo](https://mujoco.org/) - Physics simulation
- [Three.js](https://threejs.org/) - 3D graphics
