import * as THREE from 'three';

const isWebGLAvailable = () => {
    try {
        const canvas = document.createElement('canvas');
        return !!window.WebGLRenderingContext && (
            canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
        );
    } catch (e) {
        return false;
    }
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(20, parent.innerWidth / parent.innerHeight, 0.1, 1000);

let renderer;
if (isWebGLAvailable()) {
    renderer = new THREE.WebGLRenderer({
        antialias: true,
    });
} else {
    alert('WebGL not available');
}

renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

camera.position.set(5, 5, 5);
camera.lookAt(new THREE.Vector3(0, 0, 0));

export { scene, camera, renderer };
