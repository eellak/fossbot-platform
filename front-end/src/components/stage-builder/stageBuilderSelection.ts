import type { EditorStageObject } from './types';

export function movableSelectionMembers(objects: EditorStageObject[], ids: string[]): EditorStageObject[] {
  const selected = new Set(ids);
  const members = objects.filter(object => selected.has(object.id));
  if (members.some(object => object.locked || (object.kind === 'text' && object.attachment && !selected.has(object.attachment.parentId)))) return [];
  return members;
}

export function listenForViewportMultiSelect(
  canvas: HTMLCanvasElement,
  canSelect: () => boolean,
  toggleAt: (event: PointerEvent) => void,
) {
  let start: PointerEvent | null = null;
  const moved = (down: PointerEvent, event: PointerEvent) => Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) >= 5;

  const pointerDown = (event: PointerEvent) => {
    start = null;
    if (event.button !== 0 || !(event.ctrlKey || event.metaKey) || !canSelect()) return;
    start = event;
    event.stopImmediatePropagation();
  };
  const pointerMove = (event: PointerEvent) => {
    if (start && event.pointerId === start.pointerId && moved(start, event)) start = null;
  };
  const pointerUp = (event: PointerEvent) => {
    if (!start || event.pointerId !== start.pointerId) return;
    const clicked = event.button === 0 && !moved(start, event) && canSelect();
    start = null;
    if (clicked) toggleAt(event);
  };
  const cancel = () => { start = null; };

  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', cancel);
  return () => {
    canvas.removeEventListener('pointerdown', pointerDown);
    canvas.removeEventListener('pointermove', pointerMove);
    canvas.removeEventListener('pointerup', pointerUp);
    canvas.removeEventListener('pointercancel', cancel);
  };
}
