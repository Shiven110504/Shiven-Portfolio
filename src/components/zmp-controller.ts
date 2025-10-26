import { MuJoCoModel, MuJoCoSimulation } from './types/mujoco';

/**
 * PD controller gains for motor actuators (torque control)
 */
const PD_GAINS = {
  kp: 100.0,  // Proportional gain
  kd: 10.0,   // Derivative gain
};

/**
 * Actuator mapping for a robot
 */
interface ActuatorMap {
  [actuatorName: string]: number;  // Maps actuator names to indices
}

/**
 * Joint configuration for different robot types
 */
interface JointConfig {
  hipPitch: string[];
  hipRoll: string[];
  hipYaw?: string[];
  knee: string[];
  ankle?: string[];
  shoulderPitch?: string[];
  shoulderRoll?: string[];
  elbowPitch?: string[];
}

/**
 * Simple walking controller using pure position actuator control
 */
export class ZMPController {
  private model: MuJoCoModel;
  private simulation: MuJoCoSimulation;
  private modelName: string;
  private phase: number = 0;
  private isActive: boolean = false;
  private debugLogCount: number = 0;

  // Actuator mapping
  private actuatorMap: ActuatorMap = {};
  private jointConfig: JointConfig;
  private warnedActuators: Set<string> = new Set(); // Track which actuators we've warned about
  private motorActuators: Set<string> = new Set(); // Motor actuators (need torque control)

  constructor(model: MuJoCoModel, simulation: MuJoCoSimulation, modelName: string) {
    this.model = model;
    this.simulation = simulation;
    this.modelName = modelName;

    // Build actuator mapping from MuJoCo model
    this.buildActuatorMap();

    // Get joint configuration for this robot type
    this.jointConfig = this.getJointConfig(modelName);

    // Identify motor actuators based on model
    this.identifyMotorActuators(modelName);
  }

  /**
   * Identify which actuators are motors (need torque) vs position servos
   * Based on empirical testing: hip actuators on Go2 don't respond to position control
   */
  private identifyMotorActuators(modelName: string): void {
    this.motorActuators.clear();

    if (modelName === 'unitree_go2') {
      // Go2 hip actuators are motors (empirically verified - they don't respond to position control)
      this.motorActuators.add('FL_hip');
      this.motorActuators.add('FR_hip');
      this.motorActuators.add('RL_hip');
      this.motorActuators.add('RR_hip');
      console.log('🔧 Motor actuators (torque control):', Array.from(this.motorActuators).join(', '));
    }
  }

  /**
   * Build actuator name to index mapping from MuJoCo model
   */
  private buildActuatorMap(): void {
    this.actuatorMap = {};

    for (let i = 0; i < this.model.nu; i++) {
      const nameAddr = this.model.name_actuatoradr[i];
      let name = '';

      // Read null-terminated string from names buffer
      for (let j = nameAddr; j < this.model.names.length; j++) {
        const char = String.fromCharCode(this.model.names[j]);
        if (char === '\0') break;
        name += char;
      }

      if (name) {
        this.actuatorMap[name] = i;
      }
    }

    const actuatorNames = Object.keys(this.actuatorMap);
    console.log(`✓ ${this.modelName}: Found ${actuatorNames.length} actuators:`, actuatorNames);
  }

  /**
   * Get actuator index by name (with error handling)
   */
  private getActuatorIndex(actuatorName: string): number | null {
    const index = this.actuatorMap[actuatorName];
    if (index === undefined) {
      // Only warn once per actuator to avoid console spam
      if (!this.warnedActuators.has(actuatorName)) {
        console.warn(`⚠️ Actuator '${actuatorName}' not found in ${this.modelName} model`);
        this.warnedActuators.add(actuatorName);
      }
      return null;
    }
    return index;
  }

  /**
   * Get joint configuration for each robot type
   * Using simple, conservative actuator lists
   */
  private getJointConfig(modelName: string): JointConfig {
    if (modelName === 'humanoid') {
      // Standard MuJoCo humanoid
      return {
        hipPitch: ['right_hip_y', 'left_hip_y'],
        hipRoll: ['right_hip_x', 'left_hip_x'],
        knee: ['right_knee', 'left_knee'],
        ankle: ['right_ankle_y', 'left_ankle_y'],
      };
    } else if (modelName === 'unitree_go2') {
      // Go2 quadruped - all position actuators
      return {
        hipPitch: ['FL_hip', 'FR_hip', 'RL_hip', 'RR_hip'],
        hipRoll: ['FL_thigh', 'FR_thigh', 'RL_thigh', 'RR_thigh'],
        knee: ['FL_calf', 'FR_calf', 'RL_calf', 'RR_calf'],
      };
    } else if (modelName === 'unitree_h1') {
      // H1 humanoid
      return {
        hipPitch: ['left_hip_pitch', 'right_hip_pitch'],
        hipRoll: ['left_hip_roll', 'right_hip_roll'],
        knee: ['left_knee', 'right_knee'],
        ankle: ['left_ankle', 'right_ankle'],
      };
    }

    // Default fallback
    return {
      hipPitch: [],
      hipRoll: [],
      knee: [],
    };
  }



  /**
   * Start walking action
   */
  startAction(action: string): void {
    if (action === 'walk') {
      this.isActive = true;
      this.phase = 0;
      this.debugLogCount = 0;
      console.log(`🚶 Starting simple walking for ${this.modelName}`);
    }
  }

  /**
   * Stop the current action
   */
  stopAction(): void {
    this.isActive = false;
    // Reset controls to zero
    for (let i = 0; i < this.simulation.ctrl.length; i++) {
      this.simulation.ctrl[i] = 0;
    }
  }

  /**
   * Generate simple, conservative gait with small amplitudes
   * This uses pure position control - MuJoCo handles PD internally
   */
  private generateSimpleGait(phase: number): Map<string, number> {
    const targets = new Map<string, number>();

    // Very slow frequency for stability
    const freq = 0.5;  // 0.5 Hz = 2 seconds per step

    // Simple sinusoidal phases for alternating legs
    const leftPhase = Math.sin(phase * freq * 2 * Math.PI);
    const rightPhase = Math.sin(phase * freq * 2 * Math.PI + Math.PI);

    // VERY CONSERVATIVE amplitudes (small movements)
    const hipAmp = 0.1;   // ~6 degrees - small hip swing
    const kneeAmp = 0.15; // ~9 degrees - small knee bend
    const ankleAmp = 0.05; // ~3 degrees - minimal ankle

    if (this.modelName === 'unitree_go2') {
      // Quadruped trotting: FL+RR together, FR+RL together
      if (this.jointConfig.hipPitch.length === 4) {
        targets.set(this.jointConfig.hipPitch[0], leftPhase * hipAmp);   // FL
        targets.set(this.jointConfig.hipPitch[1], rightPhase * hipAmp);  // FR
        targets.set(this.jointConfig.hipPitch[2], rightPhase * hipAmp);  // RL
        targets.set(this.jointConfig.hipPitch[3], leftPhase * hipAmp);   // RR
      }

      // Keep thighs at slight outward angle
      if (this.jointConfig.hipRoll.length === 4) {
        targets.set(this.jointConfig.hipRoll[0], 0.05);   // FL
        targets.set(this.jointConfig.hipRoll[1], -0.05);  // FR
        targets.set(this.jointConfig.hipRoll[2], 0.05);   // RL
        targets.set(this.jointConfig.hipRoll[3], -0.05);  // RR
      }

      // Knees - slight bend with swing variation
      if (this.jointConfig.knee.length === 4) {
        targets.set(this.jointConfig.knee[0], -0.3 + Math.abs(leftPhase) * kneeAmp);
        targets.set(this.jointConfig.knee[1], -0.3 + Math.abs(rightPhase) * kneeAmp);
        targets.set(this.jointConfig.knee[2], -0.3 + Math.abs(rightPhase) * kneeAmp);
        targets.set(this.jointConfig.knee[3], -0.3 + Math.abs(leftPhase) * kneeAmp);
      }
    } else {
      // Humanoid (standard humanoid or H1)
      // Hip pitch - alternating leg swing
      if (this.jointConfig.hipPitch.length >= 2) {
        targets.set(this.jointConfig.hipPitch[0], rightPhase * hipAmp);  // Right
        targets.set(this.jointConfig.hipPitch[1], leftPhase * hipAmp);   // Left
      }

      // Hip roll - minimal lateral sway
      if (this.jointConfig.hipRoll.length >= 2) {
        targets.set(this.jointConfig.hipRoll[0], Math.sin(phase * freq * Math.PI) * 0.03);   // Right
        targets.set(this.jointConfig.hipRoll[1], -Math.sin(phase * freq * Math.PI) * 0.03);  // Left
      }

      // Knee - bend only when leg swings forward
      if (this.jointConfig.knee.length >= 2) {
        targets.set(this.jointConfig.knee[0], Math.max(0, rightPhase) * kneeAmp);  // Right
        targets.set(this.jointConfig.knee[1], Math.max(0, leftPhase) * kneeAmp);   // Left
      }

      // Ankle - very minimal
      if (this.jointConfig.ankle && this.jointConfig.ankle.length >= 2) {
        targets.set(this.jointConfig.ankle[0], rightPhase * ankleAmp);  // Right
        targets.set(this.jointConfig.ankle[1], leftPhase * ankleAmp);   // Left
      }
    }

    return targets;
  }

  /**
   * Update controller with mixed control strategy
   * Motors (torque) + Position servos
   */
  update(deltaTime: number, action: string): void {
    if (!this.isActive || action !== 'walk') {
      return;
    }

    // Update phase
    this.phase += deltaTime;

    // Generate simple gait targets
    const targets = this.generateSimpleGait(this.phase);

    // Apply mixed control: torque for motors, position for servos
    let appliedCount = 0;
    targets.forEach((targetAngle, actuatorName) => {
      const actuatorIdx = this.getActuatorIndex(actuatorName);
      if (actuatorIdx !== null && actuatorIdx < this.simulation.ctrl.length) {
        const isMotor = this.motorActuators.has(actuatorName);

        if (isMotor) {
          // MOTOR actuator - apply PD control to calculate torque
          const trnId = this.model.actuator_trnid ? this.model.actuator_trnid[actuatorIdx * 2] : -1;

          if (trnId >= 0 && trnId < this.simulation.qpos.length) {
            const currentAngle = this.simulation.qpos[trnId];

            // CRITICAL FIX: Free joint has 7 qpos elements but 6 qvel elements
            // So qpos[7] corresponds to qvel[6], qpos[8] to qvel[7], etc.
            // Correct formula: velIdx = trnId - 1
            const velIdx = trnId - 1;
            const currentVel = velIdx >= 0 && velIdx < this.simulation.qvel.length
              ? this.simulation.qvel[velIdx]
              : 0;

            // PD control: torque = kp * error + kd * (-velocity)
            const error = targetAngle - currentAngle;
            const torque = PD_GAINS.kp * error + PD_GAINS.kd * (-currentVel);

            this.simulation.ctrl[actuatorIdx] = torque;

            if (this.debugLogCount < 2) {
              console.log(`  ⚙️ ${actuatorName} [${actuatorIdx}] MOTOR: target=${targetAngle.toFixed(3)}, current=${currentAngle.toFixed(3)}, error=${error.toFixed(3)}, torque=${torque.toFixed(3)}`);
            }
          }
        } else {
          // POSITION SERVO - direct position control
          this.simulation.ctrl[actuatorIdx] = targetAngle;

          if (this.debugLogCount < 2) {
            console.log(`  📍 ${actuatorName} [${actuatorIdx}] SERVO: target=${targetAngle.toFixed(3)}`);
          }
        }

        appliedCount++;
      }
    });

    // Debug logging
    if (this.debugLogCount < 2) {
      console.log(`🎯 Step ${this.debugLogCount + 1}, Phase: ${this.phase.toFixed(3)}s, Applied: ${appliedCount}/${targets.size} actuators`);
      this.debugLogCount++;
    }
  }

  /**
   * Check if controller is active
   */
  isActionActive(): boolean {
    return this.isActive;
  }
}
