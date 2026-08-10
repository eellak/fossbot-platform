import Blockly, { WorkspaceSvg } from 'blockly';
import TOOLBOX_JSON_EN from '../../utils/toolboxBlockly/toolbox_en.ts';
import TOOLBOX_JSON_GR from '../../utils/toolboxBlockly/toolbox_gr.ts';

import localeEl from 'blockly/msg/el';
import localeEn from 'blockly/msg/en';

import { BlocklyWorkspace } from 'react-blockly';
import { AppState } from 'src/store/Store';
import { useSelector } from 'src/store/Store';
import { Languages } from 'src/utils/languages/Languages.ts';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { pythonGenerator } from 'blockly/python';
import { useTranslation } from 'react-i18next';
import LightTheme from './LightTheme.js'; // Import the custom theme
import DarkTheme from './DarkTheme.js'; // Import the custom theme
import "../../utils/blocksBlockly/customBlocks.ts";
import './blockly.css';

type BlocklyEditorProps = {
  code: string;
  handleGetValue: (getValueFunc: () => string) => void;
  handleGetPythonCodeValue: (getValueFunc: () => string) => void;
};

export type BlocklyEditorHandle = {
  getXml: () => string;
  getGeneratedPython: () => string;
  getSelection: () => { ids: string[]; types: string[] };
  replaceWorkspace: (xml: string) => void;
  undo: () => void;
};

const BlocklyEditorComponent = forwardRef<BlocklyEditorHandle, BlocklyEditorProps>(({
  code,
  handleGetValue,
  handleGetPythonCodeValue,
}: BlocklyEditorProps, ref) => {
  const { i18n } = useTranslation();
  const workspaceRef = useRef<WorkspaceSvg | null>(null);

  const customizer = useSelector((state: AppState) => state.customizer);
  const currentLang =
    Languages.find((_lang) => _lang.value === customizer.isLanguage) || Languages[1];

  const toolboxJSON = currentLang.value == 'gr' ? TOOLBOX_JSON_GR : TOOLBOX_JSON_EN;

  currentLang.value == 'gr' ? Blockly.setLocale(localeEl) : Blockly.setLocale(localeEn);

  // Define the custom Python generator within the component
  const customPythonGenerator = useMemo(() => {
    const generator = Object.create(pythonGenerator);
    generator.workspaceToCode = function(workspace) {
      const generatedCode = pythonGenerator.workspaceToCode(workspace);
      return `import time\n${generatedCode}`;
    };
    return generator;
  }, []);

  const onWorkspaceChange = useCallback(
    (workspace: Blockly.WorkspaceSvg) => {
      workspaceRef.current = workspace;
      const pythonCode = customPythonGenerator.workspaceToCode(workspace);
      handleGetPythonCodeValue(() => pythonCode);
    },
    [customPythonGenerator, handleGetPythonCodeValue],
  );

  const onXmlChange = useCallback((xml: string) => handleGetValue(() => xml), [handleGetValue]);

  const theme = customizer.activeMode === 'dark' ? DarkTheme : LightTheme;

  useEffect(() => {
    const handleLanguageChange = () => {
      const currentLanguage = i18n.language;

      currentLanguage == 'gr' ? Blockly.setLocale(localeEl) : Blockly.setLocale(localeEn);

      const workspace = workspaceRef.current;
      if (!workspace) return;
      const workspaceXml = Blockly.Xml.workspaceToDom(workspace, true);
      workspace.clear();
      Blockly.Xml.domToWorkspace(workspaceXml, workspace);
    };

    // Subscribe to language change events
    i18n.on('languageChanged', handleLanguageChange);

    // Cleanup the subscription when the component is unmounted
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    workspace.setTheme(theme);
    Blockly.svgResize(workspace);
  }, [theme]);

  const workspaceConfiguration = useMemo(() => ({ theme }), [theme]);

  const handleInject = useCallback(
    (workspace: WorkspaceSvg) => {
      workspaceRef.current = workspace;
      workspace.setTheme(theme);
      Blockly.svgResize(workspace);
    },
    [theme],
  );

  const handleDispose = useCallback((workspace: WorkspaceSvg) => {
    if (workspaceRef.current === workspace) workspaceRef.current = null;
  }, []);

  useImperativeHandle(ref, () => ({
    getXml: () => {
      const workspace = workspaceRef.current;
      return workspace ? Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace, true)) : code;
    },
    getGeneratedPython: () => workspaceRef.current ? customPythonGenerator.workspaceToCode(workspaceRef.current) : '',
    getSelection: () => {
      const selected = Blockly.getSelected() as unknown as Blockly.Block | null;
      if (!selected || selected.workspace !== workspaceRef.current) return { ids: [], types: [] };
      return { ids: [selected.id], types: [selected.type] };
    },
    replaceWorkspace: (xml) => {
      const workspace = workspaceRef.current;
      if (!workspace) throw new Error('editor_unavailable');
      const dom = Blockly.utils.xml.textToDom(xml);
      Blockly.Events.setGroup(true);
      try {
        workspace.clear();
        Blockly.Xml.domToWorkspace(dom, workspace);
      } finally { Blockly.Events.setGroup(false); }
    },
    undo: () => workspaceRef.current?.undo(false),
  }), [code, customPythonGenerator]);

  return (
    <BlocklyWorkspace
      className={`blocklyDiv ${customizer.activeMode === 'dark' ? 'blockly-theme-dark' : 'blockly-theme-light'}`}
      toolboxConfiguration={toolboxJSON}
      initialXml={code}
      onWorkspaceChange={onWorkspaceChange}
      onXmlChange={onXmlChange}
      workspaceConfiguration={workspaceConfiguration}
      onInject={handleInject}
      onDispose={handleDispose}
    />
  );
});

BlocklyEditorComponent.displayName = 'BlocklyEditorComponent';

export default BlocklyEditorComponent;
