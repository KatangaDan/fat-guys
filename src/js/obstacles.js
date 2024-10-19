import * as THREE from "three";
import * as CANNON from "cannon-es";

export function createPillar(world, scene, x, y, z, width, height, length) {
  //X, Y, Z IS THE POSITION OF THE GROUND PIECE, STARTING FROM THE CENTER
  //Create a simple plane for the ground
  const pillarGeometry = new THREE.BoxGeometry(width, height, length);
  const pillarMaterial = new THREE.MeshStandardMaterial({ color: "red" });
  const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
  pillar.position.set(x, y + height / 2, z + length / 2);
  pillar.castShadow = true;
  pillar.receiveShadow = true;
  scene.add(pillar);

  //Create a cannon.js body for the ground
  const groundShape = new CANNON.Box(
    new CANNON.Vec3(width / 2 + 1, height / 2 + 1, length / 2 + 1)
  );

  const groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
  groundBody.position.set(x, y, z + length / 2);
  world.addBody(groundBody);

  //return the pillar position
  return pillar.position;
}

// export function createGate(world, scene, x, y, z, width, height, length) {
//   //X, Y, Z IS THE POSITION OF THE GROUND PIECE, STARTING FROM THE CENTER
//   //Create a simple plane for the ground
//   const gateGeometry = new THREE.BoxGeometry(width, height, length);
//   const gateMaterial = new THREE.MeshStandardMaterial({ color: "blue" });
//   const gate = new THREE.Mesh(gateGeometry, gateMaterial);
//   gate.position.set(x + width / 2, y + height / 2, z + length / 2);
//   gate.castShadow = true;
//   gate.receiveShadow = true;
//   scene.add(gate);
// }
