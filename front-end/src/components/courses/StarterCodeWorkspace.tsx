import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { IconRefresh, IconTestPipe } from '@tabler/icons-react';
import BlocklyEditor from 'src/components/editors/BlocklyEditor';
import MonacoEditor from 'src/components/editors/MonacoEditor';
import type { Lesson } from 'src/courses/types';

const EMPTY_BLOCKLY = '<xml xmlns="https://developers.google.com/blockly/xml"></xml>';

function blocklyXml(content: Lesson['starter_content']): string {
  return typeof content === 'object' && content && typeof content.xml === 'string' ? content.xml : EMPTY_BLOCKLY;
}

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export default function StarterCodeWorkspace({ lesson, onChange, t }: { lesson: Lesson; onChange: (patch: Partial<Lesson>) => void; t: any }) {
  const initial = useRef<{ lessonId: number; content: Lesson['starter_content'] }>({ lessonId: lesson.id, content: lesson.starter_content });
  const worker = useRef<Worker | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ valid: boolean; message?: string } | null>(null);
  const [generatedPython, setGeneratedPython] = useState('');

  if (initial.current.lessonId !== lesson.id) initial.current = { lessonId: lesson.id, content: lesson.starter_content };
  useEffect(() => () => worker.current?.terminate(), []);

  const serialized = useMemo(() => lesson.editor_type === 'python'
    ? (typeof lesson.starter_content === 'string' ? lesson.starter_content.replace(/\r\n/g, '\n') : '')
    : blocklyXml(lesson.starter_content), [lesson.editor_type, lesson.starter_content]);

  const testStarter = () => {
    setResult(null);
    if (lesson.editor_type === 'blockly') {
      setResult({ valid: serialized.includes('<xml') && serialized.includes('</xml>'), message: generatedPython.trim() ? undefined : t('education.code.emptyBlockly') });
      return;
    }
    setChecking(true);
    if (!worker.current) worker.current = new Worker(new URL('../../workers/pythonSyntaxWorker.ts', import.meta.url));
    worker.current.onmessage = (event: MessageEvent<{ valid: boolean; message?: string }>) => { setChecking(false); setResult(event.data); };
    worker.current.onerror = () => { setChecking(false); setResult({ valid: false, message: t('education.code.checkUnavailable') }); };
    worker.current.postMessage({ source: serialized });
  };

  const stageVersion = !lesson.stageReference
    ? t('education.stage.none')
    : lesson.stageReference.sourceType === 'default' || lesson.stageReference.commitSha
      ? t('education.stage.pinned')
      : t('education.stage.pinOnSave');

  return <Stack spacing={1.5}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
      <Box><Typography variant="subtitle2">{t('education.code.title')}</Typography><Typography variant="caption" color="text.secondary">{t('education.code.help')}</Typography></Box>
      <Stack direction="row" gap={1}>
        <Button size="small" startIcon={<IconRefresh size={16} />} onClick={() => onChange({ starter_content: initial.current.content ?? null })}>{t('education.code.reset')}</Button>
        <Button size="small" variant="contained" startIcon={checking ? <CircularProgress size={14} color="inherit" /> : <IconTestPipe size={16} />} disabled={checking} onClick={testStarter}>{t('education.code.test')}</Button>
      </Stack>
    </Stack>
    <Paper variant="outlined" sx={{ height: { xs: 420, md: 520 }, overflow: 'hidden' }}>
      {lesson.editor_type === 'python' ? <MonacoEditor code={serialized} handleGetValue={(getValue) => onChange({ starter_content: getValue().replace(/\r\n/g, '\n') })} /> : <BlocklyEditor code={serialized} handleGetValue={(getValue) => onChange({ starter_content: { xml: getValue() } })} handleGetPythonCodeValue={setGeneratedPython} />}
    </Paper>
    <Stack direction="row" gap={1} flexWrap="wrap"><Chip size="small" variant="outlined" label={t('education.code.fingerprint', { fingerprint: fingerprint(serialized) })} /><Chip size="small" variant="outlined" label={t('education.code.stageVersion', { status: stageVersion })} /></Stack>
    {result && <Alert severity={result.valid ? 'success' : 'error'}>{result.valid ? t('education.code.valid') : result.message || t('education.code.invalid')}</Alert>}
  </Stack>;
}
