import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { Plane, Raycaster, Vector2, Vector3, type Object3D, type Mesh } from 'three';
import type { MeshRecord } from './StageBuilderScene';
import type { SceneHandle } from 'src/simulator/scene/scene';
import { faceDragDirection, faceGeometry, highlightResizeFace, resizeFromFace, type ResizableShape, type ResizeFace, type ResizeTarget, type FaceHighlight } from './stageBuilderFaceResize';
import { getSnapSettings, snapSize, type StageBuilderSnapSettings } from './stageBuilderSnapping';
import type { EditorColors } from './stageBuilderEditorTheme';
import { labelWidth, resizeLabel } from './stageBuilderLabelPlacement';
import type { EditorTextObject } from './types';
import './StageResizeHandles.css';

type ResizableObject = ResizableShape | EditorTextObject;
const labelSides: ResizeFace[] = ['left', 'right'];

const sides: ResizeFace[] = ['left', 'right', 'front', 'back'];
const faces: ResizeFace[] = [...sides, 'top', 'bottom'];
const wedgeFaces = faces.filter(face => face !== 'back');
const objectFaces: Record<ResizableObject['kind'], ResizeFace[]> = {
  base: sides, cube: faces, wedge: wedgeFaces, arrow: sides, cylinder: faces, sphere: faces, model: faces, text: labelSides,
};

interface Props {
  object: ResizableObject;
  getRecord: () => MeshRecord | undefined;
  scene: React.RefObject<SceneHandle>;
  colors: EditorColors;
  requestFrame: () => void;
  snap: StageBuilderSnapSettings;
  onPreview: (object: ResizableObject | null) => void;
  onChange: (object: ResizableObject) => void;
}

interface Drag {
  pointerId: number;
  target: ResizeTarget;
  start: ResizableObject;
  next: ResizableObject;
  direction?: ReturnType<typeof faceDragDirection>;
  plane: Plane;
  hit: Vector3;
  normal: Vector3;
  controlsEnabled: boolean;
  down: Vector2;
}

function pointerRay(event: MouseEvent, scene: SceneHandle) {
  const rect = scene.renderer.domElement.getBoundingClientRect();
  const raycaster = new Raycaster();
  raycaster.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1,
    1 - (event.clientY - rect.top) / rect.height * 2), scene.camera);
  return raycaster.ray;
}

function resizeWithHandle(object: ResizableObject, target: ResizeTarget, distance: number, settings: StageBuilderSnapSettings) {
  if (object.kind !== 'text') return resizeFromFace(object, target, distance, settings);
  if (!distance) return object;
  // Both label edges move equally so the centre stays on the picked surface.
  return resizeLabel(object, snapSize(labelWidth(object) + 2 * distance, settings, 0.05));
}

function handleLength(object: ResizableObject, target: ResizeTarget) {
  return object.kind === 'text' ? labelWidth(object) : faceGeometry(object, target).length;
}

export interface ResizeControl {
  update: (occluders: Object3D[], highlight: FaceHighlight, hovered?: ResizeTarget) => void;
  pressFace: (event: PointerEvent, target: ResizeTarget, point: Vector3) => boolean;
}

export const StageResizeHandles = forwardRef<ResizeControl, Props>(function StageResizeHandles(
  { object, getRecord, scene, colors, snap, onPreview, onChange, requestFrame }, ref,
) {
  const buttons = useRef(new Map<ResizeFace, HTMLButtonElement>());
  const drag = useRef<Drag | null>(null);

  const handleGeometry = (target: ResizeTarget) => {
    if (object.kind !== 'text') return faceGeometry(object, target);
    const root = getRecord()?.root;
    if (!root?.visible) return null;
    const normal = new Vector3(target.face === 'left' ? -1 : 1, 0, 0).applyQuaternion(root.quaternion);
    const length = labelWidth(object);
    return { normal, centre: root.position.clone().addScaledVector(normal, length / 2), length, dimension: 'Width' };
  };

  const endDrag = useCallback(() => {
    const active = drag.current;
    if (!active) return;
    drag.current = null;
    const button = buttons.current.get(active.target.face);
    if (button?.hasPointerCapture(active.pointerId)) button.releasePointerCapture(active.pointerId);
    button?.removeAttribute('data-dragging');
    if (scene.current) scene.current.controls.enabled = active.controlsEnabled;
    onPreview(null);
    requestFrame();
    return active;
  }, [onPreview, scene, requestFrame]);

  useEffect(() => {
    const cancel = () => { endDrag(); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && drag.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancel();
      }
    };
    window.addEventListener('keydown', escape, true);
    window.addEventListener('blur', cancel);
    return () => {
      cancel();
      window.removeEventListener('keydown', escape, true);
      window.removeEventListener('blur', cancel);
    };
  }, [endDrag]);

  function startDrag(event: PointerEvent, target: ResizeTarget, point?: Vector3) {
    const view = scene.current;
    if (!view || drag.current || !event.isPrimary || event.button !== 0) return false;
    const geometry = handleGeometry(target);
    if (!geometry?.length) return false;
    const { centre, normal } = geometry;
    const eye = view.camera.position.clone().sub(centre).normalize();
    const planeNormal = eye.addScaledVector(normal, -eye.dot(normal)).normalize();
    const plane = new Plane().setFromNormalAndCoplanarPoint(planeNormal, centre);
    const hit = point || pointerRay(event, view).intersectPlane(plane, new Vector3());
    if (!hit) return false;
    const direction = object.kind === 'text' ? undefined : faceDragDirection(object, target, view.camera, view.renderer.domElement.clientHeight);
    event.preventDefault();
    const button = buttons.current.get(target.face)!;
    button.focus({ preventScroll: true });
    button.setPointerCapture(event.pointerId);
    button.dataset.dragging = 'true';
    drag.current = { pointerId: event.pointerId, target, start: object, next: object, direction, plane, hit, normal,
      controlsEnabled: view.controls.enabled, down: new Vector2(event.clientX, event.clientY) };
    view.controls.enabled = false;
    return true;
  }

  const beginLabel = (event: React.PointerEvent<HTMLButtonElement>) => {
    const view = scene.current;
    if (!view || drag.current || event.button !== 0 || !event.isPrimary) return;
    // Large touch targets can overlap on thin objects. Pick the nearest visible square.
    let face: ResizeFace | undefined;
    let nearest = Infinity;
    for (const [side, button] of buttons.current) {
      if (button.hidden) continue;
      const rect = button.getBoundingClientRect();
      const distance = Math.hypot(event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2);
      if (distance < nearest) { nearest = distance; face = side; }
    }
    if (face) startDrag(event.nativeEvent, { face });
  };

  const move = (event: React.PointerEvent) => {
    const active = drag.current;
    const view = scene.current;
    if (!active || !view || event.pointerId !== active.pointerId) return;
    let distance: number;
    if (active.direction) {
      const pixels = active.direction.axis === 'x' ? event.clientX - active.down.x : event.clientY - active.down.y;
      distance = pixels * active.direction.metresPerPixel;
    } else {
      const hit = pointerRay(event.nativeEvent, view).intersectPlane(active.plane, new Vector3());
      if (!hit) return;
      distance = hit.sub(active.hit).dot(active.normal);
    }
    if (Math.hypot(event.clientX - active.down.x, event.clientY - active.down.y) < 2) distance = 0;
    const next = resizeWithHandle(active.start, active.target, distance, getSnapSettings(snap.preset, snap.rotationPreset, event));
    if (handleLength(active.next, active.target) === handleLength(next, active.target)) return;
    active.next = next;
    onPreview(next);
  };

  useImperativeHandle(ref, () => ({
    pressFace: startDrag,
    update(occluders, highlight, hovered) {
      const view = scene.current;
      if (!view) return;
      const { clientWidth: width, clientHeight: height } = view.renderer.domElement;
      const ray = new Raycaster();
      const focused = Array.from(buttons.current).find(([, button]) => button.matches(':focus-visible'))?.[0];
      const source = getRecord()?.pickables[0] as Mesh | undefined;
      const bounds = source?.userData.resizeBounds;
      const active = drag.current;
      const activeTarget = active?.target ?? hovered ?? (focused ? { face: focused, bounds } : undefined);
      if (activeTarget && source && object.kind !== 'text') {
        highlightResizeFace(highlight, source, object, activeTarget);
        highlight.material.color.set(colors.accent);
        highlight.material.opacity = active ? 0.50 : 0.32;
      }
      for (const [face, button] of buttons.current) {
        const target = face === activeTarget?.face ? activeTarget : { face, bounds };
        const geometry = handleGeometry(target);
        button.hidden = !geometry?.length;
        if (!geometry?.length) continue;
        const { centre, normal, length, dimension } = geometry;
        const initial = active?.target.face === face ? handleLength(active.start, active.target) : length;
        const value = Number(length.toFixed(3)) + ' m';
        button.dataset.size = dimension + ' ' + (initial === length ? value : Number(initial.toFixed(3)) + ' → ' + value);
        const eye = view.camera.position.clone().sub(centre).normalize();
        const point = centre.clone().project(view.camera);
        if (object.kind !== 'text') {
          button.toggleAttribute('data-active-face', face === activeTarget?.face);
          if (face === activeTarget?.face) {
            const direction = drag.current?.direction ?? faceDragDirection(object, target, view.camera, height);
            button.dataset.direction = direction.axis === 'x' ? '↔' : '↕';
            button.style.cursor = direction.axis === 'x' ? 'ew-resize' : 'ns-resize';
            if (drag.current) view.renderer.domElement.dataset.resizeAxis = direction.axis;
          }
          button.style.left = Math.min(Math.max(75, (point.x + 1) * width / 2), width - 75) + 'px';
          button.style.top = Math.min(Math.max(32, (1 - point.y) * height / 2), height - 8) + 'px';
          continue;
        }
        // An axis pointing straight into the view has no useful drag direction.
        ray.set(view.camera.position, eye.clone().negate());
        ray.far = view.camera.position.distanceTo(centre) - 0.001;
        button.hidden = drag.current?.target.face !== face && (Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || Math.abs(point.z) > 1
          || Math.abs(eye.dot(normal)) > 0.985 || ray.intersectObjects(occluders).length > 0);
        if (button.hidden) continue;
        const tip = centre.addScaledVector(normal, 0.01).project(view.camera);
        const direction = new Vector2((tip.x - point.x) * width, (point.y - tip.y) * height).normalize();
        button.style.left = ((point.x + 1) * width / 2 + direction.x * 7) + 'px';
        button.style.top = ((1 - point.y) * height / 2 + direction.y * 7) + 'px';
        const cursor = ['ew', 'nwse', 'ns', 'nesw'][(Math.round(Math.atan2(direction.y, direction.x) / (Math.PI / 4)) + 4) % 4];
        button.style.cursor = cursor + '-resize';
      }
    },
  }));

  return <div className="stage-resize-handles" data-faces={object.kind !== 'text' || undefined} style={{
    '--handle-ink': colors.panel, '--handle-fill': colors.textStrong, '--handle-active': colors.selectionHelper,
  } as React.CSSProperties}>
    {objectFaces[object.kind].map(face => {
      const label = 'Resize ' + face + ' side';
      return <button key={face} type="button" aria-label={label} title={label + ' · Drag or use arrow keys'}
        ref={button => { if (button) buttons.current.set(face, button); else buttons.current.delete(face); }}
        onFocus={requestFrame} onBlur={requestFrame}
        onPointerDown={object.kind === 'text' ? beginLabel : undefined} onPointerMove={move}
        onPointerUp={event => {
          if (event.pointerId !== drag.current?.pointerId) return;
          move(event);
          const ended = endDrag();
          if (ended && ended.start !== ended.next) onChange(ended.next);
        }}
        onPointerCancel={event => { if (event.pointerId === drag.current?.pointerId) endDrag(); }}
        onLostPointerCapture={event => { if (event.pointerId === drag.current?.pointerId) endDrag(); }}
        onKeyDown={event => {
          if (drag.current || !['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          const settings = getSnapSettings(snap.preset, snap.rotationPreset, event);
          const step = settings.resize || 0.01;
          const target = { face, bounds: getRecord()?.pickables[0]?.userData.resizeBounds };
          let distance = (['ArrowUp', 'ArrowRight'].includes(event.key) ? step : -step) / 2;
          const view = scene.current;
          if (object.kind !== 'text' && view) {
            const direction = faceDragDirection(object, target, view.camera, view.renderer.domElement.clientHeight);
            const horizontalKey = event.key === 'ArrowRight' || event.key === 'ArrowLeft';
            if (horizontalKey !== (direction.axis === 'x')) return;
            const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
            distance = (forward ? step : -step) * Math.sign(direction.metresPerPixel);
          }
          const next = resizeWithHandle(object, target, distance, settings);
          if (next !== object) onChange(next);
        }} />;
    })}
  </div>;
});
