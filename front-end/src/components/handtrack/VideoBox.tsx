import React, { useRef, useEffect, useState } from 'react';
import * as handTrack from 'handtrackjs';
import { library, dom } from '@fortawesome/fontawesome-svg-core';
import { faArrowUp, faArrowDown, faArrowLeft, faArrowRight, faLightbulb, faPencilAlt } from '@fortawesome/free-solid-svg-icons';
import arrowUpIcon from '../../assets/icons-svg/arrow-up-1-svgrepo-com.svg';
import arrowDownIcon from '../../assets/icons-svg/arrow-down-1-svgrepo-com.svg';
import arrowLeftIcon from '../../assets/icons-svg/arrow-left-svgrepo-com.svg';
import arrowRightIcon from '../../assets/icons-svg/arrow-right-svgrepo-com.svg';
import lightbulbIcon from '../../assets/icons-svg/light-bulb-svgrepo-com.svg';
import pencilAltIcon from '../../assets/icons-svg/pencil-svgrepo-com.svg';

library.add(faArrowUp, faArrowDown, faArrowLeft, faArrowRight, faLightbulb, faPencilAlt);
dom.watch();

const defaultParams = {
  flipHorizontal: true,
  outputStride: 16,
  imageScaleFactor: 1,
  maxNumBoxes: 3,
  iouThreshold: 0.2,
  scoreThreshold: 0.6,
  modelType: "ssd320fpnlite",
  modelSize: "small",
  bboxLineWidth: "2",
  fontSize: 17,
};

const buttonRegions = [
  { name: 'up', x: 270, y: 10, width: 100, height: 100, icon: arrowUpIcon },
  { name: 'down', x: 270, y: 350, width: 100, height: 100, icon: arrowDownIcon },
  { name: 'left', x: 50, y: 250, width: 100, height: 100, icon: arrowLeftIcon },
  { name: 'right', x: 480, y: 250, width: 100, height: 100, icon: arrowRightIcon },
  { name: 'light', x: 10, y: 50, width: 100, height: 100, icon: lightbulbIcon },
  { name: 'draw', x: 530, y: 50, width: 100, height: 100, icon: pencilAltIcon },
];

interface VideoBoxProps {
  moveStep: (distance: number) => Promise<void>;
  rotateStep: (angle: number) => Promise<void>;
  rgb_set_color: (color: string) => void;
  drawLine: (status: boolean) => void;
}

const VideoBox: React.FC<VideoBoxProps> = ({
  moveStep,
  rotateStep,
  rgb_set_color,
  drawLine,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [model, setModel] = useState<any>(null);
  const [cameraAvailable, setCameraAvailable] = useState<boolean>(true);
  const [lightOn, setLightOn] = useState<boolean>(false);
  const [drawOn, setDrawOn] = useState<boolean>(false);
  const [selectedButton, setSelectedButton] = useState<string | null>(null);
  const cooldownRef = useRef<boolean>(false);
  const actionInProgressRef = useRef<boolean>(false);
  const [buttonImages, setButtonImages] = useState<{ [key: string]: HTMLImageElement }>({});
  const soundFile = require('../../assets/sfx/achive-sound-132273.mp3');

  useEffect(() => {
    let isMounted = true;

    handTrack.load(defaultParams).then(loadedModel => {
      if (isMounted) {
        setModel(loadedModel);
      }
    });

    const startVideo = () => {
      if (videoRef.current) {
        navigator.mediaDevices.getUserMedia({ video: {} })
          .then(stream => {
            if (isMounted) {
              videoRef.current!.srcObject = stream;
              videoRef.current!.play();
              setCameraAvailable(true);
            }
          })
          .catch(err => {
            if (isMounted) {
              console.error("Error accessing webcam:", err);
              setCameraAvailable(false);
              drawMessage('Camera disconnected');
            }
          });
      }
    };

    startVideo();

    return () => {
      isMounted = false;
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      const handleLoadedData = () => {
        if (model) {
          runDetection();
        }
      };
      videoRef.current.addEventListener('loadeddata', handleLoadedData);

      return () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener('loadeddata', handleLoadedData);
        }
      };
    }
  }, [model]);

  useEffect(() => {
    const images: { [key: string]: HTMLImageElement } = {};
    buttonRegions.forEach(button => {
      const img = new Image();
      img.src = button.icon;
      img.onload = () => {
        images[button.name] = img;
      };
    });
    setButtonImages(images);
  }, []);

  const runDetection = () => {
    if (!cameraAvailable) {
      drawMessage('Camera disconnected');
      return;
    }

    if (model && videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        context.save();
        context.scale(-1, 1);
        context.translate(-canvasRef.current.width, 0);

        model.detect(videoRef.current).then((predictions: any) => {
          if (canvasRef.current && context) {
            context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            model.renderPredictions(predictions, canvasRef.current, context, videoRef.current);
            context.restore();
            drawButtons(context);
            checkButtonPress(predictions);
          }

          // Check if the video is still playing
          if (videoRef.current?.readyState === 4) {
            requestAnimationFrame(runDetection);
          } else {
            drawMessage('Camera disconnected');
          }
        });
      }
    }
  };

  const drawButtons = (context: CanvasRenderingContext2D) => {
    context.fillStyle = 'rgba(255, 255, 255, 0.5)';
    context.strokeStyle = 'black';
    context.lineWidth = 0;

    buttonRegions.forEach(button => {
      context.fillStyle = selectedButton === button.name ? 'green' : 'rgba(128, 128, 128, 0.5)';
      context.fillRect(button.x, button.y, button.width, button.height);

      if (buttonImages[button.name]) {
        context.drawImage(buttonImages[button.name], button.x + button.width / 2 - 20, button.y + button.height / 2 - 20, 40, 40);
      }
    });
  };

  const playSound = () => {
    const audio = new Audio(soundFile);
    audio.play();
  };

  const checkButtonPress = async (predictions: any) => {
    if (cooldownRef.current || actionInProgressRef.current) return;

    for (const prediction of predictions) {
      if (prediction.label === 'closed') {
        const [x, y, width, height] = prediction.bbox;
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        for (const button of buttonRegions) {
          if (
            centerX >= button.x &&
            centerX <= button.x + button.width &&
            centerY >= button.y &&
            centerY <= button.y + button.height
          ) {
            playSound();
            cooldownRef.current = true;
            actionInProgressRef.current = true;
            setSelectedButton(button.name);
            try {
              switch (button.name) {
                case 'up':
                  await moveStep(-0.4);
                  break;
                case 'down':
                  await moveStep(0.4);
                  break;
                case 'left':
                  await rotateStep(Math.PI / 2);
                  break;
                case 'right':
                  await rotateStep(-Math.PI / 2);
                  break;
                case 'light':
                  setLightOn(prev => {
                    const newStatus = !prev;
                    rgb_set_color(newStatus ? "white" : "off");
                    return newStatus;
                  });
                  break;
                case 'draw':
                  setDrawOn(prev => {
                    const newStatus = !prev;
                    drawLine(newStatus);
                    return newStatus;
                  });
                  break;
                default:
                  break;
              }
            } finally {
              setTimeout(() => {
                setSelectedButton(null);
                cooldownRef.current = false;
                actionInProgressRef.current = false;
              }, 500); // Change to 2 seconds
            }
            return;
          }
        }
      }
    }
  };

  const drawMessage = (message: string) => {
    if (canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        context.fillStyle = 'grey';
        context.font = '24px Arial';
        context.textAlign = 'center';
        context.fillText(message, canvasRef.current.width / 2, canvasRef.current.height / 2);
      }
    }
  };

  const resizeCanvas = () => {
    if (canvasRef.current && videoRef.current) {
      const videoAspectRatio = videoRef.current.videoWidth / videoRef.current.videoHeight;
      const containerWidth = canvasRef.current.parentElement?.offsetWidth || 640;
      const containerHeight = canvasRef.current.parentElement?.offsetHeight || 480;
      const containerAspectRatio = containerWidth / containerHeight;

      if (containerAspectRatio > videoAspectRatio) {
        canvasRef.current.style.width = `${containerHeight * videoAspectRatio}px`;
        canvasRef.current.style.height = `${containerHeight}px`;
      } else {
        canvasRef.current.style.width = `${containerWidth}px`;
        canvasRef.current.style.height = `${containerWidth / videoAspectRatio}px`;
      }
    }
  };

  useEffect(() => {
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    drawMessage('Loading...');
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <video ref={videoRef} width="640" height="480" autoPlay playsInline muted style={{ display: 'none' }} />
      <canvas ref={canvasRef} width="640" height="480" />
    </div>
  );
};

export default VideoBox;
