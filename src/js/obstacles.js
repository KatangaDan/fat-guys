import * as THREE from "three";
import * as CANNON from "cannon-es";

export function createPillar(world, scene, x, y, z, width, height, length) {
  //X, Y, Z IS THE POSITION OF THE GROUND PIECE, STARTING FROM THE CENTER
  //Create a simple plane for the ground
  const pillarGeometry = new THREE.BoxGeometry(width, height, length);
  const pillarMaterial = new THREE.MeshStandardMaterial({ color: "green" });
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
  groundBody.position.set(x, y + height / 2, z + length / 2);
  world.addBody(groundBody);

  //return the pillar position
  return pillar;
}

export function createGate(
  scene,
  x,
  y,
  z,
  height,
  length,
  leftPillar,
  rightPillar
) {
  //X, Y, Z IS THE POSITION OF THE GROUND PIECE, STARTING FROM THE CENTER

  // work out exact width of gate using the positions of the pillars
  let leftPillarPosition =
    leftPillar.position.x - leftPillar.geometry.parameters.width / 2;
  let rightPillarPosition =
    rightPillar.position.x + rightPillar.geometry.parameters.width / 2;

  const width = Math.abs(leftPillarPosition - rightPillarPosition);

  let newX = leftPillarPosition - width / 2;

  //Create a simple plane for the ground
  const gateGeometry = new THREE.BoxGeometry(width, height, length);
  const gateMaterial = new THREE.MeshStandardMaterial({ color: "blue" });
  const gate = new THREE.Mesh(gateGeometry, gateMaterial);
  gate.position.set(newX, y + height / 2, z);
  gate.castShadow = true;
  gate.receiveShadow = true;

  // Initialize gate movement properties
  gate.moveDirection = 1; // Initial direction: 1 (up), -1 (down)
  gate.waiting = false; // Not waiting initially
  gate.lastWaitTime = 0; // Initialize the wait timer

  // Attach reference to the left and right pillars
  gate.leftPillar = leftPillar;
  gate.rightPillar = rightPillar;

  scene.add(gate);

  return gate;
}

export function createCylinder(scene, x, y, z, radius, height) {
  //X, Y, Z IS THE POSITION OF THE GROUND PIECE, STARTING FROM THE CENTER
  //Create a simple plane for the ground
  const cylinderGeometry = new THREE.CylinderGeometry(
    radius,
    radius,
    height,
    32
  );
  const cylinderMaterial = new THREE.MeshStandardMaterial({ color: "red" });
  const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
  cylinder.position.set(x, y + height / 2, z);
  cylinder.castShadow = true;
  cylinder.receiveShadow = true;
  scene.add(cylinder);

  //return the pillar position
  return cylinder;
}
