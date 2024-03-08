import { BlocklyWorkspace } from 'react-blockly';

import Blockly from 'blockly';
import TOOLBOX_JSON_EN from '../../utils/toolboxBlockly/toolbox_en.ts';
import TOOLBOX_JSON_GR from '../../utils/toolboxBlockly/toolbox_gr.ts';

import { AppState } from 'src/store/Store';
import { useSelector, useDispatch } from 'src/store/Store';
import { Languages } from 'src/utils/languages/Languages.ts';
import { useCallback } from 'react';
import { pythonGenerator } from 'blockly/python';
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
  const onWorkspaceChange = useCallback(
    (xml: string) => {
      handleGetValue(() => xml);

      const pythonCode = pythonGenerator.workspaceToCode(Blockly.getMainWorkspace());
      handleGetPythonCodeValue(pythonCode);
    },
    [handleGetValue, handleGetPythonCodeValue],
  );

  const customizer = useSelector((state: AppState) => state.customizer);
  const currentLang =
    Languages.find((_lang) => _lang.value === customizer.isLanguage) || Languages[1];

  const toolboxJSON = currentLang.value == 'en' ? TOOLBOX_JSON_EN : TOOLBOX_JSON_GR;

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
