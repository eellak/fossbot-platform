import { Box, Button, Grid, Slider, useMediaQuery } from '@mui/material';
import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import { scene, camera, renderer } from './scene.js';
import { ambientLight, directionalLight } from './environment_lights.js';
import { plane, updateTexture } from './floor_loader.js';
import { loadBaseObject } from './robot_loader.js';
import { startAnimation, stopAnimation, stopMotion, moveStep, rotateStep, controls, rgb_set_color, changeCamera, just_rotate, just_move, drawLine } from './animate.js';
import { loadObjectsFromJSON } from './stage_loader.js';
import { faArrowUp, faArrowDown, faArrowLeft, faArrowRight, faBinoculars, faLightbulb, faRefresh } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { get_distance, get_acceleration, get_gyroscope, get_floor_sensor, get_light_sensor, traceLine } from './sensors.js';
import * as THREE from 'three';

type WebGLAppProps = {
  appsessionId: string;
  onMountChange: (isMounted: boolean) => void;
};

const WebGLApp = forwardRef(({ appsessionId, onMountChange }: WebGLAppProps, ref) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [lightIntensity, setLightIntensity] = useState(100); // Default to 50

  useImperativeHandle(ref, () => ({
    resetWorld: () => {
      resetScene();
    },
    setDirectionalLightIntensity: (intensity: number) => {
      changeDirectionalLightIntensity(intensity);
    }
  }));

  const resetScene = () => {
    // Remove all objects from the scene
    while (scene.children.length > 0) {
      scene.remove(scene.children[0]);
    }

    // Re-add lights
    ambientLight.name = 'ambientLight';
    scene.add(ambientLight);
    directionalLight.name = 'directionalLight';
    scene.add(directionalLight);

    // Re-add the plane
    plane.name = 'plane';
    scene.add(plane);
    scene.add(traceLine);

    // Re-load the base object
    loadBaseObject(scene);

    // Re-load objects from JSON
    updateTexture('/js-simulator/textures/carpet.jpg')
    loadObjectsFromJSON('/js-simulator/stages/stage_cones.json', scene);
  };

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

    // Initial scene setup
    resetScene();

    // Set the renderer to the DOM element
    if (currentMountRef) {
      currentMountRef.appendChild(renderer.domElement);
    }

    // Adjust the renderer size to fit the container
    const handleResize = () => {
      if (currentMountRef) {
        const { clientWidth, clientHeight } = currentMountRef;
        renderer.setSize(clientWidth, clientHeight);
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
      }
    };

    handleResize(); // Initial resize
    window.addEventListener('resize', handleResize);

    // Setup keyboard controls
    // setupKeyboardControls();

    // Start the animation loop
    startAnimation();

    // Clean up on unmount
    return () => {
      if (currentMountRef) {
        currentMountRef.removeChild(renderer.domElement);
      }
      window.removeEventListener('resize', handleResize);
      stopAnimation();

      // Remove keyboard controls
      // removeKeyboardControls();
    };
  }, []);

  const handleForward = async () => {
    await moveStep(-0.1);
  };

  const handleBackward = async () => {
    await moveStep(0.1);
  };

  const handleRotateLeft = async () => {
    await rotateStep(0.0174533 * 10);
  };

  const handleRotateRight = async () => {
    await rotateStep(-0.0174533 * 10);
  };

  const handleStop = () => {
    stopMotion();
  }

  const handleCamera = () => {
    changeCamera();
  };

  const testMove = async () => {
    alert('Test');
    // just_move('forward')
    just_rotate('left')
    // await moveStep(0.1);
    // await rotateStep(Math.PI / 2);
    // await moveStep(0.1);
    // await rotateStep(-Math.PI / 2);
    // await moveStep(0.1);
    // await rotateStep(-Math.PI / 2);
    // await moveStep(0.1);
    // await rotateStep(Math.PI / 2);
  };

  return (
    <Box>
      <div ref={mountRef} style={{ width: '100%', height: '400px' }} />
      <Box display="flex" justifyContent="center" marginTop={2}>
        <Grid container spacing={2} justifyContent="center">
          <Grid item xs={12} sm="auto">
            <Button variant="contained" color="primary" onClick={handleForward}><FontAwesomeIcon icon={faArrowUp} size="2x" /></Button>
          </Grid>
          <Grid item xs={12} sm="auto">
            <Button variant="contained" color="primary" onClick={handleBackward}><FontAwesomeIcon icon={faArrowDown} size="2x" /></Button>
          </Grid>
          <Grid item xs={12} sm="auto">
            <Button variant="contained" color="primary" onClick={handleRotateLeft}><FontAwesomeIcon icon={faArrowLeft} size="2x" /></Button>
          </Grid>
          <Grid item xs={12} sm="auto">
            <Button variant="contained" color="primary" onClick={handleRotateRight}><FontAwesomeIcon icon={faArrowRight} size="2x" /></Button>
          </Grid>
          <Grid item xs={12} sm="auto">
            <Button variant="contained" color="secondary" onClick={handleCamera}><FontAwesomeIcon icon={faBinoculars} size="2x" /></Button>
          </Grid>
          <Grid item xs={12} sm="auto">
            <Button variant="contained" color="warning" onClick={() => resetScene()}><FontAwesomeIcon icon={faRefresh} size="2x" /></Button>
          </Grid>
        </Grid>
      </Box>
      <Box display="flex" justifyContent="center" marginTop={2} width="100%">
        <Grid container spacing={2} alignItems="center" justifyContent="center" width="80%">
          <Grid item>
            <FontAwesomeIcon icon={faLightbulb} size="2x" />
          </Grid>
          <Grid item xs>
            <Slider
              value={lightIntensity}
              onChange={handleLightIntensityChange}
              aria-labelledby="directional-light-slider"
              min={0}
              max={100}
              sx={{ flexGrow: 1 }}
            />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
});

export { WebGLApp, moveStep, rotateStep, stopMotion, get_distance, rgb_set_color, get_acceleration, get_gyroscope, get_floor_sensor, just_move, just_rotate, get_light_sensor, drawLine };
