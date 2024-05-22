import * as THREE from 'three';

const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

const rayOrigin = new THREE.Vector3(0, -0.2, 0);
const rayDirection = new THREE.Vector3(0, 0, -1).normalize(); // Direction of the ray

const raycaster = new THREE.Raycaster(rayOrigin, rayDirection);

// Create a line to represent the raycaster starting from the new origin
const rayGeometry = new THREE.BufferGeometry().setFromPoints([rayOrigin, rayOrigin.clone().add(rayDirection.clone().multiplyScalar(2))]);
const rayMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
// const rayLine = new THREE.Line(rayGeometry, rayMaterial);

function rotateAroundPoint(object, offset, angle) {
    const quaternion = new THREE.Quaternion();
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle); // Y-axis rotation

    // Calculate the pivot point
    const point = new THREE.Vector3(object.position.x, object.position.y - offset, object.position.z);

    // Translate object to the pivot point
    object.position.sub(point);

    // Apply rotation
    object.position.applyQuaternion(quaternion);

    // Translate object back from the pivot point
    object.position.add(point);

    // Rotate object's direction
    object.quaternion.multiplyQuaternions(quaternion, object.quaternion);
}

export { rotateAroundPoint, keys, raycaster, rayDirection };
