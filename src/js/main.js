//Imports
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as CANNON from "cannon-es";
import CannonDebugger from "cannon-es-debugger";
import Stats from "stats.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { createPillar, createGate } from "./obstacles";

// Import assets
import finish from "../img/finish.jpg";
import galaxy from "../img/galaxy.jpg";
import groundTexture from "../img/stoleItLol.jpg";

//Global variables
let scene,
  camera,
  renderer,
  controls,
  clock,
  world,
  cannonDebugger,
  model,
  playerBody,
  modelCenterOffset,
  stats,
  cameraGoal;

let gates = [];

// variables for camera control
const cameraOffset = new THREE.Vector3(0, 12, -15); // Changed to position camera behind and above the model
const cameraLerpFactor = 1.0;
let cameraRotation = new THREE.Euler(0, 0, 0, "YXZ");
const mouseSensitivity = 0.0008; // for mouse sensitivity

//Movement flags
let moveForward = false,
  moveBackward = false,
  moveLeft = false,
  moveRight = false;

//Speed constants
const PLAYER_SPEED = 20;
const jumpForce = 1750;
const turnSpeed = 0.2; // for rotation

//Jumping flag
let isJumping = false;

function init() {
  initStats();
  initScene();
  initLighting();
  initPhysics();
  initPlayer();
  initEventListeners();
  createGroundPiece(0, 0, 0, 60, 500);
  initGateObstacles();
}

function initStats() {
  stats = new Stats();
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb
  document.body.appendChild(stats.dom);
}

function initScene() {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x202020, 100, 500); // Add depth fog
  camera = new THREE.PerspectiveCamera(
    70, // Field of view (45-75)
    window.innerWidth / window.innerHeight,
    0.1, // Min distance objects are rendered
    1000 //Max distance objects are rendered
  );

  //Set camera position
  camera.position.set(0, 0, 0);

  //Create a renderer
  renderer = new THREE.WebGLRenderer({ antialias: true }); // Add antialias for smoother edges
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setAnimationLoop(animate);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Better shadow quality
  document.body.appendChild(renderer.domElement);

  //Create controls for testing
  // controls = new OrbitControls(camera, renderer.domElement);
  // controls.enableDamping = true; // Smooth motion
  // controls.enableZoom = true; // Allow zooming
  // controls.enablePan = true; // Allow panning
  // controls.maxPolarAngle = Math.PI / 2; // Restrict vertical rotation (optional)

  //Create an axis
  const axesHelper = new THREE.AxesHelper(1000); // Size of the axes
  scene.add(axesHelper);

  //Start clock
  clock = new THREE.Clock();

  //Setup controls
  setupControls();
}

// for pointer lock controls
function setupControls() {
  controls = new PointerLockControls(camera, renderer.domElement);

  document.addEventListener("click", () => {
    controls.lock();
  });

  controls.addEventListener("lock", () => {
    console.log("PointerLock activated");
  });

  controls.addEventListener("unlock", () => {
    console.log("PointerLock deactivated");
  });
}

function initLighting() {
  // Scene-wide dim ambient light for base illumination
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6); // Reduced intensity
  scene.add(ambientLight);

  // Main directional light (sun-like)
  const mainLight = new THREE.DirectionalLight(0xffffff, 1.0); // Reduced intensity

  // Position light higher and further back for better coverage
  mainLight.position.set(50, 100, 50); // Increased height and distance
  mainLight.castShadow = true;

  // Increase shadow map size for better quality
  mainLight.shadow.mapSize.width = 4096;
  mainLight.shadow.mapSize.height = 4096;

  // Adjust shadow camera frustum for scene coverage
  const shadowDistance = 300; // Increased shadow camera size
  mainLight.shadow.camera.left = -shadowDistance;
  mainLight.shadow.camera.right = shadowDistance;
  mainLight.shadow.camera.top = shadowDistance;
  mainLight.shadow.camera.bottom = -shadowDistance;
  mainLight.shadow.camera.near = 1;
  mainLight.shadow.camera.far = 5000;

  // Optional: visualize shadow camera frustum
  // const helper = new THREE.CameraHelper(mainLight.shadow.camera);
  // scene.add(helper);

  scene.add(mainLight);

  // Secondary fill light (no shadows) for better coverage
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-50, 50, -50);
  scene.add(fillLight);
}
function initBackground() {
  //We have to do the background
}

function initPhysics() {
  world = new CANNON.World();
  world.gravity.set(0, -30, 0); // Set gravity
  cannonDebugger = new CannonDebugger(scene, world, { color: 0xff0000 });
}

function initPlayer() {
  const fatGuyURL = new URL("../assets/FatGuy.glb", import.meta.url);
  const assetLoader = new GLTFLoader();

  assetLoader.load(
    fatGuyURL.href,
    (gltf) => {
      model = gltf.scene;
      model.position.set(0, 10, 10);
      model.scale.set(0.4, 0.4, 0.4);

      // Enable shadows for all meshes in the model
      model.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });

      scene.add(model);

      // Create and add camera goal as a child of the model
      cameraGoal = new THREE.Object3D();
      cameraGoal.position.copy(cameraOffset);
      model.add(cameraGoal);

      // Set up animation
      //   mixer = new THREE.AnimationMixer(model);
      //   const clips = gltf.animations;
      //   const clip = THREE.AnimationClip.findByName(clips, "Running");
      //   runningAction = mixer.clipAction(clip);

      // Calculate the bounding box of the model
      const bbox = new THREE.Box3().setFromObject(model);
      const size = bbox.getSize(new THREE.Vector3());
      const center = bbox.getCenter(new THREE.Vector3());

      // Store the model center offset to use it in animate
      modelCenterOffset = new THREE.Vector3().subVectors(
        model.position,
        center
      );

      // Create a Cannon Box shape using the bounding box dimensions
      const playerShape = new CANNON.Box(
        new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)
      );

      // Create the player body using the Box shape
      playerBody = new CANNON.Body({
        mass: 70, // Mass for the player
        // Add linear damping to reduce floatiness
        linearDamping: 0.9,
        // Add angular damping to prevent unwanted rotation
        angularDamping: 0.99,
        fixedRotation: true, // This will prevent the body from rotating
        position: new CANNON.Vec3(center.x, center.y, center.z), // Start position of the player
      });

      // Add the Box shape to the body
      playerBody.addShape(playerShape);

      // Add the body to the world
      world.addBody(playerBody);
    },
    undefined,
    (error) => console.error("Error loading player model:", error)
  );
}

// Set up movement event listeners
function initEventListeners() {
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  // event listeners for mouse control
  document.addEventListener("mousemove", onMouseMove, false);
}
// function to handle mouse movement
// Update the onMouseMove function
function onMouseMove(event) {
  if (controls.isLocked) {
    // Update camera rotation
    cameraRotation.y -= event.movementX * mouseSensitivity;
    // cameraRotation.y = Math.max(
    //   -Math.PI / 2, // Limit looking up
    //   Math.min(
    //     Math.PI / 2, // Limit looking down
    //     cameraRotation.y - event.movementX * mouseSensitivity
    //   )
    // );

    // Rotate the player model to match camera direction
    if (playerBody && model) {
      // Set the quaternion of the physics body
      playerBody.quaternion.setFromAxisAngle(
        new CANNON.Vec3(0, 1, 0),
        cameraRotation.y
      );

      // model.rotation.y = cameraRotation.y;
    }
  }
}

//Movememnt functions that update the movement flags
function handleKeyDown(event) {
  switch (event.key) {
    case "w":
    case "ArrowUp":
      moveForward = true;
      //   if (runningAction && !runningAction.isRunning()) {
      //     runningAction.reset();
      //     runningAction.setLoop(THREE.LoopRepeat);
      //     runningAction.play();
      //   }
      break;
    case "s":
    case "ArrowDown":
      moveBackward = true;
      break;
    case "a":
    case "ArrowLeft":
      moveLeft = true;
      break;
    case "d":
    case "ArrowRight":
      moveRight = true;
      break;
    case " ":
      // Jump when spacebar is pressed
      if (!isJumping) {
        jump();
      }
      break;
  }
}

function handleKeyUp(event) {
  switch (event.key) {
    case "w":
    case "ArrowUp":
      moveForward = false;
      //   if (runningAction) {
      //     runningAction.fadeOut(0.5);
      //   }
      break;
    case "s":
    case "ArrowDown":
      moveBackward = false;
      break;
    case "a":
    case "ArrowLeft":
      moveLeft = false;
      break;
    case "d":
    case "ArrowRight":
      moveRight = false;
      break;
  }
}

// Function to handle jumping
function jump() {
  let startingY =
    playerBody.position.y -
    (playerBody.aabb.upperBound.y - playerBody.aabb.lowerBound.y) / 2 -
    0.1;

  // Check if the player is grounded and if they are , allow them to jump
  if (startingY < 0.1) {
    isJumping = true;
    playerBody.applyImpulse(new CANNON.Vec3(0, jumpForce, 0), model.position);
  }
}

// Update player movement based on key presses
// Update the updateMovement function to use camera direction
function updateMovement(delta) {
  const speed = PLAYER_SPEED * delta;

  // Calculate forward and right vectors based on camera rotation
  const forward = new THREE.Vector3(0, 0, 1);
  const right = new THREE.Vector3(1, 0, 0);

  // Rotate vectors based on camera rotation
  forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation.y);
  right.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation.y);

  // Calculate movement direction
  const moveDirection = new THREE.Vector3(0, 0, 0);

  if (moveForward) moveDirection.add(forward);
  if (moveBackward) moveDirection.sub(forward);
  if (moveLeft) moveDirection.add(right);
  if (moveRight) moveDirection.sub(right);

  // Normalize and apply movement
  if (moveDirection.length() > 0) {
    moveDirection.normalize();
    playerBody.position.x += moveDirection.x * speed;
    playerBody.position.z += moveDirection.z * speed;
  }

  // Reset angular velocity
  playerBody.angularVelocity.set(0, 0, 0);

  // Update jumping state
  const height =
    playerBody.position.y -
    (playerBody.aabb.upperBound.y - playerBody.aabb.lowerBound.y) / 2 -
    0.1;
  if (height < 0.1) {
    isJumping = false;
  }
}

//

function createGroundPiece(x, y, z, width, length) {
  //X, Y, Z IS THE POSITION OF THE GROUND PIECE, STARTING FROM THE CENTER
  //Create a simple plane for the ground
  const groundGeometry = new THREE.PlaneGeometry(width, length);
  const groundMaterial = new THREE.MeshStandardMaterial();
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.position.set(x, y, z + length / 2);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  //Create a cannon.js body for the ground
  const groundShape = new CANNON.Box(
    new CANNON.Vec3(width / 2, 0.001, length / 2)
  );
  const groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
  groundBody.position.set(x, y, z + length / 2);
  world.addBody(groundBody);

  //add texture over the ground
  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load(groundTexture);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);
  groundMaterial.map = texture;
}

function initGateObstacles() {
  //pillars
  let pillar1 = createPillar(world, scene, 28.5, 0, 50, 3, 8, 7);
  let pillar2 = createPillar(world, scene, 9.5, 0, 50, 3, 8, 7);
  let pillar3 = createPillar(world, scene, -9.5, 0, 50, 3, 8, 7);
  let pillar4 = createPillar(world, scene, -28.5, 0, 50, 3, 8, 7);

  // //moving gates between pillar 1 and 2
  gates.push(
    createGate(
      scene,
      pillar1.position.x,
      0,
      pillar1.position.z,
      8,
      2,
      pillar1,
      pillar2
    )
  );
  //moving gates between pillar 2 and 3
  gates.push(
    createGate(
      scene,
      pillar2.position.x,
      -4,
      pillar2.position.z,
      8,
      2,
      pillar2,
      pillar3
    )
  );
  //moving gates between pillar 3 and 4
  gates.push(
    createGate(
      scene,
      pillar3.position.x,
      0,
      pillar3.position.z,
      8,
      2,
      pillar3,
      pillar4
    )
  );
}

function animateGates(deltaTime) {
  const moveSpeed = 20; // Movement speed
  const waitTime = 1; // Seconds to wait at each position

  // Iterate over all gates
  gates.forEach((gate) => {
    //console.log(gate);
    const pillar = gate.leftPillar;
    const maxY =
      pillar.position.y +
      pillar.geometry.parameters.height / 2 -
      gate.geometry.parameters.height / 2;
    const minY = 0 - gate.geometry.parameters.height / 2;

    // Check if the gate has reached the max position
    if (gate.position.y >= maxY) {
      gate.moveDirection = -1; // Reverse the movement direction
    }

    // Check if the gate has reached the min position
    if (gate.position.y <= minY) {
      gate.moveDirection = 1; // Reverse the movement direction
    }

    gate.position.y += gate.moveDirection * moveSpeed * deltaTime;

    // if (!gate.waiting) {
    //   gate.position.y += gate.moveDirection * moveSpeed * deltaTime;

    //   // Check if the gate has reached the max position
    //   if (gate.position.y >= maxY) {
    //     gate.moveDirection = -1; // Reverse the movement direction
    //     gate.waiting = true;
    //     gate.lastWaitTime = clock.getElapsedTime(); // Record the time of the wait
    //   }

    //   // Check if the gate has reached the min position
    //   if (gate.position.y <= minY) {
    //     gate.moveDirection = 1; // Reverse the movement direction
    //     gate.waiting = true;
    //     gate.lastWaitTime = clock.getElapsedTime(); // Record the time of the wait
    //   }
    // } else {
    //   // If the gate is waiting, check how long it's been waiting
    //   if (clock.getElapsedTime() - gate.lastWaitTime >= waitTime) {
    //     gate.waiting = false; // Resume movement
    //   }
    // }
  });
}

// Update the camera position to follow the player
// Update the updateCamera function
function updateCamera() {
  if (!model) return;

  // Calculate camera position based on offset and rotation
  const cameraPosition = new THREE.Vector3(
    Math.sin(cameraRotation.y) * cameraOffset.z,
    cameraOffset.y,
    Math.cos(cameraRotation.y) * cameraOffset.z
  );

  // Add player position to camera position
  cameraPosition.add(model.position);

  // Update camera position with smooth lerp
  camera.position.lerp(cameraPosition, cameraLerpFactor);

  // Calculate look target (slightly above player position)
  const lookTarget = model.position.clone().add(new THREE.Vector3(0, 2, 0));
  camera.lookAt(lookTarget);

  // Apply pitch rotation after looking at target
  camera.rotateX(cameraRotation.x);
}

function animate() {
  stats.begin();
  // Update the physics world on every frame
  const deltaTime = clock.getDelta();
  world.step(1 / 60, deltaTime, 10);

  // make the model follow the physics body
  if (model && playerBody) {
    //Update the movement of the player
    updateMovement(deltaTime);

    // First apply rotation
    model.quaternion.set(
      playerBody.quaternion.x,
      playerBody.quaternion.y,
      playerBody.quaternion.z,
      playerBody.quaternion.w
    );

    // Then update position with offset
    const worldOffset = modelCenterOffset.clone();
    worldOffset.applyQuaternion(playerBody.quaternion); // Transform offset by current rotation

    model.position.copy(playerBody.position).add(worldOffset);

    // Update camera
    updateCamera();
  }

  //Animate the gates
  animateGates(deltaTime);

  cannonDebugger.update();
  renderer.render(scene, camera);
  //controls.update();

  stats.end();
}

init();
