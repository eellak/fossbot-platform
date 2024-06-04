import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

class CustomObject {
    constructor(scene, filename, scale=1, position=[0,0,0], orientation=[0,0,0], color = "black") {
        this.scene = scene;
        this.filename = filename;
        this.scale = scale;
        this.position = position;
        this.orientation = orientation;
        this.color = color;
        this.originalColor = color;
    }

    loadObject() {
        const objLoader = new OBJLoader();
        const objPath = `${this.filename}`;

        objLoader.load(objPath, (object) => {
            object.scale.set(this.scale, this.scale, this.scale);
            object.position.set(this.position[0], this.position[1], this.position[2]);
            object.rotation.set(this.orientation[0], this.orientation[1], this.orientation[2]);
            object.traverse((child) => {
                if (child.isMesh) {
                    child.material = new THREE.MeshStandardMaterial({ color: this.color });
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            this.object = object;
            this.scene.add(this.object);
            
        });
    }    


}

export default CustomObject;
