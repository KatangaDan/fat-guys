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

export function createFan(scene, x, y, z, radius, lengthOfFans) {
  const centerGeometry = new THREE.CylinderGeometry(radius, radius, 1.5, 32);
  const centerMaterial = new THREE.MeshStandardMaterial({ color: "yellow" });
  const center = new THREE.Mesh(centerGeometry, centerMaterial);
  center.position.set(x, y + radius / 2, z);
  scene.add(center);

  //center helper
  const centerHelper = new THREE.BoxHelper(center, 0x00ff00);
  scene.add(centerHelper);

  // Create the fan blades
  const bladeGeometry = new THREE.CylinderGeometry(1, 1, lengthOfFans, 32);
  const bladeMaterial = new THREE.MeshStandardMaterial({ color: "yellow" });

  // const fan = new THREE.Group();

  //Create a single fan blade
  const blade1 = new THREE.Mesh(bladeGeometry, bladeMaterial);
  //Rotate the blade so it is horitzontal
  blade1.rotation.z = Math.PI / 2;
  blade1.position.set(x, y + radius / 2, z);
  blade1.name = "blade1";
  scene.add(blade1);

  //blade1 helper
  const blade1Helper = new THREE.BoxHelper(blade1, 0x00ff00);
  scene.add(blade1Helper);

  const blade2 = new THREE.Mesh(bladeGeometry, bladeMaterial);
  blade2.position.set(x, y + radius / 2, z);
  blade2.rotation.x = Math.PI / 2;
  blade2.name = "blade2";
  scene.add(blade2);

  //blade2 helper
  const blade2Helper = new THREE.BoxHelper(blade2, 0x00ff00);
  scene.add(blade2Helper);

  // fan.add(center);
  // fan.add(blade1);
  // fan.add(blade2);

  // fan.position.set(x, y + radius / 2, z);
  // fan.castShadow = true;
  // fan.receiveShadow = true;
  // scene.add(fan);

  return { center, blade1, blade2, blade1Helper, blade2Helper, centerHelper };
}

//  // Create a circular obstacle
//  const radius = 5;
//  const height = 2;
//  const segments = 32;
//  const geometry = new THREE.CylinderGeometry(radius, radius, height, segments);
//  const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
//  const cylinder = new THREE.Mesh(geometry, material);
//  cylinder.position.set(0, height / 2, 5);
//  scene.add(cylinder);
