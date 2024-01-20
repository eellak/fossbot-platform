import { BlocklyWorkspace } from 'react-blockly';
import { useState } from 'react';
import './blockly.css';
import TOOLBOX_JSON from "../../utils/toolboxBlockly/toolbox_en.ts";
import { useCallback } from 'react';
 
type BlocklyEditorProps = {
  code: string;
  handleGetValue: (getValueFunc: () => string) => void;
};

const BlocklyEditorComponent = ({ code, handleGetValue }: BlocklyEditorProps) => {
  
  const onWorkspaceChange = useCallback((xml: string) => {
    handleGetValue(() => xml);
  }, [handleGetValue]);

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
