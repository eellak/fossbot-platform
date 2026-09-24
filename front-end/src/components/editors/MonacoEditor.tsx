import React, { forwardRef, useRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import MonacoEditor, { type Monaco } from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import { alpha, useTheme } from '@mui/material/styles';
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

// Monaco's Color.fromHex falls back to red for anything that is not #RRGGBB(AA), so
// convert the theme's rgba() thumb colour before handing it to defineTheme.
function toHex8(rgba: string): string {
  const match = rgba.match(/rgba?\(([^)]+)\)/);
  if (!match) return rgba;
  const [r, g, b, a = '1'] = match[1].split(',').map((part) => part.trim());
  const channel = (value: string) => Math.round(parseFloat(value)).toString(16).padStart(2, '0');
  const alphaHex = Math.round(parseFloat(a) * 255).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}${alphaHex}`;
}

const MonacoEditorComponent = forwardRef<MonacoEditorHandle, MonacoEditorProps>(({ code, handleGetValue }, ref) => {
  const customizer = useSelector((state: AppState) => state.customizer);
  const muiTheme = useTheme();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // Keep Monaco's scrollbar on the shared thin, low-contrast treatment.
  const scrollThumb = toHex8(alpha(muiTheme.palette.text.primary, muiTheme.palette.mode === 'dark' ? 0.28 : 0.26));
  const scrollThumbHover = toHex8(alpha(muiTheme.palette.text.primary, muiTheme.palette.mode === 'dark' ? 0.5 : 0.45));
  const scrollThumbActive = toHex8(alpha(muiTheme.palette.text.primary, muiTheme.palette.mode === 'dark' ? 0.62 : 0.55));

  const handleBeforeMount = useCallback((monaco: Monaco) => {
    const colors = {
      'scrollbarSlider.background': scrollThumb,
      'scrollbarSlider.hoverBackground': scrollThumbHover,
      'scrollbarSlider.activeBackground': scrollThumbActive,
    };
    monaco.editor.defineTheme('fossbot-light', { base: 'vs', inherit: true, rules: [], colors });
    monaco.editor.defineTheme('fossbot-dark', { base: 'vs-dark', inherit: true, rules: [], colors });
  }, [scrollThumb, scrollThumbHover, scrollThumbActive]);

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

  const [theme, setTheme] = useState(customizer.activeMode === 'dark' ? 'fossbot-dark' : 'fossbot-light');

  useEffect(() => {
    setTheme(customizer.activeMode === 'dark' ? 'fossbot-dark' : 'fossbot-light');
  }, [customizer.activeMode]);

  const containerStyle = {
    border: theme === 'fossbot-dark' ? 'none' : '0.5px solid lightgray',
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
        beforeMount={handleBeforeMount}
        onChange={handleEditorChange}
        options={{ automaticLayout: true, scrollBeyondLastLine: false, scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false } }}
        className='monacoEditorComponent'
        
      />
    </div>
  );
});

MonacoEditorComponent.displayName = 'MonacoEditorComponent';

export default MonacoEditorComponent;
