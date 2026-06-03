import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

class CustomObject {
  constructor(scene, filename, scale = 1, position = [0, 0, 0], orientation = [0, 0, 0], color = "black", options = {}) {
    this.scene = scene;
    this.filename = filename;
    this.scale = scale;
    this.position = position;
    this.orientation = orientation;
    this.color = color;
    this.originalColor = color;
    this.options = options;
  }

  loadObject() {
    const objLoader = new OBJLoader();
    const objPath = `${this.filename}`;

    objLoader.load(objPath, (object) => {
      object.scale.set(this.scale, this.scale, this.scale);
      object.position.set(this.position[0], this.position[1], this.position[2]);
      object.rotation.set(this.orientation[0], this.orientation[1], this.orientation[2]);
      if (this.options.name) {
        object.name = this.options.name;
      }

      if (this.options.physics) {
        object.userData.physics = { ...this.options.physics };
      }

      const castShadow = this.options.castShadow !== false;
      object.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({ color: this.color });
          child.castShadow = castShadow;
          child.receiveShadow = true;
        }
      });

      this.object = object;
      this.scene.add(this.object);

    });
  }


}

export default CustomObject;
