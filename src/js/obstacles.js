import * as THREE from "three";
import * as CANNON from "cannon-es";
import wall from "../textures/fall-guys-texture.jpg";
import neon_wall from "../textures/neon.png";
import chain from "../textures/silver_texture.jpg";
import texture2 from "../textures/pink.jpg";
import texture3 from "../textures/texture 3.jpg";
import tile from "../textures/floor.png";
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
      const pillarMaterial = new THREE.MeshStandardMaterial({
         map: texture,
        //  metalness: 0.8,
        //  roughness: 0.2
         });
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
    textureLoader.load(neon_wall, (texture) => {
      // work out exact width of gate using the positions of the pillars
      let leftPillarPosition =
        leftPillar.position.x - leftPillar.geometry.parameters.width / 2;
      let rightPillarPosition =
        rightPillar.position.x + rightPillar.geometry.parameters.width / 2;

      const width = Math.abs(leftPillarPosition - rightPillarPosition);

      let newX = leftPillarPosition - width / 2;

      //Create a simple plane for the ground
      const gateGeometry = new THREE.BoxGeometry(width, height, length);
      const gateMaterial = new THREE.MeshStandardMaterial({ 
        map: texture,
        metalness: 3,
        roughness: 0.2
       });
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

export async function createHorizontalCylinder(
  world,
  scene,
  x,
  y,
  z,
  radius,
  height
) {
  return new Promise((resolve) => {
    // Load the texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(texture2, (texture) => {
      // Create a Three.js cylinder
      const cylinderGeometry = new THREE.CylinderGeometry(
        radius,
        radius,
        height,
        32
      );
      const cylinderMaterial = new THREE.MeshStandardMaterial({ map: texture });
      const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
      cylinder.position.set(x, y, z + height / 2);
      cylinder.rotation.x = Math.PI / 2; // Rotate the cylinder by 90 degrees around the x-axis
      cylinder.castShadow = true;
      cylinder.receiveShadow = true;
      scene.add(cylinder);

      // Create a Cannon.js body for the cylinder using half dimensions
      const shape = new CANNON.Cylinder(
        radius / 2 + 0.5,
        radius / 2 + 0.5,
        height,
        32
      );
      const body = new CANNON.Body({
        mass: 0, // Set mass to 0 to make it static
        position: new CANNON.Vec3(x, y, z + height / 2),
      });
      body.addShape(shape);
      body.quaternion.setFromEuler(Math.PI / 2, 0, 0, "XYZ"); // Rotate the cylinder body

      // Add the body to the Cannon.js physics world
      world.addBody(body);

      // Update the position and rotation of the Three.js mesh based on the Cannon.js body
      cylinder.userData.physicsBody = body;

      // Resolve the cylinder mesh
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

export async function createVertRod(
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
      rod.rotation.y = Math.PI / 2;
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

//level 2 obstacles
export async function createGate2(
  world,
  scene,
  x,
  y,
  z,
  height,
  length,
  leftPillar,
  rightPillar
) {
  // X, Y, Z IS THE POSITION OF THE GROUND PIECE, STARTING FROM THE CENTER

  return new Promise((resolve) => {
    // load the texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(neon_wall, (texture) => {
      // Calculate the exact width of gate using the positions of the pillars
      let leftPillarPosition =
        leftPillar.position.x - leftPillar.geometry.parameters.width / 2;
      let rightPillarPosition =
        rightPillar.position.x + rightPillar.geometry.parameters.width / 2;

      const width = Math.abs(leftPillarPosition - rightPillarPosition);
      let newX = leftPillarPosition - width / 2;

      // Create the gate mesh in Three.js
      const gateGeometry = new THREE.BoxGeometry(width, height, length);
      const gateMaterial = new THREE.MeshStandardMaterial({ 
        map: texture,
        metalness: 3,
        roughness: 0.2
       });
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

      // Create the Cannon.js body for the gate
      const shape = new CANNON.Box(
        new CANNON.Vec3(width / 2 + 1.8, height / 2 + 1.8, length / 2 + 1.8)
      );
      const body = new CANNON.Body({
        mass: 0, // Set mass to 0 if the gate should be static, otherwise set it to a higher value
        position: new CANNON.Vec3(newX, y + height / 2, z),
      });
      body.addShape(shape);

      // Add the body to the Cannon.js physics world
      world.addBody(body);

      // Link the Cannon.js body to the Three.js mesh for later synchronization
      gate.userData.physicsBody = body;

      resolve(gate);
    });
  });
}

export async function createPillar2(
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
      const pillarMaterial = new THREE.MeshStandardMaterial({
         color: "#5e408f",
        //  metalness: 0.8,
        //  roughness: 0.2
         });
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

export async function createWreckingBall(scene, x, y, z, ropeLength, ropeRadius, ballRadius) {
  return new Promise((resolve) => {
    const textureLoader = new THREE.TextureLoader();
    
    // Create a group to hold both the rope and ball
    const wreckingBallGroup = new THREE.Group();
    
    // Load textures for both rope and ball
    Promise.all([
      new Promise(resolve => textureLoader.load(chain, resolve)), // rope texture
      new Promise(resolve => textureLoader.load(texture3, resolve))  // ball texture
    ]).then(([ropeTexture, ballTexture]) => {
      // Create the rope (cylinder)
      const ropeGeometry = new THREE.CylinderGeometry(
        ropeRadius,
        ropeRadius,
        ropeLength,
        16
      );
      const ropeMaterial = new THREE.MeshStandardMaterial({ 
        map: ropeTexture,
        metalness: 0.7,
        roughness: 0.3
      });
      const rope = new THREE.Mesh(ropeGeometry, ropeMaterial);
      
      // Position the rope - rotate it so it hangs down
      rope.rotation.x = Math.PI / 2;
      rope.position.set(0, 0, ropeLength / 2);
      
      // Create the ball (sphere)
      const ballGeometry = new THREE.SphereGeometry(ballRadius, 32, 32);
      const ballMaterial = new THREE.MeshStandardMaterial({ 
        map: ballTexture,
        metalness: 0.8,
        roughness: 0.2
      });
      const ball = new THREE.Mesh(ballGeometry, ballMaterial);
      
      // Position the ball at the end of the rope
      ball.position.set(0, 0, ropeLength);
      
      // Add both meshes to the group
      wreckingBallGroup.add(rope);
      wreckingBallGroup.add(ball);
      
      // Position the entire group
      wreckingBallGroup.position.set(x, y, z);
      wreckingBallGroup.rotateX(Math.PI / 2);
      
      // Set up shadows
      // rope.castShadow = true;
      rope.receiveShadow = true;
      ball.castShadow = true;
      ball.receiveShadow = true;
      
      // Add the group to the scene
      scene.add(wreckingBallGroup);
      
      // Resolve with the group to allow for future manipulation
      resolve(wreckingBallGroup);
    });
  });
}


// level 3 obstacles
export function createCannonBall(scene, world, radius, startPosition, direction, speedMultiplier = 1) {
  const ballGroup = new THREE.Group();

  // Create main sphere
  const ballGeometry = new THREE.SphereGeometry(radius * 2, 32, 32);
  const ballMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    roughness: 0.3,
    metalness: 0.9,
    emissive: 0xff0000,
    emissiveIntensity: 0.5
  });
  const ball = new THREE.Mesh(ballGeometry, ballMaterial);
  ball.castShadow = true;
  ballGroup.add(ball);

  // Create physics body
  const shape = new CANNON.Sphere(radius * 2);
  const body = new CANNON.Body({
    mass: 5,
    position: new CANNON.Vec3(startPosition.x, startPosition.y, startPosition.z),
    shape: shape,
    material: new CANNON.Material({
      friction: 0.3,
      restitution: 0.6
    })
  });

  // Apply initial velocity with adjusted trajectory and speed
  const baseSpeed = 40;
  const speed = baseSpeed * speedMultiplier;
  const upwardForce = 15 * speedMultiplier;
  body.velocity.set(
    direction.x * speed,
    direction.y * speed + upwardForce,
    direction.z * speed
  );

  world.addBody(body);
  scene.add(ballGroup);

  ball.userData.physicsBody = body;

  // Add lifetime property to the ball
  const lifetime = 2; // 2 seconds lifetime
  ball.userData.creationTime = Date.now();
  ball.userData.lifetime = lifetime;

  return {
    mesh: ballGroup,
    body: body,
    lifetime: lifetime,
    creationTime: Date.now()
  };
}

export async function createTurnstile(
  world,
  scene,
  x,
  y,
  z,
  radius,
  barLength
) {
  return new Promise((resolve) => {
    // Create bar
    const barWidth = barLength;
    const barHeight = radius * 2.5; // Adjusted for proportions
    const barDepth = radius * 0.2;
    const barGeometry = new THREE.BoxGeometry(barWidth, barHeight, barDepth);
    const barMaterial = new THREE.MeshStandardMaterial({
      color: 0xd3d3d3,
      roughness: 0.2,
      metalness: 0.1,
    });
    const bar = new THREE.Mesh(barGeometry, barMaterial);

    // Create stripes on bar
    const stripeCount = 6;
    const stripeWidth = barWidth / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      if (i % 2 === 1) {
        // Only add light stripes
        const stripeGeometry = new THREE.BoxGeometry(
          stripeWidth,
          barHeight + 0.01,
          barDepth + 0.01
        );
        const stripeMaterial = new THREE.MeshStandardMaterial({
          color: 0xff69b4,
          roughness: 0.2,
          metalness: 0.1,
        });
        const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
        stripe.position.set(-barWidth / 2 + stripeWidth * (i + 0.5), 0, 0);
        bar.add(stripe);
      }
    }

    // Create pole
    const poleRadius = radius * 0.2;
    const poleHeight = barHeight * 1.1; // Pole height now matches bar height
    const poleGeometry = new THREE.CylinderGeometry(
      poleRadius,
      poleRadius,
      poleHeight,
      32
    );
    const pole = new THREE.Mesh(poleGeometry, barMaterial);

    // Create base ring
    const ringRadius = poleRadius;
    const ringTubeRadius = radius * 0.03;
    const ringGeometry = new THREE.TorusGeometry(
      ringRadius,
      ringTubeRadius,
      16,
      32
    );
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xd3d3d3,
      roughness: 0.2,
      metalness: 0.1,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.set(0, -poleHeight / 2, 0);
    ring.rotation.x = Math.PI / 2;

    // Group components
    const turnstileGroup = new THREE.Group();
    turnstileGroup.add(bar);
    turnstileGroup.add(pole);
    turnstileGroup.add(ring);

    // Position components
    bar.position.set(0, 0, 0);
    pole.position.set(0, 0, 0);

    // Set overall position
    turnstileGroup.position.set(x, y + poleHeight / 2, z);

    scene.add(turnstileGroup);

    // Create a cannon.js body for the turnstile
    const poleShape = new CANNON.Cylinder(
      poleRadius,
      poleRadius,
      poleHeight,
      32
    );
    const barShape = new CANNON.Box(
      new CANNON.Vec3(barWidth / 2, barHeight / 2, barDepth / 2)
    );

    const turnstileBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
    });
    turnstileBody.addShape(poleShape);
    turnstileBody.addShape(barShape, new CANNON.Vec3(0, 0, 0));

    turnstileBody.position.set(x, y + poleHeight / 2, z);
    world.addBody(turnstileBody);

    resolve({ mesh: turnstileGroup, body: turnstileBody, bar: bar });
  });
}

export function createRotatingHammer(
  world,
  scene,
  x,
  y,
  z,
  hammerLength = 4,
  rotationSpeed = 1
) {
  const hammerGroup = new THREE.Group();

  // Create stationary pole
  const poleRadius = 0.5;
  const poleHeight = 3;
  const poleGeometry = new THREE.CylinderGeometry(poleRadius, poleRadius, poleHeight, 32);
  const poleMaterial = new THREE.MeshStandardMaterial({
    color: 0xd3d3d3,
    metalness: 0.3,
    roughness: 0.4
  });
  const pole = new THREE.Mesh(poleGeometry, poleMaterial);
  pole.position.set(0, poleHeight/2, 0);
  pole.castShadow = true;
  pole.receiveShadow = true;

  // Create a group for the hammer components
  const hammerParts = new THREE.Group();

  // Create hammer handle
  const handleRadius = 0.3;
  const handleLength = 3;
  const handleGeometry = new THREE.CylinderGeometry(handleRadius, handleRadius, handleLength, 32);
  const handleMaterial = new THREE.MeshStandardMaterial({
    color: 0xd3d3d3,
    metalness: 0.2,
    roughness: 0.5
  });
  const handle = new THREE.Mesh(handleGeometry, handleMaterial);
  handle.rotation.z = Math.PI/2;
  handle.position.set(handleLength/2, 0, 0);
  handle.castShadow = true;
  handle.receiveShadow = true;
  hammerParts.add(handle);

  // Create hammer head
  const headRadius = 1.7;
  const headHeight = 2.5;
  const headGeometry = new THREE.CylinderGeometry(headRadius, headRadius, headHeight, 32);
  const headMaterial = new THREE.MeshStandardMaterial({
    color: 0xff69b4,
    metalness: 0.3,
    roughness: 0.4
  });
  const hammerHead = new THREE.Mesh(headGeometry, headMaterial);
  hammerHead.rotation.y = Math.PI/2;
  hammerHead.position.set(handleLength + headHeight/2, 0, 0);
  hammerHead.castShadow = true;
  hammerHead.receiveShadow = true;
  hammerParts.add(hammerHead);

  // Position hammer parts at correct height
  hammerParts.position.set(0, poleHeight * 0.8, 0);

  // Create rotating group
  const rotatingGroup = new THREE.Group();
  rotatingGroup.add(hammerParts);

  // Add everything to main group
  hammerGroup.add(pole);
  hammerGroup.add(rotatingGroup);
  hammerGroup.position.set(x, y, z);

  scene.add(hammerGroup);

  // Create CANNON.js bodies
  const poleShape = new CANNON.Cylinder(poleRadius, poleRadius, poleHeight, 32);
  const handleShape = new CANNON.Cylinder(handleRadius, handleRadius, handleLength, 32);
  const headShape = new CANNON.Cylinder(headRadius, headRadius, headHeight, 32);

  const hammerBody = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.KINEMATIC
  });

  // Add shapes with proper positioning
  hammerBody.addShape(poleShape, new CANNON.Vec3(0, poleHeight/2, 0));
  
  // Add handle and head shapes to match the visual positioning
  const handleOffset = new CANNON.Vec3(handleLength/2, poleHeight * 0.8, 0);
  const headOffset = new CANNON.Vec3(handleLength + headHeight/2, poleHeight * 0.8, 0);
  
  hammerBody.addShape(handleShape, handleOffset, new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI/2));
  hammerBody.addShape(headShape, headOffset, new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI/2));

  hammerBody.position.set(x, y, z);
  world.addBody(hammerBody);

  let rotationAngle = 0;

  function updateRotation(deltaTime) {
    rotationAngle += rotationSpeed * deltaTime;
    rotatingGroup.rotation.y = rotationAngle;
    
    // Update CANNON body rotation
    hammerBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotationAngle);

    if (rotationAngle >= Math.PI * 2) {
      rotationAngle -= Math.PI * 2;
    }
  }

  return {
    mesh: hammerGroup,
    body: hammerBody,
    rotatingGroup, // Export the rotating group for external control
    updateRotation,
    rotationSpeed
  };
}

export async function createConveyorBelt(
  world,
  scene,
  x,
  y,
  z,
  width,
  length,
  segments
) {
  return new Promise(async (resolve) => {
    const conveyorGroup = new THREE.Group();

    // Create base frame
    const frameGeometry = new THREE.BoxGeometry(width + 0.4, 0.2, length + 0.4);
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0xf4d03f,
      metalness: 0.3,
      roughness: 0.4,
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.y = -0.1;
    conveyorGroup.add(frame);

    // Create arrow texture
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    // Fill background with lighter orange
    ctx.fillStyle = "#FFA07A";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw arrows
    ctx.fillStyle = "#FF7F50";
    const arrowCount = 3;
    const arrowHeight = canvas.height / arrowCount;

    for (let i = 0; i < arrowCount; i++) {
      const y = i * arrowHeight;

      ctx.beginPath();
      ctx.moveTo(canvas.width * 0.2, y + arrowHeight * 0.5);
      ctx.lineTo(canvas.width * 0.5, y + arrowHeight * 0.2);
      ctx.lineTo(canvas.width * 0.8, y + arrowHeight * 0.5);
      ctx.lineTo(canvas.width * 0.5, y + arrowHeight * 0.8);
      ctx.closePath();
      ctx.fill();

      // Add subtle gradient overlay
      const gradient = ctx.createLinearGradient(0, y, 0, y + arrowHeight);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.2)");
      gradient.addColorStop(0.5, "rgba(255, 255, 255, 0)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0.2)");
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 4);

    // Create main belt with arrow texture
    const beltGeometry = new THREE.PlaneGeometry(
      width,
      length,
      segments * 2,
      segments * 2
    );
    const beltMaterial = new THREE.MeshPhysicalMaterial({
      map: texture,
      metalness: 0.1,
      roughness: 0.6,
      clearcoat: 0.3,
      clearcoatRoughness: 0.2,
    });

    const belt = new THREE.Mesh(beltGeometry, beltMaterial);
    belt.rotation.x = -Math.PI / 2;
    belt.position.y = 0.01;
    conveyorGroup.add(belt);

    // Side rails
    const railGeometry = new THREE.BoxGeometry(0.1, 0.3, length);
    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0xffa07a,
      metalness: 0.2,
      roughness: 0.6,
    });

    const leftRail = new THREE.Mesh(railGeometry, railMaterial);
    leftRail.position.set(-width / 2 - 0.05, 0.15, 0);
    conveyorGroup.add(leftRail);

    const rightRail = new THREE.Mesh(railGeometry, railMaterial);
    rightRail.position.set(width / 2 + 0.05, 0.15, 0);
    conveyorGroup.add(rightRail);

    // Support rollers (made smaller and less visible)
    const rollerCount = Math.ceil(length / 0.8); // Increased spacing
    const rollerGeometry = new THREE.CylinderGeometry(
      0.05,
      0.05,
      width + 0.1,
      16
    );
    const rollerMaterial = new THREE.MeshStandardMaterial({
      color: 0xffb6c1,
      metalness: 0.2,
      roughness: 0.6,
    });

    for (let i = 0; i < rollerCount; i++) {
      const roller = new THREE.Mesh(rollerGeometry, rollerMaterial);
      roller.rotation.z = Math.PI / 2;
      roller.position.set(0, -0.05, (i / (rollerCount - 1) - 0.5) * length);
      conveyorGroup.add(roller);
    }

    // Subtle shadow
    const shadowGeometry = new THREE.PlaneGeometry(width + 1, length + 1);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffa07a,
      transparent: true,
      opacity: 0.1,
    });
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.19;
    conveyorGroup.add(shadow);

    // Position the entire group
    conveyorGroup.position.set(x, y, z);
    scene.add(conveyorGroup);

    // Animation loop for smooth scrolling
    const animate = () => {
      texture.offset.y += 0.005;
      requestAnimationFrame(animate);
    };
    animate();

    // Create a cannon.js body for the conveyor belt
    const conveyorShape = new CANNON.Box(
      new CANNON.Vec3(width / 2, 0.1, length / 2)
    );
    const conveyorBody = new CANNON.Body({ mass: 0, shape: conveyorShape });
    conveyorBody.position.set(x, y, z);
    world.addBody(conveyorBody);

    resolve({
      group: conveyorGroup,
      body: conveyorBody,
      setSpeed: (speed) => {
        texture.offset.y += speed;
      },
      setColor: (color) => {
        beltMaterial.color.set(color);
      },
    });
  });
}

export async function createCrown(
  world,
  scene,
  x,
  y,
  z,
  radius = 1,
  spikeHeight = 0.9,
  spikeRadius = 0.1
) {
  return new Promise((resolve) => {
    // Crown Base (cylinder)
    const crownMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700, // Gold color
      metalness: 0.7,
      roughness: 0.4,
      emissive: 0xffd700, // Add emissive color for a glowing effect
      emissiveIntensity: 1, // Adjust emissive intensity as desired
    });
    const crownBase = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.5, 32),
      crownMaterial
    );

    // Position crown base
    crownBase.position.set(x, y, z);
    scene.add(crownBase);

    // Create a cannon.js body for the crown
    const crownShape = new CANNON.Cylinder(radius, radius, 0.5, 32);
    const crownBody = new CANNON.Body({ mass: 0, shape: crownShape });
    crownBody.position.set(x, y, z);
    world.addBody(crownBody);

    // Crown Spikes (cones)
    const spikeGeometry = new THREE.ConeGeometry(spikeRadius, spikeHeight, 32);
    const spikes = []; // Store spikes for easy reference
    for (let i = 0; i < 8; i++) {
      const spike = new THREE.Mesh(spikeGeometry, crownMaterial);
      const angle = (i / 8) * Math.PI * 2; // Evenly distribute spikes around the crown

      // Adjust the position to avoid showing the base under the crown
      spike.scale.set(2, 2, 2);
      spike.position.set(
        Math.cos(angle) * radius,
        0.75,
        Math.sin(angle) * radius
      ); // Move spikes up slightly (y = 0.75)
      spike.lookAt(0, 1, 0); // Make spike point upwards

      // Add each spike as a child of the crown base
      crownBase.add(spike);
      spikes.push(spike);
    }

    // Add Spheres (ornaments) to spikes (at the tip of each spike)
    const sphereGeometry = new THREE.SphereGeometry(spikeRadius * 0.75, 32, 32);
    for (let i = 0; i < 8; i++) {
      const ornament = new THREE.Mesh(sphereGeometry, crownMaterial);
      ornament.position.set(0, spikeHeight * 0.52, 0); // Slightly above the spike's tip
      spikes[i].add(ornament); // Attach the ornament to the tip of each spike
    }

    // Add a golden light source near the crown
    const crownLight = new THREE.PointLight(0xffd700, 1, 10); // 0xffd700 is a golden color
    crownLight.position.set(x, y + 1, z); // Position it slightly above the crown
    crownLight.castShadow = true; // Enable shadows if desired
    scene.add(crownLight);

    resolve({ mesh: crownBase, body: crownBody, light: crownLight });
  });
}

export async function createStartingPlatform(
  world,
  scene,
  x,
  y,
  z,
  width,
  height,
  depth
) {
  return new Promise((resolve) => {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(tile, (texture) => {
      // Create the platform mesh with emissive color for a subtle glow
      const platformGeometry = new THREE.BoxGeometry(width, height, depth);
      const platformMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        emissive: new THREE.Color(0x0000ff), // Blue emissive color
        emissiveIntensity: 0.2, // Adjust as needed for subtle glow
      });
      const platform = new THREE.Mesh(platformGeometry, platformMaterial);
      platform.position.set(x, y + height / 2, z);
      platform.castShadow = true;
      platform.receiveShadow = true;
      scene.add(platform);

      // Create the physics body for the platform
      const platformShape = new CANNON.Box(
        new CANNON.Vec3(width / 2, height / 2, depth / 2)
      );
      const platformBody = new CANNON.Body({ mass: 0, shape: platformShape });
      platformBody.position.set(x, y + height / 2, z);
      world.addBody(platformBody);

      // Add blue ambient light for the platform area
      const platformAmbientLight = new THREE.AmbientLight(0x0000ff, 0.4); // Blue light with low intensity
      scene.add(platformAmbientLight);

      // Create fences
      const fenceHeight = 5;
      const fenceThickness = 0.2;
      const fenceMaterial = new THREE.MeshStandardMaterial({ map: texture });

      // Left fence
      const leftFenceGeometry = new THREE.BoxGeometry(
        fenceThickness,
        fenceHeight,
        depth
      );
      const leftFence = new THREE.Mesh(leftFenceGeometry, fenceMaterial);
      leftFence.position.set(
        x - width / 2,
        y + height / 2 + fenceHeight / 2,
        z
      );
      scene.add(leftFence);

      // Right fence
      const rightFenceGeometry = new THREE.BoxGeometry(
        fenceThickness,
        fenceHeight,
        depth
      );
      const rightFence = new THREE.Mesh(rightFenceGeometry, fenceMaterial);
      rightFence.position.set(
        x + width / 2,
        y + height / 2 + fenceHeight / 2,
        z
      );
      scene.add(rightFence);

      // Back fence
      const backFenceGeometry = new THREE.BoxGeometry(
        width,
        fenceHeight,
        fenceThickness
      );
      const backFence = new THREE.Mesh(backFenceGeometry, fenceMaterial);
      backFence.position.set(
        x,
        y + height / 2 + fenceHeight / 2,
        z - depth / 2
      );
      scene.add(backFence);

      // Create physics bodies for fences
      const fenceShape = new CANNON.Box(
        new CANNON.Vec3(fenceThickness / 2, fenceHeight / 2, depth / 2)
      );
      const leftFenceBody = new CANNON.Body({ mass: 0, shape: fenceShape });
      leftFenceBody.position.copy(leftFence.position);
      world.addBody(leftFenceBody);

      const rightFenceBody = new CANNON.Body({ mass: 0, shape: fenceShape });
      rightFenceBody.position.copy(rightFence.position);
      world.addBody(rightFenceBody);

      const backFenceShape = new CANNON.Box(
        new CANNON.Vec3(width / 2, fenceHeight / 2, fenceThickness / 2)
      );
      const backFenceBody = new CANNON.Body({ mass: 0, shape: backFenceShape });
      backFenceBody.position.copy(backFence.position);
      world.addBody(backFenceBody);

      resolve({
        mesh: platform,
        body: platformBody,
        ambientLight: platformAmbientLight, // Return the ambient light for reference if needed
        fences: {
          left: { mesh: leftFence, body: leftFenceBody },
          right: { mesh: rightFence, body: rightFenceBody },
          back: { mesh: backFence, body: backFenceBody },
        },
      });
    });
  });
}


