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

// Function to update the texture of the plane
function updateTexture(texturePath) {
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(texturePath, (texture) => {
    // This function is called after the texture has loaded
    console.log('Texture loaded', texture);
    // Set texture properties
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    // Set how many times the texture repeats
    texture.repeat.set(10, 10); // Adjust the values as needed
    texture.offset.set(0, 0); // Adjust the values as needed

    // Apply the texture to the plane material
    planeMaterial.map = texture;
    planeMaterial.color = null; // Reset color to use texture
    planeMaterial.needsUpdate = true; // Ensure the material updates
  });
}

export { plane, updateTexture };
