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
  createGate,
} from "./obstacles";

// Import assets
import finish from "../img/finish.jpg";
import basicBg from "../img/sky.jpg";
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
  timerInterval,
  isPanning = false,
  panProgress = 0,
  panStartPosition = null,
  panEndPosition = null,
  panStartTime = null,
  panDuration = 5000, // 10 seconds
  countdownInterval;

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
const jumpCooldown = 250; // milliseconds between allowed jump attempts

//Audio Setup
const listener = new THREE.AudioListener();
const audioLoader = new THREE.AudioLoader();

// Cannon ball management
let cannonBalls = [];
let hasLeftStartingPlatform = false;
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

// Add these with your other global variables
let targetRotationY = 0;
let rotationDamping = 0.1; // Controls how smoothly the rotation changes

// Game state variables
let isPaused = false;
let gameWon = false;
let loadingAnimationInterval;
let deathCooldown = 2000; // 2 seconds in milliseconds
let lastDeathTime = 0;
let frame = 0; //display game timer
let isPlayerDead = false;
let canSpawnBalls = false;
let spawnCooldown = false;
const SPAWN_COOLDOWN_TIME = 1000; // 3 seconds cooldown after respawn

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
      await initEventListeners();
      await initAudio();

      console.log("Creating obstacles + particles...");

      await initLevel3Layout();
      await initTurnstiles();
      await initHorizontalCylinders();
      await initHammers();
      await initGates();
      await initCheckpoints();

      //Init particle background system
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

async function initAudio() {
  return new Promise((resolve) => {
    const backGroundMusic = new THREE.Audio(listener);
    audioLoader.load(PbackGroundMusic, function (buffer) {
      backGroundMusic.setBuffer(buffer);
      backGroundMusic.setLoop(true);
      backGroundMusic.setVolume(0.2);
      backGroundMusic.play();

      resolve();
    });
  });
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
let particles = [];
const particleCountDie = 100;
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
  hasLeftStartingPlatform = false;  // Reset the flag when player dies
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
    start: { x: 0, y: 10, z: 10 },
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
    hitsound.setVolume(1);
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
    generateHearts(currentLives);
  }

  // Make player visible again
  model.visible = true;

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
      canSpawnBalls &&
      !isPaused &&
      playerBody.position.z < SECOND_CHECKPOINT_Z &&
      !spawnCooldown &&
      !isPlayerDead &&
      hasLeftStartingPlatform // New condition
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
      console.log("You win!");

      // Play win sound
      const winsound = new THREE.Audio(listener);
      audioLoader.load(Pwinsound, function (buffer) {
        winsound.setBuffer(buffer);
        winsound.setLoop(false);
        winsound.setVolume(1);
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
async function toggleView() {
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
    controls.lock();
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
    //We have to do the background
    const textureLoader = new THREE.TextureLoader();
    const skyboxTexture = textureLoader.load(basicBg, function (texture) {
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
    resolve();
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
    const fatGuyURL = new URL("../assets/FatGuy.glb", import.meta.url);
    const assetLoader = new GLTFLoader();

    assetLoader.load(
      fatGuyURL.href,
      (gltf) => {
        model = gltf.scene;
        model.position.set(0, 10, 0);
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
    window.addEventListener("keydown", (event) => {
      if (event.key === "v") {
        toggleView();
      }
    });
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

//Movememnt functions that update the movement flags
async function handleKeyDown(event) {
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
    case " ":
      // Jump when spacebar is pressed
      console.log("Jumping");

      if (!isJumping) {
        jump();
      }
      break;
  }
}

async function handleKeyUp(event) {
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

// Function to handle jumping
function jump() {
  const currentTime = Date.now();
  let startingY =
    playerBody.position.y -
    (playerBody.aabb.upperBound.y - playerBody.aabb.lowerBound.y) / 2 -
    0.1;

  // Multiple checks to ensure the jump is valid
  if (
    startingY < 0.1 && // Ground check
    !isJumping && // Not already in a jump
    currentTime - lastJumpTime >= jumpCooldown && // Cooldown check
    Math.abs(playerBody.velocity.y) < 0.1 // Ensure player is not moving vertically
  ) {
    isJumping = true;
    lastJumpTime = currentTime;

    // Play jump sound
    const jumpSound = new THREE.Audio(listener);
    audioLoader.load(PjumpSound, function (buffer) {
      jumpSound.setBuffer(buffer);
      jumpSound.setLoop(false);
      jumpSound.setVolume(1);
      jumpSound.play();
    });

    // Apply jump force
    playerBody.applyImpulse(new CANNON.Vec3(0, jumpForce, 0), model.position);
    crossfadeAction(currentAction, jumpAction, fadeDuration);
    currentAction = jumpAction;

    // Set up ground detection
    const raycaster = new THREE.Raycaster();
    const rayDirection = new THREE.Vector3(0, -1, 0);

    let groundCheckInterval;

    function checkGroundCollision() {
      if (!isJumping) {
        cancelAnimationFrame(groundCheckInterval);
        return;
      }

      raycaster.set(playerBody.position, rayDirection);
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length > 0 && intersects[0].distance <= 0.1) {
        isJumping = false;
        // Play landing sound
        const jumpland = new THREE.Audio(listener);
        audioLoader.load(Pjumpland, function (buffer) {
          jumpland.setBuffer(buffer);
          jumpland.setLoop(false);
          jumpland.setVolume(1);
          jumpland.play();
        });
        cancelAnimationFrame(groundCheckInterval);
      } else {
        groundCheckInterval = requestAnimationFrame(checkGroundCollision);
      }
    }

    checkGroundCollision();
  }
}

async function crossfadeAction(fromAction, toAction, duration) {
  if (fromAction !== toAction) {
    if (toAction == jumpAction) {
      isJumping = true;
      console.log("imhere");
      jumpAction.setLoop(THREE.LoopOnce); // Make jumpAction play only once
      jumpAction.clampWhenFinished = true; // Ensure the animation holds the last frame
      //jumpAction.enable = false; // Initially, disable it to prevent accidental play
    }
    if (playerBody.position.y < 0) {
      toAction = fallingAction;
    }
    toAction.reset().fadeIn(duration).play(); // Fade in the new action
    fromAction.fadeOut(duration); // Fade out th  e old action
  }
}

async function checkIdleState() {
  // If no movement keys are pressed and the current action isn't idle, switch to idle
  if (
    !moveForward &&
    !moveBackward &&
    !moveRight &&
    !moveLeft &&
    currentAction !== idleAction &&
    !isJumping &&
    playerBody.position.y > 0
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
async function updateMovement(delta) {
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
    if (
      playerBody.position.y < 0 &&
      (moveRight || moveForward || moveBackward || moveLeft)
    ) {
      targetAction = fallingAction;
    }

    // Always prioritize jumpAction if space bar is pressed
    if (isJumping) {
      targetAction = jumpAction;
    }

    // Crossfade to the appropriate movement animation if it's different from the current one
    if (currentAction !== targetAction && targetAction != jumpAction) {
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
  //turnstiles.push(await createTurnstile(world, scene, 20, 0, 200, 2, 15));

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

  const rod2 = await createRod(scene, 25, 1, 240, 5, 30, 0.5, 10, 30);
  rod2.rotation.z = Math.PI / 2; // Rotate the rod to be horizontal
  rods.push(rod2);

  // Section 2 - right rods
  const rod3 = await createRod(scene, -10, 1, 280, -30, -5, 0.5, 10, 20);
  rod3.rotation.z = Math.PI / 2; // Rotate the rod to be horizontal
  rods.push(rod3);

  const rod4 = await createRod(scene, -25, 1, 300, -30, -5, 0.5, 10, 25);
  rod4.rotation.z = Math.PI / 2; // Rotate the rod to be horizontal
  rods.push(rod4);

  const rod5 = await createRod(scene, -10, 1, 320, -30, -5, 0.5, 10, 20);
  rod5.rotation.z = Math.PI / 2; // Rotate the rod to be horizontal
  rods.push(rod5);
}

async function initLevel3Layout() {
  // Starting platform with back fence
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

  // Rest of platforms (no back fences)
  const platforms = [
    await createStartingPlatform(world, scene, 0, 0, 180, 60, 0.1, 30), // Checkpoint 1
    await createStartingPlatform(world, scene, -20, 0, 230, 40, 0.1, 60), // Section 2
    await createStartingPlatform(world, scene, 20, 0, 300, 40, 0.1, 60),
    await createStartingPlatform(world, scene, 0, 0, 360, 60, 0.1, 30), // Checkpoint 2
    await createStartingPlatform(world, scene, 0, 0, 420, 60, 0.1, 60), // Section 3
    await createStartingPlatform(world, scene, 0, 0, 480, 60, 0.1, 30), // Final platform
  ];
  
  // Remove back fences from all remaining platforms
  platforms.forEach((platform) => {
    scene.remove(platform.fences.back.mesh);
    world.removeBody(platform.fences.back.body);
  });

  // Add crown at the finish line
  crown = await createCrown(world, scene, 0, 5, 480)
}

async function initGates() {
  // Platform dimensions from your layout
  const platformWidth = 60;
  const platformDepth = 60;
  const platformPosition = { x: 0, y: 0, z: 420 }; // Section 3 platform position

  // Create three sets of double gates across the platform
  const gateSetSpacing = platformDepth / 3;
  const gateSpacing = 10; // Space between gates in a pair

  for (let i = 0; i < 3; i++) {
    const setZ =
      platformPosition.z - platformDepth / 2 + gateSetSpacing * (i + 1);

    // Create each pair of gates
    for (let j = 0; j < 2; j++) {
      const gateX = j === 0 ? -15 : 15; // Offset gates left and right

      // Create pillars for this gate
      const leftPillar = await createPillar(
        world,
        scene,
        gateX - 5, // Adjust pillar position based on gate position
        0,
        setZ,
        2, // width
        8, // height
        2 // depth
      );

      const rightPillar = await createPillar(
        world,
        scene,
        gateX + 5, // Adjust pillar position based on gate position
        0,
        setZ,
        2, // width
        8, // height
        2 // depth
      );

      // Create gate between pillars
      const gate = await createGate(
        scene,
        gateX,
        0,
        setZ,
        6, // height
        2, // length
        leftPillar,
        rightPillar
      );

      // Add random initial phase to create alternating patterns
      gate.phase = Math.random() * Math.PI * 2;
      gates.push(gate);
    }
  }
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
  hammers.push(hammerr1, hammerr2, hammerl1, hammerl2, hammerr3, hammerr4, hammerl3, hammerl4, hammerr5, hammerr6, hammerl5, hammerl6, hammer6, hammer7);

  // Section 2 obstacles - Zigzag section
  const hammer3 = createRotatingHammer(world, scene, -20, 0, 225, 1, 6); 
  const hammer4 = createRotatingHammer(world, scene, -20, 0, 255, 1, 6);
  hammers.push(hammer3, hammer4);

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
    opacity: 0.5,
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
    isPaused ||
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
          //die();

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
      if (turnstile.mesh && turnstile.body) {
        const rotation = deltaTime * 1.0;
        turnstile.mesh.rotation.y += rotation; // Rotate the turnstile mesh
        turnstile.body.quaternion.setFromAxisAngle(
          new CANNON.Vec3(0, 1, 0),
          turnstile.mesh.rotation.y
        ); // Rotate the cannon body
      }
    });
    resolve();
  });
}

async function animateHammer(deltaTime) {
  return new Promise((resolve) => {
    hammers.forEach((hammer) => {
      if (hammer && hammer.updateRotation) {
        hammer.updateRotation(deltaTime);
      }
    });
    resolve();
  });
}

async function animateRods(deltaTime) {
  let waitTime = 0.5; // Seconds to wait at each position

  rods.forEach((rod) => {
    const maxX = Math.max(rod.maxX, rod.minX);
    const minX = Math.min(rod.maxX, rod.minX);
    const moveSpeed = rod.speed; // Movement speed

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

  async function playCountdownSound(count) {
    let soundFile = mapCountdownSounds[count];

    // Stop any currently playing sound
    if (countdownAudio.isPlaying) {
      countdownAudio.stop();
    }

    audioLoader.load(soundFile, function (buffer) {
      countdownAudio.setBuffer(buffer);
      countdownAudio.setLoop(false);
      countdownAudio.setVolume(0.5);
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
      canSpawnBalls = true; // Enable cannon ball spawning

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

    // Check collision with crown
    if (crown && crown.mesh && !gameWon) {
      const crownBoundingBox = new THREE.Box3().setFromObject(crown.mesh);
      if (playerBoundingBox.intersectsBox(crownBoundingBox)) {
        console.log("Player won!");
        gameWon = true;
        showWinScreen(elapsedTime);
        // Hide the crown instead of removing it
        crown.mesh.visible = false;
        if (crown.body && world.removeBody) {
          world.removeBody(crown.body);
        }
      }
    }

    // Update gates
    gates.forEach((gate) => {
      if (gate && gate.mesh) {
        // Gate movement logic
        const maxHeight = 8;
        const minHeight = 0;
        const moveSpeed = 0.05;

        if (!gate.mesh.waiting) {
          gate.mesh.position.y += moveSpeed * gate.mesh.moveDirection;

          if (gate.mesh.position.y >= maxHeight) {
            gate.mesh.moveDirection = -1;
            gate.mesh.waiting = true;
            gate.mesh.lastWaitTime = Date.now();
          } else if (gate.mesh.position.y <= minHeight) {
            gate.mesh.moveDirection = 1;
            gate.mesh.waiting = true;
            gate.mesh.lastWaitTime = Date.now();
          }
        } else {
          if (Date.now() - gate.mesh.lastWaitTime > 1000) {
            gate.mesh.waiting = false;
          }
        }

        // Update physics body position
        if (gate.body) {
          gate.body.position.y = gate.mesh.position.y;
          gate.body.position.copy(gate.mesh.position);
        }
      }
    });

    // Reset crown visibility when game restarts
    if (!gameWon && crown && crown.mesh && !crown.mesh.visible) {
      crown.mesh.visible = true;
      if (crown.body && !world.bodies.includes(crown.body)) {
        world.addBody(crown.body);
      }
    }

    // Check collision with turnstiles
    turnstiles.forEach((turnstile) => {
      if (turnstile.mesh && turnstile.bar) {
        const barWorldPosition = new THREE.Vector3();
        turnstile.bar.getWorldPosition(barWorldPosition);

        const turnstileBoundingBox = new THREE.Box3().setFromObject(
          turnstile.bar
        );

        if (playerBoundingBox.intersectsBox(turnstileBoundingBox)) {
          const currentTime = Date.now();
          if (!isPlayerDead && currentTime - lastDeathTime > deathCooldown) {
            isPlayerDead = true;
            lastDeathTime = currentTime;
            //die();

            // Reset the dead state after the cooldown
            setTimeout(() => {
              isPlayerDead = false;
            }, deathCooldown);
          }
        }
      }
    });

    // Check collision with hammer
    hammers.forEach((hammer) => {
      if (hammer && hammer.mesh) {
        const hammerBoundingBox = new THREE.Box3().setFromObject(hammer.mesh);
        if (playerBoundingBox.intersectsBox(hammerBoundingBox)) {
          const currentTime = Date.now();
          if (!isPlayerDead && currentTime - lastDeathTime > deathCooldown) {
            isPlayerDead = true;
            lastDeathTime = currentTime;
            //die();

            // Reset the dead state after the cooldown
            setTimeout(() => {
              isPlayerDead = false;
            }, deathCooldown);
          }
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
          //die();

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

    // Update camera
    updateCamera();
  }

  // if (dieParticles) {
  //   updateParticles();
  // }

  // Animate obstacles
  animateCrown(deltaTime);
  animateTurnstile(deltaTime);
  animateHammer(deltaTime);
  animateRods(deltaTime);
  updateCannonBalls(deltaTime);

  cannonDebugger.update();
  renderer.render(scene, camera);
  //controls.update();

  
  // Check if player has left starting platform
  if (!hasLeftStartingPlatform && playerBody.position.z > 30) { // Adjust 30 based on your platform size
    hasLeftStartingPlatform = true;
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
    isPaused = false;
    // unpauseGame();
  } else {
    const resumeButton = document.getElementById("resumeButton");
    const startButton = document.getElementById("startButton");
    const restartButton = document.getElementById("restartButton");

    startButton.style.display = "none";
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
    isPaused = true;
    // pauseGame();
  }
}

async function showWinScreen(elapsedTime) {
  const gameMenu = document.getElementById("gameMenu");
  elapsedTime = elapsedTime / 1000;
  // Hide start and resume buttons
  document.getElementById("startButton").style.display = "none";
  document.getElementById("resumeButton").style.display = "none";
  document.getElementById("restartButton").style.display = "block"; // Show restart button

  //show the game menu
  gameMenu.style.display = "block";

  //disable player movement by removing event listers for wasd
  window.removeEventListener("keydown", handleKeyDown);

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

  // Create the congratulatory message
  const congratsMessage = document.createElement("h2");
  congratsMessage.id = "congratsMessage";
  congratsMessage.textContent = "Congratulations!";
  winMessage.appendChild(congratsMessage);

  //store elapsed time in local storage as best time
  let bestTime = localStorage.getItem("bestTime");

  if (!bestTime) {
    localStorage.setItem("bestTime", elapsedTime);
    bestTime = localStorage.getItem("bestTime");
  }

  // Create a best time message
  const bestTimeMessage = document.createElement("p");
  bestTimeMessage.id = "bestTimeMessage";
  bestTimeMessage.textContent = `Best Time: ${bestTime} seconds`; // Show the best time
  winMessage.appendChild(bestTimeMessage);

  //new best time
  if (elapsedTime <= bestTime) {
    localStorage.setItem("bestTime", elapsedTime);
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
  let bestTime = localStorage.getItem("bestTime");

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
  canSpawnBalls = false; // Stop spawning during restart

  // Remove all existing cannon balls
  await removeAllCannonBalls();

  // Reset crown visibility
  if (crown && crown.mesh) {
    crown.mesh.visible = true;
    if (crown.body && !world.bodies.includes(crown.body)) {
      world.addBody(crown.body);
    }
  }

  // do countdown again
  resetTimer();
  // Start countdown will re-enable spawning when ready
  startCountdown();
  playerBody.position.set(0, 10, 0);
  currentLives = 3;
  generateHearts(currentLives);
  gameWon = false;
}

//Main function to start the game
async function startGame() {
  try {
    let startButton = document.getElementById("startButton");
    let resumeButton = document.getElementById("resumeButton");
    let restartButton = document.getElementById("restartButton");

    //Add event listener to the resume button
    resumeButton.addEventListener("click", () => {
      toggleMenu();
      //Add pointer lock to the document
      document.body.requestPointerLock();
      canSpawnBalls = true; // Resume spawning when unpaused
      // unpauseGame();
    });

    //Add event listener to the restart button
    restartButton.addEventListener("click", () => {
      // window.location.reload();
      toggleMenu();
      generateBestTime();

      restartGame();
    });

    //Add event listener to the start button
    startButton.addEventListener("click", async () => {
      showLoadingScreen();
      hideGameMenu();
      //render the game
      await init();

      //startGameTimer(); happens in animate due to timing issues otherwise (inside startCountdown)
      showTimer();
      hideLoadingScreen();
      createHeartsContainer();
      generateHearts(3);
      generateBestTime();
      renderer.setAnimationLoop(animate);
      //await panCameraToStart();
      startCountdown();

      //Add pause event listener
      document.addEventListener("keydown", (event) => {
        if (event.key === "P" || event.key === "p") {
          toggleMenu();
          document.exitPointerLock();
          canSpawnBalls = false; // Stop spawning when paused
        }
      });
    });
  } catch (error) {
    console.error("Error during initialization:", error);
    hideLoadingScreen();
    // Show an error message to the user
    alert("An error occurred while loading the game. Please try again.");
  }
}

startGame();
