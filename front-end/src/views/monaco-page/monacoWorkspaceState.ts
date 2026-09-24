import type { RobotProgramState } from 'src/robot/RobotConnectionContext';

const activeRobotProgramStates: RobotProgramState[] = ['accepted', 'starting', 'running', 'stopping'];

export const isRobotProgramActive = (state: RobotProgramState): boolean => activeRobotProgramStates.includes(state);

export const isExistingProject = (projectId?: string): boolean => Boolean(projectId);
