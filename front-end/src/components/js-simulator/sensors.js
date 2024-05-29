import { scene, renderer } from './scene.js';
import { baseObject,photoresistor } from './robot_loader.js';
import * as THREE from 'three';
import { raycaster } from './utils.js';

const max_ray_distance = 3.0;
let lastVelocity = new THREE.Vector3();
let lastAngularVelocity = new THREE.Vector3();
let lastTime = performance.now();

let tracePoints = [];
const traceMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
const traceGeometry = new THREE.BufferGeometry().setFromPoints(tracePoints);
const traceLine = new THREE.Line(traceGeometry, traceMaterial);
traceMaterial.polygonOffset = true;
traceMaterial.polygonOffsetFactor = -1;
traceMaterial.polygonOffsetUnits = -1;
traceLine.renderOrder = 1;



// Function to get the distance from the nearest object
function get_distance() {
    if (baseObject) {
        baseObject.updateMatrixWorld(true);
        const offset = new THREE.Vector3(0, 0.06, -0.1);
        const origin = offset.clone().applyMatrix4(baseObject.matrixWorld);
        const localDirection = new THREE.Vector3(0, 0, -1);
        const worldDirection = localDirection.clone().applyQuaternion(baseObject.quaternion).normalize();
        raycaster.set(origin, worldDirection);
        const intersects = raycaster.intersectObjects(scene.children, true);
        const validIntersects = intersects.filter(intersect =>
            intersect.object !== baseObject &&
            !intersect.object.userData.isRobotPart &&
            !intersect.object.userData.isPlane &&
            intersect.object.name !== ''
        );
        let distance = max_ray_distance;
        if (validIntersects.length > 0 && validIntersects[0].distance < max_ray_distance) {
            distance = validIntersects[0].distance;
        } 
        const lineEnd = origin.clone().add(worldDirection.clone().multiplyScalar(max_ray_distance));
        // rayLine.geometry.setFromPoints([origin, lineEnd]);
        return distance; 
    }
    return null;
}



// Function to get the current acceleration
function get_acceleration(axis) {
    if (baseObject) {
        const currentTime = performance.now();
        const deltaTime = (currentTime - lastTime) / 1000; // in seconds
        let velocity = baseObject.velocity;

        const currentVelocity = new THREE.Vector3();
        baseObject.getWorldDirection(currentVelocity).multiplyScalar(velocity); // Assuming `velocity` is defined elsewhere

        const accelerationVector = currentVelocity.clone().sub(lastVelocity).divideScalar(deltaTime);

        lastVelocity.copy(currentVelocity);
        lastTime = currentTime;

        switch (axis) {
            case 'x':
                return accelerationVector.x;
            case 'y':
                return accelerationVector.y;
            case 'z':
                return accelerationVector.z;
            default:
                return 0;
        }
    }
    return 0;
}

// Function to get the current angular velocity
function get_gyroscope(axis) {
    if (baseObject) {
        const currentTime = performance.now();
        const deltaTime = (currentTime - lastTime) / 1000; // in seconds

        const euler = new THREE.Euler().setFromQuaternion(baseObject.quaternion, 'XYZ');
        const currentAngularVelocity = new THREE.Vector3(euler.x, euler.y, euler.z);

        const angularVelocityVector = currentAngularVelocity.clone().sub(lastAngularVelocity).divideScalar(deltaTime);

        lastAngularVelocity.copy(currentAngularVelocity);
        lastTime = currentTime;

        switch (axis) {
            case 'x':
                return angularVelocityVector.x;
            case 'y':
                return angularVelocityVector.y;
            case 'z':
                return angularVelocityVector.z;
            default:
                return 0;
        }
    }
    return 0;
}

const sensorCameras = [];
const sensorRenderTargets = [];
const sensorSize = 64;
const sensorLines = [];
const sensorOffsets = [
    new THREE.Vector3(0, -0.005, -0.05),
    new THREE.Vector3(-0.03, -0.005, -0.05),
    new THREE.Vector3(0.03, -0.005, -0.05)
];

sensorOffsets.forEach(offset => {
    const camera = new THREE.OrthographicCamera(-0.05, 0.05, 0.05, -0.05, 0.01, 1);
    sensorCameras.push(camera);
    const renderTarget = new THREE.WebGLRenderTarget(sensorSize, sensorSize);
    sensorRenderTargets.push(renderTarget);
    const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
    const points = [new THREE.Vector3(), new THREE.Vector3(0, -0.1, 0)];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    sensorLines.push(line);
    scene.add(line);
});

function updateSensorTextures() {
    sensorOffsets.forEach((offset, index) => {
        const sensorOrigin = offset.clone().applyMatrix4(baseObject.matrixWorld);
        const sensorCamera = sensorCameras[index];
        sensorCamera.position.copy(sensorOrigin);
        sensorCamera.lookAt(sensorOrigin.clone().add(new THREE.Vector3(0, -1, 0)));
        sensorCamera.updateMatrixWorld(true);
        renderer.setRenderTarget(sensorRenderTargets[index]);
        renderer.render(scene, sensorCamera);
        renderer.setRenderTarget(null);
    });
}

// function checkSensor() {
//     if (baseObject) {
//         baseObject.updateMatrixWorld(true);
//         const offset = new THREE.Vector3(0, 0.06, -0.1);
//         const origin = offset.clone().applyMatrix4(baseObject.matrixWorld);
//         const localDirection = new THREE.Vector3(0, 0, -1);
//         const worldDirection = localDirection.clone().applyQuaternion(baseObject.quaternion).normalize();
//         raycaster.set(origin, worldDirection);
//         const intersects = raycaster.intersectObjects(scene.children, true);
//         const validIntersects = intersects.filter(intersect =>
//             intersect.object !== baseObject &&
//             !intersect.object.userData.isRobotPart &&
//             !intersect.object.userData.isPlane &&
//             intersect.object.name !== ''
//         );
//         let distance = max_ray_distance;
//         if (validIntersects.length > 0 && validIntersects[0].distance < max_ray_distance) {
//             distance = validIntersects[0].distance;
//         } 
//         const lineEnd = origin.clone().add(worldDirection.clone().multiplyScalar(max_ray_distance));
//         rayLine.geometry.setFromPoints([origin, lineEnd]);
//         return distance; 
//     }
//     return null;
// }

function checkCollisions() {
    if (baseObject) {
        const baseBox = new THREE.Box3().setFromObject(baseObject);
        scene.traverse((object) => {
            if (object !== baseObject && object.isMesh && !object.userData.isPlane && object.name !== "route" && !object.userData.isRobotPart) {
                const objectBox = new THREE.Box3().setFromObject(object);
                if (baseBox.intersectsBox(objectBox)) {
                    // console.log('Collision detected!');
                    return true;
                }
            }
        });
    }
    return false;
}

function checkLineSensors() {
    let sensorResults = [false, false, false];
    if (baseObject) {
        baseObject.updateMatrixWorld(true);
        updateSensorTextures();
        sensorOffsets.forEach((offset, index) => {
            const renderTarget = sensorRenderTargets[index];
            const pixelBuffer = new Uint8Array(4 * sensorSize * sensorSize);
            renderer.readRenderTargetPixels(renderTarget, 0, 0, sensorSize, sensorSize, pixelBuffer);
            function getCenterPixelColor() {
                const centerIndex = (Math.floor(sensorSize / 2) + Math.floor(sensorSize / 2) * sensorSize) * 4;
                return {
                    r: pixelBuffer[centerIndex],
                    g: pixelBuffer[centerIndex + 1],
                    b: pixelBuffer[centerIndex + 2],
                    a: pixelBuffer[centerIndex + 3]
                };
            }
            const color = getCenterPixelColor();
         
            if (color.r === 0 && color.g === 0 && color.b === 0) {
                sensorResults[index] = true;
            }

            const sensorDirection = new THREE.Vector3(0, -1, 0);
            const sensorOrigin = offset.clone().applyMatrix4(baseObject.matrixWorld);
            const lineEnd = sensorOrigin.clone().add(sensorDirection.clone().multiplyScalar(0.1));
            sensorLines[index].geometry.setFromPoints([sensorOrigin, lineEnd]);

            

        });
        return sensorResults;
    }
    return null;
}

// Function to get the current angular velocity
function get_floor_sensor(sensor_id) {
    let result = checkLineSensors()
    return result[sensor_id];
}



// Function to get light intensity
function get_light_intensity() {
    if (baseObject) {
        baseObject.updateMatrixWorld(true);
        const sensorPosition = new THREE.Vector3(0.1, 0.1, 0).applyMatrix4(baseObject.matrixWorld);
        const lightDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(baseObject.quaternion).normalize();
        raycaster.set(sensorPosition, lightDirection);

        const intersects = raycaster.intersectObjects(scene.children, true);
        const validIntersects = intersects.filter(intersect => intersect.object !== baseObject);
        
        let lightIntensity = 1024; // Default maximum value
        if (validIntersects.length > 0) {
            // Calculate light intensity based on distance (simple inverse square law simulation)
            const distance = validIntersects[0].distance;
            lightIntensity = Math.max(0, Math.min(1024, 1024 / (distance * distance)));
        }
        return lightIntensity;
    }
    return 0;
}

// Function to check sensor and update the sphere position
function get_light_sensor() {
    if (baseObject) {
        baseObject.updateMatrixWorld(true);
        const sensorPosition = new THREE.Vector3(0.1, 0.1, 0).applyMatrix4(baseObject.matrixWorld);
        photoresistor.position.copy(sensorPosition);
        return get_light_intensity();
    }
    return 0;
}



export { checkCollisions, get_distance, get_acceleration, get_gyroscope,get_floor_sensor,get_light_sensor,traceGeometry,tracePoints,traceLine };
