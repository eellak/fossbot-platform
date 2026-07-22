import Blockly, { WorkspaceSvg } from 'blockly';
import TOOLBOX_JSON_EN from '../../utils/toolboxBlockly/toolbox_en.ts';
import TOOLBOX_JSON_GR from '../../utils/toolboxBlockly/toolbox_gr.ts';

import localeEl from 'blockly/msg/el';
import localeEn from 'blockly/msg/en';

import { BlocklyWorkspace } from 'react-blockly';
import { AppState } from 'src/store/Store';
import { useSelector } from 'src/store/Store';
import { Languages } from 'src/utils/languages/Languages.ts';
import { useCallback, useEffect, useMemo, useRef } from 'react';
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

const BlocklyEditorComponent = ({
  code,
  handleGetValue,
  handleGetPythonCodeValue,
}: BlocklyEditorProps) => {
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
    (xml: string) => {
      handleGetValue(() => xml);

      const pythonCode = customPythonGenerator.workspaceToCode(Blockly.getMainWorkspace());
      handleGetPythonCodeValue(pythonCode);
    },
    [customPythonGenerator, handleGetValue, handleGetPythonCodeValue],
  );

  const theme = customizer.activeMode === 'dark' ? DarkTheme : LightTheme;

  useEffect(() => {
    console.log('Current Color:', customizer.activeMode);

    const handleLanguageChange = () => {
      const currentLanguage = i18n.language;

      currentLanguage == 'gr' ? Blockly.setLocale(localeEl) : Blockly.setLocale(localeEn);

      const workspaceXml = Blockly.Xml.workspaceToDom(Blockly.getMainWorkspace(), true);
      Blockly.getMainWorkspace().clear();
      Blockly.Xml.domToWorkspace(workspaceXml, Blockly.getMainWorkspace());
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

  return (
    <BlocklyWorkspace
      className={`blocklyDiv ${customizer.activeMode === 'dark' ? 'blockly-theme-dark' : 'blockly-theme-light'}`}
      toolboxConfiguration={toolboxJSON}
      initialXml={code}
      onXmlChange={onWorkspaceChange}
      workspaceConfiguration={workspaceConfiguration}
      onInject={handleInject}
      onDispose={handleDispose}
    />
  );
};

export default BlocklyEditorComponent;
