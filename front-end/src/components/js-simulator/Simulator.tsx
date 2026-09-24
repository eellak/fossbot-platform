import { Box } from '@mui/material';
import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import { scene, camera, renderer } from './scene.js';
import { ambientLight, directionalLight } from './environment_lights.js';
import { plane, updateTexture} from './floor_loader.js';
import { loadBaseObject } from './robot_loader.js';
import { startAnimation, stopAnimation, stopMotion, moveStep, rotateStep, controls, rgb_set_color, changeCamera, just_rotate, just_move, rc_drive, drawLine } from './animate.js';
import { loadObjectsFromJSON, robot_position } from './stage_loader.js';
import { get_distance, get_acceleration, get_gyroscope, get_floor_sensor, get_light_sensor, traceLine } from './sensors.js';
import CardDialog from 'src/components/stage-select-popup/CardDialog'; // Import the CardDialog component
import SimulatorControlsOverlay from './SimulatorControlsOverlay';

type WebGLAppProps = {
  appsessionId: string;
  onMountChange: (isMounted: boolean) => void;
  showControls?: boolean;
  allowStageSelection?: boolean;
};

export type LegacySimulatorControlHandle = {
  resetStage: () => void;
  changeCamera: () => void;
  openStageSelection: () => void;
};

const WebGLApp = forwardRef<LegacySimulatorControlHandle, WebGLAppProps>(({ onMountChange, showControls = true, allowStageSelection = true }, ref) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [currentURL, setCurrentURL] = useState('/js-simulator/stages/stage_white_rect.json');

  useEffect(() => {
    const currentMountRef = mountRef.current;

    resetScene(currentURL);

    

    const handleResize = () => {
      if (currentMountRef) {
        const { clientWidth, clientHeight } = currentMountRef;
        renderer.setSize(clientWidth, clientHeight);
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
      }
    };

    if (currentMountRef) {
      handleResize();
      currentMountRef.appendChild(renderer.domElement);
    }

    
    window.addEventListener('resize', handleResize);

    startAnimation();

    return () => {
      if (currentMountRef) {
        currentMountRef.removeChild(renderer.domElement);
      }
      window.removeEventListener('resize', handleResize);
      stopAnimation();
    };
  }, [currentURL]);

  const handleForward = async () => {
    await moveStep(-0.4);
  };

  const handleBackward = async () => {
    await moveStep(0.4);
  };

  const handleRotateLeft = async () => {
    await rotateStep(0.0174533 * 10);
  };

  const handleRotateRight = async () => {
    await rotateStep(-0.0174533 * 10);
  };

  const handleStop = () => {
    stopMotion();
  };

  const handleCamera = () => {
    changeCamera();
  };

 


   // New state for dialog
   const [openDialog, setOpenDialog] = useState(false);

  // Dialog handler functions
  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleCardSelect = (url: string) => {
    
    setCurrentURL(url);
    setOpenDialog(false); // Close the dialog after selecting a card
  };

  const resetScene = (currentURL: string) => {
    while (scene.children.length > 0) {
      scene.remove(scene.children[0]);
      rgb_set_color('off');
      drawLine(false);
    }
  
    ambientLight.name = 'ambientLight';
    scene.add(ambientLight);
    directionalLight.name = 'directionalLight';
    scene.add(directionalLight);
  
    scene.add(traceLine);
  
    loadObjectsFromJSON(currentURL, scene);
  
    loadBaseObject(scene);
  };

  useImperativeHandle(ref, () => ({
    resetStage: () => resetScene(currentURL),
    changeCamera,
    openStageSelection: handleOpenDialog,
  }), [currentURL]);

  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100%" width="100%" position="relative" overflow="hidden">
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      {showControls && <SimulatorControlsOverlay onForward={handleForward} onBackward={handleBackward} onTurnLeft={handleRotateLeft} onTurnRight={handleRotateRight} onChangeCamera={handleCamera} />}
      {allowStageSelection && <CardDialog open={openDialog} onClose={handleCloseDialog} onSelect={handleCardSelect} />}
    </Box>
  );
});

export { WebGLApp, moveStep, rotateStep, stopMotion, get_distance, rgb_set_color, get_acceleration, get_gyroscope, get_floor_sensor, just_move, just_rotate, rc_drive, get_light_sensor, drawLine};
