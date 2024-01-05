import  { useEffect } from 'react';
import { Box } from '@mui/material';

const WebGLApp = () => {

  const loadScript = () => {
    
    const script = document.createElement('script');
    script.src = 'src/components/websimulator/index.js';
    script.async = false;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    }
  };

  useEffect(() => {
    const removeScript = loadScript();

    return () => {
      removeScript();
    };
  }, []); // Empty array ensures this runs once on mount and once on unmount

  return (
    <Box width={'100%'}>
      <canvas id='canvas' style={{ display: 'block', width: '100%', position: 'relative' }}>
        HTML5 canvas appears to be unsupported in the current browser.<br />
        Please try updating or use a different browser.
      </canvas>
      <div id='status'>
          <div id='status-progress' style={{ display: 'none' }} onContextMenu={(e) => e.preventDefault()}>
            <div id='status-progress-inner'></div>
          </div>
          <div id='status-indeterminate' style={{ display: 'none' }} onContextMenu={(e) => e.preventDefault()}></div>
          <div id='status-notice' className='godot' style={{ display: 'none' }}></div>
      </div>
      </Box>
  );
};

export default WebGLApp;