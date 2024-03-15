import React, { useEffect, useState } from 'react';
import { useRef } from 'react';
import { Box } from '@mui/material';
import { io } from 'socket.io-client'; // Import Socket.IO

import styles from './GodotGame.module.css';

// Declare global types
declare global {
  interface Window {
    Engine: any;
    appsessionId: string;
    initGodotSocket: (ws_ip: string, ws_port: string, sio_namespace: string) => void;
    sendMessageFromGodot: (data: any, func: string, fossbot_name: string, user_id: string) => void;
    sendErrorFromGodot: (data: any, fossbot_name: string, user_id: string) => void;
    sendEnvMessageFromGodot: (data: any, user_id: string) => void;
  }
}


// Define props for WebGLApp component
type WebGLAppProps = {
  appsessionId: string; // Add sessionId to the props
};

const WebGLApp: React.FC<WebGLAppProps> = ({ appsessionId }) => {
  const engineRef = useRef(null); // Ref to store the engine instance
  const [scriptsLoaded, setScriptsLoaded] = useState(false);

  useEffect(() => {
    // Check if scripts have already been loaded
    if (!scriptsLoaded) {
      // Function to load script dynamically
      const loadScript = (src: string, onLoad: () => void, onError?: () => void) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = false; // Load synchronously
        script.defer = true; // Defer execution until the document has been parsed
        script.onload = onLoad;
        script.onerror = onError || (() => console.error(`Failed to load script at: ${src}`));
        document.body.appendChild(script);
        return script;
      };

      // Load index.js script
      const script1 = loadScript(
        '/index.js',
        () => {
          // Initialize the Godot Engine
          const GODOT_CONFIG = {
            args: [],
            canvasResizePolicy: 0,
            executable: 'index',
            experimentalVK: false,
            focusCanvas: true,
            unloadAfterInit: false,
            gdnativeLibs: [],
          };
          const engine = new window.Engine(GODOT_CONFIG);
          engineRef.current = engine;
        },
        () => {
          console.error('Failed to load index.js');
        },
      );

      // Load simulator.js script
      const script2 = loadScript(
        '/simulator.js',
        () => {
          // Ensure simulator.js has loaded
          const ws_port = '5000';
          const ws_ip = '127.0.0.1';
          const sio_namespace = '/godot';

          // Wrap the code inside a window 'load' event listener
          window.addEventListener('load', () => {
            const socket = io(`http://${ws_ip}:${ws_port}${sio_namespace}`);

            // Your code here
            console.log(socket);

            // Handle socket connection errors
            socket.on('connect_error', (error) => {
              console.error('Socket connection error:', error);
            });

            if (window.initGodotSocket) {
              window.initGodotSocket(ws_ip, ws_port, sio_namespace);
            } else {
              console.error('initGodotSocket is not defined');
            }
          });

          // Start the game engine
          engineRef.current
            .startGame()
            .then(() => {
              console.log('Game started');
            })
            .catch((error) => {
              console.error('Failed to start the game:', error);
            });
        },
        () => {
          console.error('Failed to load simulator.js');
        },
      );

      // Update state to indicate that scripts have been loaded
      setScriptsLoaded(true);

      // Clean-up function
      return () => {
        if (script1) document.body.removeChild(script1);
        if (script2) document.body.removeChild(script2);
      };
    }
  }, [scriptsLoaded]); // Include scriptsLoaded in the dependency array

  // Render the component
  return (
    <Box width={'100%'}>
      <div className={styles.godotGameContainer}>
        <canvas id="canvas">
          HTML5 canvas appears to be unsupported in the current browser.
          <br />
          Please try updating or use a different browser.
        </canvas>
        {/* Other HTML elements can be added here if needed */}
      </div>
    </Box>
  );
};

export default WebGLApp;
