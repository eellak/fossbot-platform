import React, { useRef, useEffect, useState } from 'react';
import * as handTrack from 'handtrackjs';
// import soundFile from '../../../assets/sfx/achive-sound-132273.mp3';

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
  { name: 'up', x: 270, y: 10, width: 100, height: 100 },
  { name: 'down', x: 270, y: 350, width: 100, height: 100 },
  { name: 'left', x: 50, y: 250, width: 100, height: 100 },
  { name: 'right', x: 480, y: 250, width: 100, height: 100 },
  { name: 'light', x: 10, y: 50, width: 100, height: 100 },
  { name: 'draw', x: 530, y: 50, width: 100, height: 100 },
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
  const cooldownRef = useRef<boolean>(false);
  const actionInProgressRef = useRef<boolean>(false);
  const soundFile = require('../../assets/sfx/achive-sound-132273.mp3');

  useEffect(() => {
    // Load the handtrack.js model
    handTrack.load(defaultParams).then(loadedModel => {
      setModel(loadedModel);
    });

    // Start the video stream
    const startVideo = () => {
      if (videoRef.current) {
        navigator.mediaDevices.getUserMedia({ video: {} })
          .then(stream => {
            videoRef.current!.srcObject = stream;
            videoRef.current!.play();
            setCameraAvailable(true);
          })
          .catch(err => {
            console.error("Error accessing webcam:", err);
            setCameraAvailable(false);
            drawCameraNotFound();
          });
      }
    };

    startVideo();

    // Clean up the video stream on component unmount
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.addEventListener('loadeddata', () => {
        if (model) {
          runDetection();
        }
      });
    }
  }, [model]);

  const runDetection = () => {
    if (model && videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        context.save();
        context.scale(-1, 1);
        context.translate(-canvasRef.current.width, 0);

        model.detect(videoRef.current).then((predictions: any) => {
          context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          model.renderPredictions(predictions, canvasRef.current, context, videoRef.current);
          context.restore();
          drawButtons(context);
          checkButtonPress(predictions);

          requestAnimationFrame(runDetection);
        });
      }
    }
  };

  const drawButtons = (context: CanvasRenderingContext2D) => {
    context.fillStyle = 'rgba(255, 255, 255, 0.5)';
    context.strokeStyle = 'black';
    context.lineWidth = 2;

    buttonRegions.forEach(button => {
      context.fillRect(button.x, button.y, button.width, button.height);
      context.strokeRect(button.x, button.y, button.width, button.height);
      context.fillStyle = 'black';
      context.font = '20px Arial';
      context.fillText(button.name.toUpperCase(), button.x + 5, button.y + 30);
      context.fillStyle = 'rgba(255, 255, 255, 0.5)';
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
            try {
              switch (button.name) {
                case 'up':
                  await moveStep(-1);
                  break;
                case 'down':
                  await moveStep(1);
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
                    rgb_set_color(newStatus ? "red" : "off");
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
                cooldownRef.current = false;
                actionInProgressRef.current = false;
              }, 500); // Extended the cooldown period to 1000 milliseconds
            }
            return;
          }
        }
      }
    }
  };

  const drawCameraNotFound = () => {
    if (canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        context.fillStyle = 'grey';
        context.font = '24px Arial';
        context.textAlign = 'center';
        context.fillText('Camera not found', canvasRef.current.width / 2, canvasRef.current.height / 2);
      }
    }
  };

  return (
    <div>
      <video ref={videoRef} width="640" height="480" autoPlay playsInline muted style={{ display: 'none' }} />
      <canvas ref={canvasRef} width="640" height="480" />
    </div>
  );
};

export default VideoBox;
