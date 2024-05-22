import React, { useRef, useCallback, useEffect, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import { AppState } from 'src/store/Store';
import { useSelector } from 'src/store/Store';

type MonacoEditorProps = {
  code: string;
  handleGetValue: (getValueFunc: () => string) => void;
};

const MonacoEditorComponent = ({ code, handleGetValue }: MonacoEditorProps) => {
  const customizer = useSelector((state: AppState) => state.customizer);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    editor.focus(); // Set focus on the editor when it mounts
  };

  // New handler for editor changes
  const handleEditorChange = useCallback(() => {
    // Check if editorRef.current is not null before calling getValue
    if (editorRef.current) {
      const currentValue = editorRef.current.getValue();
      handleGetValue(() => currentValue);
    }
  }, [handleGetValue]); 

  const [theme, setTheme] = useState(customizer.activeMode === 'dark' ? 'vs-dark' : 'vs');

  useEffect(() => {
    const currentTheme = customizer.activeMode === 'light' ? 'vs' : 'vs-dark';
    setTheme(currentTheme);
  }, [customizer.activeMode]);

  const containerStyle = {
    border: theme === 'vs-dark' ? 'none' : '0.5px solid lightgray',
    height: '100%',
  };

  return (
    <div style={containerStyle}>
      <MonacoEditor
        height="100%"
        language="python"
        theme={theme}
        value={code}
        onMount={handleEditorDidMount}
        onChange={handleEditorChange}
        options={{ automaticLayout: true }}
      />
    </div>
  );
};

export default MonacoEditorComponent;
