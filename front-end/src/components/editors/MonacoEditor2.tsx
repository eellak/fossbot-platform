import React, { useRef } from 'react'; // Import React
import MonacoEditor from '@monaco-editor/react';
import { editor } from 'monaco-editor';

type MonacoEditorProps = {
  code: string;
  handleGetValue: (getValueFunc: () => string) => void;
};

const MonacoEditorComponent2 = ({ code, handleGetValue }: MonacoEditorProps) => {
  // Type definition for useRef
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    handleGetValue(() => editorRef.current?.getValue() || '');
  };

  return (
    <MonacoEditor
      // height="90vh"
      language="python"
      theme="vs-dark"
      value={code}
      onMount={handleEditorDidMount}
    />
  );
};

export default MonacoEditorComponent2;
