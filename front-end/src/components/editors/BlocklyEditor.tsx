import Blockly from 'blockly';
import TOOLBOX_JSON_EN from '../../utils/toolboxBlockly/toolbox_en.ts';
import TOOLBOX_JSON_GR from '../../utils/toolboxBlockly/toolbox_gr.ts';

import localeEl from 'blockly/msg/el';
import localeEn from 'blockly/msg/en';

import { BlocklyWorkspace } from 'react-blockly';
import { AppState } from 'src/store/Store';
import { useSelector } from 'src/store/Store';
import { Languages } from 'src/utils/languages/Languages.ts';
import { createContext, useCallback, useEffect } from 'react';
import { pythonGenerator } from 'blockly/python';
import { useTranslation } from 'react-i18next';

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

  const customizer = useSelector((state: AppState) => state.customizer);
  const currentLang =
    Languages.find((_lang) => _lang.value === customizer.isLanguage) || Languages[1];

  const toolboxJSON = currentLang.value == 'gr' ? TOOLBOX_JSON_GR : TOOLBOX_JSON_EN;

  currentLang.value == 'gr' ? Blockly.setLocale(localeEl) : Blockly.setLocale(localeEn);

  const onWorkspaceChange = useCallback(
    (xml: string) => {
      handleGetValue(() => xml);

      const pythonCode = pythonGenerator.workspaceToCode(Blockly.getMainWorkspace());
      handleGetPythonCodeValue(pythonCode);
    },
    [handleGetValue, handleGetPythonCodeValue],
  );

  useEffect(() => {
    const handleLanguageChange = () => {
      const currentLanguage = i18n.language;

      currentLanguage == 'gr' ? Blockly.setLocale(localeEl) : Blockly.setLocale(localeEn);

      const workspaceXml = Blockly.Xml.workspaceToDom(Blockly.getMainWorkspace(), true);
      Blockly.getMainWorkspace().clear()
      Blockly.Xml.domToWorkspace(workspaceXml, Blockly.getMainWorkspace());
    };

    // Subscribe to language change events
    i18n.on('languageChanged', handleLanguageChange);

    // Cleanup the subscription when the component is unmounted
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  return (
    <BlocklyWorkspace
      className={'blocklyDiv'}
      toolboxConfiguration={toolboxJSON}
      initialXml={code}
      onXmlChange={onWorkspaceChange}
    />
  );
};

export default BlocklyEditorComponent;
