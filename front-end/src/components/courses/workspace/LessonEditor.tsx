import { Box } from '@mui/material';
import MonacoEditorComponent, { type MonacoEditorHandle } from 'src/components/editors/MonacoEditor';
import BlocklyEditorComponent, { type BlocklyEditorHandle } from 'src/components/editors/BlocklyEditor';
import type { LessonEditorType, LessonWorkspace } from 'src/courses/types';
import type { RefObject } from 'react';

type Props = {
  editorType: LessonEditorType;
  content: LessonWorkspace['content'];
  onChange: (content: LessonWorkspace['content']) => void;
  onPythonChange: (code: string) => void;
  monacoRef?: RefObject<MonacoEditorHandle | null>;
  blocklyRef?: RefObject<BlocklyEditorHandle | null>;
};

const EMPTY_BLOCKLY = '<xml xmlns="https://developers.google.com/blockly/xml"></xml>';

export default function LessonEditor({ editorType, content, onChange, onPythonChange, monacoRef, blocklyRef }: Props) {
  if (editorType === 'none') return null;
  return (
    <Box sx={{ height: '100%', minHeight: 360, overflow: 'hidden' }}>
      {editorType === 'python' ? (
        <MonacoEditorComponent ref={monacoRef} code={typeof content === 'string' ? content : ''} handleGetValue={(getValue) => onChange(getValue())} />
      ) : (
        <BlocklyEditorComponent
          ref={blocklyRef}
          code={typeof content === 'object' && content && typeof content.xml === 'string' ? content.xml : EMPTY_BLOCKLY}
          handleGetValue={(getValue) => onChange({ xml: getValue() })}
          handleGetPythonCodeValue={(value) => onPythonChange(typeof value === 'function' ? value() : value)}
        />
      )}
    </Box>
  );
}
