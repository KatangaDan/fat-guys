//Imports
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as CANNON from "cannon-es";
import CannonDebugger from "cannon-es-debugger";
import Stats from "stats.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import {
  createPillar,
  createGate,
  createCylinder,
  createFan,
  createRod,
} from "./obstacles";

// Import assets
import finish from "../img/finish.jpg";
import basicBg from "../img/sky.jpg";
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

//Helpers to visualize intersection boxes
let playerHelper;

let gates = [];
let gateHelpers = [];
let cylinders = [];
let cylinderHelpers = [];

let fans = [];
let fanHelpers = [];

let rods = [];
let rodsHelpers = [];

// variables for camera control
const cameraOffset = new THREE.Vector3(0, 12, -15); // Changed to position camera behind and above the model
const cameraLerpFactor = 1.0;
let cameraRotation = new THREE.Euler(0, 0, 0, "YXZ");
const mouseSensitivity = 0.0004; // for mouse sensitivity

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
  initBackground();
  initPhysics();
  initPlayer();
  initEventListeners();
  createGroundPiece(0, 0, 0, 60, 260);

  //First set of obstacles
  initGateObstacles();

  //Ground pieces for second set of obstacles

  createGroundPiece(0, 0, 290, 10, 10);
  createGroundPiece(-29, 0, 275, 10, 10);
  createGroundPiece(29, 0, 275, 10, 10);
  createGroundPiece(20, 0, 300, 10, 10);
  createGroundPiece(-18, 0, 305, 10, 10);
  createGroundPiece(27, 0, 350, 10, 10);
  createGroundPiece(5, 0, 330, 10, 10);
  createGroundPiece(-15, 0, 350, 10, 10);
  createGroundPiece(25, 0, 380, 10, 10);
  createGroundPiece(0, 0, 390, 10, 10);
  createGroundPiece(-20, 0, 387, 10, 10);
  createGroundPiece(-10, 0, 410, 10, 10);
  createGroundPiece(10, 0, 430, 10, 10);
  createGroundPiece(-29, 0, 450, 10, 10);
  createGroundPiece(20, 0, 460, 10, 10);

  //Rod pieces for second set of obstacles
  initRodObstacles();

  createGroundPiece(0, 0, 490, 60, 260);

  // initFanObstacles();
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
  const ambientLight = new THREE.AmbientLight(0x404040, 1.0); // Reduced intensity
  scene.add(ambientLight);

  // Main directional light (sun-like)
  const mainLight = new THREE.DirectionalLight(0xffffff, 2.5); // Reduced intensity

  // Position light higher and further back for better coverage
  mainLight.position.set(50, 100, -50); // Increased height and distance
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
  const textureLoader = new THREE.TextureLoader();
  const skyboxTexture = textureLoader.load(basicBg, function(texture) {
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(1, 1);
    texture.offset.set(0, -0.3); // Move the image up by 0.3 units

    // // Enable texture matrix transformation
    // texture.center.set(0.5, 0.5); // Set the center of rotation to the center of the texture
    // texture.rotation = Math.PI/2; // Rotate the texture by 45 degrees (π/4 radians)
  });

  const skyboxGeometry = new THREE.SphereGeometry(500, 60, 40);
  const skyboxMaterial = new THREE.MeshBasicMaterial({
    map: skyboxTexture,
    side: THREE.BackSide,
  });
  const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
  scene.add(skybox);
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
      model.position.set(0, 10, 5);
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
      //localstorage playerposition
      // Retrieve the player position string from localStorage
      const playerPosition = localStorage.getItem("playerPosition");

      // Split the string by commas and map each value to a float
      const [x, y, z] = playerPosition.split(",").map((pos) => parseFloat(pos));

      // Now you have three separate variables: x, y, and z
      console.log("x:", x);
      console.log("y:", y);
      console.log("z:", z);

      // Create the player body using the Box shape
      playerBody = new CANNON.Body({
        mass: 70, // Mass for the player
        // Add linear damping to reduce floatiness
        linearDamping: 0.9,
        // Add angular damping to prevent unwanted rotation
        angularDamping: 0.99,
        fixedRotation: true, // This will prevent the body from rotating
        position: new CANNON.Vec3(x, y, z), // Set the initial position of the player
      });

      // Add the Box shape to the body
      playerBody.addShape(playerShape);

      // Add the body to the world
      world.addBody(playerBody);

      // Create a helper to visualize the player's bounding box
      playerHelper = new THREE.BoxHelper(model, "red"); // Red box around object1
      scene.add(playerHelper);
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
// function onMouseMove(event) {
//   if (controls.isLocked) {
//     // Update camera rotation
//     cameraRotation.y -= event.movementX * mouseSensitivity;
//     // cameraRotation.y = Math.max(
//     //   -Math.PI / 2, // Limit looking up
//     //   Math.min(
//     //     Math.PI / 2, // Limit looking down
//     //     cameraRotation.y - event.movementX * mouseSensitivity
//     //   )
//     // );

//     // Rotate the player model to match camera direction
//     if (playerBody && model) {
//       // Set the quaternion of the physics body
//       playerBody.quaternion.setFromAxisAngle(
//         new CANNON.Vec3(0, 1, 0),
//         cameraRotation.y
//       );

//       // model.rotation.y = cameraRotation.y;
//     }
//   }
// }

let targetRotationY = 0; // Store target rotation
const rotationDamping = 0.2; // Damping factor

function onMouseMove(e) {
  if (controls.isLocked) {
    // Accumulate mouse movement
    targetRotationY -= e.movementX * mouseSensitivity;

    // Smoothly interpolate towards the target rotation
    cameraRotation.y += (targetRotationY - cameraRotation.y) * rotationDamping;

    // Update the player's body rotation
    if (playerBody) {
      playerBody.quaternion.setFromAxisAngle(
        new CANNON.Vec3(0, 1, 0),
        cameraRotation.y
      );
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
  //FIRST SET OF PILLARS AND GATES (4 pillars, 3 gates)
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
      -8,
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

  //SECOND SET OF PILLARS (5 pillars, 4 gates)

  const secondSetZ = 100; // Z position for the second set of pillars
  const leftmostX = 28.5; // Fixed x position for the leftmost pillar
  const rightmostX = -28.5; // Fixed x position for the rightmost pillar

  // Calculate equal spacing between the pillars
  const totalDistance = leftmostX - rightmostX; // Distance between leftmost and rightmost
  const pillarSpacing = totalDistance / 4; // We have 4 gaps for 5 pillars

  // Create 5 pillars with equal spacing between them
  let pillar5 = createPillar(world, scene, leftmostX, 0, secondSetZ, 3, 8, 7);
  let pillar6 = createPillar(
    world,
    scene,
    leftmostX - pillarSpacing,
    0,
    secondSetZ,
    3,
    8,
    7
  );
  let pillar7 = createPillar(
    world,
    scene,
    leftmostX - 2 * pillarSpacing,
    0,
    secondSetZ,
    3,
    8,
    7
  );
  let pillar8 = createPillar(
    world,
    scene,
    leftmostX - 3 * pillarSpacing,
    0,
    secondSetZ,
    3,
    8,
    7
  );
  let pillar9 = createPillar(world, scene, rightmostX, 0, secondSetZ, 3, 8, 7);

  //create cylinder obstacle
  cylinders.push(createCylinder(scene, -29, 0, 98.5, 1, 6));

  // Moving gates between pillar 5 and 6
  gates.push(
    createGate(
      scene,
      pillar5.position.x,
      0,
      pillar5.position.z,
      8,
      2,
      pillar5,
      pillar6
    )
  );
  // Moving gates between pillar 6 and 7
  gates.push(
    createGate(
      scene,
      pillar6.position.x,
      -8,
      pillar6.position.z,
      8,
      2,
      pillar6,
      pillar7
    )
  );
  // Moving gates between pillar 7 and 8
  gates.push(
    createGate(
      scene,
      pillar7.position.x,
      0,
      pillar7.position.z,
      8,
      2,
      pillar7,
      pillar8
    )
  );
  // Moving gates between pillar 8 and 9
  gates.push(
    createGate(
      scene,
      pillar8.position.x,
      -8,
      pillar8.position.z,
      8,
      2,
      pillar8,
      pillar9
    )
  );

  //Third SET OF PILLARS, gates , and cylinders (5 pillars, 4 gates)
  const thirdSetZ = 150; // Z position for the second set of pillars

  // Create 5 pillars with equal spacing between them
  let pillar10 = createPillar(world, scene, leftmostX, 0, thirdSetZ, 3, 8, 7);
  let pillar11 = createPillar(
    world,
    scene,
    leftmostX - pillarSpacing,
    0,
    thirdSetZ,
    3,
    8,
    7
  );
  let pillar12 = createPillar(
    world,
    scene,
    leftmostX - 2 * pillarSpacing,
    0,
    thirdSetZ,
    3,
    8,
    7
  );
  let pillar13 = createPillar(
    world,
    scene,
    leftmostX - 3 * pillarSpacing,
    0,
    thirdSetZ,
    3,
    8,
    7
  );
  let pillar14 = createPillar(world, scene, rightmostX, 0, thirdSetZ, 3, 8, 7);

  //create cylinder obstacle
  cylinders.push(createCylinder(scene, 15, 0, 148.5, 1, 6));
  //create cylinder obstacle
  cylinders.push(createCylinder(scene, -15, 0, 158, 1, 6));

  // Moving gates between pillar 5 and 6
  gates.push(
    createGate(
      scene,
      pillar10.position.x,
      0,
      pillar10.position.z,
      8,
      2,
      pillar10,
      pillar11
    )
  );
  // Moving gates between pillar 6 and 7
  gates.push(
    createGate(
      scene,
      pillar11.position.x,
      -8,
      pillar11.position.z,
      8,
      2,
      pillar11,
      pillar12
    )
  );
  // Moving gates between pillar 7 and 8
  gates.push(
    createGate(
      scene,
      pillar12.position.x,
      0,
      pillar12.position.z,
      8,
      2,
      pillar12,
      pillar13
    )
  );
  // Moving gates between pillar 8 and 9
  gates.push(
    createGate(
      scene,
      pillar13.position.x,
      -8,
      pillar13.position.z,
      8,
      2,
      pillar13,
      pillar14
    )
  );

  //Fourth SET OF PILLARS, gates , and cylinders (5 pillars, 4 gates)
  const fourthSetZ = 200; // Z position for the second set of pillars

  // Create 5 pillars with equal spacing between them
  let pillar15 = createPillar(world, scene, leftmostX, 0, fourthSetZ, 3, 8, 7);

  let pillar16 = createPillar(
    world,
    scene,
    leftmostX - pillarSpacing,
    0,
    fourthSetZ,
    3,
    8,
    7
  );

  let pillar17 = createPillar(
    world,
    scene,
    leftmostX - 2 * pillarSpacing,
    0,
    fourthSetZ,
    3,
    8,
    7
  );

  let pillar18 = createPillar(
    world,
    scene,
    leftmostX - 3 * pillarSpacing,
    0,
    fourthSetZ,
    3,
    8,
    7
  );

  let pillar19 = createPillar(world, scene, rightmostX, 0, fourthSetZ, 3, 8, 7);

  // Moving gates between pillar 5 and 6
  gates.push(
    createGate(
      scene,
      pillar15.position.x,
      0,
      pillar15.position.z,
      8,
      2,
      pillar15,
      pillar16
    )
  );

  // Moving gates between pillar 6 and 7
  gates.push(
    createGate(
      scene,
      pillar16.position.x,
      -8,
      pillar16.position.z,
      8,
      2,
      pillar16,
      pillar17
    )
  );

  // Moving gates between pillar 7 and 8
  gates.push(
    createGate(
      scene,
      pillar17.position.x,
      0,
      pillar17.position.z,
      8,
      2,
      pillar17,
      pillar18
    )
  );

  // Moving gates between pillar 8 and 9
  gates.push(
    createGate(
      scene,
      pillar18.position.x,
      -8,
      pillar18.position.z,
      8,
      2,
      pillar18,
      pillar19
    )
  );

  //create cylinder obstacle
  cylinders.push(createCylinder(scene, 29, 0, 198.5, 1, 6));
  //create cylinder obstacle
  cylinders.push(createCylinder(scene, -29, 0, 198.5, 1, 6));

  //create cylinder obstacle
  cylinders.push(createCylinder(scene, 12, 0, 208.5, 1, 6));
  //create cylinder obstacle
  cylinders.push(createCylinder(scene, -12, 0, 208.5, 1, 6));

  AddVisualGateHelpers();
  AddVisualCylinderHelpers();
}

function initRodObstacles() {
  //x, y, z, minX, maxX, radius, length
  let rod1 = createRod(scene, -29, 0, 250, -15, 15, 0.75, 10);
  let rod2 = createRod(scene, 0, 0, 250, -29, 29, 0.75, 10);
  let rod3 = createRod(scene, 29, 0, 250, -29, 29, 0.75, 10);

  rods.push(rod1);
  rods.push(rod2);
  rods.push(rod3);

  addVisualRodHelpers();
}

function initFanObstacles() {
  let fan1 = createFan(scene, 15, 0, 250, 3, 30);
  let fan2 = createFan(scene, -15, 0, 260, 3, 30);
  let fan3 = createFan(scene, 15, 0, 290, 3, 30);
  let fan4 = createFan(scene, -15, 0, 300, 3, 30);

  fans.push(fan1.blade1);
  fans.push(fan1.blade2);
  fans.push(fan1.center);

  fans.push(fan2.blade1);
  fans.push(fan2.blade2);
  fans.push(fan2.center);

  fans.push(fan3.blade1);
  fans.push(fan3.blade2);
  fans.push(fan3.center);

  fans.push(fan4.blade1);
  fans.push(fan4.blade2);
  fans.push(fan4.center);

  fanHelpers.push(fan1.blade1Helper);
  fanHelpers.push(fan1.blade2Helper);
  fanHelpers.push(fan1.centerHelper);

  fanHelpers.push(fan2.blade1Helper);
  fanHelpers.push(fan2.blade2Helper);
  fanHelpers.push(fan2.centerHelper);

  fanHelpers.push(fan3.blade1Helper);
  fanHelpers.push(fan3.blade2Helper);
  fanHelpers.push(fan3.centerHelper);

  fanHelpers.push(fan4.blade1Helper);
  fanHelpers.push(fan4.blade2Helper);
  fanHelpers.push(fan4.centerHelper);

  console.log(fans);
}

function addVisualRodHelpers() {
  rods.forEach((rod) => {
    const helper = new THREE.BoxHelper(rod, "blue");
    rodsHelpers.push(helper);
    scene.add(helper);
  });
}

function animateRods(deltaTime) {
  const moveSpeed = 20; // Movement speed

  rods.forEach((rod) => {
    const maxX = rod.maxX;
    const minX = rod.minX;

    // Initialize the rod direction if it doesn't exist
    if (rod.moveDirection === undefined) {
      rod.moveDirection = rod.position.x >= maxX ? -1 : 1;
    }

    // Clamp rod position to max/min bounds
    if (rod.position.x > maxX) {
      rod.position.x = maxX;
      rod.moveDirection *= -1;
    } else if (rod.position.x < minX) {
      rod.position.x = minX;
      rod.moveDirection *= -1;
    }

    rod.position.x += rod.moveDirection * moveSpeed * deltaTime;
  });
}

function AddVisualGateHelpers() {
  // Add visual helpers for the gates
  gates.forEach((gate) => {
    const helper = new THREE.BoxHelper(gate, "blue");
    gateHelpers.push(helper);
    scene.add(helper);
  });
}

function AddVisualCylinderHelpers() {
  // Add visual helpers for the cylinders
  cylinders.forEach((cylinder) => {
    const helper = new THREE.BoxHelper(cylinder, "blue");
    cylinderHelpers.push(helper);
    scene.add(helper);
  });
}

function animateGates(deltaTime) {
  const moveSpeed = 20; // Movement speed
  const waitTime = 1; // Seconds to wait at each position

  gates.forEach((gate) => {
    const pillar = gate.leftPillar;
    const maxY =
      pillar.position.y +
      pillar.geometry.parameters.height / 2 -
      gate.geometry.parameters.height / 2;
    const minY = 0 - gate.geometry.parameters.height / 2 - 1;

    // Initialize the gate direction if it doesn't exist
    if (gate.moveDirection === undefined) {
      gate.moveDirection = gate.position.y >= maxY ? -1 : 1;
    }

    // Initialize waiting state and last wait time if not set
    if (gate.waiting === undefined) {
      gate.waiting = false;
      gate.lastWaitTime = 0;
    }

    // If gate is at max or min height, start waiting
    if (!gate.waiting && (gate.position.y >= maxY || gate.position.y <= minY)) {
      gate.waiting = true;
      gate.lastWaitTime = clock.getElapsedTime(); // Record the time of the wait
    }

    // Handle the waiting period
    if (gate.waiting) {
      // Check how long the gate has been waiting
      if (clock.getElapsedTime() - gate.lastWaitTime >= waitTime) {
        gate.waiting = false; // Stop waiting and reverse direction
        gate.moveDirection *= -1;
      }
    }

    // Move the gate if not waiting
    if (!gate.waiting) {
      gate.position.y += gate.moveDirection * moveSpeed * deltaTime;

      // Clamp gate position to max/min bounds
      if (gate.position.y > maxY) {
        gate.position.y = maxY;
      } else if (gate.position.y < minY) {
        gate.position.y = minY;
      }
    }
  });
}

function animateFans(deltaTime) {
  const fanSpinSpeed = 2;
  fans.forEach((fan) => {
    if (fan.name == "blade1") {
      fan.rotation.y += fanSpinSpeed * deltaTime;
    }
    if (fan.name == "blade2") {
      fan.rotation.z -= fanSpinSpeed * deltaTime;
    }
  });

  fanHelpers.forEach((helper) => {
    if (helper) {
      helper.update();
      helper.updateMatrixWorld(true);
    }
  });
}

function animateCylinders(deltaTime) {
  //function to move cylinders right and left

  const moveSpeed = 50; // Movement speed

  cylinders.forEach((cylinder) => {
    const maxX = 29;
    const minX = -29;

    // Initialize the cylinder direction if it doesn't exist
    if (cylinder.moveDirection === undefined) {
      cylinder.moveDirection = cylinder.position.x >= maxX ? -1 : 1;
    }

    // If cylinder is at max or min width, start waiting
    if (cylinder.position.x >= maxX || cylinder.position.x <= minX) {
      cylinder.moveDirection *= -1;
    }
    // Clamp cylinder position to max/min bounds
    if (cylinder.position.x > maxX) {
      cylinder.position.x = maxX;
    } else if (cylinder.position.x < minX) {
      cylinder.position.x = minX;
    }

    cylinder.position.x += cylinder.moveDirection * moveSpeed * deltaTime;
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

//Bounding boxes

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

    localStorage.setItem("playerPosition", playerBody.position);

    /*Actual bounding boxes for the player and obstacles*/

    //player bounding box
    const playerBoundingBox = new THREE.Box3().setFromObject(model);

    //gates bounding boxes
    gates.forEach((gate) => {
      const gateBoundingBox = new THREE.Box3().setFromObject(gate);

      if (playerBoundingBox.intersectsBox(gateBoundingBox)) {
        //Reset the players position
        playerBody.position.set(0, 10, 10);
      }
    });

    //cylinders bounding boxes
    cylinders.forEach((cylinder) => {
      const cylinderBoundingBox = new THREE.Box3().setFromObject(cylinder);

      if (playerBoundingBox.intersectsBox(cylinderBoundingBox)) {
        //Reset the players position
        playerBody.position.set(0, 10, 10);
      }
    });

    //rods bounding boxes
    rods.forEach((rod) => {
      const rodBoundingBox = new THREE.Box3().setFromObject(rod);

      if (playerBoundingBox.intersectsBox(rodBoundingBox)) {
        //Reset the players position
        playerBody.position.set(0, 10, 10);
      }
    });

    // fans.forEach((fan) => {
    //   fan.children.forEach((child) => {
    //     const fanBoundingBox = new THREE.Box3().setFromObject(child);

    //     if (playerBoundingBox.intersectsBox(fanBoundingBox)) {
    //       //Reset the players position
    //       playerBody.position.set(0, 10, 10);
    //     }
    //   });
    //   // const fanBoundingBox = new THREE.Box3().setFromObject(fan);

    //   // if (playerBoundingBox.intersectsBox(fanBoundingBox)) {
    //   //   //Reset the players position
    //   //   playerBody.position.set(0, 10, 10);
    //   // }
    // });

    /*Actual bounding boxes for the player and obstacles*/

    /*HELPERS TO VISUALIZE BOUNDING BOXES */
    if (playerHelper) {
      playerHelper.update();
    }

    //Update gate helpers
    gateHelpers.forEach((helper) => {
      if (helper) helper.update();
    });

    // fanHelpers.forEach((helper) => {
    //   if (helper) helper.update();
    // });

    //Update cylinder helpers
    cylinderHelpers.forEach((helper) => {
      if (helper) helper.update();
    });

    //Update rod helpers
    rodsHelpers.forEach((helper) => {
      if (helper) helper.update();
    });

    /*HELPERS TO VISUALIZE BOUNDING BOXES */

    // Update camera
    updateCamera();
  }

  //Animate the gates
  animateGates(deltaTime);
  animateCylinders(deltaTime);
  animateFans(deltaTime);
  animateRods(deltaTime);

  // cannonDebugger.update();
  renderer.render(scene, camera);
  //controls.update();

  stats.end();
}

init();
