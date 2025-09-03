# Cursor Rules for MuJoCo Portfolio Website

## 🎯 Project Overview
This is a modern portfolio website featuring an interactive MuJoCo physics simulation as the hero section. The site combines cutting-edge web technologies with realistic physics simulation to create an engaging user experience.

## 🛠 Technology Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS with custom design system
- **Animations**: Framer Motion for fluid interactions
- **UI Components**: Shadcn/ui component library
- **Physics**: MuJoCo WebAssembly for realistic physics simulation
- **3D Graphics**: Three.js with React Three Fiber
- **State Management**: React hooks with context where needed

## 📁 File Structure Guidelines

### Component Organization
```
src/
├── app/                    # Next.js app router pages
│   ├── (sections)/        # Route groups for different site sections
│   ├── globals.css        # Global styles and Tailwind imports
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Homepage
├── components/            # Reusable components
│   ├── ui/               # Shadcn/ui components
│   ├── sections/         # Page sections
│   ├── animations/       # Animation components
│   ├── physics/          # Physics-related components
│   └── layout/           # Layout components
├── lib/                  # Utilities and configurations
│   ├── utils.ts          # General utilities
│   ├── animations.ts     # Animation utilities
│   └── physics/          # Physics utilities
└── types/                # TypeScript type definitions
```

### Naming Conventions
- **Components**: PascalCase (e.g., `MuJoCoSimulator.tsx`)
- **Files**: camelCase for utilities, PascalCase for components
- **Folders**: lowercase with hyphens if needed
- **Hooks**: `use` prefix (e.g., `usePhysics.ts`)

## 🎨 Design & Animation Guidelines

### Framer Motion Usage
- Use `motion.div`, `motion.section` for animating containers
- Implement `whileHover`, `whileTap` for interactive elements
- Use `AnimatePresence` for enter/exit animations
- Keep animations subtle and performant (60fps)
- Use `stagger` for sequential animations

### Shadcn/ui Integration
- Always use Shadcn/ui components over custom implementations
- Customize via Tailwind classes and CSS variables
- Follow accessibility standards built into Shadcn/ui
- Use consistent theming across all components

### Tailwind CSS Patterns
- Use semantic color names from design system
- Implement responsive design with mobile-first approach
- Use Tailwind's animation utilities alongside Framer Motion
- Create reusable component classes with `@apply`

## ⚡ Performance Guidelines

### Animation Performance
- Use `transform` and `opacity` for smooth animations
- Avoid animating layout properties when possible
- Implement `will-change` for frequently animated elements
- Use `motion.div` with `layout` prop for layout animations

### Physics Integration
- Keep physics simulation separate from React render cycle
- Use `useRef` for physics objects to avoid re-renders
- Implement proper cleanup for physics resources
- Optimize force calculations and coordinate conversions

## 🔧 Development Workflow

### Component Development
1. **Plan**: Sketch component structure and props interface
2. **Build**: Create component with TypeScript interfaces
3. **Style**: Add Tailwind classes and Framer Motion
4. **Animate**: Implement smooth transitions and interactions
5. **Test**: Ensure responsive behavior and accessibility

### Physics Components
1. **Separation**: Keep physics logic separate from React components
2. **Types**: Use proper TypeScript interfaces for physics objects
3. **Performance**: Optimize coordinate conversions and force calculations
4. **Cleanup**: Properly dispose of physics resources

## 📝 Code Quality Standards

### TypeScript
- Use strict TypeScript configuration
- Define interfaces for all component props
- Use union types for variant props
- Avoid `any` type - use proper type definitions

### Component Patterns
```tsx
// ✅ Preferred pattern
interface ComponentProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

export function Component({ variant = 'primary', children }: ComponentProps) {
  return (
    <motion.div
      className={cn('base-classes', variantClasses[variant])}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}
```

### Animation Patterns
```tsx
// ✅ Smooth page transitions
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.3, ease: 'easeOut' }}
>
  <Component />
</motion.div>
```

## 🚀 Future Enhancements
- Performance monitoring and optimization
- Advanced physics interactions
- Progressive Web App features
- Internationalization support
- Advanced animation sequences
- Real-time collaboration features

## 📚 Resources
- [Framer Motion Documentation](https://www.framer.com/motion/)
- [Shadcn/ui Documentation](https://ui.shadcn.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [MuJoCo Documentation](https://mujoco.org/)
