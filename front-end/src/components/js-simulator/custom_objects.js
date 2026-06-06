import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

function withCoacdSuffix(filePath) {
  const qIndex = filePath.indexOf('?');
  const base = qIndex >= 0 ? filePath.slice(0, qIndex) : filePath;
  const query = qIndex >= 0 ? filePath.slice(qIndex) : '';

  const dot = base.lastIndexOf('.');
  const slash = base.lastIndexOf('/');
  if (dot <= slash) {
    return `${base}_coacd${query}`;
  }

  return `${base.slice(0, dot)}_coacd${base.slice(dot)}${query}`;
}

function countMeshes(object) {
  let meshCount = 0;
  object.traverse((child) => {
    if (child.isMesh) meshCount += 1;
  });
  return meshCount;
}

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
    const objPath = `${this.filename}`;
    const coacdPath = withCoacdSuffix(objPath);

    const finalizeObject = (object, loadedPath, usedCoacd) => {
      object.scale.set(this.scale, this.scale, this.scale);
      object.position.set(this.position[0], this.position[1], this.position[2]);
      object.rotation.set(this.orientation[0], this.orientation[1], this.orientation[2]);
      if (this.options.name) {
        object.name = this.options.name;
      }

      object.userData = object.userData || {};
      object.userData.loadedModelPath = loadedPath;
      object.userData.hasCoacd = usedCoacd;

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
    };

    const loadOriginal = () => {
      const originalLoader = new OBJLoader();
      originalLoader.load(
        objPath,
        (object) => {
          if (countMeshes(object) === 0) {
            console.error('Loaded model has no meshes:', objPath);
            return;
          }
          finalizeObject(object, objPath, false);
        },
        undefined,
        (error) => {
          console.error('Failed to load model:', objPath, error);
        },
      );
    };

    if (coacdPath === objPath) {
      loadOriginal();
      return;
    }

    const coacdLoader = new OBJLoader();
    coacdLoader.load(
      coacdPath,
      (object) => {
        if (countMeshes(object) === 0) {
          loadOriginal();
          return;
        }
        finalizeObject(object, coacdPath, true);
      },
      undefined,
      () => {
        loadOriginal();
      },
    );
  }


}

export default CustomObject;
