import { Box } from '@mui/material';
import MonacoEditorComponent from 'src/components/editors/MonacoEditor';
import BlocklyEditorComponent from 'src/components/editors/BlocklyEditor';
import type { LessonEditorType, LessonWorkspace } from 'src/courses/types';

type Props = {
  editorType: LessonEditorType;
  content: LessonWorkspace['content'];
  onChange: (content: LessonWorkspace['content']) => void;
  onPythonChange: (code: string) => void;
};

const EMPTY_BLOCKLY = '<xml xmlns="https://developers.google.com/blockly/xml"></xml>';

export default function LessonEditor({ editorType, content, onChange, onPythonChange }: Props) {
  if (editorType === 'none') return null;
  return (
    <Box sx={{ height: '100%', minHeight: 360, overflow: 'hidden' }}>
      {editorType === 'python' ? (
        <MonacoEditorComponent code={typeof content === 'string' ? content : ''} handleGetValue={(getValue) => onChange(getValue())} />
      ) : (
        <BlocklyEditorComponent
          code={typeof content === 'object' && content && typeof content.xml === 'string' ? content.xml : EMPTY_BLOCKLY}
          handleGetValue={(getValue) => onChange({ xml: getValue() })}
          handleGetPythonCodeValue={(value) => onPythonChange(typeof value === 'function' ? value() : value)}
        />
      )}
    </Box>
  );
}
