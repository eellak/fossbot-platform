import React, { forwardRef, useRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import { AppState } from 'src/store/Store';
import { useSelector } from 'src/store/Store';

type MonacoEditorProps = {
  code: string;
  handleGetValue: (getValueFunc: () => string) => void;
};

export type MonacoEditorHandle = {
  getSource: () => string;
  getSelection: () => { text: string; startLine: number; startColumn: number; endLine: number; endColumn: number } | null;
  replaceSource: (source: string) => void;
  undo: () => void;
};

const MonacoEditorComponent = forwardRef<MonacoEditorHandle, MonacoEditorProps>(({ code, handleGetValue }, ref) => {
  const customizer = useSelector((state: AppState) => state.customizer);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    editor.setPosition({ lineNumber: 1, column: 1 });
    editor.setScrollPosition({ scrollTop: 0, scrollLeft: 0 });
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

  useImperativeHandle(ref, () => ({
    getSource: () => editorRef.current?.getValue() ?? code,
    getSelection: () => {
      const instance = editorRef.current;
      const selection = instance?.getSelection();
      const model = instance?.getModel();
      if (!selection || !model || selection.isEmpty()) return null;
      return {
        text: model.getValueInRange(selection),
        startLine: selection.startLineNumber,
        startColumn: selection.startColumn,
        endLine: selection.endLineNumber,
        endColumn: selection.endColumn,
      };
    },
    replaceSource: (source) => {
      const instance = editorRef.current;
      const model = instance?.getModel();
      if (!instance || !model) throw new Error('editor_unavailable');
      instance.pushUndoStop();
      instance.executeEdits('fossbot-buddy', [{ range: model.getFullModelRange(), text: source }]);
      instance.pushUndoStop();
      handleGetValue(() => instance.getValue());
    },
    undo: () => editorRef.current?.trigger('fossbot-buddy', 'undo', null),
  }), [code, handleGetValue]);

  return (
    <div style={containerStyle}>
      <MonacoEditor
        height="100%"
        language="python"
        theme={theme}
        value={code}
        saveViewState={false}
        onMount={handleEditorDidMount}
        onChange={handleEditorChange}
        options={{ automaticLayout: true, scrollBeyondLastLine: false }}
        className='monacoEditorComponent'
        
      />
    </div>
  );
});

MonacoEditorComponent.displayName = 'MonacoEditorComponent';

export default MonacoEditorComponent;
