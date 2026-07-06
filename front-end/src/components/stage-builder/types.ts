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

export type StageSkyboxMode = 'default' | 'color';

export type StageBuilderSkyboxSettings = {
  mode: StageSkyboxMode;
  color: string;
};

export type StageSkyboxEntry = {
  type: 'skybox';
  mode?: StageSkyboxMode;
  color?: string | number;
  name?: string;
};

export type StageBaseEntry = {
  type: 'base';
  dimensions: [number, number];
  material?: StageEntryMaterial;
  position: [number, number];
  name?: string;
};

export type StagePrimitiveCollisionMode = 'auto' | 'none';
export type StageModelCollisionMode = 'auto' | 'none' | 'trimesh' | 'convexHull' | 'compoundConvex';

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
  collision?: StagePrimitiveCollisionMode;
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
  collision?: StagePrimitiveCollisionMode;
};

export type StageLineEntry = {
  type: 'line';
  points: [number, number][];
  width?: number;
  color?: string | number;
  y?: number;
  name?: string;
};

export type StageLabelFace = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

export type StageLabelAttachment = {
  parentId: string;
  face: StageLabelFace;
  offset: [number, number];
  rotation: number;
  billboard?: boolean;
};

export type StageTextStyle = {
  backgroundVisible?: boolean;
  backgroundSize?: [number, number];
  backgroundColor?: string;
  backgroundOpacity?: number;
  borderVisible?: boolean;
  borderColor?: string;
  borderWidth?: number;
  fontSize?: number;
};

export type StageTextEntry = {
  type: 'text';
  text: string;
  position: [number, number, number];
  color?: string | number;
  scale?: number;
  onFloor?: boolean;
  attachment?: StageLabelAttachment;
  attach?: {
    parentName: string;
    face: StageLabelFace;
    offset: [number, number];
    rotation: number;
  };
  style?: StageTextStyle;
  name?: string;
};

export type StageFossbotEntry = {
  type: 'fossbot';
  position: [number, number, number];
  orientation: [number, number, number];
};

export type StageModelFormat = 'obj' | 'stl';

export type StageModelEntry = {
  type: 'model';
  filename: string;
  format?: StageModelFormat;
  position: [number, number, number];
  scale?: number;
  normalize?: boolean;
  nativeDimensions?: [number, number, number];
  orientation?: [number, number, number];
  color?: string | number;
  name?: string;
  castShadow?: boolean;
  mass?: number;
  immovable?: boolean;
  collision?: StageModelCollisionMode | { mode?: StageModelCollisionMode; source?: string };
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

export type StageAudioSourceType = 'url' | 'file';

export type StageAudioEntry = {
  type: 'audio';
  position: [number, number, number];
  sourceType?: StageAudioSourceType;
  source?: string;
  volume?: number;
  loop?: boolean;
  spatial?: boolean;
  range?: number;
  autoplay?: boolean;
  name?: string;
};

export type StageJsonEntry =
  | StageSkyboxEntry
  | StageFloorEntry
  | StageBaseEntry
  | StageCubeEntry
  | StageCylinderEntry
  | StageLineEntry
  | StageTextEntry
  | StageFossbotEntry
  | StageModelEntry
  | StageLightEntry
  | StageCameraEntry
  | StageAudioEntry;

export type StageObjectKind = 'base' | 'cube' | 'cylinder' | 'line' | 'text' | 'fossbot' | 'model' | 'light' | 'camera' | 'audio';

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
  | 'camera'
  | 'audio'
  | 'customObject';

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
  skybox?: StageBuilderSkyboxSettings;
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
  parentId?: string;
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
  collision?: StagePrimitiveCollisionMode;
  rampAngle?: number;
};

export type EditorCylinderObject = EditorObjectCommon & {
  kind: 'cylinder';
  position: Vec3;
  dimensions: [number, number, number, number];
  color: string;
  mass: number;
  immovable: boolean;
  collision?: StagePrimitiveCollisionMode;
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
  attachment?: StageLabelAttachment;
  style?: StageTextStyle;
};

export type EditorFossbotObject = EditorObjectCommon & {
  kind: 'fossbot';
  position: Vec3;
  rotationY: number;
};

export type EditorModelObject = EditorObjectCommon & {
  kind: 'model';
  filename: string;
  format: StageModelFormat;
  originalFileName?: string;
  position: Vec3;
  rotationY: number;
  orientation?: Vec3;
  scale: number;
  normalize: boolean;
  nativeDimensions?: Vec3;
  color: string;
  mass: number;
  immovable: boolean;
  collision: StageModelCollisionMode;
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

export type EditorAudioObject = EditorObjectCommon & {
  kind: 'audio';
  position: Vec3;
  sourceType: StageAudioSourceType;
  source: string;
  volume: number;
  loop: boolean;
  spatial: boolean;
  range: number;
  autoplay: boolean;
};

export type EditorStageObject =
  | EditorBaseObject
  | EditorCubeObject
  | EditorCylinderObject
  | EditorLineObject
  | EditorTextObject
  | EditorFossbotObject
  | EditorModelObject
  | EditorLightObject
  | EditorCameraObject
  | EditorAudioObject;

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
