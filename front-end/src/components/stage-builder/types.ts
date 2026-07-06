export type StageEntryMaterial = {
  color?: string | number;
  opacity?: number;
};

export type StageFloorEntry = {
  type: 'floor';
  dimensions: [number, number];
  material?: StageEntryMaterial;
  texture?: string;
  repeat?: [number, number];
  offset?: [number, number];
  name?: string;
};

export type StageBaseEntry = {
  type: 'base';
  dimensions: [number, number];
  material?: StageEntryMaterial;
  position: [number, number];
  name?: string;
};

export type StageCubeEntry = {
  type: 'cube';
  dimensions: [number, number, number];
  material?: StageEntryMaterial;
  position: [number, number, number];
  orientation?: [number, number, number];
  name?: string;
  castShadow?: boolean;
  immovable?: boolean;
  mass?: number;
};

export type StageCylinderEntry = {
  type: 'cylinder';
  dimensions: [number, number, number, number?];
  material?: StageEntryMaterial;
  position: [number, number, number];
  name?: string;
  castShadow?: boolean;
  immovable?: boolean;
  mass?: number;
};

export type StageLineEntry = {
  type: 'line';
  points: [number, number][];
  width?: number;
  color?: string | number;
  y?: number;
  name?: string;
};

export type StageTextEntry = {
  type: 'text';
  text: string;
  position: [number, number, number];
  color?: string | number;
  scale?: number;
  onFloor?: boolean;
  name?: string;
};

export type StageFossbotEntry = {
  type: 'fossbot';
  position: [number, number, number];
  orientation: [number, number, number];
};

export type StageLightSubtype = 'point' | 'directional' | 'spot' | 'ambient';

export type StageLightEntry = {
  type: 'light';
  subtype?: StageLightSubtype;
  position: [number, number, number];
  color?: string | number;
  intensity?: number;
  range?: number;
  angle?: number;
  penumbra?: number;
  rotationY?: number;
  name?: string;
};

export type StageCameraEntry = {
  type: 'camera';
  position: [number, number, number];
  rotationY?: number;
  pitch?: number;
  fov?: number;
  name?: string;
};

export type StageJsonEntry =
  | StageFloorEntry
  | StageBaseEntry
  | StageCubeEntry
  | StageCylinderEntry
  | StageLineEntry
  | StageTextEntry
  | StageFossbotEntry
  | StageLightEntry
  | StageCameraEntry;

export type StageObjectKind = 'base' | 'cube' | 'cylinder' | 'line' | 'text' | 'fossbot' | 'light' | 'camera';

export type StageSemanticKind =
  | 'floor'
  | 'baseTile'
  | 'wall'
  | 'block'
  | 'ramp'
  | 'platform'
  | 'cylinder'
  | 'obstacle'
  | 'robotSpawn'
  | 'target'
  | 'checkpoint'
  | 'dangerZone'
  | 'sensorZone'
  | 'line'
  | 'label'
  | 'light'
  | 'camera';

export type StageBuilderMode = 'navigate' | 'place' | 'edit' | 'test';
export type StageBuilderTool = 'select' | 'move' | 'rotate' | 'resize';
export type StageBuilderTransformSpace = 'world' | 'local';

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export type EditorStageFloorSettings = {
  name: string;
  dimensions: [number, number];
  color: string;
  texture?: string;
  repeat?: [number, number];
  offset?: [number, number];
};

export type StageBuilderGroup = {
  id: string;
  name: string;
  objectIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type StageValidationOverrideMap = Record<string, boolean>;

export type StageBuilderMetadata = {
  version: 2;
  groups: StageBuilderGroup[];
  validationOverrides: StageValidationOverrideMap;
  gridVisible?: boolean;
  gridSize?: number;
  defaultSnapPreset?: 'off' | 'fine' | 'medium' | 'coarse';
  defaultRotationSnapPreset?: 'off' | '15' | '30' | '45';
  lockCamera?: boolean;
};

export type StageBuilderEditorSnapshot = StageBuilderMetadata & {
  floor?: EditorStageFloorSettings;
  objects?: EditorStageObject[];
};

export type EditorObjectCommon = {
  id: string;
  name: string;
  semanticKind?: StageSemanticKind;
  groupId?: string;
  prefabSourceId?: string;
  locked?: boolean;
  hidden?: boolean;
};

export type EditorBaseObject = EditorObjectCommon & {
  kind: 'base';
  position: Vec3;
  dimensions: [number, number];
  color: string;
};

export type EditorCubeObject = EditorObjectCommon & {
  kind: 'cube';
  position: Vec3;
  rotationY: number;
  orientation?: Vec3;
  dimensions: Vec3;
  color: string;
  mass: number;
  immovable: boolean;
  rampAngle?: number;
};

export type EditorCylinderObject = EditorObjectCommon & {
  kind: 'cylinder';
  position: Vec3;
  dimensions: [number, number, number, number];
  color: string;
  mass: number;
  immovable: boolean;
};

export type EditorLineObject = EditorObjectCommon & {
  kind: 'line';
  points: Vec2[];
  width: number;
  color: string;
  y?: number;
};

export type EditorTextObject = EditorObjectCommon & {
  kind: 'text';
  text: string;
  position: Vec3;
  color: string;
  scale: number;
  onFloor: boolean;
};

export type EditorFossbotObject = EditorObjectCommon & {
  kind: 'fossbot';
  position: Vec3;
  rotationY: number;
};

export type EditorLightObject = EditorObjectCommon & {
  kind: 'light';
  subtype: StageLightSubtype;
  position: Vec3;
  rotationY: number;
  color: string;
  intensity: number;
  range: number;
  angle: number;
  penumbra: number;
};

export type EditorCameraObject = EditorObjectCommon & {
  kind: 'camera';
  position: Vec3;
  rotationY: number;
  pitch: number;
  fov: number;
};

export type EditorStageObject =
  | EditorBaseObject
  | EditorCubeObject
  | EditorCylinderObject
  | EditorLineObject
  | EditorTextObject
  | EditorFossbotObject
  | EditorLightObject
  | EditorCameraObject;

export type EditorStage = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  floor: EditorStageFloorSettings;
  objects: EditorStageObject[];
  metadata: StageBuilderMetadata;
};

export type LocalStageRecord = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  config: StageJsonEntry[];
  editor?: StageBuilderEditorSnapshot;
};
