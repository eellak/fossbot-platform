import { BlocklyWorkspace } from 'react-blockly';
import './blockly.css';
import TOOLBOX_JSON from '../../utils/toolboxBlockly/toolbox_en.ts';
import { useCallback } from 'react';

import Blockly from 'blockly';
import { pythonGenerator } from 'blockly/python';

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

  return (
    <BlocklyWorkspace
      className={'blocklyDiv'}
      toolboxConfiguration={TOOLBOX_JSON}
      initialXml={code}
      onXmlChange={onWorkspaceChange}
    />
  );
};

export default BlocklyEditorComponent;
