import * as RAPIER from "@dimforge/rapier3d-compat";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import * as THREE from "three";

const COACD_FILES = [
  "b1_p_f_coacd.stl",
  "b2_p_f_coacd.stl",
  "b3_p_f_coacd.stl",
  "batterycover_coacd.stl",
  "left_fender_coacd.stl",
  "right_fender_coacd.stl",
  "left_eye_coacd.stl",
  "right_eye_coacd.stl",
  "lego_top_coacd.stl",
  "pen_holder_coacd.stl",
];

const COACD_BASE_URL = "/js-simulator/models/robots/v2/";

let coacdGeometries: Map<string, THREE.BufferGeometry> | null = null;
let coacdLoadingPromise: Promise<Map<string, THREE.BufferGeometry>> | null = null;

async function loadCoacdGeometries(): Promise<Map<string, THREE.BufferGeometry>> {
  if (coacdGeometries) {
    return coacdGeometries;
  }

  if (coacdLoadingPromise) {
    return coacdLoadingPromise;
  }

  coacdLoadingPromise = (async () => {
    const loader = new STLLoader();
    const geomMap = new Map<string, THREE.BufferGeometry>();

    const loadPromises = COACD_FILES.map((filename) => {
      return new Promise<[string, THREE.BufferGeometry]>((resolve, reject) => {
        loader.load(
          COACD_BASE_URL + filename,
          (geometry) => {
            // Scale from mm to m (0.001). Keep the original local origin so
            // collider vertices align with the visual part transforms.
            geometry.scale(0.001, 0.001, 0.001);
            resolve([filename, geometry]);
          },
          undefined,
          (err) => {
            console.error(`Failed to load ${filename}:`, err);
            reject(err);
          }
        );
      });
    });

    const results = await Promise.all(loadPromises);
    results.forEach(([filename, geom]) => {
      geomMap.set(filename, geom);
    });

    coacdGeometries = geomMap;
    return geomMap;
  })();

  return coacdLoadingPromise;
}

/**
 * Create Rapier ConvexHull collider descriptors from loaded coacd STLs.
 * Each STL becomes one ConvexHull collider.
 */
/**
 * Return the loaded coacd geometries (scaled to meters and centered).
 * The caller is responsible for converting them to ColliderDesc with any
 * additional visual scale applied (e.g., pivot scale from the visual model).
 */
export async function getCoacdGeometries(): Promise<Map<string, THREE.BufferGeometry>> {
  return loadCoacdGeometries();
}

export default getCoacdGeometries;
