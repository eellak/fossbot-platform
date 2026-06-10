import { log, isLogEnabled } from "./log";

export function checkSuspensionHealth(robot_mass: number, gravity: number, num_wheels: number = 2, stiffness: number, restLength: number, travel: number) {
  const totalWeightN = Math.abs(robot_mass * gravity);

  // Max force occurs at full compression (Rest Length + Max Travel)
  const maxForcePerWheel = stiffness * (restLength + travel);
  const totalMaxForce = maxForcePerWheel * num_wheels;

  if (!isLogEnabled) return;

  log.robot(`Robot Weight: ${totalWeightN.toFixed(2)}N`);
  log.robot(`Max Suspension Lift: ${totalMaxForce.toFixed(2)}N`);

  const equilibrium = totalWeightN / (stiffness * num_wheels);

  if (equilibrium > restLength) {
    log.robot(
      `CRITICAL: Chassis Drag! The robot needs to sag ${(equilibrium * 100).toFixed(2)}cm, ` +
      `but your Rest Length is only ${(restLength * 100).toFixed(2)}cm.`
    );
  }

  if (totalMaxForce < totalWeightN) {
    log.robot(
      `WARNING: Suspension is mathematically unable to lift the robot. ` +
      `It will bottom out and drag on the floor. ` +
      `Increase SUSPENSION_STIFFNESS or SUSPENSION_REST_LENGTH.`
    );
  } else if (totalMaxForce < totalWeightN * 1.5) {
    log.robot(
      `INFO: Suspension is very soft. The robot will sit very low in its fenders.`
    );
  } else {
    log.robot(`SUCCESS: Suspension has sufficient overhead.`);
  }
}