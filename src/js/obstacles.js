import * as THREE from "three";
import * as CANNON from "cannon-es";
import wall from "../textures/fall-guys-texture.jpg";
import texture2 from "../textures/pink.jpg";
import texture3 from "../textures/texture 3.jpg";
import tile from "../textures/hexagon-tile.jpg";
import stripes from "../textures/texture 4.png";

export async function createPillar(
  world,
  scene,
  x,
  y,
  z,
  width,
  height,
  length
) {
  //X, Y, Z IS THE POSITION OF THE GROUND PIECE, STARTING FROM THE CENTER

  return new Promise((resolve) => {
    // load the texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(wall, (texture) => {
      //Create a simple plane for the ground
      const pillarGeometry = new THREE.BoxGeometry(width, height, length);
      const pillarMaterial = new THREE.MeshStandardMaterial({ map: texture });
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
      resolve(pillar);
    });
  });
}

export async function createGate(
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

  return new Promise((resolve) => {
    // load the texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(stripes, (texture) => {
      // work out exact width of gate using the positions of the pillars
      let leftPillarPosition =
        leftPillar.position.x - leftPillar.geometry.parameters.width / 2;
      let rightPillarPosition =
        rightPillar.position.x + rightPillar.geometry.parameters.width / 2;

      const width = Math.abs(leftPillarPosition - rightPillarPosition);

      let newX = leftPillarPosition - width / 2;

      //Create a simple plane for the ground
      const gateGeometry = new THREE.BoxGeometry(width, height, length);
      const gateMaterial = new THREE.MeshStandardMaterial({ map: texture });
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

      resolve(gate);
    });
  });
}

export async function createCylinder(scene, x, y, z, radius, height) {
  //X, Y, Z IS THE POSITION OF THE GROUND PIECE, STARTING FROM THE CENTER

  return new Promise((resolve) => {
    // load the texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(texture2, (texture) => {
      //Create a simple plane for the ground
      const cylinderGeometry = new THREE.CylinderGeometry(
        radius,
        radius,
        height,
        32
      );
      const cylinderMaterial = new THREE.MeshStandardMaterial({ map: texture });
      const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
      cylinder.position.set(x, y + height / 2, z);
      cylinder.castShadow = true;
      cylinder.receiveShadow = true;
      scene.add(cylinder);

      //return the pillar position
      resolve(cylinder);
    });
  });
}

export function createFan(scene, x, y, z, radius, lengthOfFans) {
  const centerGeometry = new THREE.CylinderGeometry(radius, radius, 1.5, 32);
  const centerMaterial = new THREE.MeshStandardMaterial({ color: "yellow" });
  const center = new THREE.Mesh(centerGeometry, centerMaterial);
  center.position.set(x, y + radius / 2, z);
  scene.add(center);

  //center helper
  const centerHelper = new THREE.BoxHelper(center, 0x00ff00);
  //scene.add(centerHelper);

  // Create the fan blades
  const bladeGeometry = new THREE.CylinderGeometry(
    0.75,
    0.75,
    lengthOfFans,
    32
  );
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
  //scene.add(blade1Helper);

  const blade2 = new THREE.Mesh(bladeGeometry, bladeMaterial);
  blade2.position.set(x, y + radius / 2, z);
  blade2.rotation.x = Math.PI / 2;
  blade2.name = "blade2";
  scene.add(blade2);

  //blade2 helper
  const blade2Helper = new THREE.BoxHelper(blade2, 0x00ff00);
  //scene.add(blade2Helper);

  // fan.add(center);
  // fan.add(blade1);
  // fan.add(blade2);

  // fan.position.set(x, y + radius / 2, z);
  // fan.castShadow = true;
  // fan.receiveShadow = true;
  // scene.add(fan);

  return { center, blade1, blade2, blade1Helper, blade2Helper, centerHelper };
}

export async function createRod(
  scene,
  x,
  y,
  z,
  minX,
  maxX,
  radiusOfRod,
  lengthOfRod,
  speed
) {
  return new Promise((resolve) => {
    // load the texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(texture3, (texture) => {
      const rodGeometry = new THREE.CylinderGeometry(
        radiusOfRod,
        radiusOfRod,
        lengthOfRod,
        32
      );
      const rodMaterial = new THREE.MeshStandardMaterial({ map: texture });
      const rod = new THREE.Mesh(rodGeometry, rodMaterial);
      rod.position.set(x, y + radiusOfRod, z);
      rod.rotation.x = Math.PI / 2;
      rod.castShadow = true;
      rod.minX = minX;
      rod.maxX = maxX;
      rod.speed = speed;
      rod.receiveShadow = true;
      scene.add(rod);

      resolve(rod);
    });
  });
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
