export interface RobotModel {
  name: string;
  path: string;
  description: string;
}

export const ROBOT_MODELS: Record<string, RobotModel> = {
  humanoid: {
    name: 'Humanoid',
    path: '/humanoid.xml',
    description: 'Classic MuJoCo humanoid'
  },
  unitree_go2: {
    name: 'Unitree Go2',
    path: '/unitree_go2/go2.xml',
    description: 'Quadruped robot'
  },
  unitree_h1: {
    name: 'Unitree H1',
    path: '/unitree_h1/h1.xml',
    description: 'Advanced humanoid robot'
  }
};

export const ROBOT_ACTIONS = [
  { value: 'idle', label: 'Idle' },
  { value: 'walk', label: 'Walk' },
  { value: 'run', label: 'Run' },
  { value: 'squat', label: 'Squat' },
  { value: 'dance', label: 'Dance' }
] as const;
