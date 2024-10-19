// Import necessary libraries and modules
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as CANNON from "cannon-es";
import CannonDebugger from "cannon-es-debugger";
import Stats from "stats.js";

// Import assets
import finish from "../img/finish.jpg";
import galaxy from "../img/galaxy.jpg";

// Constants for game settings
const PLAYER_SPEED = 35;
const OBSTACLE_SPEED = 20;
let PLATFORM_SPEED = 20;

// Global variables
let scene, camera, renderer, controls, world, cannonDebugger;
let ground, finishLine, model, playerBody, mixer, runningAction;
let clock, stats;

//Material variables
let playerMaterial, obstacleMaterial;

// Movement flags
let moveForward = false,
  moveBackward = false,
  moveLeft = false,
  moveRight = false;

// Initialize the game
function init() {
  initStats();
  initScene();
  initPhysics();
  initGround();
  initObstacles();
  initFinishLine();
  initPlayer();
  initEventListeners();
  animate();
}

// Initialize stats for performance monitoring
function initStats() {
  stats = new Stats();
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb
  document.body.appendChild(stats.dom);
}

// Set up the Three.js scene, camera, renderer, and lighting
function initScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 5, 10);

  renderer = new THREE.WebGLRenderer({ antialias: true }); // Add antialias for smoother edges
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Better shadow quality
  document.body.appendChild(renderer.domElement);

  // Add ambient and directional lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(10, 20, 10);
  directionalLight.castShadow = true;

  // Configure shadow properties
  directionalLight.shadow.mapSize.width = 2048; // High resolution for sharp shadows
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 1000; // Increased far plane to reach entire scene
  directionalLight.shadow.camera.left = -150; // Widened frustum to cover full width
  directionalLight.shadow.camera.right = 150;
  directionalLight.shadow.camera.top = 200; // Increased height to cover full length
  directionalLight.shadow.camera.bottom = -200;
  directionalLight.shadow.bias = -0.001;

  // Reposition light to better cover the scene
  directionalLight.position.set(50, 50, 0); // Moved higher and to the side

  scene.add(directionalLight);

  setupBackground();

  clock = new THREE.Clock();
}

// Function to set up the background
function setupBackground() {
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    galaxy,
    (texture) => {
      scene.background = texture;
      console.log("Galaxy background loaded successfully");
    },
    undefined,
    (error) => {
      console.error(
        "An error occurred while loading the galaxy background:",
        error
      );
    }
  );
}

// Initialize the Cannon.js physics world
function initPhysics() {
  world = new CANNON.World();
  world.gravity.set(0, -9.82, 0); // Set gravity
  cannonDebugger = new CannonDebugger(scene, world, { color: 0xff0000 });

  initMaterials();
}

// Create the ground plane
function initGround() {
  const geometry = new THREE.PlaneGeometry(100, 300);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x87ceeb,
    roughness: 0.8, // Add some roughness for better shadow interaction
    metalness: 0.2,
  });
  ground = new THREE.Mesh(geometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true; // Ground receives shadows
  scene.add(ground);

  // Add physics body for the ground
  const groundShape = new CANNON.Box(new CANNON.Vec3(50, 0.1, 150));
  const groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
  groundBody.position.set(0, 0, 0);
  world.addBody(groundBody);
}

// Create obstacles and platforms
function initObstacles() {
  const obstaclePositions = [
    { x: 5, y: 2.5, z: 130, id: "obs-1", color: "#ffffff" },
    { x: 15, y: 2.5, z: 115, id: "obs-2", color: "blue" },
    { x: -5, y: 2.5, z: 125, id: "obs-3", color: "red" },
    { x: -15, y: 2.5, z: 105, id: "obs-4", color: "#ffffff" },
    { x: -20, y: 2.5, z: 110, id: "obs-5", color: "blue" },
    { x: -25, y: 2.5, z: 120, id: "obs-6", color: "red" },
    { x: 25, y: 2.5, z: 135, id: "obs-7", color: "#ffffff" },
    { x: 30, y: 2.5, z: 135, id: "obs-8", color: "blue" },
    { x: 28, y: 2.5, z: 120, id: "obs-9", color: "red" },
  ];

  obstaclePositions.forEach((pos) =>
    createCylindricalObstacle(pos.x, pos.y, pos.z, pos.id, pos.color)
  );

  createFloatingPlatform(0, 0.25, -5, "danish", "#ff0000");
}

function initMaterials() {
  playerMaterial = new CANNON.Material("playerMaterial");
  playerMaterial.friction = 0.3; // Adjust friction if needed
  playerMaterial.restitution = 1.0; // High bounciness for the player

  obstacleMaterial = new CANNON.Material("obstacleMaterial");
  obstacleMaterial.friction = 1.0; // High friction for obstacles
  obstacleMaterial.restitution = 1.0; // Bouncy effect for obstacles

  // Define how the player and obstacle interact
  const contactMaterial = new CANNON.ContactMaterial(
    playerMaterial, // The player's material
    obstacleMaterial, // The obstacle's material
    {
      friction: 1.0, // The friction between player and obstacle
      restitution: 1.0, // High restitution for a bouncy effect
    }
  );

  // Add the contact material to the world
  world.addContactMaterial(contactMaterial);
}

// Create a cylindrical obstacle
function createCylindricalObstacle(x, y, z, id, color) {
  const obstacleGeometry = new THREE.CylinderGeometry(1, 1, 10, 32);
  const obstacleMaterial = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.7,
    metalness: 0.3,
  });
  const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
  obstacle.position.set(x, y, z);
  obstacle.castShadow = true; // Obstacles cast shadows
  obstacle.receiveShadow = true; // Obstacles also receive shadows
  obstacle.name = id;
  scene.add(obstacle);

  // Add physics body for the obstacle
  const obstacleShape = new CANNON.Cylinder(1, 1, 10, 32);
  const obstacleBody = new CANNON.Body({ mass: 0, shape: obstacleShape });
  obstacleBody.position.set(x, y, z);
  obstacleBody.id = id;
  world.addBody(obstacleBody);
}

// Create a floating platform
function createFloatingPlatform(x, y, z, id, color) {
  const platformGeometry = new THREE.BoxGeometry(6, 0.5, 6);
  const platformMaterial = new THREE.MeshStandardMaterial({ color: color });
  const platform = new THREE.Mesh(platformGeometry, platformMaterial);
  platform.position.set(x, y, z);
  platform.castShadow = true;
  platform.name = id;
  scene.add(platform);
}

// Create the finish line
function initFinishLine() {
  const textureLoader = new THREE.TextureLoader();
  const finishLineGeometry = new THREE.BoxGeometry(6, 0.1, 3);
  const finishLineMaterial = new THREE.MeshStandardMaterial({
    map: textureLoader.load(finish),
  });
  finishLine = new THREE.Mesh(finishLineGeometry, finishLineMaterial);
  finishLine.position.set(0, 0.1, -135);
  finishLine.scale.set(10, 1, 10);
  scene.add(finishLine);
}

// Load and set up the player model
function initPlayer() {
  const fatGuyURL = new URL("../assets/FatGuy.glb", import.meta.url);
  const assetLoader = new GLTFLoader();

  assetLoader.load(
    fatGuyURL.href,
    (gltf) => {
      model = gltf.scene;
      model.position.set(0, 4, 140);
      model.scale.set(0.5, 0.5, 0.5);
      model.rotation.y = Math.PI;

      // Enable shadows for all meshes in the model
      model.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });

      scene.add(model);

      // Set up animation
      mixer = new THREE.AnimationMixer(model);
      const clips = gltf.animations;
      const clip = THREE.AnimationClip.findByName(clips, "Running");
      runningAction = mixer.clipAction(clip);

      initPlayerPhysics();
    },
    undefined,
    (error) => console.error("Error loading player model:", error)
  );
}

// Set up physics for the player
function initPlayerPhysics() {
  const bbox = new THREE.Box3().setFromObject(model);
  const size = bbox.getSize(new THREE.Vector3());

  const radiusTop = size.x / 4;
  const radiusBottom = size.x / 4;
  const height = size.y;

  const playerShape = new CANNON.Cylinder(radiusTop, radiusBottom, height, 16);
  playerBody = new CANNON.Body({
    mass: 5,
    position: new CANNON.Vec3(
      model.position.x,
      model.position.y,
      model.position.z
    ),
    material: playerMaterial,
  });

  playerBody.addShape(playerShape);
  const q = new CANNON.Quaternion();
  q.setFromEuler(0, 0, 0);
  playerBody.quaternion.copy(q);

  world.addBody(playerBody);
}

// Set up event listeners
function initEventListeners() {
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("resize", handleResize);
}

// Global variables
let isJumping = false; // Flag to check if the player is currently jumping
const jumpForce = 1.5; // The amount of force to apply for the jump

// Handle keydown events
function handleKeyDown(event) {
  switch (event.key) {
    case "w":
    case "ArrowUp":
      moveForward = true;
      if (runningAction && !runningAction.isRunning()) {
        runningAction.reset();
        runningAction.setLoop(THREE.LoopRepeat);
        runningAction.play();
      }
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

// Function to handle jumping
function jump() {
  // Check if the player is grounded
  if (playerBody.velocity.y < 0.5) {
    isJumping = true;
    playerBody.applyImpulse(
      new CANNON.Vec3(0, jumpForce, 0),
      playerBody.position
    );
  }
}

// Handle keyup events
function handleKeyUp(event) {
  switch (event.key) {
    case "w":
    case "ArrowUp":
      moveForward = false;
      if (runningAction) {
        runningAction.fadeOut(0.5);
      }
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

// Handle window resize
function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Main animation loop
function animate() {
  stats.begin();

  const deltaTime = clock.getDelta();
  world.step(1 / 60, deltaTime, 3);

  if (playerBody && model) {
    updateMovement(deltaTime);
    updateModelPosition();
    updateObstacles(deltaTime);
    updateCamera();
  }

  if (mixer) mixer.update(deltaTime);

  cannonDebugger.update();
  renderer.render(scene, camera);

  stats.end();

  requestAnimationFrame(animate);
}

// Update player movement based on key presses
function updateMovement(deltaTime) {
  const translationStep = PLAYER_SPEED * deltaTime;

  if (moveForward) playerBody.position.z -= translationStep;
  if (moveBackward) playerBody.position.z += translationStep;
  if (moveLeft) playerBody.position.x -= translationStep;
  if (moveRight) playerBody.position.x += translationStep;

  // Reset isJumping flag if the player has landed (velocity in the Y direction is near 0)
  if (Math.abs(playerBody.velocity.y) < 0.05) {
    isJumping = false;
  }
  playerBody.angularVelocity.set(0, 0, 0);
}

// Update the visual model's position to match the physics body
function updateModelPosition() {
  model.position.copy(playerBody.position);
  model.position.y += -1;
  model.position.z += -3;
}

// Update positions of obstacles and platforms
function updateObstacles(deltaTime) {
  movePlatform("danish", deltaTime);
  for (let i = 1; i <= 9; i++) {
    moveObstacle(`obs-${i}`, OBSTACLE_SPEED, deltaTime);
  }

  //Make the world bodies with the given id, follow the visual model
}

// Move a platform
function movePlatform(id, deltaTime) {
  const platform = scene.getObjectByName(id);
  if (platform) {
    platform.position.x += PLATFORM_SPEED * deltaTime;
    if (Math.abs(platform.position.x) > 48) {
      PLATFORM_SPEED *= -1;
    }
  }
}

const obstacleDirections = {};

// Move an obstacle
function moveObstacle(id, speed, deltaTime) {
  const obstacle = scene.getObjectByName(id);
  const obstacleBody = world.bodies.find((body) => body.id === id);

  if (obstacle) {
    // Initialize direction if it doesn't exist
    if (obstacleDirections[id] === undefined) {
      obstacleDirections[id] = 1;
    }

    // Change direction if the obstacle reaches the boundary
    if (Math.abs(obstacle.position.x) > 48) {
      obstacleDirections[id] *= -1;
    }

    // Move the obstacle
    obstacle.position.x += speed * deltaTime * obstacleDirections[id];
    obstacleBody.position.x += speed * deltaTime * obstacleDirections[id];
  }
}

// Update the camera position to follow the player
function updateCamera() {
  camera.position.set(
    model.position.x,
    model.position.y + 5,
    model.position.z + 10
  );
  camera.lookAt(model.position);
}

// Start the game
init();
