import * as THREE from 'three';

// Create plane geometry and material with initial white color and no texture
const planeGeometry = new THREE.PlaneGeometry(10, 10);
const initialColor = new THREE.Color('white');
const planeMaterial = new THREE.MeshStandardMaterial({ color: initialColor, side: THREE.DoubleSide });

const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.name = 'plane'; // Custom property to identify the plane
plane.rotation.x = Math.PI / 2;
plane.position.y = -0.02;
plane.material.polygonOffset = false;
plane.renderOrder = 0;
plane.receiveShadow = true;
plane.userData.isPlane = true; // Custom property to identify the plane

function updateTexture(texturePath, color, repeat = { x: 25, y: 25 }, offset = { x: 0, y: 0 }) {
  const textureLoader = new THREE.TextureLoader();

  if (texturePath === '') {
    // Clear the texture and set the color
    planeMaterial.map = null;
    if (color) {
      planeMaterial.color.set(color);
    }
    planeMaterial.needsUpdate = true; // Ensure the material updates
  } else {
    // Load and apply the new texture
    textureLoader.load(texturePath, (texture) => {
      // This function is called after the texture has loaded
      console.log('Texture loaded', texture);

      // Set texture properties
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;

      // Set how many times the texture repeats
      texture.repeat.set(repeat.x, repeat.y);

      // Set texture offset
      texture.offset.set(offset.x, offset.y);

      // Apply the texture to the plane material
      planeMaterial.map = texture;
      if (color) {
        planeMaterial.color.set(color);
      }

      planeMaterial.needsUpdate = true; // Ensure the material updates
    });
  }
}


function updateDimensions(dimensions) {
  plane.scale.set(dimensions[0], dimensions[1]);
}


export { plane, updateTexture, updateDimensions };

