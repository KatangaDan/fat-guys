import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as CANNON from "cannon-es";
import CannonDebugger from "cannon-es-debugger";
import Stats from "stats.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import {
  createCrown,
  createCannonBall,
  createTurnstile,
  createRotatingHammer,
  createConveyorBelt,
  createStartingPlatform,
  createHorizontalCylinder,
  createCylinder,
  createPillar,
  createRod,
  createVertRod,
  createGate,
} from "./obstacles";

// Import assets
import finish from "../img/finish.jpg";
import basicBg from "../img/sample2.png";
import heart from "../img/heart.png";
import groundTexture from "../img/stoleItLol.jpg";
import PbackGroundMusic from "../sounds/backGroundMusic.mp3";
import PjumpSound from "../sounds/jumpSound.wav";
import Pjumpland from "../sounds/jumpland.wav";
import Phitsound from "../sounds/hit.wav";
import Pwinsound from "../sounds/winSound.wav";
import countdownOne from "../sounds/1.mp3";
import countdownTwo from "../sounds/2.mp3";
import countdownThree from "../sounds/3.mp3";
import countdownGo from "../sounds/GO.mp3";
import runSound from "../sounds/running.mp3";

//Global variables
let scene,
  camera,
  renderer,
  controls,
  clock,
  world,
  cannonDebugger,
  runningAction,
  backRunningAction,
  runningLeftAction,
  runningRightAction,
  jumpAction,
  fallingAction,
  mixer,
  currentAction,
  fadeDuration = 0.07,
  idleAction,
  idleClip,
  model,
  playerBody,
  modelCenterOffset,
  stats,
  cameraGoal,
  isFirstPerson = false,
  startTime = 0,
  elapsedTime = 0,
  timerRunning = false,
  previousTimestamp = 0,
  currentLives = 3,
  gameVolume = 0.5,
  backGroundMusic,
  runningAudio,
  isRunningPlaying = false,
  timerInterval,
  isPanning = false,
  panProgress = 0,
  panStartPosition = null,
  panEndPosition = null,
  panStartTime = null,
  panDuration = 5000, // 10 seconds
  countdownInterval,
  targetRotationY = 0,
  rotationDamping = 0.1; // Controls how smoothly the rotation changes

//Global variables for the background particle system
let particleSystem;
let positions;
let velocities;
let particleCount = 1500;
let particleSpreadX = 200;
let particleSpreadY = 60;
let particleSpreadZ = 1000; //Based on how long our level is

//Helpers to visualize intersection boxes
let playerHelper;

// Obstacles
let crown;
let turnstiles = [];
let hammers = [];
let rods = [];
let cylinders = [];
let gates = [];
let platforms = [];

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
let lastJumpTime = 0;
let isPlayingJumpAnimation = false;
const jumpCooldown = 250; // milliseconds between allowed jump attempts

//Audio Setup
const listener = new THREE.AudioListener();
const audioLoader = new THREE.AudioLoader();

// Cannon ball management
let cannonBalls = [],
  hasLeftStartingPlatform = false;
// Cannon positions array to cover the entire level
const CANNON_POSITIONS = [
  // Section 1 - Fork paths
  { x: -30, y: 15, z: 120 }, // Left path
  { x: 30, y: 15, z: 120 }, // Right path

  // // Section 2 - After first checkpoint
  // { x: -20, y: 15, z: 230 }, // Left side
  // { x: 20, y: 15, z: 300 },  // Right side

  // // Section 3 - Final stretch
  // { x: -25, y: 15, z: 420 }, // Left path
  // { x: 0, y: 15, z: 420 },   // Center path
  // { x: 25, y: 15, z: 420 }   // Right path
];

// Modify shooting interval
const SHOOT_INTERVAL = 1000; // Shoot every second
const SECOND_CHECKPOINT_Z = 360; // Z position of second checkpoint

// Game state variables
let isGamePaused = false;
let gameWon = false;
let loadingAnimationInterval;
let deathCooldown = 2000; // 2 seconds in milliseconds
let lastDeathTime = 0;
let frame = 0; //display game timer
let isPlayerDead = false;
let canSpawnBalls = false;
let spawnCooldown = false;
let particles = [];
const particleCountDie = 100;
const SPAWN_COOLDOWN_TIME = 1000; // 3 seconds cooldown after respawn

// minimap setup
let minimapElements, minimapScene, minimapCamera, minimapRenderer;

//function to load all game audio into buffers before the game starts
async function loadAudio() {}

async function init() {
  return new Promise(async (resolve, reject) => {
    try {
      // Reset arrays
      hammers = [];
      turnstiles = [];
      cannonBalls = [];

      console.log("Initializing the game...");
      await initStats();
      await initScene();
      await initLighting();
      await initBackground();
      await initPhysics();
      await initPlayer();
      await initBackgroundAudio();

      // Initialize minimap
      minimapElements = initMinimap();

      console.log("Creating obstacles + particles...");

      await initLevel3Layout();
      await initTurnstiles();
      await initHorizontalCylinders();
      await initHammers();
      await initGates();
      await initCheckpoints();

      // //Init particle background system
      await initBackgroundParticleSystem();

      // Create finish line
      //await initFinishLine();

      console.log("Game initialized successfully!");

      await initCannonBallSystem();

      resolve();
    } catch (error) {
      console.error("Error initializing the game:", error);
      reject(error);
    }
  });
}

function initMinimap() {
  // Create a new scene specifically for the minimap
  minimapScene = new THREE.Scene();

  // Create orthographic camera
  const minimapCamera = new THREE.OrthographicCamera(-50, 50, 50, -50, 1, 1000);
  minimapCamera.position.set(0, 200, 0);
  minimapCamera.lookAt(0, 0, 0);
  minimapCamera.up.set(0, 0, -1);

  // Setup minimap renderer
  const minimapRenderer = new THREE.WebGLRenderer({
    canvas: document.getElementById("minimap"),
    alpha: true, // Changed from antialias to alpha
  });
  minimapRenderer.setSize(150, 150); // Changed from 250x250 to 150x150 to match working version

  // Create player indicator (red dot)
  const playerDot = new THREE.Mesh(
    new THREE.CircleGeometry(2, 16), // Changed from 3,32 to 2,16 to match working version
    new THREE.MeshBasicMaterial({ color: "#f874b4" })
  );
  playerDot.rotation.x = -Math.PI / 2;
  playerDot.position.y = 0.1;
  minimapScene.add(playerDot);

  // Create simplified level layout
  createMinimapLayout();

  return {
    scene: minimapScene,
    camera: minimapCamera,
    renderer: minimapRenderer,
    playerDot: playerDot,
  };
}

// Keep your original createMinimapLayout and createMinimapPlatform functions unchanged
function createMinimapLayout() {
  const platformMaterial = new THREE.MeshBasicMaterial({ color: "#2c13ad" });
  const obstacleMaterial = new THREE.MeshBasicMaterial({ color: 0xff6b6b });
  const checkpointMaterial = new THREE.MeshBasicMaterial({ color: "#2c13ad" });

  // Starting platform
  createMinimapPlatform(0, 0, 60, 30, platformMaterial);

  // Fork paths
  createMinimapPlatform(-30, 60, 30, 60, platformMaterial);
  createMinimapPlatform(30, 60, 30, 60, platformMaterial);
  createMinimapPlatform(-30, 120, 30, 60, platformMaterial);
  createMinimapPlatform(30, 120, 30, 60, platformMaterial);

  // Checkpoint 1
  createMinimapPlatform(0, 180, 60, 30, checkpointMaterial);

  // Section 2
  createMinimapPlatform(20, 230, 40, 60, platformMaterial);
  createMinimapPlatform(-20, 300, 40, 60, platformMaterial);

  // Checkpoint 2
  createMinimapPlatform(0, 360, 60, 30, checkpointMaterial);

  // Final sections
  createMinimapPlatform(0, 420, 60, 60, platformMaterial);
  createMinimapPlatform(0, 480, 60, 30, platformMaterial);
}

function createMinimapPlatform(x, z, width, depth, material) {
  const platform = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    material
  );
  platform.rotation.x = -Math.PI / 2;
  platform.position.set(x, 0, -z);
  minimapScene.add(platform);
}

// Updated minimap update function to match working version's structure
function updateMinimap(minimapElements, player) {
  if (!minimapElements) return;

  const { scene, camera, renderer, playerDot } = minimapElements;

  // Update player dot position
  playerDot.position.x = -player.position.x;
  playerDot.position.z = -player.position.z;

  // Update camera position to follow player
  camera.position.x = -player.position.x;
  camera.position.z = -player.position.z;
  camera.lookAt(-player.position.x, 0, -player.position.z);

  // Render minimap
  renderer.render(scene, camera);
}
function addMinimapObstacles() {
  const obstacleMaterial = new THREE.MeshBasicMaterial({ color: 0xff6b6b });

  // Add simplified turnstiles
  const turnstilePositions = [
    { x: -30, z: 60 },
    { x: 30, z: 60 },
    { x: -30, z: 100 },
    { x: 30, z: 100 },
    { x: 10, z: 210 },
    { x: 30, z: 210 },
    { x: 10, z: 240 },
    { x: 30, z: 240 },
    { x: -10, z: 280 },
    { x: -30, z: 280 },
    { x: -10, z: 310 },
    { x: -30, z: 310 },
  ];

  turnstilePositions.forEach((pos) => {
    const turnstile = new THREE.Mesh(
      new THREE.CircleGeometry(5, 32),
      obstacleMaterial
    );
    turnstile.rotation.x = -Math.PI / 2;
    turnstile.position.set(pos.x, 0, -pos.z);
    minimapScene.add(turnstile);
  });

  // Add simplified gates
  const gatePositions = [
    { x: 0, z: 400 },
    { x: 0, z: 430 },
  ];

  gatePositions.forEach((pos) => {
    const gate = new THREE.Mesh(
      new THREE.BoxGeometry(50, 1, 5),
      obstacleMaterial
    );
    gate.position.set(pos.x, 0, -pos.z);
    minimapScene.add(gate);
  });
}

async function initBackgroundAudio() {
  return new Promise((resolve) => {
    backGroundMusic = new THREE.Audio(listener);
    audioLoader.load(PbackGroundMusic, function (buffer) {
      backGroundMusic.setBuffer(buffer);
      backGroundMusic.setLoop(true);
      backGroundMusic.setVolume(gameVolume / 2);
      backGroundMusic.play();

      resolve();
    });
  });
}

function updateGameVolume() {
  if (backGroundMusic) {
    backGroundMusic.setVolume(gameVolume / 2);
  }
}

// async function initFinishLine() {
//   return new Promise((resolve, reject) => {
//     const textureLoader = new THREE.TextureLoader();

//     textureLoader.load(
//       finish,
//       async (texture) => {
//         const finishLineGeometry = new THREE.BoxGeometry(60, 0, 1); // Changed width to 60 to match platform
//         const finishLineMaterial = new THREE.MeshStandardMaterial({
//           map: texture,
//         });
//         const finishLine = new THREE.Mesh(
//           finishLineGeometry,
//           finishLineMaterial
//         );
//         finishLine.position.set(0, 0, 480);
//         finishLine.scale.z = 15;
//         scene.add(finishLine);

//         // Add crown at the finish line
//         crown = await createCrown(world, scene, 0, 5, 480); // Position crown above finish line
//         resolve();
//       },
//       undefined,
//       (error) => {
//         console.error("Error loading texture:", error);
//         reject(error);
//       }
//     );
//   });
// }

// First, add these variables at the top with your other global variables

const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
const particleMaterial = new THREE.MeshBasicMaterial({
  color: "#8E1767",
  transparent: true,
  opacity: 0.8,
});

async function createParticleExplosion(position) {
  // Clear any existing particles
  particles.forEach((particle) => {
    scene.remove(particle.mesh);
  });
  particles = [];

  const explosionSpeed = 10; // Adjust this to control explosion force

  // Create new particles
  for (let i = 0; i < particleCount; i++) {
    const mesh = new THREE.Mesh(particleGeometry, particleMaterial.clone());
    mesh.position.copy(position);

    // Calculate spherical coordinates
    // Phi is the angle from the y axis (vertical angle)
    // Theta is the angle in the xz plane (horizontal angle)
    const phi = Math.acos((2 * i) / particleCount - 1);
    const theta = Math.sqrt(particleCount * Math.PI) * phi;

    // Convert spherical coordinates to cartesian coordinates for velocity
    const velocity = new THREE.Vector3(
      explosionSpeed * Math.sin(phi) * Math.cos(theta),
      explosionSpeed * Math.cos(phi),
      explosionSpeed * Math.sin(phi) * Math.sin(theta)
    );

    // Add some randomness to make it look more natural
    velocity.x += (Math.random() - 0.5) * 2;
    velocity.y += (Math.random() - 0.5) * 2;
    velocity.z += (Math.random() - 0.5) * 2;

    scene.add(mesh);

    particles.push({
      mesh: mesh,
      velocity: velocity,
      lifetime: 1.0,
    });
  }
}

// Add this to your animation loop
async function updateParticles(deltaTime) {
  particles.forEach((particle, index) => {
    // Update position based on velocity
    particle.mesh.position.x += particle.velocity.x * deltaTime;
    particle.mesh.position.y += particle.velocity.y * deltaTime;
    particle.mesh.position.z += particle.velocity.z * deltaTime;

    // Add gravity effect
    particle.velocity.y -= 9.8 * deltaTime;

    // Reduce lifetime
    particle.lifetime -= deltaTime;

    // Fade out based on lifetime
    particle.mesh.material.opacity = particle.lifetime;

    // Remove dead particles
    if (particle.lifetime <= 0) {
      scene.remove(particle.mesh);
      particles.splice(index, 1);
    }
  });
}

async function die() {
  canSpawnBalls = false; // Stop spawning while dead
  currentLives--;

  // Remove all existing cannon balls
  await removeAllCannonBalls();

  // Create particle explosion at player's current position
  createParticleExplosion(model.position);

  //Hide the player model
  model.visible = false;

  // Define checkpoint positions
  const checkpoints = {
    start: { x: 0, y: 10, z: 0 },
    checkpoint1: { x: 0, y: 10, z: 180 },
    checkpoint2: { x: 0, y: 10, z: 360 },
  };

  // Determine respawn position based on player's progress
  let respawnPosition;
  if (playerBody.position.z < 180) {
    respawnPosition = checkpoints.start;
  } else if (playerBody.position.z < 360) {
    respawnPosition = checkpoints.checkpoint1;
  } else {
    respawnPosition = checkpoints.checkpoint2;
  }

  const hitsound = new THREE.Audio(listener);
  audioLoader.load(Phitsound, function (buffer) {
    hitsound.setBuffer(buffer);
    hitsound.setLoop(false);
    hitsound.setVolume(gameVolume);
    hitsound.play();
  });

  // Wait for particle effect and then respawn
  await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay

  //true death - don't respawn: show a menu to restart the game
  if (currentLives <= 0) {
    playerBody.position.set(0, 10, 10);
    //request for mouse control
    document.exitPointerLock();
    removeEventListeners();

    generateHearts(currentLives);
    //stop the timer
    timerRunning = false;
    removeEventListeners();
    toggleMenu();
    //hide volume slider
    document.getElementById("volume-control").style.display = "none";

    //stop player moving if they die
    moveForward = false;
    moveBackward = false;
    moveLeft = false;
    moveRight = false;
    //hide resume button from menu
    document.getElementById("resumeButton").style.display = "none";
    //add "You lost" message to gameMenu
    const lostMessage = document.createElement("h1");
    lostMessage.id = "lostMessage";
    lostMessage.innerHTML = "You lost!";
    document.getElementById("gameMenu").appendChild(lostMessage);
  } else {
    // Respawn at appropriate checkpoint
    playerBody.position.set(
      respawnPosition.x,
      respawnPosition.y,
      respawnPosition.z
    );

    currentAction.stop();
    currentAction = idleAction;
    currentAction.play();

    generateHearts(currentLives);
  }

  // Make player visible again
  model.visible = true;
  isPlayerDead = false;

  // After respawn position is set
  spawnCooldown = true;
  canSpawnBalls = false;
  setTimeout(() => {
    spawnCooldown = false;
    // Only enable cannon balls if player has left starting platform
    if (hasLeftStartingPlatform) {
      canSpawnBalls = true;
    }
  }, SPAWN_COOLDOWN_TIME);
}

async function initBackgroundParticleSystem() {
  return new Promise((resolve) => {
    const particles = new THREE.BufferGeometry();
    positions = new Float32Array(particleCount * 3);
    velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * particleSpreadX;
      positions[i * 3 + 1] = (Math.random() - 0.5) * particleSpreadY;
      positions[i * 3 + 2] = Math.random() * particleSpreadZ;

      velocities[i * 3] = (Math.random() - 0.5) * 0.1;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.05;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
    }

    particles.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const particleMaterial = new THREE.PointsMaterial({
      color: "white",
      size: 0.25,
      transparent: true,
      opacity: 0.25,

      // Add blending for better transparency
      blending: THREE.AdditiveBlending,

      // Add depth test to avoid rendering overlapping particles
      depthTest: true,

      // Enable size attenuation for better visibility
      sizeAttenuation: true,

      // Enable fog for better depth perception
      fog: true,
    });

    particleSystem = new THREE.Points(particles, particleMaterial);
    scene.add(particleSystem);
    resolve();
  });
}

async function initStats() {
  return new Promise((resolve) => {
    stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb
    document.body.appendChild(stats.dom);

    resolve();
  });
}

async function initScene() {
  return new Promise((resolve) => {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x202020, 100, 500); // Add depth fog
    camera = new THREE.PerspectiveCamera(
      70, // Field of view (45-75)
      window.innerWidth / window.innerHeight,
      0.1, // Min distance objects are rendered
      1000 //Max distance objects are rendered
    );
    camera.add(listener);

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
    // renderer.setAnimationLoop(animate);
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Better shadow quality
    document.body.appendChild(renderer.domElement);

    //Create an axis
    const axesHelper = new THREE.AxesHelper(1000); // Size of the axes
    scene.add(axesHelper);

    //Start clock
    clock = new THREE.Clock();

    //Setup controls
    setupControls();
    resolve();
  });
}

// Initialize the shooting system
async function initCannonBallSystem() {
  setInterval(() => {
    if (
      !isGamePaused &&
      !spawnCooldown &&
      !isPlayerDead &&
      hasLeftStartingPlatform && // This should be checked first
      playerBody.position.z < SECOND_CHECKPOINT_Z &&
      canSpawnBalls
    ) {
      shootCannonBall();
    }
  }, SHOOT_INTERVAL);
}

async function checkForWin() {
  if (!gameWon && crown && crown.mesh) {
    const playerBoundingBox = new THREE.Box3().setFromObject(model);
    const crownBoundingBox = new THREE.Box3().setFromObject(crown.mesh);

    if (playerBoundingBox.intersectsBox(crownBoundingBox)) {
      gameWon = true;
      //set all movement flags to false
      moveForward = false;
      moveBackward = false;
      moveLeft = false;
      moveRight = false;

      //play win sound
      const winsound = new THREE.Audio(listener);
      audioLoader.load(Pwinsound, function (buffer) {
        winsound.setBuffer(buffer);
        winsound.setLoop(false);
        winsound.setVolume(gameVolume);
        winsound.play();
      });

      showWinScreen(elapsedTime);
      //Stop the timer
      timerRunning = false;

      // Hide the crown
      crown.mesh.visible = false;
      if (crown.body) {
        world.removeBody(crown.body);
      }
    }
  }
}

// function to toggle between first-person and third-person views
function toggleView() {
  isFirstPerson = !isFirstPerson;
  if (isFirstPerson) {
    controls.connect();
    model.visible = false; // Hide the model in first-person view
  } else {
    controls.disconnect();
    model.visible = true; // Show the model in third-person view
  }
}

// for pointer lock controls
async function setupControls() {
  controls = new PointerLockControls(camera, renderer.domElement);
  document.addEventListener("click", () => {
    if (!isGamePaused) {
      controls.lock(); // Lock pointer only when the game is not paused
    }
  });

  controls.addEventListener("lock", () => {
    console.log("PointerLock activated");
  });

  controls.addEventListener("unlock", () => {
    console.log("PointerLock deactivated");
  });
}

async function initLighting() {
  return new Promise((resolve) => {
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

    resolve();
  });
}

async function initBackground() {
  return new Promise((resolve) => {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(basicBg, function (texture) {
      // Set the texture mapping to equirectangular for a spherical effect
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;

      // Set up a large sphere geometry for the skybox
      const skyboxGeometry = new THREE.SphereGeometry(500, 60, 40);
      const skyboxMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide,
      });

      // Create the skybox mesh and add it to the scene
      const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
      scene.add(skybox);

      resolve();
    });
  });
}

async function initPhysics() {
  return new Promise((resolve) => {
    world = new CANNON.World();
    world.gravity.set(0, -30, 0); // Set gravity
    cannonDebugger = new CannonDebugger(scene, world, { color: 0xff0000 });
    resolve();
  });
}

async function initPlayer() {
  return new Promise((resolve) => {
    const fatGuyURL = new URL("../assets/SmoothFatGuy.glb", import.meta.url);
    const assetLoader = new GLTFLoader();

    assetLoader.load(
      fatGuyURL.href,
      (gltf) => {
        model = gltf.scene;
        model.position.set(0, 2, 180);
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
        mixer = new THREE.AnimationMixer(model);
        const clips = gltf.animations;
        const clip = THREE.AnimationClip.findByName(clips, "Running");
        runningAction = mixer.clipAction(clip);

        const clipLeft = THREE.AnimationClip.findByName(clips, "Running");
        runningLeftAction = mixer.clipAction(clipLeft);

        const clipRight = THREE.AnimationClip.findByName(clips, "Running");
        runningRightAction = mixer.clipAction(clipRight);

        const backClip = THREE.AnimationClip.findByName(
          clips,
          "Running Backward"
        );
        backRunningAction = mixer.clipAction(backClip);

        const jumpClip = THREE.AnimationClip.findByName(clips, "Jumping Land");
        jumpAction = mixer.clipAction(jumpClip);

        idleClip = THREE.AnimationClip.findByName(clips, "Idle");
        idleAction = mixer.clipAction(idleClip);

        const fallingClip = THREE.AnimationClip.findByName(clips, "Falling");
        fallingAction = mixer.clipAction(fallingClip);

        idleAction.setLoop(THREE.LoopRepeat);
        idleAction.play();

        currentAction = idleAction;

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
          new CANNON.Vec3(size.x / 4, size.y / 2, size.z / 2)
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

        // Create a helper to visualize the player's bounding box
        playerHelper = new THREE.BoxHelper(model, "red"); // Red box around object1
        //scene.add(playerHelper);

        resolve();
      },
      undefined,
      (error) => console.error("Error loading player model:", error)
    );
  });
}

// Set up movement event listeners
async function initEventListeners() {
  return new Promise((resolve) => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    // event listeners for mouse control
    document.addEventListener("mousemove", onMouseMove, false);
    //switch between first and third person view
    resolve();
  });
}

async function onMouseMove(e) {
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

// Movement functions that update the movement flags
function handleKeyDown(event) {
  switch (event.key) {
    case "w":
    case "ArrowUp":
      moveForward = true;
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
    case "p" || "P":
      // Pause the game
      toggleMenu();
      break;
    case "v":
      toggleView();
      break;
    case " ":
      // Jump when spacebar is pressed
      console.log("Jumping");

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

function checkJumpState() {
  let startingY =
    playerBody.position.y -
    (playerBody.aabb.upperBound.y - playerBody.aabb.lowerBound.y) / 2 -
    0.1;

  // Reset isJumping as soon as we start falling and near ground
  if (playerBody.velocity.y < 0 && startingY < 0.15) {
    if (isJumping) {
      isJumping = false;
      // Play landing sound
      try {
        jumpland.play();
      } catch (e) {
        console.warn("Landing sound failed to play:", e);
      }
    }
  }
}

function jump() {
  let startingY =
    playerBody.position.y -
    (playerBody.aabb.upperBound.y - playerBody.aabb.lowerBound.y) / 2 -
    0.1;
  const GROUND_THRESHOLD = 0.15;

  if (
    startingY < GROUND_THRESHOLD &&
    !isJumping &&
    Math.abs(playerBody.velocity.y) < 0.2
  ) {
    isJumping = true;
    isPlayingJumpAnimation = true;

    // Play jump sound
    try {
      jumpSound.play();
    } catch (e) {
      console.warn("Jump sound failed to play:", e);
    }

    // Apply jump force
    playerBody.applyImpulse(new CANNON.Vec3(0, jumpForce, 0), model.position);

    // Ensure jump animation plays
    crossfadeAction(currentAction, jumpAction, fadeDuration);
    currentAction = jumpAction;
  }
}

function isInAir() {
  //if(currentAction!=fallingAction){
  let startingY =
    playerBody.position.y -
    (playerBody.aabb.upperBound.y - playerBody.aabb.lowerBound.y) / 2 -
    0.1;
  const GROUND_THRESHOLD = 0.15;

  return (
    startingY >= GROUND_THRESHOLD || Math.abs(playerBody.velocity.y) >= 0.2
  );
  //}
}

function crossfadeAction(fromAction, toAction, duration) {
  if (fromAction !== toAction) {
    // Don't allow transition to running or idle animations while in air
    if (
      (toAction === runningAction ||
        toAction === backRunningAction ||
        toAction === runningLeftAction ||
        toAction === runningRightAction) &&
      isInAir()
    ) {
      return;
    }

    if (toAction == jumpAction) {
      isJumping = true;
      jumpAction.setLoop(THREE.LoopOnce);
      jumpAction.clampWhenFinished = true;
    }

    if (playerBody.position.y < 0) {
      toAction = fallingAction;
    }

    toAction.reset().fadeIn(duration).play();
    fromAction.fadeOut(duration);
    console.log(
      `Crossfade from ${fromAction.getClip().name} to ${
        toAction.getClip().name
      }`
    );
  }
}
function checkIdleState() {
  // If no movement keys are pressed and the current action isn't idle, switch to idle
  if (
    !moveForward &&
    !moveBackward &&
    !moveRight &&
    !moveLeft &&
    currentAction !== idleAction &&
    currentAction !== fallingAction &&
    !isInAir()
  ) {
    console.log("Transitioning to idle");
    //playerBody.position.y = 0;

    // Fade in the idle action
    idleAction.reset().fadeIn(fadeDuration);
    idleAction.play();

    // Fade out the current action (if it's not already idle)
    if (currentAction) {
      currentAction.fadeOut(fadeDuration);
    }

    currentAction = idleAction; // Set the current action to idle
  }
}

// Update player movement based on key presses
// Update the updateMovement function to use camera direction
function updateMovement(delta) {
  const speed = PLAYER_SPEED * delta;

  // Calculate forward and right vectors based on camera rotation

  let forward;
  let right;

  if (isFirstPerson) {
    // In first-person, use camera's direction
    forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; // Keep movement on the horizontal plane
    right = new THREE.Vector3(forward.z, 0, -forward.x);
  } else {
    // In third-person, use existing logic
    forward = new THREE.Vector3(0, 0, 1);
    right = new THREE.Vector3(1, 0, 0);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation.y);
    right.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation.y);
  }

  // Calculate movement direction
  const moveDirection = new THREE.Vector3(0, 0, 0);

  if (moveForward) moveDirection.add(forward);
  if (moveBackward) moveDirection.sub(forward);
  if (moveLeft) moveDirection.add(right);
  if (moveRight) moveDirection.sub(right);

  const isMoving =
    moveForward || moveBackward || moveLeft || moveRight || isJumping;

  if (isMoving) {
    let targetAction = runningAction;

    if (!isInAir()) {
      // Determine which movement animation to play
      if (moveBackward && !moveForward && !moveLeft && !moveRight) {
        targetAction = backRunningAction;
      }
      if (moveLeft && !moveForward && !moveBackward && !moveRight) {
        targetAction = runningLeftAction;
      }
      if (moveRight && !moveForward && !moveBackward && !moveLeft) {
        targetAction = runningRightAction;
      }
    } else if (currentAction !== jumpAction) {
      // If we're in the air and not already jumping, keep the current animation
      targetAction = currentAction;
    }

    if (playerBody.position.y < 0) {
      targetAction = fallingAction;
    }

    // Always prioritize jumpAction if we're jumping
    if (isJumping) {
      targetAction = jumpAction;
    }

    // Crossfade to the appropriate movement animation if it's different from the current one
    if (
      currentAction !== targetAction &&
      (!isInAir() || targetAction === jumpAction)
    ) {
      crossfadeAction(currentAction, targetAction, fadeDuration);
      currentAction = targetAction; // Update current action to the new one
    }
    const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
    // // Create a quaternion for the target rotation
    playerBody.quaternion.setFromAxisAngle(
      new CANNON.Vec3(0, 1, 0),
      targetRotation
    );
  } else {
    // Check if the player should transition to the idle animation
    console.log("Checking idle state");
    checkIdleState();
  }

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

async function initTurnstiles() {
  // Section 1 - Fork path
  turnstiles.push(await createTurnstile(world, scene, -30, 0, 60, 2, 15)); // Left path
  turnstiles.push(await createTurnstile(world, scene, 30, 0, 60, 2, 15)); // Right path
  turnstiles.push(await createTurnstile(world, scene, -30, 0, 100, 2, 15)); // Left path
  turnstiles.push(await createTurnstile(world, scene, 30, 0, 100, 2, 15)); // Right path

  // Section 2 - After first checkpoint
  turnstiles.push(await createTurnstile(world, scene, -10, 0, 210, 2, 15));
  turnstiles.push(await createTurnstile(world, scene, -30, 0, 210, 2, 15));
  turnstiles.push(await createTurnstile(world, scene, -10, 0, 240, 2, 15));
  turnstiles.push(await createTurnstile(world, scene, -30, 0, 240, 2, 15));
  turnstiles.push(await createTurnstile(world, scene, 10, 0, 280, 2, 15));
  turnstiles.push(await createTurnstile(world, scene, 30, 0, 280, 2, 15));
  turnstiles.push(await createTurnstile(world, scene, 10, 0, 310, 2, 15));
  turnstiles.push(await createTurnstile(world, scene, 30, 0, 310, 2, 15));
  // Section 3 - Final stretch
  // turnstiles.push(await createTurnstile(world, scene, 0, 0, 400, 2, 15));
  // turnstiles.push(await createTurnstile(world, scene, -15, 0, 420, 2, 15));
}

async function initHorizontalCylinders() {
  // Section 2 - left
  await createHorizontalCylinder(world, scene, 10, -2, 210, 2, 50);
  await createHorizontalCylinder(world, scene, 25, -2, 210, 2, 50);
  // Section 2 - right
  await createHorizontalCylinder(world, scene, -10, -2, 270, 2, 60);
  await createHorizontalCylinder(world, scene, -25, -2, 270, 2, 60);

  // Add moving rods on top of cylinders
  // Section 2 - left rods

  const rod1 = await createRod(scene, 10, 1, 220, 5, 30, 0.5, 10, 25);
  rod1.rotation.z = Math.PI / 2; // Rotate the rod to be horizontal
  rods.push(rod1);

  const rodz1 = await createVertRod(scene, 25, 1, 230, 5, 30, 0.5, 10, 20);
  rodz1.rotation.z = Math.PI / 2; // Rotate the rod to be horizontal
  rods.push(rodz1);

  const rod2 = await createRod(scene, 10, 1, 240, 5, 30, 0.5, 10, 30);
  rod2.rotation.z = Math.PI / 2; // Rotate the rod to be horizontal
  rods.push(rod2);

  const rodz2 = await createVertRod(scene, 25, 1, 250, 5, 30, 0.5, 10, 20);
  rodz2.rotation.z = Math.PI / 2; // Rotate the rod to be horizontal
  rods.push(rodz2);

  const rod6 = await createRod(scene, 10, 1, 260, 5, 30, 0.5, 10, 30);
  rod6.rotation.z = Math.PI / 2; // Rotate the rod to be horizontal
  rods.push(rod6);

  // Section 2 - right rods
  const rod3 = await createRod(scene, -10, 1, 280, -30, -5, 0.5, 10, 20);
  rod3.rotation.z = Math.PI / 2; // Rotate the rod to be horizontal
  rods.push(rod3);

  const rodz3 = await createVertRod(scene, -25, 1, 290, -30, -5, 0.5, 10, 20);
  rodz3.rotation.z = Math.PI / 2; // Rotate the rod to be horizontal
  rods.push(rodz3);

  const rod4 = await createRod(scene, -10, 1, 300, -30, -5, 0.5, 10, 25);
  rod4.rotation.z = Math.PI / 2; // Rotate the rod to be horizontal
  rods.push(rod4);

  const rodz4 = await createVertRod(scene, -25, 1, 310, -30, -5, 0.5, 10, 20);
  rodz4.rotation.z = Math.PI / 2; // Rotate the rod to be horizontal
  rods.push(rodz4);

  const rod5 = await createRod(scene, -10, 1, 320, -30, -5, 0.5, 10, 20);
  rod5.rotation.z = Math.PI / 2; // Rotate the rod to be horizontal
  rods.push(rod5);
}

async function initLevel3Layout() {
  // Starting platform
  const startPlatform = await createStartingPlatform(
    world,
    scene,
    0,
    0,
    0,
    60,
    0.1,
    30
  );
  scene.remove(startPlatform.fences.back.mesh);
  scene.remove(startPlatform.fences.left.mesh);
  scene.remove(startPlatform.fences.right.mesh);
  world.removeBody(startPlatform.fences.back.body);
  world.removeBody(startPlatform.fences.left.body);
  world.removeBody(startPlatform.fences.right.body);

  // Left path (no back fences)
  const leftPath1 = await createStartingPlatform(
    world,
    scene,
    -30,
    0,
    60,
    30,
    0.1,
    60
  );
  scene.remove(leftPath1.fences.back.mesh);
  world.removeBody(leftPath1.fences.back.body);

  const leftPath2 = await createStartingPlatform(
    world,
    scene,
    -30,
    0,
    120,
    30,
    0.1,
    60
  );
  scene.remove(leftPath2.fences.back.mesh);
  world.removeBody(leftPath2.fences.back.body);

  // Right path (no back fences)
  const rightPath1 = await createStartingPlatform(
    world,
    scene,
    30,
    0,
    60,
    30,
    0.1,
    60
  );
  scene.remove(rightPath1.fences.back.mesh);
  world.removeBody(rightPath1.fences.back.body);

  const rightPath2 = await createStartingPlatform(
    world,
    scene,
    30,
    0,
    120,
    30,
    0.1,
    60
  );
  scene.remove(rightPath2.fences.back.mesh);
  world.removeBody(rightPath2.fences.back.body);

  const section2right = await createStartingPlatform(
    world,
    scene,
    -20,
    0,
    230,
    40,
    0.1,
    60
  );
  scene.remove(section2right.fences.back.mesh);
  world.removeBody(section2right.fences.back.body);

  const section2left = await createStartingPlatform(
    world,
    scene,
    20,
    0,
    300,
    40,
    0.1,
    60
  );
  scene.remove(section2left.fences.back.mesh);
  world.removeBody(section2left.fences.back.body);

  const section3 = await createStartingPlatform(
    world,
    scene,
    0,
    0,
    420,
    60,
    0.1,
    60
  );
  scene.remove(section3.fences.back.mesh);
  world.removeBody(section3.fences.back.body);

  // Rest of platforms (no back fences)
  const platforms = [
    await createStartingPlatform(world, scene, 0, 0, 180, 60, 0.1, 30), // Checkpoint 1
    await createStartingPlatform(world, scene, 0, 0, 360, 60, 0.1, 30), // Checkpoint 2
    await createStartingPlatform(world, scene, 0, 0, 480, 60, 0.1, 30), // Final platform
  ];

  // Remove back fences from all remaining platforms
  platforms.forEach((platform) => {
    scene.remove(platform.fences.back.mesh);
    scene.remove(platform.fences.left.mesh);
    scene.remove(platform.fences.right.mesh);
    world.removeBody(platform.fences.back.body);
    world.removeBody(platform.fences.left.body);
    world.removeBody(platform.fences.right.body);
  });

  // Add crown at the finish line
  crown = await createCrown(world, scene, 0, 3, 480);
}

async function initGates() {
  // First set of pillars and gates (4 pillars, 3 gates)
  const firstSetZ = 400; // First set position
  const pillarWidth = 3;
  const pillarHeight = 8;
  const pillarDepth = 6;

  // Create first set of pillars
  let pillar1 = await createPillar(
    world,
    scene,
    28.5,
    0,
    firstSetZ,
    pillarWidth,
    pillarHeight,
    pillarDepth
  );
  let pillar2 = await createPillar(
    world,
    scene,
    9.5,
    0,
    firstSetZ,
    pillarWidth,
    pillarHeight,
    pillarDepth
  );
  let pillar3 = await createPillar(
    world,
    scene,
    -9.5,
    0,
    firstSetZ,
    pillarWidth,
    pillarHeight,
    pillarDepth
  );
  let pillar4 = await createPillar(
    world,
    scene,
    -28.5,
    0,
    firstSetZ,
    pillarWidth,
    pillarHeight,
    pillarDepth
  );

  // Create gates between pillars (first set)
  gates.push(
    await createGate(
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

  gates.push(
    await createGate(
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

  gates.push(
    await createGate(
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

  // Second set of pillars, gates, and cylinders
  const secondSetZ = 430;

  // Create second set of pillars
  let pillar5 = await createPillar(
    world,
    scene,
    28.5,
    0,
    secondSetZ,
    pillarWidth,
    pillarHeight,
    pillarDepth
  );
  let pillar6 = await createPillar(
    world,
    scene,
    9.5,
    0,
    secondSetZ,
    pillarWidth,
    pillarHeight,
    pillarDepth
  );
  let pillar7 = await createPillar(
    world,
    scene,
    -9.5,
    0,
    secondSetZ,
    pillarWidth,
    pillarHeight,
    pillarDepth
  );
  let pillar8 = await createPillar(
    world,
    scene,
    -28.5,
    0,
    secondSetZ,
    pillarWidth,
    pillarHeight,
    pillarDepth
  );

  // Create cylinders near second set
  cylinders.push(await createCylinder(scene, 30, 0, secondSetZ - 1.5, 1, 6));
  cylinders.push(await createCylinder(scene, -30, 0, secondSetZ + 8, 1, 6));

  // Create gates between pillars (second set)
  gates.push(
    await createGate(
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

  gates.push(
    await createGate(
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

  gates.push(
    await createGate(
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
}

async function initHammers() {
  // Section 1 obstacles - Fork paths
  const hammerr1 = createRotatingHammer(world, scene, -22, 0, 40, 1, 5); // Left path hammer
  const hammerr2 = createRotatingHammer(world, scene, -38, 0, 40, 1, 5); // Right path hammer
  const hammerl1 = createRotatingHammer(world, scene, 22, 0, 40, 1, 5); // Left path hammer
  const hammerl2 = createRotatingHammer(world, scene, 38, 0, 40, 1, 5); // Right path hammer
  const hammerr3 = createRotatingHammer(world, scene, -22, 0, 80, 1, 5); // Left path hammer
  const hammerr4 = createRotatingHammer(world, scene, -38, 0, 80, 1, 5); // Right path hammer
  const hammerl3 = createRotatingHammer(world, scene, 22, 0, 80, 1, 5); // Left path hammer
  const hammerl4 = createRotatingHammer(world, scene, 38, 0, 80, 1, 5); // Right path hammer
  const hammerr5 = createRotatingHammer(world, scene, -22, 0, 120, 1, 5); // Left path hammer
  const hammerr6 = createRotatingHammer(world, scene, -38, 0, 120, 1, 5); // Right path hammer
  const hammerl5 = createRotatingHammer(world, scene, 22, 0, 120, 1, 5); // Left path hammer
  const hammerl6 = createRotatingHammer(world, scene, 38, 0, 120, 1, 5); // Right path hammer
  const hammer6 = createRotatingHammer(world, scene, 30, 0, 140, 1, 6); // Right path hammer
  const hammer7 = createRotatingHammer(world, scene, -30, 0, 140, 1, 6); // Right path hammer
  hammers.push(
    hammerr1,
    hammerr2,
    hammerl1,
    hammerl2,
    hammerr3,
    hammerr4,
    hammerl3,
    hammerl4,
    hammerr5,
    hammerr6,
    hammerl5,
    hammerl6,
    hammer6,
    hammer7
  );

  // Section 2 obstacles - Zigzag section
  const hammer3 = createRotatingHammer(world, scene, -20, 0, 225, 1, 6);
  const hammer4 = createRotatingHammer(world, scene, -20, 0, 255, 1, 6);
  const hammer5 = createRotatingHammer(world, scene, 20, 0, 295, 1, 6);
  const hammer8 = createRotatingHammer(world, scene, 20, 0, 325, 1, 6);
  hammers.push(hammer3, hammer4, hammer5, hammer8);

  // Section 3 obstacles - Final stretch
  // const hammer5 = createRotatingHammer(world, scene, 0, 0, 440, 1, 2);
  // hammers.push(hammer5);
}

async function initCheckpoints() {
  // Create checkpoint markers (you can use custom models or simple geometries)
  const checkpointGeometry = new THREE.BoxGeometry(60, 5, 2);
  const checkpointMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0,
  });

  // Checkpoint 1
  const checkpoint1 = new THREE.Mesh(checkpointGeometry, checkpointMaterial);
  checkpoint1.position.set(0, 2.5, 180);
  scene.add(checkpoint1);

  // Checkpoint 2
  const checkpoint2 = new THREE.Mesh(checkpointGeometry, checkpointMaterial);
  checkpoint2.position.set(0, 2.5, 360);
  scene.add(checkpoint2);
}

// Shoot a cannon ball from the end line towards the player
async function shootCannonBall() {
  // Don't shoot if:
  // 1. No model/player
  // 2. Game won
  // 3. Past second checkpoint
  // 4. Game is paused
  // 5. In spawn cooldown
  // 6. Player is dead
  if (
    !model ||
    !playerBody ||
    gameWon ||
    playerBody.position.z >= SECOND_CHECKPOINT_Z ||
    isGamePaused ||
    spawnCooldown ||
    isPlayerDead
  )
    return;

  // Randomly select a cannon position
  const cannonPos =
    CANNON_POSITIONS[Math.floor(Math.random() * CANNON_POSITIONS.length)];
  const startPosition = new THREE.Vector3(
    cannonPos.x,
    cannonPos.y,
    cannonPos.z
  );

  // Add some randomization to the x position for variety
  startPosition.x += (Math.random() - 0.5) * 20; // Random spread of ±10 units

  // Calculate direction towards player with adjusted aim
  const targetPos = model.position.clone();
  targetPos.y += 2; // Aim slightly above player

  // Add some randomization to targeting
  targetPos.x += (Math.random() - 0.5) * 5; // Random targeting spread
  targetPos.z += (Math.random() - 0.5) * 5;

  const direction = new THREE.Vector3()
    .subVectors(targetPos, startPosition)
    .normalize();

  // Adjust speed based on distance to player for more consistent trajectories
  const distanceToPlayer = startPosition.distanceTo(targetPos);
  const speedMultiplier = Math.min(distanceToPlayer / 100, 2); // Cap the multiplier at 2

  // Create the cannon ball with adjusted parameters
  const cannonBall = await createCannonBall(
    scene,
    world,
    1.0,
    startPosition,
    direction,
    speedMultiplier
  );

  cannonBalls.push(cannonBall);

  // Clean up old cannon balls after 8 seconds
  setTimeout(() => {
    if (cannonBall.mesh && cannonBall.body) {
      scene.remove(cannonBall.mesh);
      world.removeBody(cannonBall.body);
      cannonBalls = cannonBalls.filter((ball) => ball !== cannonBall);
    }
  }, 8000);
}

// Update cannon balls in the animation loop
async function updateCannonBalls(deltaTime) {
  cannonBalls.forEach((cannonBall) => {
    if (cannonBall.mesh && cannonBall.body) {
      // Update visual position to match physics
      cannonBall.mesh.position.copy(cannonBall.body.position);
      cannonBall.mesh.quaternion.copy(cannonBall.body.quaternion);

      // Check for collision with player
      const ballBoundingBox = new THREE.Box3().setFromObject(cannonBall.mesh);
      const playerBoundingBox = new THREE.Box3().setFromObject(model);

      if (playerBoundingBox.intersectsBox(ballBoundingBox)) {
        const currentTime = Date.now();
        if (!isPlayerDead && currentTime - lastDeathTime > deathCooldown) {
          isPlayerDead = true;
          lastDeathTime = currentTime;
          die();

          // Remove the cannon ball after hit
          scene.remove(cannonBall.mesh);
          world.removeBody(cannonBall.body);
          cannonBalls = cannonBalls.filter((ball) => ball !== cannonBall);

          setTimeout(() => {
            isPlayerDead = false;
          }, deathCooldown);
        }
      }
    }
  });
}

// function to remove all cannon balls
async function removeAllCannonBalls() {
  cannonBalls.forEach((ball) => {
    if (ball.mesh && ball.body) {
      scene.remove(ball.mesh);
      world.removeBody(ball.body);
    }
  });
  cannonBalls = [];
}

async function animateCrown(deltaTime) {
  return new Promise((resolve) => {
    if (crown && crown.mesh) {
      crown.mesh.rotation.y += deltaTime * 0.5; // Rotate the crown
    }
    resolve();
  });
}

async function animateTurnstile(deltaTime) {
  return new Promise((resolve) => {
    turnstiles.forEach((turnstile) => {
      // Only animate if turnstile is ahead of player and within range
      if (
        turnstile.mesh &&
        turnstile.body &&
        turnstile.mesh.position.z > playerBody.position.z - 30 && // Don't animate obstacles behind player
        turnstile.mesh.position.z < playerBody.position.z + 100
      ) {
        // Don't animate obstacles too far ahead
        const rotation = deltaTime * 1.0;
        turnstile.mesh.rotation.y += rotation;
        turnstile.body.quaternion.setFromAxisAngle(
          new CANNON.Vec3(0, 1, 0),
          turnstile.mesh.rotation.y
        );
      }
    });
    resolve();
  });
}

async function animateHammer(deltaTime) {
  return new Promise((resolve) => {
    hammers.forEach((hammer) => {
      // Only animate if hammer is ahead of player and within range
      if (
        hammer &&
        hammer.updateRotation &&
        hammer.mesh.position.z > playerBody.position.z - 30 &&
        hammer.mesh.position.z < playerBody.position.z + 100
      ) {
        hammer.updateRotation(deltaTime);
      }
    });
    resolve();
  });
}

async function animateRods(deltaTime) {
  let waitTime = 0.5; // Seconds to wait at each position

  rods.forEach((rod) => {
    // Only animate if rod is ahead of player and within range
    if (
      rod.position.z > playerBody.position.z - 30 &&
      rod.position.z < playerBody.position.z + 100
    ) {
      const maxX = Math.max(rod.maxX, rod.minX);
      const minX = Math.min(rod.maxX, rod.minX);
      const moveSpeed = rod.speed;

      // Initialize the rod direction if it doesn't exist
      if (rod.moveDirection === undefined) {
        rod.moveDirection = rod.position.x >= maxX ? -1 : 1;
      }

      if (rod.waitTimer === undefined) {
        rod.waitTimer = 0; // Timer for waiting at bounds
      }

      // Check if the rod is waiting at the bounds
      if (rod.waitTimer > 0) {
        rod.waitTimer -= deltaTime; // Reduce the wait timer
        return; // Skip the movement until wait time is over
      }

      // Clamp rod position to max/min bounds
      if (rod.position.x > maxX) {
        rod.position.x = maxX;
        rod.moveDirection *= -1;
        rod.waitTimer = waitTime; // Set wait timer before moving again
      } else if (rod.position.x < minX) {
        rod.position.x = minX;
        rod.moveDirection *= -1;
        rod.waitTimer = waitTime; // Set wait timer before moving again
      }

      rod.position.x += rod.moveDirection * moveSpeed * deltaTime;
    }
  });
}

async function animateGates(deltaTime) {
  const moveSpeed = 20; // Movement speed
  const waitTime = 1; // Seconds to wait at each position

  gates.forEach((gate) => {
    // Only animate if gate is ahead of player and within range
    if (
      gate.position.z > playerBody.position.z - 30 &&
      gate.position.z < playerBody.position.z + 100
    ) {
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
      if (
        !gate.waiting &&
        (gate.position.y >= maxY || gate.position.y <= minY)
      ) {
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
    }
  });
}

async function animateCylinders(deltaTime) {
  return new Promise((resolve) => {
    const moveSpeed = 40; // Movement speed

    cylinders.forEach((cylinder) => {
      // Only animate if cylinder is ahead of player and within range
      if (
        cylinder.position.z > playerBody.position.z - 30 &&
        cylinder.position.z < playerBody.position.z + 100
      ) {
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
      }
    });

    resolve();
  });
}

// Update the camera position to follow the player and initial panning
async function updateCamera() {
  if (!model || isPlayerDead) return;

  // Handle panning animation
  if (isPanning) {
    const currentTime = Date.now();
    const elapsed = currentTime - panStartTime;
    panProgress = Math.min(elapsed / panDuration, 1);

    // Use easing function for smooth motion
    const easedProgress = easeInOutQuad(panProgress);

    // Interpolate camera position
    camera.position.lerpVectors(
      panStartPosition,
      panEndPosition,
      easedProgress
    );

    //look at a point in front and under the camera
    // Calculate look-at point: 50 units ahead and 20 units below camera
    const lookAtPoint = camera.position.clone();
    // lookAtPoint.z -= 50; // Look 50 units ahead
    lookAtPoint.x += 70;
    lookAtPoint.y -= 50; // Look 20 units down

    camera.lookAt(lookAtPoint);

    // Check if panning is complete
    if (panProgress >= 1) {
      isPanning = false;
      panProgress = 0;
    }

    return; // Skip regular camera updates while panning
  }

  // Your existing camera update logic
  if (isFirstPerson) {
    model.visible = false;
    const headPosition = model.position.clone().add(new THREE.Vector3(0, 2, 0));
    camera.position.copy(headPosition);
    camera.rotation.copy(controls.getObject().rotation);
  } else {
    const cameraPosition = new THREE.Vector3(
      Math.sin(cameraRotation.y) * cameraOffset.z,
      cameraOffset.y,
      Math.cos(cameraRotation.y) * cameraOffset.z
    );
    cameraPosition.add(model.position);
    camera.position.lerp(cameraPosition, cameraLerpFactor);
    const lookTarget = model.position.clone().add(new THREE.Vector3(0, 2, 0));
    camera.lookAt(lookTarget);
    camera.rotateX(cameraRotation.x);
  }
}

// Easing function for smooth acceleration and deceleration
async function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

async function startGameTimer() {
  startCountdown(); // Only start the countdown, don't start the timer yet
}

async function removeEventListeners() {
  //remove event listeners
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
  window.removeEventListener("mousemove", onMouseMove, false);
}

async function startCountdown() {
  removeEventListeners(); // Remove any existing event listeners

  const audioLoader = new THREE.AudioLoader();
  let countdownAudio = new THREE.Audio(listener);

  const mapCountdownSounds = {
    3: countdownThree,
    2: countdownTwo,
    1: countdownOne,
    GO: countdownGo,
  };

  function playCountdownSound(count) {
    let soundFile = mapCountdownSounds[count];

    // Stop any currently playing sound
    if (countdownAudio.isPlaying) {
      countdownAudio.stop();
    }

    audioLoader.load(soundFile, function (buffer) {
      countdownAudio.setBuffer(buffer);
      countdownAudio.setLoop(false);
      countdownAudio.setVolume(gameVolume);
      countdownAudio.play();
    });
  }

  // clear existing countdown element if it exists
  let countdownDisplay = document.getElementById("countdown");
  if (countdownDisplay) {
    countdownDisplay.remove();
  }

  let count = 3;
  countdownDisplay = document.getElementById("countdown");

  countdownDisplay = document.createElement("div");
  countdownDisplay.id = "countdown";
  countdownDisplay.style.cssText = `
            position: fixed;
            top: 25%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 150px;
            font-weight: bold;
            color: #ffffff;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        `;
  document.body.appendChild(countdownDisplay);

  countdownDisplay.style.display = "block";
  countdownInterval = setInterval(() => {
    if (count > 0) {
      playCountdownSound(count); // Play sound for the current countdown number
      countdownDisplay.textContent = count;
      countdownDisplay.style.transform = "translate(-50%, -50%) scale(1.2)";
      setTimeout(() => {
        countdownDisplay.style.transform = "translate(-50%, -50%) scale(1)";
      }, 200);
      count--;
    } else {
      countdownDisplay.textContent = "GO!";
      playCountdownSound("GO"); // Play "GO.mp3" sound

      // Start the timer and player control after the countdown ends
      initEventListeners();
      initializeTimer();

      // Clear the interval and hide the countdown display after 1 second
      clearInterval(countdownInterval);
      setTimeout(() => {
        countdownDisplay.style.display = "none";
      }, 1000);
    }
  }, 1000);
}

async function initializeTimer() {
  startTime = Date.now();
  elapsedTime = 0;
  timerRunning = true;
  updateTimerDisplay(0);
  timerInterval = setInterval(updateTimer, 100);
}

// Update game timer
async function updateTimer() {
  if (!timerRunning) return;

  const currentTime = Date.now(); // Get the current timestamp in milliseconds
  // Calculate the time elapsed since the timer started
  elapsedTime = currentTime - startTime;

  // Update the display
  updateTimerDisplay(elapsedTime);
}

// Create a function to show the timer
async function showTimer() {
  const timer = document.createElement("div");
  timer.id = "game-timer";

  // Style the timer
  timer.style.position = "fixed";
  timer.style.top = "12px";
  timer.style.right = "150px";
  timer.style.color = "white";
  timer.style.padding = "10px";
  timer.style.borderRadius = "5px";
  timer.style.fontSize = "30px";
  timer.style.zIndex = "10000"; // Higher than other game elements

  // Initial timer content
  timer.textContent = "0.0 s";

  document.body.appendChild(timer);
}

// Update the timer display
async function updateTimerDisplay(timeInMs) {
  const timer = document.getElementById("game-timer");
  if (timer) {
    const seconds = Math.max(0, timeInMs / 1000).toFixed(1); // Ensure we never show negative time
    timer.textContent = seconds + " s";
  }
}

// Reset timer function (useful for restarts)
async function resetTimer() {
  elapsedTime = 0; // Reset elapsed time
  timerRunning = false;
  updateTimerDisplay(0);
}

// Modified panCameraToStart function
async function panCameraToStart() {
  return new Promise((resolve) => {
    // Set initial camera position
    camera.position.set(-70, 50, 350);
    panStartPosition = new THREE.Vector3(-70, 50, 400);
    panEndPosition = new THREE.Vector3(-70, 50, 10);
    panStartTime = Date.now();
    isPanning = true;

    // Create an interval to check when panning is complete
    const checkInterval = setInterval(() => {
      if (!isPanning) {
        clearInterval(checkInterval);
        isFirstPerson = false;
        updateCamera();
        resolve();
      }
    }, 100);
  });
}

async function animate() {
  frame++;
  stats.begin();

  // update the game timer
  updateTimer();
  //console.log("elapsedTime", elapsedTime);

  //check if the player has reached the end of the game
  checkForWin();

  // Update the physics world on every frame
  const deltaTime = clock.getDelta();
  world.step(1 / 60, deltaTime, 10);

  updateParticles(deltaTime);

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

    //checking for falling
    if (playerBody.position.y < 0) {
      //console.log("Transitioning to falling");
      crossfadeAction(currentAction, fallingAction, fadeDuration);
      currentAction = fallingAction; // Update current action to the new one
      idleAction.stop();
    }

    if (playerBody.position.y < -20) {
      const currentTime = Date.now();
      if (!isPlayerDead && currentTime - lastDeathTime > deathCooldown) {
        isPlayerDead = true;
        lastDeathTime = currentTime;
        die();

        // Reset the dead state after the cooldown
        setTimeout(() => {
          isPlayerDead = false;
        }, deathCooldown);
      }
    }

    if (mixer) {
      mixer.update(deltaTime);
    }

    // Then update position with offset
    const worldOffset = modelCenterOffset.clone();
    worldOffset.applyQuaternion(playerBody.quaternion); // Transform offset by current rotation

    // check if player is currently in idling animation
    if (currentAction === idleAction) {
      // Update the position of the model based on the physics body (update each component separately)
      model.position.x = playerBody.position.x + worldOffset.x;
      model.position.y = playerBody.position.y + worldOffset.y - 0.5;
      model.position.z = playerBody.position.z + worldOffset.z;
    } else {
      model.position.copy(playerBody.position).add(worldOffset);
    }

    // Check for collisions with new obstacles
    const playerBoundingBox = new THREE.Box3().setFromObject(model);

    // Reset crown visibility when game restarts
    if (!gameWon && crown && crown.mesh && !crown.mesh.visible) {
      crown.mesh.visible = true;
      if (crown.body && !world.bodies.includes(crown.body)) {
        world.addBody(crown.body);
      }
    }

    // Check collision with turnstiles
    turnstiles.forEach((turnstile) => {
      if (turnstile.mesh && playerBody) {
        // Create bounding box for turnstile mesh
        const turnstileBoundingBox = new THREE.Box3().setFromObject(
          turnstile.mesh
        );
        const playerBoundingBox = new THREE.Box3().setFromObject(model);

        if (playerBoundingBox.intersectsBox(turnstileBoundingBox)) {
          const currentTime = Date.now();
          if (!isPlayerDead && currentTime - lastDeathTime > deathCooldown) {
            isPlayerDead = true;
            lastDeathTime = currentTime;
            die();

            setTimeout(() => {
              isPlayerDead = false;
            }, deathCooldown);
          }
        }
      }
    });

    // Check collision with hammers
    hammers.forEach((hammer) => {
      if (hammer && hammer.mesh && playerBody) {
        // Create bounding box for hammer mesh
        const hammerBoundingBox = new THREE.Box3().setFromObject(hammer.mesh);
        const playerBoundingBox = new THREE.Box3().setFromObject(model);

        if (playerBoundingBox.intersectsBox(hammerBoundingBox)) {
          const currentTime = Date.now();
          if (!isPlayerDead && currentTime - lastDeathTime > deathCooldown) {
            isPlayerDead = true;
            lastDeathTime = currentTime;
            die();

            setTimeout(() => {
              isPlayerDead = false;
            }, deathCooldown);
          }
        }
      }
    });

    // Check for collisions with gates
    gates.forEach((gate) => {
      const gateBoundingBox = new THREE.Box3().setFromObject(gate);

      if (playerBoundingBox.intersectsBox(gateBoundingBox)) {
        const currentTime = Date.now();
        if (!isPlayerDead && currentTime - lastDeathTime > deathCooldown) {
          isPlayerDead = true;
          lastDeathTime = currentTime;
          die();

          // Reset the dead state after the cooldown
          setTimeout(() => {
            isPlayerDead = false;
          }, deathCooldown);
        }
      }
    });

    // Check for collisions with cylinders
    cylinders.forEach((cylinder) => {
      const cylinderBoundingBox = new THREE.Box3().setFromObject(cylinder);

      if (playerBoundingBox.intersectsBox(cylinderBoundingBox)) {
        const currentTime = Date.now();
        if (!isPlayerDead && currentTime - lastDeathTime > deathCooldown) {
          isPlayerDead = true;
          lastDeathTime = currentTime;
          die();

          // Reset the dead state after the cooldown
          setTimeout(() => {
            isPlayerDead = false;
          }, deathCooldown);
        }
      }
    });

    // Check for collisions with platforms
    platforms.forEach((platform) => {
      const platformBoundingBox = new THREE.Box3().setFromObject(platform);
      if (playerBoundingBox.intersectsBox(platformBoundingBox)) {
        // Ensure player stays on top of platform
        if (playerBody.position.y > platform.position.y) {
          playerBody.position.y = platform.position.y + 1;
          playerBody.velocity.y = 0;
        }
      }
    });

    // Update fence collisions with stronger push-back
    platforms.forEach((platform) => {
      if (platform.userData.fences) {
        Object.values(platform.userData.fences).forEach((fence) => {
          if (fence.body && fence.mesh) {
            const fenceBoundingBox = new THREE.Box3().setFromObject(fence.mesh);
            if (playerBoundingBox.intersectsBox(fenceBoundingBox)) {
              const pushDirection = new THREE.Vector3()
                .subVectors(playerBody.position, fence.body.position)
                .normalize();

              // Increase push-back force significantly
              playerBody.applyForce(
                new CANNON.Vec3(pushDirection.x, 0, pushDirection.z).scale(
                  1000
                ),
                playerBody.position
              );

              // Add upward force to prevent clipping through
              playerBody.velocity.y = Math.max(playerBody.velocity.y, 5);

              // Add horizontal velocity dampening
              playerBody.velocity.x *= 0.5;
              playerBody.velocity.z *= 0.5;
            }
          }
        });
      }
    });

    // check for collisions with rods
    rods.forEach((rod) => {
      const rodBoundingBox = new THREE.Box3().setFromObject(rod);

      if (playerBoundingBox.intersectsBox(rodBoundingBox)) {
        //Reset the players position
        const currentTime = Date.now();
        if (!isPlayerDead && currentTime - lastDeathTime > deathCooldown) {
          isPlayerDead = true;
          lastDeathTime = currentTime;
          die();

          // Reset the dead state after the cooldown
          setTimeout(() => {
            isPlayerDead = false;
          }, deathCooldown);
        }
      }
    });

    /*HELPERS TO VISUALIZE BOUNDING BOXES */
    if (playerHelper) {
      playerHelper.update();
    }

    //Particle system
    if (particleSystem) {
      // Remove rotation line
      // particleSystem.rotation.y += 0.001; // Remove this line

      let positionArray = particleSystem.geometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        positionArray[3 * i] += velocities[3 * i];
        positionArray[3 * i + 1] += velocities[3 * i + 1];
        positionArray[3 * i + 2] += velocities[3 * i + 2];

        // Reset position if it goes out of bounds
        if (positionArray[3 * i] > 50 || positionArray[3 * i] < -50) {
          velocities[3 * i] *= -1;
        }
        if (positionArray[3 * i + 1] > 50 || positionArray[3 * i + 1] < -50) {
          velocities[3 * i + 1] *= -1;
        }
        if (positionArray[3 * i + 2] > 50 || positionArray[3 * i + 2] < -50) {
          velocities[3 * i + 2] *= -1;
        }
      }
      particleSystem.geometry.attributes.position.needsUpdate = true;
    }

    // Update camera
    updateCamera();
  }

  // Animate obstacles
  animateGates(deltaTime);
  animateCylinders(deltaTime);
  animateCrown(deltaTime);
  animateTurnstile(deltaTime);
  animateHammer(deltaTime);
  animateRods(deltaTime);
  updateCannonBalls(deltaTime);

  //cannonDebugger.update();
  renderer.render(scene, camera);
  //controls.update();

  // Check if player has left starting platform
  if (!hasLeftStartingPlatform && playerBody.position.z > 30) {
    // Adjust 30 based on your platform size
    hasLeftStartingPlatform = true;
    canSpawnBalls = true; // Enable cannon ball spawning when player leaves platform
  }

  // Update cannon balls with lifetime check
  cannonBalls = cannonBalls.filter((ball, index) => {
    if (!ball || !ball.mesh || !ball.body) return false;

    const age = (Date.now() - ball.creationTime) / 1000; // Convert to seconds
    if (age > ball.lifetime) {
      scene.remove(ball.mesh);
      world.removeBody(ball.body);
      return false;
    }
    return true;
  });

  // Check for checkpoint 2
  if (playerBody.position.z >= SECOND_CHECKPOINT_Z) {
    // Stop cannon balls and remove existing ones
    canSpawnBalls = false;
    removeAllCannonBalls();
  }

  stats.end();

  if (minimapElements && model) {
    updateMinimap(minimapElements, model);
  }
}

async function showLoadingScreen() {
  const loadingScreen = document.createElement("div");
  loadingScreen.id = "loading-screen";
  loadingScreen.style.position = "fixed";
  loadingScreen.style.top = "0";
  loadingScreen.style.left = "0";
  loadingScreen.style.width = "100%";
  loadingScreen.style.height = "100%";
  loadingScreen.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  loadingScreen.style.display = "flex";
  loadingScreen.style.justifyContent = "center";
  loadingScreen.style.alignItems = "center";
  loadingScreen.style.zIndex = "9999";

  const loadingText = document.createElement("h1");
  loadingText.textContent = "Loading";
  loadingText.style.color = "white";

  loadingScreen.appendChild(loadingText);
  document.body.appendChild(loadingScreen);

  // Start the loading animation
  let dots = "";
  loadingAnimationInterval = setInterval(() => {
    if (dots.length < 3) {
      dots += ".";
    } else {
      dots = ""; // Reset the dots after reaching 3
    }
    loadingText.textContent = `Loading${dots}`; // Update the loading text
  }, 200); // Adjust the interval duration as needed
}

// Function to hide the loading screen
async function hideLoadingScreen() {
  clearInterval(loadingAnimationInterval); // Clear the animation interval
  const loadingScreen = document.getElementById("loading-screen");
  if (loadingScreen) {
    document.body.removeChild(loadingScreen);
  }
}

async function showGameMenu() {
  document.getElementById("gameMenu").style.display = "block";
}

async function hideGameMenu() {
  document.getElementById("gameMenu").style.display = "none";
}

async function generateHearts(currentLives) {
  // Get the container for the hearts
  const heartsContainer = document.getElementById("hearts-container");

  // Clear existing hearts
  while (heartsContainer.firstChild) {
    heartsContainer.removeChild(heartsContainer.firstChild);
  }

  // Create hearts based on currentLives
  for (let i = 0; i < currentLives; i++) {
    const heartImg = document.createElement("img");
    heartImg.src = heart; // Use the imported heart image
    heartImg.style.width = "40px"; // Adjust size as needed
    heartImg.style.marginLeft = "5px"; // Space between hearts
    heartImg.style.position = "relative";
    heartImg.style.zIndex = "10001"; // Higher than other game elements
    heartsContainer.appendChild(heartImg);
  }
}

// Create a container for the hearts when the game starts
async function createHeartsContainer() {
  const heartsContainer = document.createElement("div");
  heartsContainer.id = "hearts-container";
  heartsContainer.style.position = "fixed";
  heartsContainer.style.top = "20px";
  heartsContainer.style.right = "10px"; // Adjust based on timer position
  heartsContainer.style.display = "flex";
  heartsContainer.style.zIndex = "10000"; // Higher than other game elements
  //add a thick border around this container
  //heartsContainer.style.border = "2px solid white";
  document.body.appendChild(heartsContainer);
}

async function toggleMenu() {
  const gameMenu = document.getElementById("gameMenu");

  if (gameMenu.style.display === "block") {
    gameMenu.style.display = "none";
    isGamePaused = false; //unpauseGame
    document.body.requestPointerLock(); //take control of mouse
    document.body.click(); //click anywhere on the screen
  } else {
    //pauseGame
    isGamePaused = true;
    document.exitPointerLock();

    const resumeButton = document.getElementById("resumeButton");

    const restartButton = document.getElementById("restartButton");

    //show volume slider
    const volumeControl = document.getElementById("volume-control");
    console.log("volumeControl", volumeControl);
    if (volumeControl) volumeControl.style.display = "block";

    resumeButton.style.display = "block";
    restartButton.style.display = "block";

    //if win and congration message is displayed, hide it
    const winMessage = document.getElementById("winMessage");
    const congratsMessage = document.getElementById("congratsMessage");
    const bestTimeMessage = document.getElementById("bestTimeMessage");
    //hide "You lost" message
    const youLostMessage = document.getElementById("lostMessage");

    if (winMessage) {
      winMessage.remove();
    }

    if (congratsMessage) {
      congratsMessage.remove();
    }
    if (bestTimeMessage) {
      bestTimeMessage.remove();
    }

    if (youLostMessage) {
      youLostMessage.remove();
    }

    gameMenu.style.display = "block";
    //show the volume control
  }
}

async function showWinScreen(elapsedTime) {
  const gameMenu = document.getElementById("gameMenu");
  elapsedTime = elapsedTime / 1000;

  document.getElementById("resumeButton").style.display = "none";
  document.getElementById("restartButton").style.display = "block"; // Show restart button

  document.getElementById("volume-control").style.display = "none";

  //show the game menu
  gameMenu.style.display = "block";

  //disable player movement by removing event listers for wasd
  removeEventListeners();

  //exit pointer lock
  document.exitPointerLock();

  // Remove any existing win message if it exists
  const existingWinMessage = document.getElementById("winMessage");
  if (existingWinMessage) {
    existingWinMessage.remove();
  }

  // Create a new div for the win message
  const winMessage = document.createElement("div");
  winMessage.id = "winMessage";
  winMessage.style.textAlign = "center"; // Center the text
  winMessage.style.color = "white";

  //hide you lost message if it exists
  const youLostMessage = document.getElementById("lostMessage");
  if (youLostMessage) {
    youLostMessage.remove();
  }

  // Create the congratulatory message
  const congratsMessage = document.createElement("h2");
  congratsMessage.id = "congratsMessage";
  congratsMessage.textContent = "Congratulations! ";
  winMessage.appendChild(congratsMessage);

  //store elapsed time in local storage as best time
  let bestTime = localStorage.getItem("levelThreeBestTime");

  if (!bestTime) {
    localStorage.setItem("levelThreeBestTime", elapsedTime);
    bestTime = localStorage.getItem("levelThreeBestTime");
  }

  // Create a best time message
  const bestTimeMessage = document.createElement("p");
  bestTimeMessage.id = "bestTimeMessage";
  bestTimeMessage.textContent = `Best Time: ${bestTime} seconds`; // Show the best time
  winMessage.appendChild(bestTimeMessage);

  //new best time
  if (elapsedTime <= bestTime) {
    localStorage.setItem("levelThreeBestTime", elapsedTime);
    congratsMessage.textContent = "Congratulations! New Best Time!";
  }

  // Create the final time message
  const finalTime = document.createElement("p");
  finalTime.textContent = `Your time: ${elapsedTime.toFixed(3)} seconds`; // Show the final time
  winMessage.appendChild(finalTime);

  // Append the win message to the game menu
  gameMenu.appendChild(winMessage);
}

async function generateBestTime() {
  //clear the best time container
  if (document.getElementById("best-time")) {
    document.getElementById("best-time").remove();
  }

  const bestTimeContainer = document.createElement("div");
  bestTimeContainer.id = "best-time";

  // Style the best time container
  bestTimeContainer.style.position = "fixed";
  bestTimeContainer.style.top = "60px"; // Adjust to position it below the timer
  bestTimeContainer.style.right = "15px"; // Same right alignment as the timer
  bestTimeContainer.style.color = "white"; // Text color
  bestTimeContainer.style.fontSize = "30px"; // Font size
  bestTimeContainer.style.zIndex = "10000"; // Higher than other game elements

  // Retrieve the best time from localStorage
  let bestTime = localStorage.getItem("levelThreeBestTime");

  // Format the display message
  if (bestTime) {
    bestTimeContainer.textContent = `Best Time: ${parseFloat(bestTime).toFixed(
      1
    )} s`; // Show best time formatted to 3 decimal places
  } else {
    bestTimeContainer.textContent = "Best Time: N/A"; // Default message if no best time
  }

  // Append the best time container to the body
  document.body.appendChild(bestTimeContainer);
}

// Example reset function (you need to implement the actual logic)
async function resetGame() {
  // Logic to reset your game
  console.log("Game is restarting...");
}

async function restartGame() {
  hasLeftStartingPlatform = false;
  canSpawnBalls = false;
  isPlayerDead = false;

  // Remove all existing cannon balls
  await removeAllCannonBalls();

  currentAction.stop();
  currentAction = idleAction;
  currentAction.play();

  // Reset crown visibility
  if (crown && crown.mesh) {
    crown.mesh.visible = true;
    if (crown.body && !world.bodies.includes(crown.body)) {
      world.addBody(crown.body);
    }
  }

  //reset timer to 0
  resetTimer();
  startCountdown();

  playerBody.position.set(0, 2, 0);
  //restart timer
  //resetTimer();
  currentLives = 3;
  generateHearts(currentLives);
  gameWon = false;
}

//Main function to start the game
async function startGame() {
  try {
    let resumeButton = document.getElementById("resumeButton");
    let restartButton = document.getElementById("restartButton");
    let menuButton = document.getElementById("mainMenuButton");

    //event listener for the menu button
    menuButton.addEventListener("click", () => {
      window.location.href = "/";
    });

    // Add an event listener to the volume slider
    function updateVolume() {
      // Get the current slider value
      const volume = volumeSlider.value;
      // Update the game volume
      gameVolume = volume;

      updateGameVolume();
    }

    volumeSlider.addEventListener("input", updateVolume);
    // Set the initial volume of the slider
    volumeSlider.value = gameVolume;

    //Add event listener to the resume button
    resumeButton.addEventListener("click", () => {
      toggleMenu();
      //Add pointer lock to the document
      document.body.requestPointerLock();

      // unpauseGame();
    });

    //Add event listener to the restart button
    restartButton.addEventListener("click", () => {
      // window.location.reload();
      toggleMenu();
      generateBestTime();

      restartGame();
    });

    //start the game

    hideGameMenu();
    //render the game
    await init();

    //hide the controls ui
    let controlsInfo = document.getElementById("controls-info");
    if (controlsInfo) {
      controlsInfo.style.display = "none";
    }

    //startGameTimer(); happens in animate due to timing issues otherwise (inside startCountdown)
    showTimer();
    hideLoadingScreen();
    createHeartsContainer();
    generateHearts(3);
    generateBestTime();
    renderer.setAnimationLoop(animate);
    //await panCameraToStart();
    startCountdown();
    //show minimap
    document.getElementById("minimap-container").style.display = "block";
  } catch (error) {
    console.error("Error during initialization:", error);
    hideLoadingScreen();
    // Show an error message to the user
    alert("An error occurred while loading the game. Please try again.");
  }
}

startGame();
