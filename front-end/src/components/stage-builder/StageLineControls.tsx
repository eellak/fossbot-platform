import React, { useRef } from 'react';
import { Alert, Button, Checkbox, FormControlLabel, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { evaluateLineGeometry } from '../../simulator/stages/lineGeometryCore';
import { canCloseLine, closeLine, insertLinePoint, moveLinePoint, removeLinePoint, setLineCorner, type LineOperation } from './stageBuilderLineEditing';
import { StageBuilderNumberField } from './StageBuilderNumberField';
import type { EditorLineObject } from './types';

export type LineEditorActions = {
  lineOperation?: LineOperation;
  onLineOperationChange?: (operation: LineOperation) => void;
  onDeleteLine?: (id: string) => void;
  onLinePreview?: (line: EditorLineObject | null) => void;
};

export function StageLineControls({ line, onChange, lineOperation, onLineOperationChange, onDeleteLine, onLinePreview }: LineEditorActions & { line: EditorLineObject; onChange: (line: EditorLineObject) => void }) {
  const pointSelector = useRef<{ focus: () => void } | null>(null);
  const editing = lineOperation?.mode === 'edit' && lineOperation.pathId === line.id;
  const index = Math.min(editing ? lineOperation.pointIndex ?? line.points.length - 1 : line.points.length - 1, line.points.length - 1);
  const point = line.points[index];
  const evaluated = evaluateLineGeometry(line);
  const locked = !!line.locked;
  const corner = line.corners?.[index] ?? { mode: 'sharp' as const };
  const hasCorner = line.closed || (index > 0 && index < line.points.length - 1);
  const requested = corner.mode === 'rounded' && corner.sizing === 'manual' ? corner.trim : evaluated.requestedTrims[index] || 0;
  const effective = evaluated.effectiveTrims[index] || 0;
  const automatic = corner.mode === 'rounded' && corner.sizing === 'auto';
  const select = (nextIndex: number) => onLineOperationChange?.({ mode: 'edit', pathId: line.id, pointIndex: nextIndex });
  const remove = () => {
    const next = removeLinePoint(line, index);
    if (!next) onDeleteLine?.(line.id);
    else { onChange(next); select(Math.min(index, next.points.length - 1)); }
    requestAnimationFrame(() => {
      if (next) pointSelector.current?.focus();
      else (document.querySelector('[aria-label="Search hierarchy"]') as HTMLElement | null)?.focus();
    });
  };
  return <Stack spacing={1.5} sx={{ minWidth: 0, width: '100%' }}>
    <Stack direction="row" spacing={1} alignItems="center">
      <StageBuilderNumberField size="small" label="Width (m)" disabled={locked} value={line.width} sx={{ flex: 1, minWidth: 0 }} inputProps={{ 'aria-label': 'Line width (m)', min: 0.001, step: 0.01 }} onValuePreview={value => onLinePreview?.(value === null ? null : { ...line, width: value })} onChange={event => {
        const width = Number(event.target.value);
        if (Number.isFinite(width) && width > 0) onChange({ ...line, width });
      }} />
      <Button size="small" disabled={!editing && locked} onClick={() => editing ? onLineOperationChange?.({ mode: 'select' }) : select(index)} sx={{ flexShrink: 0 }}>{editing ? 'Done' : 'Edit line'}</Button>
    </Stack>
    {evaluated.diagnostics.map(diagnostic => <Alert key={`${diagnostic.code}:${diagnostic.pointIndex}`} severity={diagnostic.severity === 'notice' ? 'info' : 'error'}>{diagnostic.message}</Alert>)}
    <Stack direction="row" spacing={0.5} alignItems="center">
      <IconButton size="small" aria-label="Previous point" disabled={index === 0} onClick={() => select(index - 1)}><ChevronLeftIcon /></IconButton>
      <TextField select size="small" label="Point" value={index} inputRef={pointSelector} SelectProps={{ inputProps: { 'aria-label': 'Selected point' }, renderValue: value => `${Number(value) + 1} of ${line.points.length}` }} onChange={event => select(Number(event.target.value))} sx={{ flex: 1, minWidth: 0 }}>
        {line.points.map((_, i) => <MenuItem key={i} value={i}>Point {i + 1}</MenuItem>)}
      </TextField>
      <IconButton size="small" aria-label="Next point" disabled={index === line.points.length - 1} onClick={() => select(index + 1)}><ChevronRightIcon /></IconButton>
    </Stack>
    <Stack key={`${line.id}:${index}`} spacing={1.5}>
      <Stack direction="row" spacing={1}>
        {(['X', 'Z'] as const).map((axis, coordinate) => <StageBuilderNumberField key={axis} size="small" axis={axis} disabled={locked} value={point[coordinate]} sx={{ flex: 1, minWidth: 0 }} inputProps={{ 'aria-label': `Point ${index + 1} ${axis}`, step: 0.1 }} onValuePreview={value => onLinePreview?.(value === null ? null : moveLinePoint(line, index, coordinate === 0 ? [value, point[1]] : [point[0], value]))} onChange={event => {
          const value = Number(event.target.value);
          if (Number.isFinite(value)) onChange(moveLinePoint(line, index, coordinate === 0 ? [value, point[1]] : [point[0], value]));
        }} />)}
      </Stack>
      {hasCorner && <Stack spacing={0.75}>
        <TextField select size="small" label="Corner" value={corner.mode} disabled={locked} SelectProps={{ inputProps: { 'aria-label': `Point ${index + 1} corner` } }} onChange={event => onChange(setLineCorner(line, index, event.target.value === 'sharp' ? { mode: 'sharp' } : { mode: 'rounded', sizing: 'auto' }))}>
          <MenuItem value="sharp">Sharp</MenuItem><MenuItem value="rounded">Rounded</MenuItem>
        </TextField>
        {corner.mode === 'rounded' && <Stack direction="row" spacing={1} alignItems="center">
          <StageBuilderNumberField size="small" label="Rounding (m)" disabled={locked || automatic} value={requested} displayPrecision={4} sx={{ flex: 1, minWidth: 0 }} inputProps={{ min: 0.001, step: 0.001, 'aria-label': `Point ${index + 1} rounding (m)` }} onValuePreview={value => onLinePreview?.(value === null || value <= 0 ? null : setLineCorner(line, index, { mode: 'rounded', sizing: 'manual', trim: value }))} onChange={event => {
            const trim = Number(event.target.value);
            if (Number.isFinite(trim) && trim > 0 && trim !== requested) onChange(setLineCorner(line, index, { mode: 'rounded', sizing: 'manual', trim }));
          }} />
          <FormControlLabel label="Auto" control={<Checkbox size="small" checked={automatic} disabled={locked} inputProps={{ 'aria-label': `Point ${index + 1} automatic rounding` }} onChange={event => onChange(setLineCorner(line, index, event.target.checked ? { mode: 'rounded', sizing: 'auto' } : { mode: 'rounded', sizing: 'manual', trim: Math.max(0.001, requested) }))} />} />
        </Stack>}
        {corner.mode === 'rounded' && effective < requested && <Tooltip title="Nearby sections limit the rounding. Your requested size returns when there is enough room." disableInteractive>
          <Typography variant="caption" role="status" tabIndex={0}>Limited to {effective.toLocaleString(undefined, { maximumFractionDigits: 4 })} m</Typography>
        </Tooltip>}
      </Stack>}
    </Stack>
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Add a point at the end of the path" disableInteractive>
        <span><Button size="small" startIcon={<AddIcon />} disabled={locked} onClick={() => {
          const end = line.points[line.points.length - 1];
          onChange(insertLinePoint(line, line.points.length, [end[0] + 0.1, end[1]]));
          select(line.points.length);
        }}>Add point</Button></span>
      </Tooltip>
      {canCloseLine(line, index, index === 0 ? line.points.length - 1 : 0) && <Button size="small" onClick={() => onChange(closeLine(line))}>Close loop</Button>}
      <Tooltip title={line.points.length === 1 ? 'Delete path' : 'Remove selected point'} disableInteractive>
        <span style={{ marginLeft: 'auto' }}><IconButton size="small" disabled={locked} aria-label={line.points.length === 1 ? 'Delete path' : `Remove point ${index + 1}`} onClick={remove}><DeleteOutlineIcon fontSize="small" /></IconButton></span>
      </Tooltip>
    </Stack>
  </Stack>;
}
