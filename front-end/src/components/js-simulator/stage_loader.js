import * as THREE from 'three';
import { plane, updateTexture,updateColor,updateDimensions } from './floor_loader.js';
import { loadBaseObject,setPosition } from './robot_loader.js';
import CustomObject from './custom_objects.js';
import { color } from 'framer-motion';

export let robot_position = [0, 0, 0]; 

function parsePhysicsConfig(obj) {
    const massValue = Number(obj?.mass);
    const hasMass = Number.isFinite(massValue);
    const hasImmovable = obj?.immovable === true;

    if (!hasMass && !hasImmovable) return null;

    const cfg = {
        immovable: hasImmovable,
    };

    if (hasMass) {
        cfg.mass = Math.max(0, massValue);
        if (cfg.mass === 0) cfg.immovable = true;
    }

    return cfg;
}

function applyPhysicsConfig(target, obj) {
    const physics = parsePhysicsConfig(obj);
    if (!physics) return;
    target.userData = target.userData || {};
    target.userData.physics = physics;
}

export function loadObjectsFromJSON(url, scene) {
    const loader = new THREE.FileLoader();    
    loader.load(
        url,
        (data) => {
            const objects = JSON.parse(data);
            objects.forEach((obj) => {
               
                if (obj.type === 'floor') {                    
                    scene.add(plane);
                    // plane.dimensions = obj.dimensions;
                    updateTexture(obj.texture,obj.material.color);

                    // updateDimensions(...obj.dimensions);
                }else if(obj.type === 'base'){
                    const base_plane = new THREE.Mesh(new THREE.PlaneGeometry(obj.dimensions[0],obj.dimensions[1]), new THREE.MeshStandardMaterial({ color: obj.material.color, side: THREE.DoubleSide }));
                    base_plane.rotation.x = Math.PI / 2;
                    base_plane.position.x = obj.position[0];
                    base_plane.position.z = obj.position[1];
                    base_plane.position.y = -0.019;
                    scene.add(base_plane);
                }else if(obj.type === 'model'){                    
                    const customObject = new CustomObject(
                        scene,
                        obj.filename,
                        obj.scale,
                        obj.position,
                        obj.orientation,
                        obj.color,
                        {
                            name: obj.name,
                            castShadow: obj.castShadow,
                            physics: parsePhysicsConfig(obj),
                        },
                    );
                    customObject.loadObject();
                   

                       
                }else if(obj.type === 'fossbot'){
                    robot_position = obj.position;    
                  
                }else{
                    let geometry;
                    const material = new THREE.MeshStandardMaterial(obj.material);
                    switch (obj.type) {
                        case 'cube':
                            geometry = new THREE.BoxGeometry(...obj.dimensions);
                            break;
                        case 'cylinder':
                            geometry = new THREE.CylinderGeometry(...obj.dimensions);
                            break;                       
                        default:
                            console.warn(`Unsupported object type: ${obj.type}`);
                            return;
                    }

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(...obj.position);
                    mesh.name = obj.name;
                    mesh.castShadow = obj.castShadow || false;
                    applyPhysicsConfig(mesh, obj);
                    scene.add(mesh);
                }
            });
        },
        undefined,
        (error) => {
            console.error('An error occurred while loading the JSON file:', error);
        }
    );
}

