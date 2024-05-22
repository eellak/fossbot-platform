import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
// import { rayLine } from './utils.js';

let baseObject;
let wheels = [];
const rgbLED = new THREE.SpotLight(0x000000, 100, 100, Math.PI / 3, 0.5, 2); // White light initially
const rgbLEDVisual = new THREE.Mesh(
    new THREE.SphereGeometry(0.005, 16, 16),  // Small sphere geometry
    new THREE.MeshBasicMaterial({ color: 0x000000 })  // White color material
);
rgbLEDVisual.userData.isRobotPart = true;  // Custom property to identify robot parts
// Add the photoresistor sensor
const photoresistor = new THREE.Mesh(
    new THREE.SphereGeometry(0.005, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
);
photoresistor.userData.isRobotPart = true;  // Custom property to identify robot parts






// Line to show the direction of the light sensor
// const sensorLineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
// const sensorLineGeometry = new THREE.BufferGeometry().setFromPoints([
//     new THREE.Vector3(),
//     new THREE.Vector3(0, 0, -1)
// ]);
// const sensorLine = new THREE.Line(sensorLineGeometry, sensorLineMaterial);


function loadBaseObject(scene) {
    if (scene.getObjectByName('robot_body')) {
        // If robot already exists, do nothing
        return;
    }

    const mtlLoader = new MTLLoader();
    mtlLoader.load('/js-simulator/models/base1.mtl', (materials) => {
        materials.preload();
        const objLoader = new OBJLoader();
        objLoader.setMaterials(materials);
        objLoader.load('/js-simulator/models/base1.obj', (object) => {
            object.position.set(0, 0, 0);
            object.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.userData.isRobotPart = true;  // Custom property to identify robot parts
                }
            });

            const boundingBox = new THREE.Box3().setFromObject(object);
            const center = boundingBox.getCenter(new THREE.Vector3());
            const size = boundingBox.getSize(new THREE.Vector3());
            object.position.sub(center);
            object.position.y += size.y / 2;

            object.name = 'robot_body';  // Custom property to identify the base object

            scene.add(object);
            baseObject = object;
            baseObject.velocity = 0;

            rgbLED.position.set(0.07, 0.052, -0.08);
            rgbLED.target.position.set(0, 0, 1);
            baseObject.add(rgbLED);
            scene.add(rgbLED.target);
            rgbLEDVisual.position.copy(rgbLED.position);
            baseObject.add(rgbLEDVisual);

            
            photoresistor.position.set(-0.07, 0.052, -0.08); // Position it at the top right of the body
            baseObject.add(photoresistor);
            // sensorLine.position.set(-0.07, 0.052, -0.08);
            // baseObject.add(sensorLine);

      
            loadWheels(object);
            // scene.add(rayLine);

        });
    });
}

function loadWheels(object) {
    const wheelMtlLoader = new MTLLoader();
    wheelMtlLoader.load('/js-simulator/models/wheel.mtl', (wheelMaterials) => {
        wheelMaterials.preload();
        const wheelObjLoader = new OBJLoader();
        wheelObjLoader.setMaterials(wheelMaterials);
        wheelObjLoader.load('/js-simulator/models/wheel.obj', (wheel) => {
            wheel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.userData.isRobotPart = true;  // Custom property to identify robot parts
                }
            });

            const wheelScale = 0.001;
            wheel.scale.set(wheelScale, wheelScale, wheelScale);
            wheel.name = 'wheel';  // Custom property to identify the wheel

            const wheel1 = wheel.clone();
            wheel1.position.set(0.085, 0.015, -0.049);
            wheel1.rotation.set(0, -Math.PI / 2, 0);
            object.add(wheel1);
            wheels.push(wheel1);

            const wheel2 = wheel.clone();
            wheel2.position.set(-0.085, 0.015, -0.049);
            wheel2.rotation.set(0, Math.PI / 2, 0);
            object.add(wheel2);
            wheels.push(wheel2);
        });
    });
}

export { loadBaseObject, baseObject, wheels, rgbLED, rgbLEDVisual,photoresistor };
