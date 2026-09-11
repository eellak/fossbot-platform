import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { IconRefresh, IconTestPipe } from '@tabler/icons-react';
import BlocklyEditor, { type BlocklyEditorHandle } from 'src/components/editors/BlocklyEditor';
import MonacoEditor, { type MonacoEditorHandle } from 'src/components/editors/MonacoEditor';
import type { Lesson } from 'src/courses/types';
import AssistantPanel, { type AssistantSurfaceAdapter } from 'src/components/ai/AssistantPanel';
import { fingerprintText } from 'src/ai/fingerprint';
import { allowedBlocklyBlockTypes, previewPythonSuggestion, validateBlocklySuggestion } from 'src/ai/suggestions/codeSuggestions';

const EMPTY_BLOCKLY = '<xml xmlns="https://developers.google.com/blockly/xml"></xml>';

function blocklyXml(content: Lesson['starter_content']): string {
  return typeof content === 'object' && content && typeof content.xml === 'string' ? content.xml : EMPTY_BLOCKLY;
}

export default function StarterCodeWorkspace({ lesson, onChange, t }: { lesson: Lesson; onChange: (patch: Partial<Lesson>) => void; t: any }) {
  const initial = useRef<{ lessonId: number; content: Lesson['starter_content'] }>({ lessonId: lesson.id, content: lesson.starter_content });
  const worker = useRef<Worker | null>(null);
  const monacoRef = useRef<MonacoEditorHandle | null>(null);
  const blocklyRef = useRef<BlocklyEditorHandle | null>(null);
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

  const assistantAdapter: AssistantSurfaceAdapter = lesson.editor_type === 'python' ? {
    surface: 'python',
    getFingerprint: () => fingerprintText(monacoRef.current?.getSource() ?? serialized),
    getContext: async () => {
      const source = monacoRef.current?.getSource() ?? serialized;
      return {
        source,
        sourceFingerprint: await fingerprintText(source),
        selection: monacoRef.current?.getSelection()?.text || '',
        editorType: 'python',
        lessonObjective: lesson.title,
        stageSummary: lesson.stageReference ? { title: lesson.stageReference.title || '', sourceType: lesson.stageReference.sourceType, revision: lesson.stageReference.commitSha || '' } : {},
      };
    },
    previewSuggestion: async (suggestion) => {
      if (suggestion.type !== 'python_replace') throw new Error('invalid_suggestion');
      return previewPythonSuggestion(suggestion, monacoRef.current?.getSource() ?? serialized);
    },
    applySuggestion: async (suggestion) => {
      if (suggestion.type !== 'python_replace') throw new Error('invalid_suggestion');
      monacoRef.current?.replaceSource(suggestion.replacement);
    },
  } : {
    surface: 'blockly',
    getFingerprint: () => fingerprintText(blocklyRef.current?.getXml() ?? serialized),
    getContext: async () => {
      const xml = blocklyRef.current?.getXml() ?? serialized;
      const selection = blocklyRef.current?.getSelection() || { ids: [], types: [] };
      return {
        xml,
        workspaceFingerprint: await fingerprintText(xml),
        selectedBlockIds: selection.ids,
        selectedBlockTypes: selection.types,
        generatedPython: (blocklyRef.current?.getGeneratedPython() ?? generatedPython).slice(0, 8000),
        allowedBlockTypes: allowedBlocklyBlockTypes(),
        editorType: 'blockly',
        lessonObjective: lesson.title,
        stageSummary: lesson.stageReference ? { title: lesson.stageReference.title || '', sourceType: lesson.stageReference.sourceType, revision: lesson.stageReference.commitSha || '' } : {},
      };
    },
    previewSuggestion: async (suggestion) => {
      if (suggestion.type !== 'blockly_replace') throw new Error('invalid_suggestion');
      return validateBlocklySuggestion(suggestion, blocklyRef.current?.getXml() ?? serialized);
    },
    applySuggestion: async (suggestion) => {
      if (suggestion.type !== 'blockly_replace') throw new Error('invalid_suggestion');
      blocklyRef.current?.replaceWorkspace(suggestion.xml);
    },
  };

  return <Stack spacing={1.5}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
      <Box><Typography variant="subtitle2">{t('education.code.title')}</Typography><Typography variant="caption" color="text.secondary">{t('education.code.help')}</Typography></Box>
      <Stack direction="row" gap={1}>
        <Button size="small" startIcon={<IconRefresh size={16} />} onClick={() => onChange({ starter_content: initial.current.content ?? null })}>{t('education.code.reset')}</Button>
        <Button size="small" variant="contained" startIcon={checking ? <CircularProgress size={14} color="inherit" /> : <IconTestPipe size={16} />} disabled={checking} onClick={testStarter}>{t('education.code.test')}</Button>
      </Stack>
    </Stack>
    <Paper variant="outlined" sx={{ height: { xs: 420, md: 520 }, overflow: 'hidden' }}>
      {lesson.editor_type === 'python' ? <MonacoEditor ref={monacoRef} code={serialized} handleGetValue={(getValue) => onChange({ starter_content: getValue().replace(/\r\n/g, '\n') })} /> : <BlocklyEditor ref={blocklyRef} code={serialized} handleGetValue={(getValue) => onChange({ starter_content: { xml: getValue() } })} handleGetPythonCodeValue={setGeneratedPython} />}
    </Paper>
    <AssistantPanel key={`${lesson.id}:${lesson.editor_type}`} adapter={assistantAdapter} explainCapability={lesson.editor_type === 'python' ? 'code.explain' : 'blockly.explain'} suggestCapability={lesson.editor_type === 'python' ? 'code.suggest_changes' : 'blockly.suggest_changes'} />
    <Chip size="small" variant="outlined" label={t('education.code.stageVersion', { status: stageVersion })} sx={{ alignSelf: 'flex-start' }} />
    {result && <Alert severity={result.valid ? 'success' : 'error'}>{result.valid ? t('education.code.valid') : result.message || t('education.code.invalid')}</Alert>}
  </Stack>;
}
