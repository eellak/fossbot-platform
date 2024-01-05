import React, { useRef,useCallback } from 'react'; // Import React
import MonacoEditor from '@monaco-editor/react';
import { editor } from 'monaco-editor';

type MonacoEditorProps = {
  code: string;
  handleGetValue: (getValueFunc: () => string) => void;
};

const MonacoEditorComponent = ({ code, handleGetValue }: MonacoEditorProps) => {

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
  };

  // New handler for editor changes
  const handleEditorChange = useCallback(() => {
    // Check if editorRef.current is not null before calling getValue
    if (editorRef.current) {
      const currentValue = editorRef.current.getValue();
      handleGetValue(() => currentValue);
    }
  }, [handleGetValue]);

  return (
    <MonacoEditor
      height="90vh"
      language="python"
      theme="vs-dark"
      value={code}
      onMount={handleEditorDidMount}
      onChange={handleEditorChange} 
    />
  );
};

export default MonacoEditorComponent;
