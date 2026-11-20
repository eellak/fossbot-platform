import { listenForViewportMultiSelect, movableSelectionMembers } from './stageBuilderSelection';
import type { EditorBaseObject, EditorLineObject, EditorTextObject } from './types';

declare const test: any, expect: any, jest: any;

test('a shared move includes selected paths and keeps locked objects and label attachments intact', () => {
  const path: EditorLineObject = { id: 'path', name: 'Path', kind: 'line', points: [[1, 0], [2, 0]], width: 0.02, color: 'black' };
  const parent: EditorBaseObject = { id: 'base', name: 'Base', kind: 'base', position: [0, 0, 0], dimensions: [1, 1], color: 'white' };
  const label: EditorTextObject = { kind: 'text', id: 'label', name: 'Label', text: 'A', onFloor: false, scale: 1, color: 'black', position: [0, 0, 0],
    attachment: { parentId: 'base', face: 'top', rotation: 0, offset: [0, 0] } };
  const objects = [path, parent, label];
  expect(movableSelectionMembers(objects, ['path', 'base'])).toEqual([path, parent]);
  expect(movableSelectionMembers(objects, ['path', 'base', 'label'])).toEqual(objects);
  expect(movableSelectionMembers(objects, ['path', 'label'])).toEqual([]);
  expect(movableSelectionMembers([{ ...path, locked: true }, parent], ['base', 'path'])).toEqual([]);
});

test('Ctrl and Cmd clicks reach selection, while ordinary clicks reach the gizmo', () => {
  const canvas = document.createElement('canvas');
  const toggle = jest.fn();
  const gizmo = jest.fn();
  const stop = listenForViewportMultiSelect(canvas, () => true, toggle);
  canvas.addEventListener('pointerdown', gizmo);
  for (const modifier of [{ ctrlKey: true }, { metaKey: true }, {}]) {
    canvas.dispatchEvent(new MouseEvent('pointerdown', modifier));
    canvas.dispatchEvent(new MouseEvent('pointerup', modifier));
  }
  expect(toggle).toHaveBeenCalledTimes(2);
  expect(gizmo).toHaveBeenCalledTimes(1);
  stop();
  canvas.dispatchEvent(new MouseEvent('pointerdown', { ctrlKey: true }));
  canvas.dispatchEvent(new MouseEvent('pointerup', { ctrlKey: true }));
  expect(gizmo).toHaveBeenCalledTimes(2);
  expect(toggle).toHaveBeenCalledTimes(2);
});

test('panning, cancelled clicks and other editor modes preserve the selection', () => {
  const canvas = document.createElement('canvas');
  const toggle = jest.fn();
  let editing = true;
  const stop = listenForViewportMultiSelect(canvas, () => editing, toggle);
  const send = (type: string, clientX = 0) => canvas.dispatchEvent(new MouseEvent(type, { ctrlKey: true, clientX }));
  send('pointerdown');
  send('pointermove', 20);
  send('pointerup');
  send('pointerdown');
  send('pointercancel');
  send('pointerup');
  editing = false;
  send('pointerdown');
  send('pointerup');
  expect(toggle).not.toHaveBeenCalled();
  stop();
});
