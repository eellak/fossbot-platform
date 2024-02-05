import React, { useEffect } from 'react';
import { useRef } from 'react';
import {Box} from '@mui/material';
// import io from 'socket.io-client';
import styles from './GodotGame.module.css';

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

type WebGLAppProps = {
  appsessionId: string; // Add sessionId to the props
};

const WebGLApp: React.FC<WebGLAppProps> = ({ appsessionId }) => {

  const engineRef = useRef(null); // Ref to store the engine instance
  

  useEffect(() => {
    if (window.appsessionId == undefined){
      window.appsessionId = appsessionId;
    }
    const loadScript = (src: string, onLoad: () => void, onError?: () => void) => {
      
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = onLoad;
      script.onerror = onError || (() => console.error(`Failed to load script at: ${src}`));
      document.body.appendChild(script);
      return script;
    };
    let script2: HTMLScriptElement;

    let script3: HTMLScriptElement;

    const script1 = loadScript('/index.js', () => {
      // Initialize the Godot Engine
      const GODOT_CONFIG = {
        args: [],
        canvasResizePolicy: 0,
        executable: "index",
        experimentalVK: false,
        focusCanvas: true,
        unloadAfterInit: false,
        gdnativeLibs: [],    
    
      };
      const engine = new window.Engine(GODOT_CONFIG);
      engineRef.current = engine;

      

      script2 = loadScript('/simulator.js', () => {
        // Ensure simulator.js has loaded
        const ws_port = "5000";
        const ws_ip = "localhost";
        const sio_namespace = "/godot";


        script3 = loadScript('https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.0.1/socket.io.js', () => {
          // socket.io-client is now loaded
          if (window.initGodotSocket) {
            window.initGodotSocket(ws_ip, ws_port, sio_namespace);
          } else {
            console.error("initGodotSocket is not defined");
          }
        });

        engine.startGame().then(() => {
          console.log("Game started");
        }).catch((error) => {
          console.error("Failed to start the game:", error);
        });
      });
    });

    return () => {
      
      window.appsessionId = undefined;
      if (engineRef.current) {
        
        
        engineRef.current = null; // Clear the ref
      }
      //delete window.Engine;
      //delete window.Engine;

      if (script1) document.body.removeChild(script1);
      if (script2) document.body.removeChild(script2);
      if (script3) document.body.removeChild(script3);

      // Clean up
      //delete window.sessionId;
      // delete window.Engine;
      // document.body.removeChild(script1);
      // document.body.removeChild(script2);
      // document.body.removeChild(script3);
      // Remove script3 if needed
    };
  }, []);

  return (
    <Box width={'100%'}>

    <div className={styles.godotGameContainer}>
      <canvas id="canvas">
        HTML5 canvas appears to be unsupported in the current browser.<br />
        Please try updating or use a different browser.
      </canvas>
      {/* Other HTML elements can be added here if needed */}
    </div>
    </Box>
  );
};

export default WebGLApp;

