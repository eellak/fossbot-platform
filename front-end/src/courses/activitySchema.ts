import { v4 as uuidv4 } from 'uuid';
import { emptyTiptapDocument } from './courseAuthoring';
import type { Activity, SensorPresentation, SensorStatistic } from './types';

export const activityTypes: Activity['type'][] = [
  'rich_text', 'multiple_choice', 'multiple_select', 'numeric_answer',
  'short_reflection', 'simulator_observation', 'hint',
  'mission',
];

export const sensorCatalog = [
  { id: 'ultrasonic-front', unit: 'm', group: 'distance' },
  { id: 'ir-front-left', unit: 'm', group: 'distance' },
  { id: 'ir-front-right', unit: 'm', group: 'distance' },
  { id: 'ir-side-left', unit: 'm', group: 'distance' },
  { id: 'ir-side-right', unit: 'm', group: 'distance' },
  { id: 'ir-floor-left', unit: 'state', group: 'surface' },
  { id: 'ir-floor-center', unit: 'state', group: 'surface' },
  { id: 'ir-floor-right', unit: 'state', group: 'surface' },
  { id: 'ldr-top', unit: '0–1023', group: 'environment' },
  { id: 'microphone', unit: '0–1023', group: 'environment' },
  { id: 'odometer-left', unit: 'm', group: 'motion' },
  { id: 'odometer-right', unit: 'm', group: 'motion' },
  { id: 'accelerometer-x', unit: 'm/s²', group: 'motion' },
  { id: 'accelerometer-y', unit: 'm/s²', group: 'motion' },
  { id: 'accelerometer-z', unit: 'm/s²', group: 'motion' },
  { id: 'gyroscope-x', unit: '°/s', group: 'motion' },
  { id: 'gyroscope-y', unit: '°/s', group: 'motion' },
  { id: 'gyroscope-z', unit: '°/s', group: 'motion' },
] as const;

export const sensorGroups = ['distance', 'surface', 'environment', 'motion'] as const;

export const sensorPresentations: SensorPresentation[] = ['live', 'chart', 'summary'];
export const sensorStatistics: SensorStatistic[] = ['minimum', 'maximum', 'average', 'finalValue'];

const key = (type: Activity['type']) => `${type}-${uuidv4()}`;

export function createActivity(type: Activity['type']): Activity {
  const common = { key: key(type), type, version: 1 as const, required: false };
  if (type === 'rich_text') return { ...common, type, content: emptyTiptapDocument() };
  if (type === 'hint') return { ...common, type, content: '', forActivityKey: null };
  if (type === 'multiple_choice') return {
    ...common, type, prompt: '', options: [{ key: 'option-1', label: '' }, { key: 'option-2', label: '' }], correctOptionKey: 'option-1', feedbackCorrect: '', feedbackIncorrect: '',
  };
  if (type === 'multiple_select') return {
    ...common, type, prompt: '', options: [{ key: 'option-1', label: '' }, { key: 'option-2', label: '' }], correctOptionKeys: ['option-1'], feedbackCorrect: '', feedbackIncorrect: '',
  };
  if (type === 'numeric_answer') return {
    ...common, type, prompt: '', expectedValue: 0, unit: 'm', tolerance: { mode: 'absolute', value: 0 }, validRange: null, feedbackCorrect: '', feedbackIncorrect: '',
  };
  if (type === 'short_reflection') return { ...common, type, prompt: '', collectResponse: false };
  if (type === 'mission') return {
    ...common,
    type,
    title: 'Reach the target',
    completionMode: 'all',
    objectives: [{
      key: `objective-${uuidv4()}`,
      role: 'completion',
      summary: 'Reach the selected target.',
      condition: { type: 'reach_target', markerId: '' },
    }],
    retryLimit: null,
    feedbackMode: 'immediate',
    scoreConfig: { version: 1, enabled: false, rankFailedAttempts: false, components: [], starThresholds: [0.5, 0.75, 0.9] },
  };
  return {
    ...common, type, prompt: '', allowedSensors: ['ultrasonic-front'], sensorHelperMode: 'student_toggle', presentations: ['live', 'chart'], capturedStatistics: ['minimum', 'maximum', 'average', 'finalValue'], visibleStatistics: ['maximum', 'average', 'finalValue'],
  };
}

export function duplicateActivity(activity: Activity): Activity {
  return { ...JSON.parse(JSON.stringify(activity)), key: key(activity.type) } as Activity;
}

export function activityValidation(activity: Activity): string[] {
  const errors: string[] = [];
  if ('prompt' in activity && !activity.prompt.trim()) errors.push('prompt');
  if (activity.type === 'multiple_choice' || activity.type === 'multiple_select') {
    const optionKeys = new Set(activity.options.map((option) => option.key));
    if (activity.options.length < 2 || activity.options.some((option) => !option.label.trim())) errors.push('options');
    if (activity.type === 'multiple_choice' && (!activity.correctOptionKey || !optionKeys.has(activity.correctOptionKey))) errors.push('answer');
    if (activity.type === 'multiple_select' && (!activity.correctOptionKeys?.length || activity.correctOptionKeys.some((key) => !optionKeys.has(key)))) errors.push('answer');
  }
  if (activity.type === 'numeric_answer') {
    if (!activity.unit.trim() || activity.expectedValue === undefined || activity.tolerance.value < 0) errors.push('numeric');
  }
  if (activity.type === 'simulator_observation' && (!activity.allowedSensors.length || !activity.presentations.length)) errors.push('sensors');
  if (activity.type === 'short_reflection' && !activity.collectResponse && activity.required) errors.push('private-reflection-required');
  if (activity.type === 'mission') {
    if (!activity.title.trim() || !activity.objectives.length || !activity.objectives.some((objective) => objective.role === 'completion')) errors.push('mission');
    if (activity.objectives.some((objective) => !objective.summary.trim() || missionConditionIncomplete(objective.condition))) errors.push('mission');
  }
  return errors;
}

function missionConditionIncomplete(condition: import('./types').MissionCondition): boolean {
  if (condition.type === 'reach_target' || condition.type === 'stop_in_target') return !condition.markerId;
  if (condition.type === 'checkpoints' || condition.type === 'collect' || condition.type === 'avoid_zones') return condition.markerIds.length === 0;
  if (condition.type === 'object_in_zone') return !condition.objectId || !condition.zoneId;
  if (condition.type === 'no_incident') return condition.incidents.length === 0;
  if (condition.type === 'sensor_threshold') return !condition.sensorId || !Number.isFinite(condition.threshold);
  if (condition.type === 'actuator_state') return !condition.state;
  return condition.maxDurationMs === undefined && condition.maxMovementActions === undefined;
}
