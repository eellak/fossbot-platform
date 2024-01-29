import { useEffect, useState } from 'react';
import { Box } from '@mui/material';

type WebGLAppProps = {
  sessionId: string;
  onMountChange: (isMounted: boolean) => void;
};

const WebGLApp: React.FC<WebGLAppProps> = ({ sessionId, onMountChange }) => {
  // const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  // useEffect(() => {
  //   if (!window.myWebGLAppScriptLoaded) {
  //     const script = document.createElement('script');
  //     script.src = 'src/components/websimulator/index.js';
  //     script.async = true;
  //     script.onload = () => {
  //       window.myWebGLAppScriptLoaded = true;
  //       setIsScriptLoaded(true);
  //     };
  //     document.body.appendChild(script);
  //   } else {
  //     setIsScriptLoaded(true);
  //   }

  //   return () => {
  //     // Cleanup logic if necessary
  //   };
  // }, []);

  const handleIframeLoad = () => {
    onMountChange(true); // Call the callback function with the updated value
  };

  const SimUrl = 'http://localhost:5000/' + sessionId;
  return (
    <Box width={'100%'}>
      <iframe
        src={SimUrl}
        width={'100%'}
        height={'370px'}
        frameBorder="0"
        allowFullScreen
        onLoad={handleIframeLoad}
      ></iframe>
      {/* {isScriptLoaded && (
        <canvas id='canvas' style={{ display: 'block', width: '100%', position: 'relative' }}>
          HTML5 canvas appears to be unsupported in the current browser.<br />
          Please try updating or use a different browser.
        </canvas>
      )}
      Status elements */}
    </Box>
  );
};

export default WebGLApp;
