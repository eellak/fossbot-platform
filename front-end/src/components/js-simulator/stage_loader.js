import * as THREE from 'three';

export function loadObjectsFromJSON(url, scene) {
    const loader = new THREE.FileLoader();

    loader.load(
        url,
        (data) => {
            const objects = JSON.parse(data);
            objects.forEach((obj) => {
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
                scene.add(mesh);
            });
        },
        undefined,
        (error) => {
            console.error('An error occurred while loading the JSON file:', error);
        }
    );
}
