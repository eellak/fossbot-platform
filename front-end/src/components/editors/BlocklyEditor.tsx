import { BlocklyWorkspace } from 'react-blockly';
import { useState } from 'react';
import './blockly.css';
import TOOLBOX_JSON from "../../utils/toolboxBlockly/toolbox_en.ts";

const BlocklyEditorComponent: React.FC = () => {
  const [xml, setXml] = useState('<xml xmlns="http://www.w3.org/1999/xhtml"></xml>');
  return (
    <BlocklyWorkspace
      className={'blocklyDiv'} 
      toolboxConfiguration={TOOLBOX_JSON}
      initialXml={xml}
      onXmlChange={setXml}
    />
  );
};

export default BlocklyEditorComponent;
