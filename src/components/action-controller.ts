import { MuJoCoModel, MuJoCoSimulation } from './types/mujoco';

// PD Controller gains - tune these for better performance
const PD_GAINS = {
  kp: 10,  // Proportional gain
  kd: 10,   // Derivative gain
};

// Robot-specific joint configurations
interface JointConfig {
  hipPitch: number[];   // Hip pitch joint indices
  hipRoll: number[];    // Hip roll joint indices
  knee: number[];       // Knee joint indices
  ankle?: number[];     // Ankle joint indices (optional)
  shoulderPitch?: number[]; // Shoulder pitch (for humanoids)
  shoulderRoll?: number[];  // Shoulder roll (for humanoids)
}

// Get joint configuration for each robot type
function getJointConfig(_model: MuJoCoModel, modelName: string): JointConfig {
  if (modelName === 'humanoid') {
    // Standard MuJoCo humanoid (7 DOF base + joints)
    return {
      hipPitch: [8, 14],      // left_hip, right_hip pitch
      hipRoll: [7, 13],       // left_hip, right_hip roll
      knee: [9, 15],          // left_knee, right_knee
      ankle: [10, 16],        // left_ankle, right_ankle
      shoulderPitch: [18, 21], // left_shoulder, right_shoulder
      shoulderRoll: [17, 20],  // arms
    };
  } else if (modelName === 'unitree_go2') {
    // Go2 quadruped (7 DOF base + 12 leg joints)
    return {
      hipPitch: [8, 11, 14, 17],  // FL, FR, RL, RR hip pitch
      hipRoll: [7, 10, 13, 16],   // hip roll/abduction
      knee: [9, 12, 15, 18],      // knee joints
    };
  } else if (modelName === 'unitree_h1') {
    // H1 humanoid (7 DOF base + joints)
    return {
      hipPitch: [9, 14],       // left_hip_pitch, right_hip_pitch
      hipRoll: [8, 13],        // left_hip_roll, right_hip_roll
      knee: [10, 15],          // left_knee, right_knee
      ankle: [11, 16],         // left_ankle, right_ankle
      shoulderPitch: [19, 23], // left_shoulder_pitch, right_shoulder_pitch
      shoulderRoll: [18, 22],  // left_shoulder_roll, right_shoulder_roll
    };
  }

  // Default fallback
  return {
    hipPitch: [],
    hipRoll: [],
    knee: [],
  };
}

// Generate walking target angles for a given phase
function generateWalkTargets(
  phase: number,
  config: JointConfig,
  modelName: string
): Map<number, number> {
  const targets = new Map<number, number>();

  if (modelName === 'unitree_go2') {
    // Quadruped trotting gait
    // Front-left & Rear-right move together, Front-right & Rear-left move together
    const freq = 2.0;
    const amp = 0.4;

    // Hip pitch (forward/backward)
    targets.set(config.hipPitch[0], Math.sin(phase * freq) * amp);        // FL
    targets.set(config.hipPitch[1], Math.sin(phase * freq + Math.PI) * amp); // FR
    targets.set(config.hipPitch[2], Math.sin(phase * freq + Math.PI) * amp); // RL
    targets.set(config.hipPitch[3], Math.sin(phase * freq) * amp);        // RR

    // Knee (always bent during walk)
    const kneeAngle = -0.8 + Math.abs(Math.sin(phase * freq)) * 0.4;
    config.knee.forEach(idx => targets.set(idx, kneeAngle));

  } else {
    // Humanoid bipedal walking
    const freq = 1.5;
    const hipAmp = 0.3;
    const kneeAmp = 0.5;
    const ankleAmp = 0.2;

    // Hip pitch - alternating legs
    if (config.hipPitch.length >= 2) {
      targets.set(config.hipPitch[0], Math.sin(phase * freq) * hipAmp);        // Left
      targets.set(config.hipPitch[1], Math.sin(phase * freq + Math.PI) * hipAmp); // Right
    }

    // Hip roll - slight sway for balance
    if (config.hipRoll.length >= 2) {
      targets.set(config.hipRoll[0], Math.sin(phase * freq * 0.5) * 0.1);
      targets.set(config.hipRoll[1], -Math.sin(phase * freq * 0.5) * 0.1);
    }

    // Knee - bend when leg swings forward
    if (config.knee.length >= 2) {
      targets.set(config.knee[0], Math.max(0, Math.sin(phase * freq)) * kneeAmp);
      targets.set(config.knee[1], Math.max(0, Math.sin(phase * freq + Math.PI)) * kneeAmp);
    }

    // Ankle - slight adjustment
    if (config.ankle && config.ankle.length >= 2) {
      targets.set(config.ankle[0], Math.sin(phase * freq) * ankleAmp * 0.5);
      targets.set(config.ankle[1], Math.sin(phase * freq + Math.PI) * ankleAmp * 0.5);
    }

    // Arms swing opposite to legs
    if (config.shoulderPitch && config.shoulderPitch.length >= 2) {
      targets.set(config.shoulderPitch[0], Math.sin(phase * freq + Math.PI) * 0.3);
      targets.set(config.shoulderPitch[1], Math.sin(phase * freq) * 0.3);
    }
  }

  return targets;
}

// PD Controller: Computes control forces
function pdController(
  targetAngle: number,
  currentAngle: number,
  currentVelocity: number,
  kp: number,
  kd: number
): number {
  const error = targetAngle - currentAngle;
  const errorDerivative = -currentVelocity; // Target velocity is 0
  return kp * error + kd * errorDerivative;
}

// Action Controller Class
export class ActionController {
  private model: MuJoCoModel;
  private simulation: MuJoCoSimulation;
  private modelName: string;
  private phase: number = 0;
  private jointConfig: JointConfig;
  private isActive: boolean = false;

  constructor(model: MuJoCoModel, simulation: MuJoCoSimulation, modelName: string) {
    this.model = model;
    this.simulation = simulation;
    this.modelName = modelName;
    this.jointConfig = getJointConfig(model, modelName);
  }

  // Start an action
  startAction(action: string): void {
    this.isActive = true;
    this.phase = 0;
    console.log(`Starting action: ${action} for ${this.modelName}`);
  }

  // Stop the current action
  stopAction(): void {
    this.isActive = false;
    // Reset controls to zero
    for (let i = 0; i < this.simulation.ctrl.length; i++) {
      this.simulation.ctrl[i] = 0;
    }
  }

  // Update the controller (call this every simulation step)
  update(deltaTime: number, action: string): void {
    if (!this.isActive || action !== 'walk') {
      return;
    }

    // Update phase
    this.phase += deltaTime;

    // Generate target angles for current phase
    const targets = generateWalkTargets(this.phase, this.jointConfig, this.modelName);

    // Apply PD control to each joint
    targets.forEach((targetAngle, jointIdx) => {
      // Check if joint index is valid
      if (jointIdx < this.model.nq && jointIdx >= 7) { // Skip free joint (0-6)
        const currentAngle = this.simulation.qpos[jointIdx];
        const currentVelocity = this.simulation.qvel[jointIdx - 7]; // qvel doesn't include free joint

        // Compute control force
        const controlForce = pdController(
          targetAngle,
          currentAngle,
          currentVelocity,
          PD_GAINS.kp,
          PD_GAINS.kd
        );

        // Map joint index to actuator index (usually joint_idx - 7 for robots with free joint)
        const actuatorIdx = jointIdx - 7;
        if (actuatorIdx >= 0 && actuatorIdx < this.simulation.ctrl.length) {
          this.simulation.ctrl[actuatorIdx] = controlForce;
        }
      }
    });
  }

  isActionActive(): boolean {
    return this.isActive;
  }
}
