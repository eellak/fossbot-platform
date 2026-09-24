import { Box } from '@mui/material';
import type { RefObject } from 'react';
import MonacoEditorComponent, { type MonacoEditorHandle } from 'src/components/editors/MonacoEditor';

type PythonWorkspaceEditorProps = {
  code: string;
  onChange: (code: string) => void;
  editorRef?: RefObject<MonacoEditorHandle | null>;
};

export default function PythonWorkspaceEditor({ code, onChange, editorRef }: PythonWorkspaceEditorProps) {
  return (
    <Box sx={{ height: '100%', minHeight: 360, overflow: 'hidden' }}>
      <MonacoEditorComponent ref={editorRef} code={code} handleGetValue={(getValue) => onChange(getValue())} />
    </Box>
  );
}
