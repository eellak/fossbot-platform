import { Box, Button, Grid, Slider, useMediaQuery } from '@mui/material';
import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import { scene, camera, renderer } from './scene.js';
import { ambientLight, directionalLight } from './environment_lights.js';
import { plane, updateTexture} from './floor_loader.js';
import { loadBaseObject } from './robot_loader.js';
import { startAnimation, stopAnimation, stopMotion, moveStep, rotateStep, controls, rgb_set_color, changeCamera, just_rotate, just_move, drawLine } from './animate.js';
import { loadObjectsFromJSON, robot_position } from './stage_loader.js';
import { faMap, faArrowUp, faArrowDown, faArrowLeft, faArrowRight, faBinoculars, faLightbulb, faRefresh } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { get_distance, get_acceleration, get_gyroscope, get_floor_sensor, get_light_sensor, traceLine } from './sensors.js';
import * as THREE from 'three';
import CardDialog from 'src/components/stage-select-popup/CardDialog'; // Import the CardDialog component

type WebGLAppProps = {
  appsessionId: string;
  onMountChange: (isMounted: boolean) => void;
};





const WebGLApp = forwardRef(({ appsessionId, onMountChange }: WebGLAppProps, ref) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [lightIntensity, setLightIntensity] = useState(100);
  const [currentURL, setCurrentURL] = useState('/js-simulator/stages/stage_white_rect.json');

  useImperativeHandle(ref, () => ({

    setDirectionalLightIntensity: (intensity: number) => {
      changeDirectionalLightIntensity(intensity);
    }
  }));

  const changeDirectionalLightIntensity = (intensity: number) => {
    const scaledIntensity = THREE.MathUtils.clamp(intensity / 100, 0, 1);
    directionalLight.intensity = scaledIntensity;
    ambientLight.intensity = scaledIntensity;
  };

  const handleLightIntensityChange = (event: Event, newValue: number | number[]) => {
    const intensity = Array.isArray(newValue) ? newValue[0] : newValue;
    setLightIntensity(intensity);
    changeDirectionalLightIntensity(intensity);
  };

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



  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100%" width="100%">
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      <Box mt={2} width="100%">
        <Grid container spacing={2} justifyContent="center">
          <Grid item>
            <Button variant="contained" color="primary" onClick={handleForward}>
              <FontAwesomeIcon icon={faArrowUp} size="2x" />
            </Button>
          </Grid>
          <Grid item>
            <Button variant="contained" color="primary" onClick={handleBackward}>
              <FontAwesomeIcon icon={faArrowDown} size="2x" />
            </Button>
          </Grid>
          <Grid item>
            <Button variant="contained" color="primary" onClick={handleRotateLeft}>
              <FontAwesomeIcon icon={faArrowLeft} size="2x" />
            </Button>
          </Grid>
          <Grid item>
            <Button variant="contained" color="primary" onClick={handleRotateRight}>
              <FontAwesomeIcon icon={faArrowRight} size="2x" />
            </Button>
          </Grid>
          <Grid item>
            <Button variant="contained" color="secondary" onClick={handleCamera}>
              <FontAwesomeIcon icon={faBinoculars} size="2x" />
            </Button>
          </Grid>
          <Grid item>
            <Button variant="contained" color="warning" onClick={() => resetScene(currentURL)}>
              <FontAwesomeIcon icon={faRefresh} size="2x" />
            </Button>
          </Grid>
          <Grid item>
            <Button variant="contained" color="success" onClick={handleOpenDialog}>
              <FontAwesomeIcon icon={faMap} size="2x" />
            </Button>
          </Grid>
        </Grid>
      </Box>
      <Box mt={2} width="80%">
        <Grid container spacing={2} alignItems="center" justifyContent="center">
          <Grid item>
            <FontAwesomeIcon icon={faLightbulb} size="2x" color='primary' />
          </Grid>
          <Grid item xs>
            <Slider
              value={lightIntensity}
              onChange={handleLightIntensityChange}
              aria-labelledby="directional-light-slider"
              min={0}
              max={100}
              sx={{ width: '100%' }}
            />
          </Grid>
        </Grid>
      </Box>
      <CardDialog  open={openDialog} onClose={handleCloseDialog} onSelect={handleCardSelect} />
    </Box>
  );
});

export { WebGLApp, moveStep, rotateStep, stopMotion, get_distance, rgb_set_color, get_acceleration, get_gyroscope, get_floor_sensor, just_move, just_rotate, get_light_sensor, drawLine};
