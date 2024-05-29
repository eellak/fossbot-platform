import { scene, camera, renderer } from './scene.js';
import { baseObject, wheels, rgbLED, rgbLEDVisual } from './robot_loader.js';
import { rotateAroundPoint, keys } from './utils.js';
import { checkCollisions,traceGeometry,tracePoints } from './sensors.js';
// import { statsEnabled } from './keyboard.js';
import * as THREE from 'three';
import Stats from 'stats.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let stats;
let velocity = 0;
const acceleration = 0.001;
const maxSpeed = 0.01;
const deceleration = 0.1;
const turnSpeed = Math.PI / 100;
let animationFrameId;
let isAnimating = false;
let traceEnabled = false;
let targetRotation = 0;
let currentRotation = 0;

let targetDistance = 0;
let distanceMoved = 0;
let movingStep = false;
let rotatingStep = false;

let followCamera = false;
let moveResolve = null;
let rotateResolve = null;

let moveIntervalId = null;
let rotateIntervalId = null;
let lastPosition = new THREE.Vector3();



function move(speed) {
    if (baseObject) {
        const movementVector = new THREE.Vector3();
        baseObject.getWorldDirection(movementVector);
        movementVector.multiplyScalar(speed);
        baseObject.position.add(movementVector);

        wheels.forEach((wheel) => {
            wheel.rotation.x += speed / 0.0001;
        });

        if (traceEnabled && movementVector.length() > 0) {

            updateTraceLine();
        }
    }
}

function rotate(angle) {
    if (baseObject) {
        targetRotation += angle;
    }
}

function performRotation() {
    if (baseObject && Math.abs(targetRotation - currentRotation) > 0.001) {
        const rotationStep = Math.sign(targetRotation - currentRotation) * turnSpeed;
        let angle = rotationStep;

        if (Math.abs(targetRotation - currentRotation) < Math.abs(rotationStep)) {
            angle = targetRotation - currentRotation;
        }

        currentRotation += angle;
        rotateAroundPoint(baseObject, 0.015, angle);

        wheels[0].rotation.x -= angle * 3;
        wheels[1].rotation.x += angle * 3;
    } else {
        rotatingStep = false; // Rotation complete
        if (rotateResolve) {
            rotateResolve();
            rotateResolve = null;
        }
    }
}

function updateObjectPosition() {
    if (baseObject) {
        if (followCamera) {
            const cameraOffset = new THREE.Vector3(0, 0.8, 0.9);
            const cameraPosition = cameraOffset.clone().applyMatrix4(baseObject.matrixWorld);
            camera.position.copy(cameraPosition);
            camera.lookAt(baseObject.position);
        }

        updateRgbLedDirection();
    }
}

function handleMovement() {
    if (keys.ArrowDown) {
        velocity += acceleration;
        if (velocity > maxSpeed) velocity = maxSpeed;
    } else if (keys.ArrowUp) {
        velocity -= acceleration;
        if (velocity < -maxSpeed) velocity = -maxSpeed;
    } else {
        velocity *= deceleration;
    }
    if (baseObject) {
        baseObject.velocity = velocity;  // Update baseObject.velocity
    }
    move(velocity);
}

function handleRotation() {
    if (keys.ArrowLeft) {
        rotate(turnSpeed);
    }
    if (keys.ArrowRight) {
        rotate(-turnSpeed);
    }
}

function moveBaseObject() {
    handleMovement();
    handleRotation();
    performRotation();
    performLinearMove();
    if (traceEnabled) {
        updateTraceLine();
    }
    updateObjectPosition();

}

function updateRgbLedDirection() {
    const direction = new THREE.Vector3();
    baseObject.getWorldDirection(direction);
    direction.negate();
    rgbLED.target.position.copy(baseObject.position).add(direction);
    rgbLED.target.updateMatrixWorld();
}

// Function to set the color of the RGB LED
function rgb_set_color(color) {
    const colors = {
        red: 0xff0000,
        green: 0x00ff00,
        blue: 0x0000ff,
        yellow: 0xffff00,
        violet: 0xee82ee,
        white: 0xffffff,
        off: 0x000000
    };

    if (rgbLEDVisual && rgbLEDVisual.material && rgbLEDVisual.material.color) {
        rgbLEDVisual.material.color.setHex(colors[color] || 0x000000);
        rgbLED.color.setHex(colors[color] || 0x000000);
    } else {
        console.error("rgbLED or its material/color properties are not defined.");
    }
}



function updateTraceLine() {
    const currentPosition = baseObject.position.clone();
    if (!currentPosition.equals(lastPosition)) {
        const newPoint = currentPosition.clone();
        newPoint.y -= 0.015;
        tracePoints.push(newPoint);
        traceGeometry.setFromPoints(tracePoints);
        traceGeometry.attributes.position.needsUpdate = true;
        lastPosition.copy(currentPosition);
    }
}

// function initStats() {
//     stats = new Stats();
//     stats.showPanel(0);
//     stats.dom.style.display = 'none';
//     document.body.appendChild(stats.dom);
// }

const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = true;

function animate() {
    if (!isAnimating) return;

    animationFrameId = requestAnimationFrame(animate);
    // if (statsEnabled && stats) {
    //     stats.begin();
    // }

    moveBaseObject();
    // checkCollisions();

    if (controls.enabled) {
        controls.update();
    }

    renderer.render(scene, camera);
    // if (statsEnabled && stats) {
    //     stats.end();
    // }
}

function startAnimation() {
    if (!isAnimating) {
        isAnimating = true;
        animate();
    }
}

function stopAnimation() {
    if (isAnimating) {
        isAnimating = false;
        cancelAnimationFrame(animationFrameId);
    }
}

function changeCamera() {
    followCamera = !followCamera;
    controls.enabled = !followCamera;
    
    camera.position.set(5, 5, 5);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    camera.fov = 10;
    if (followCamera) {
        camera.fov = 75;
        controls.reset();
    }
} 

function moveStep(distance) {
    return new Promise((resolve) => {
        if (baseObject) {
            stopMotion();
            targetDistance = distance;
            distanceMoved = 0;
            movingStep = true;
            moveResolve = resolve;           
        } else {
            resolve();
        }
    });
}

function performLinearMove() {
    if (movingStep) {
        const speed = 0.01;
        const movementVector = new THREE.Vector3();
        baseObject.getWorldDirection(movementVector);
        movementVector.multiplyScalar(Math.sign(targetDistance) * speed);
        baseObject.position.add(movementVector);
        distanceMoved += speed;

        wheels.forEach((wheel) => {
            wheel.rotation.x += Math.sign(targetDistance) * speed / 0.0001;
        });

        if (distanceMoved >= Math.abs(targetDistance)) {
            movingStep = false;
            if (moveResolve) {
                moveResolve();
                moveResolve = null;
            }
        }
    }
}

function rotateStep(angle) {
    return new Promise((resolve) => {
        if (baseObject) {
            stopMotion();
            targetRotation = currentRotation + angle;
            rotatingStep = true;
            rotateResolve = resolve;
        } else {
            resolve();
        }
    });
}

function stopMotion() {
    // Stop movement
    velocity = 0;
    if (baseObject) {
        baseObject.velocity = 0;
    }
    movingStep = false;
    targetDistance = 0;
    distanceMoved = 0;
    if (moveResolve) {
        moveResolve();
        moveResolve = null;
    }

    // Stop rotation
    rotatingStep = false;
    targetRotation = currentRotation;
    if (rotateResolve) {
        rotateResolve();
        rotateResolve = null;
    }

    // Clear intervals if any
    if (moveIntervalId) {
        clearInterval(moveIntervalId);
        moveIntervalId = null;
    }
    if (rotateIntervalId) {
        clearInterval(rotateIntervalId);
        rotateIntervalId = null;
    }
}

// Non-blocking continuous movement
function just_move(direction) {
    stopMotion(); // Ensure any current motion is stopped
    moveIntervalId = setInterval(() => {
        if (direction === 'forward') {
            move(-1 * maxSpeed);
        } else if (direction === 'backward') {
            move(maxSpeed);
        }
    }, 1000 / 60); // 60 FPS
}

// Non-blocking continuous rotation
function just_rotate(direction) {
    stopMotion(); // Ensure any current motion is stopped
    rotateIntervalId = setInterval(() => {
        if (direction === 'left') {
            rotate(turnSpeed);
        } else if (direction === 'right') {
            rotate(-turnSpeed);
        }
    }, 1000 / 60); // 60 FPS
}

function drawLine(status) {
    traceEnabled = status;
    console.log('Trace enabled:', traceEnabled);
    if (!traceEnabled) {
        tracePoints.length = 0;
        traceGeometry.setFromPoints(tracePoints);
        traceGeometry.attributes.position.needsUpdate = true;
    }
}

// initStats();
export { startAnimation, stopAnimation, stopMotion, stats, controls, rgb_set_color, changeCamera, move, rotate, moveStep, rotateStep, just_move, just_rotate, drawLine };
