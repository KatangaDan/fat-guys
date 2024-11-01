//Imports
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as CANNON from "cannon-es";
import CannonDebugger from "cannon-es-debugger";
import Stats from "stats.js";
import stripes from "../textures/neon.png";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import {
  createPillar2,
  createGate2,
  createWreckingBall,
  createHorizontalCylinder,
  createCrown,
} from "./obstacles";

// Import assets
import finish from "../img/finish.jpg";
import basicBg from "../img/sample2.png";
import heart from "../img/heart.png";
import groundTexture from "../textures/floor.png";
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
  gameWon = false,
  gameVolume = 0.5,
  isGamePaused = false,
  runningAudio,
  isRunningPlaying = false,
  crown;

let backGroundMusic,
  jumpSound,
  jumpland,
  hitsound,
  winsound,
  countdownOneSound,
  countdownTwoSound,
  countdownThreeSound,
  countdownGoSound;

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

let gateHelpers = [];
let cylinders = [];
let cylinderHelpers = [];

let horizontalCylinders = [];
let horizontalCylinderHelpers = [];

let gates = [];
let explosionGates = [];
let wreckingBalls = [];
let rods = [];
let rodsHelpers = [];

let rodsZ = [];
let rodsZHelpers = [];

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

// minimap setup
let minimapElements, minimapScene, minimapCamera, minimapRenderer;

async function init() {
  return new Promise(async (resolve, reject) => {
    //audio setup for pre-loading

    try {
      //console.log("Initializing the game...");
      await initStats();
      await initScene();
      await initLighting();
      await initBackground();
      await initPhysics();
      await initPlayer();
      //console.log("Loading audio...");
      await loadAudio();
      // don't call init event listeners here - it gives the user control too early (they can move while in the laoding screena & before countdown)
      await initBackgroundAudio();

      console.log("Creating obstacles + particles...");
      await createGroundPiece(0, 0, 0, 60, 60);
      await initBackgroundParticleSystem();

      //First set of obstacles
      await initGroundCylinders();

      //Ground pieces for second set of obstacles
      await createGroundPiece(0, 0, 115, 60, 10);
      await createGroundPiece(0, 0, 145, 60, 10);
      await createGroundPiece(0, 0, 175, 60, 10);
      await createGroundPiece(0, 0, 205, 60, 10);
      await createGroundPiece(0, 0, 235, 60, 10);
      await createGroundPiece(0, 0, 265, 60, 240);

      wreckingBalls.push(
        await createWreckingBall(scene, 0, 25, 135, 25, 0.8, 3.8)
      );

      wreckingBalls.push(
        await createWreckingBall(scene, 0, 25, 165, 25, 0.8, 3.8)
      );

      wreckingBalls.push(
        await createWreckingBall(scene, 0, 25, 195, 25, 0.8, 3.8)
      );

      wreckingBalls.push(
        await createWreckingBall(scene, 0, 25, 225, 25, 0.8, 3.8)
      );

      wreckingBalls.push(
        await createWreckingBall(scene, 0, 25, 255, 25, 0.8, 3.8)
      );

      // Third set of obstacles
      await initGateObstacles();

      //await initFinishLine();
      // Add crown at the finish line
      crown = await createCrown(world, scene, 0, 3, 460);

      // Initialize minimap
      minimapElements = createMinimapScene();

      createEnd(0, 0, 495, 60, 10);

      console.log("Game initialized successfully!");

      resolve();
      // initFanObstacles();
    } catch (error) {
      console.error("Error initializing the game:", error);
      reject(error);
    }
  });
}

function createEnd(x, y, z, length, height) {
  //create a box
  const geometry = new THREE.BoxGeometry(length, height, 5);
  const material = new THREE.MeshBasicMaterial({ color: "#2c13ad" });
  const end = new THREE.Mesh(geometry, material);
  end.position.set(x, y + height / 2, z);

  //add a physics body
  const endShape = new CANNON.Box(new CANNON.Vec3(length / 2, height / 2, 2.5));
  const endBody = new CANNON.Body({ mass: 0 });
  endBody.addShape(endShape);
  endBody.position.set(x, y + height / 2, z);
  world.addBody(endBody);

  scene.add(end);
}

function createMinimapScene() {
  const minimapScene = new THREE.Scene();

  // Add ground pieces using basic geometries
  function addMinimapGround(x, y, z, width, length) {
    const geometry = new THREE.PlaneGeometry(width, length);
    const material = new THREE.MeshBasicMaterial({ color: "#2c13ad" });
    const ground = new THREE.Mesh(geometry, material);
    ground.position.set(x, y, -(z + length / 2));
    ground.rotation.x = -Math.PI / 2;
    minimapScene.add(ground);
  }

  // Add cylinder representation
  function addMinimapCylinder(x, y, z, radius, height) {
    const geometry = new THREE.PlaneGeometry(radius * 2, height);
    const material = new THREE.MeshBasicMaterial({ color: "#f834d4" });
    const cylinder = new THREE.Mesh(geometry, material);
    // Adjust position to match the actual cylinder position
    cylinder.position.set(x, y, -(z + height / 2));
    cylinder.rotation.x = -Math.PI / 2;
    minimapScene.add(cylinder);
  }

  // Add player representation (simple dot)
  function createPlayerDot() {
    const geometry = new THREE.CircleGeometry(2, 16);
    const material = new THREE.MeshBasicMaterial({ color: "#f874b4" });
    const playerDot = new THREE.Mesh(geometry, material);
    playerDot.rotation.x = -Math.PI / 2;
    playerDot.position.y = 0.1;
    minimapScene.add(playerDot);
    return playerDot;
  }

  function initMinimap() {
    const minimapCamera = new THREE.OrthographicCamera(
      -50,
      50,
      50,
      -50,
      1,
      1000
    );
    minimapCamera.position.set(0, 200, 0);
    minimapCamera.lookAt(0, 0, 0);
    minimapCamera.up.set(0, 0, -1);

    const minimapRenderer = new THREE.WebGLRenderer({
      canvas: document.getElementById("minimap"),
      alpha: true,
    });
    minimapRenderer.setSize(150, 150);

    // Add ground pieces matching the level layout
    // First ground piece
    addMinimapGround(0, 0, 0, 60, 60);

    // Add cylinders with correct positions from initGroundCylinders
    // Parameters match createHorizontalCylinder(world, scene, x, y, z, radius, height)
    addMinimapCylinder(-20, 0, 65, 2, 40); // Left cylinder
    addMinimapCylinder(0, 0, 65, 2, 40); // Middle cylinder
    addMinimapCylinder(20, 0, 65, 2, 40); // Right cylinder

    // Second set of ground pieces (platforms for wrecking balls)
    addMinimapGround(0, 0, 115, 60, 10);
    addMinimapGround(0, 0, 145, 60, 10);
    addMinimapGround(0, 0, 175, 60, 10);
    addMinimapGround(0, 0, 205, 60, 10);
    addMinimapGround(0, 0, 235, 60, 10);

    // Large ground piece for third section
    addMinimapGround(0, 0, 265, 60, 240);

    const playerDot = createPlayerDot();

    return {
      scene: minimapScene,
      camera: minimapCamera,
      renderer: minimapRenderer,
      playerDot: playerDot,
    };
  }

  return initMinimap();
}

// Update minimap in render loop
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

//function to load all game audio into buffers before the game starts
async function loadAudio() {
  // Initialize audio objects
  backGroundMusic = new THREE.Audio(listener);
  jumpSound = new THREE.Audio(listener);
  jumpland = new THREE.Audio(listener);
  hitsound = new THREE.Audio(listener);
  winsound = new THREE.Audio(listener);
  countdownOneSound = new THREE.Audio(listener);
  countdownTwoSound = new THREE.Audio(listener);
  countdownThreeSound = new THREE.Audio(listener);
  countdownGoSound = new THREE.Audio(listener);

  const audioPromises = [];

  // Helper function to load a sound file and set up audio properties
  function loadSound(filePath, audioObject, loop = false, volume = gameVolume) {
    return new Promise((resolve, reject) => {
      audioLoader.load(
        filePath,
        (buffer) => {
          audioObject.setBuffer(buffer);
          audioObject.setLoop(loop);
          audioObject.setVolume(volume);
          resolve();
        },
        undefined,
        reject
      );
    });
  }

  // Assign each load operation to the audioPromises array
  audioPromises.push(
    loadSound(PbackGroundMusic, backGroundMusic, true, gameVolume / 2)
  );
  audioPromises.push(loadSound(PjumpSound, jumpSound));
  audioPromises.push(loadSound(Pjumpland, jumpland));
  audioPromises.push(loadSound(Phitsound, hitsound));
  audioPromises.push(loadSound(Pwinsound, winsound));
  audioPromises.push(loadSound(countdownOne, countdownOneSound));
  audioPromises.push(loadSound(countdownTwo, countdownTwoSound));
  audioPromises.push(loadSound(countdownThree, countdownThreeSound));
  audioPromises.push(loadSound(countdownGo, countdownGoSound));

  // Wait for all audio files to load
  await Promise.all(audioPromises);

  // Optional: Play background music immediately if desired
  backGroundMusic.play();
}

async function initBackgroundAudio() {
  return new Promise((resolve) => {
    backGroundMusic.play();
    resolve();
  });
}

function updateGameVolume() {
  if (backGroundMusic) {
    backGroundMusic.setVolume(gameVolume / 2);
  }
}

async function initFinishLine() {
  return new Promise((resolve, reject) => {
    const textureLoader = new THREE.TextureLoader();

    textureLoader.load(
      finish,
      (texture) => {
        const finishLineGeometry = new THREE.BoxGeometry(6.5, 0.1, 1);
        const finishLineMaterial = new THREE.MeshStandardMaterial({
          map: texture,
        });
        const finishLine = new THREE.Mesh(
          finishLineGeometry,
          finishLineMaterial
        );
        finishLine.position.set(0, 0.5, 495);
        finishLine.scale.x = 10;
        finishLine.scale.z = 15;
        scene.add(finishLine);

        resolve();
      },
      undefined, // onProgress callback (optional)
      (error) => {
        console.error("Error loading texture:", error);
        reject(error);
      }
    );
  });
}

// First, add these variables at the top with your other global variables
let particles = [];
const particleCountDie = 100;
const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
const particleMaterial = new THREE.MeshBasicMaterial({
  color: "#8E1767",
  transparent: true,
  opacity: 0.8,
});

function createParticleExplosion(position) {
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

function animateWreckingBalls(deltaTime) {
  const baseSwingSpeed = 1.5; // Base speed that will be modified per ball
  const swingAmplitude = 30;
  const maxVerticalLift = 10;

  wreckingBalls.forEach((wreckingBall, index) => {
    // Initialize time, position, and speed if they don't exist
    if (wreckingBall.time === undefined) {
      wreckingBall.time = 0;
      if (wreckingBall.initialX === undefined) {
        wreckingBall.initialX = wreckingBall.position.x;
      }
      if (wreckingBall.initialY === undefined) {
        wreckingBall.initialY = wreckingBall.position.y;
      }
      // Option 1: Assign a random speed between 1 and 3
      //wreckingBall.swingSpeed = baseSwingSpeed * (0.5 + Math.random());

      // Option 2: Use index to create evenly spaced speeds
      wreckingBall.swingSpeed = baseSwingSpeed * (0.75 + index * 0.25);
    }

    // Update the time
    wreckingBall.time += deltaTime;

    // Use the ball's individual speed instead of the constant
    const sineValue = Math.sin(wreckingBall.time * wreckingBall.swingSpeed);
    const newX = wreckingBall.initialX + sineValue * swingAmplitude;

    const normalizedPosition = Math.abs(sineValue);
    const verticalOffset = Math.pow(normalizedPosition, 2) * maxVerticalLift;

    wreckingBall.position.x = newX;
    wreckingBall.position.y = wreckingBall.initialY + verticalOffset;

    const rotationAngle =
      -Math.cos(wreckingBall.time * wreckingBall.swingSpeed) * (Math.PI / 3);
    wreckingBall.rotation.z = rotationAngle;

    const forwardTilt = Math.abs(sineValue) * (Math.PI / 6);
    //wreckingBall.rotation.x = forwardTilt;
  });
}

// Add this to your animation loop
function updateParticles(deltaTime) {
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

// Declare gate as a global variable
let gate;

async function gateExplosion(position) {
  // Clear any existing particles for the gate explosion
  particles.forEach((particle) => {
    scene.remove(particle.mesh);
  });
  particles = [];

  const explosionSpeed = 20; // Adjust for gate explosion force
  const particleCount = 800; // Adjust particle count for effect
  const particleSize = 0.1; // Adjust particle size for effect
  let gateParticleGeometry = new THREE.BoxGeometry(
    particleSize,
    particleSize,
    particleSize
  ); // Square particles

  /*let gateParticleMaterial = new THREE.MeshBasicMaterial({
    color: "#8E1767",
    transparent: true,
    opacity: 0.8,
  });*/

  // Create new particles for the gate explosion
  for (let i = 0; i < particleCount; i++) {
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(Math.random(), Math.random(), Math.random()), // Random RGB color
    });
    const mesh = new THREE.Mesh(gateParticleGeometry, material);
    mesh.position.copy(position);

    const phi = Math.acos((2 * i) / particleCount - 1);
    const theta = Math.sqrt(particleCount * Math.PI) * phi;

    const velocity = new THREE.Vector3(
      explosionSpeed * Math.sin(phi) * Math.cos(theta),
      explosionSpeed * Math.cos(phi),
      explosionSpeed * Math.sin(phi) * Math.sin(theta)
    );

    // Add randomness for a natural effect
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

async function createGateExplosion(
  scene,
  model, // The player model
  x,
  y,
  z,
  height,
  length,
  leftPillar,
  rightPillar
) {
  return new Promise((resolve) => {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(stripes, (texture) => {
      const leftPillarPosition =
        leftPillar.position.x - leftPillar.geometry.parameters.width / 2;
      const rightPillarPosition =
        rightPillar.position.x + rightPillar.geometry.parameters.width / 2;

      const width = Math.abs(leftPillarPosition - rightPillarPosition);
      const newX = leftPillarPosition - width / 2;

      const gateGeometry = new THREE.BoxGeometry(width, height, length);
      const gateMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        metalness: 3,
        roughness: 0.2,
      });
      gate = new THREE.Mesh(gateGeometry, gateMaterial); // Assign to global gate
      gate.position.set(newX, y + height / 2, z);
      gate.castShadow = true;
      gate.receiveShadow = true;

      gate.exploded = false;

      scene.add(gate);
      explosionGates.push(gate); // Add to explosion gates array

      // Set width property for collision detection
      gate.width = width;

      resolve(gate);
    });
  });
}

let popedGates = [];
// Collision check function
function checkCollision(model) {
  const playerBoundingBox = new THREE.Box3().setFromObject(model);
  explosionGates.forEach((gate, index) => {
    if (!gate.exploded) {
      const gateBoundingBox = new THREE.Box3().setFromObject(gate);
      if (playerBoundingBox.intersectsBox(gateBoundingBox)) {
        gateExplosion(gate.position); // Trigger explosion at gate's position
        scene.remove(gate); // Remove gate after explosion
        gate.exploded = true; // Set exploded flag to true
        popedGates.push(gate);
        gates.splice(index, 1); // Remove gate from array
      }
    }
  });
}

async function die() {
  currentLives--;

  popedGates.forEach((gate) => {
    gate.exploded = false;
    gateExplosion(gate.position);
    scene.add(gate);
  });

  isPlayerDead = true;

  //stop run sound
  // runningAudio.setVolume(0);

  // Create particle explosion at player's current position
  createParticleExplosion(model.position);


  //Hide the player model
  model.visible = false;

  //Reset animations
  currentAction.stop();
  currentAction = idleAction;
  currentAction.play();
  // checkIdleState();


  const respawnPosition =
    playerBody.position.z < 265
      ? { x: 0, y: 10, z: 10 }
      : { x: 0, y: 10, z: 270 };

  hitsound.play();

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

    // currentLives = 3;
    // generateHearts(currentLives);
    // //reset timer
    // resetTimer();
  } else {
    // Respawn at appropriate position
    playerBody.position.set(
      respawnPosition.x,
      respawnPosition.y,
      respawnPosition.z
    );
    generateHearts(currentLives);
  }

  // Make player visible again
  model.visible = true;
  isPlayerDead = false;
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

    //Create controls for testing
    // controls = new OrbitControls(camera, renderer.domElement);
    // controls.enableDamping = true; // Smooth motion
    // controls.enableZoom = true; // Allow zooming
    // controls.enablePan = true; // Allow panning
    // controls.maxPolarAngle = Math.PI / 2; // Restrict vertical rotation (optional)

    //Create an axis
    const axesHelper = new THREE.AxesHelper(1000); // Size of the axes
    // scene.add(axesHelper);

    //Start clock
    clock = new THREE.Clock();

    //Setup controls
    setupControls();

    // try {
    //   minimapElements = initMinimap();
    //   console.log("Minimap initialized successfully");
    // } catch (error) {
    //   console.error("Failed to initialize minimap:", error);
    // }

    resolve();
  });
}

function checkForWin() {
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

      //Stop the timer
      timerRunning = false;

      //in local storage, check if level2Unlocked is true,if it doesnt exist, set it to true
      if (localStorage.getItem("level3Unlocked") === null) {
        localStorage.setItem("level3Unlocked", "true");
      }

      //play win sound
      winsound.play();

      showWinScreen(elapsedTime);
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
function setupControls() {
  controls = new PointerLockControls(camera, renderer.domElement);
  document.addEventListener("click", () => {
    if (!isGamePaused) {
      controls.lock(); // Lock pointer only when the game is not paused
    }
  });

  controls.addEventListener("lock", () => {
    //("PointerLock activated");
  });

  controls.addEventListener("unlock", () => {
    //console.log("PointerLock deactivated");
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

    // create a second light at z =270, in the oposite direction to the mainlight so ot can illumintate the wrecking balls
    const secondaryLight = new THREE.DirectionalLight(0xffffff, 1.5);
    secondaryLight.position.set(50, 100, 270);
    secondaryLight.castShadow = true;
    secondaryLight.shadow.mapSize.width = 4096;
    secondaryLight.shadow.mapSize.height = 4096;
    secondaryLight.shadow.camera.left = -shadowDistance;
    secondaryLight.shadow.camera.right = shadowDistance;
    secondaryLight.shadow.camera.top = shadowDistance;
    secondaryLight.shadow.camera.bottom = -shadowDistance;

    scene.add(secondaryLight);

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
      // texture.rotation = Math.PI/2; // Rotate the texture by 45 degrees (?/4 radians)
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
    const fatGuyURL = new URL("../assets/SmoothFatGuy.glb", import.meta.url);
    const assetLoader = new GLTFLoader();

    assetLoader.load(
      fatGuyURL.href,
      (gltf) => {
        model = gltf.scene;
        model.position.set(0, 2, 490);
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
    case " ":
      // Jump when spacebar is pressed
      //console.log("Jumping");
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
  
  return startingY >= GROUND_THRESHOLD || Math.abs(playerBody.velocity.y) >= 0.2;
  //}
}

function crossfadeAction(fromAction, toAction, duration) {
  if (fromAction !== toAction) {
    // Don't allow transition to running or idle animations while in air
    if ((toAction===runningAction || toAction===backRunningAction || toAction===runningLeftAction || toAction===runningRightAction) && isInAir()) {
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
    console.log(`Crossfade from ${fromAction.getClip().name} to ${toAction.getClip().name}`);
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

    if(!isInAir()){
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
    
    }
    else if (currentAction !== jumpAction) {
      // If we're in the air and not already jumping, keep the current animation
      targetAction = currentAction;
    }
    
    if (
      playerBody.position.y < 0
    ) {
      targetAction = fallingAction;
    }

     // Always prioritize jumpAction if we're jumping
     if (isJumping) {
      targetAction = jumpAction;
    }
    
    // Crossfade to the appropriate movement animation if it's different from the current one
    if (currentAction !== targetAction && (!isInAir() || targetAction === jumpAction)) {
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

async function createGroundPiece(x, y, z, width, length) {
  return new Promise((resolve) => {
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
    texture.repeat.set(4, 1);
    groundMaterial.map = texture;

    resolve();
  });
}

async function initGateObstacles() {
  return new Promise(async (resolve) => {
    const pillarZPositions = [275, 300, 325, 350, 375, 400, 425];
    const pillarXPositions = [28.5, 9.5, -9.5, -28.5]; // Replace with specific x-coordinates as needed

    for (let z of pillarZPositions) {
      let pillars = [];
      for (let x of pillarXPositions) {
        pillars.push(await createPillar2(world, scene, x, 0, z, 3, 8, 7));
      }

      // Randomly select one gate to be explosive in this z row
      const gateIndex = Math.floor(Math.random() * (pillars.length - 1));

      for (let i = 0; i < pillars.length - 1; i++) {
        const leftPillar = pillars[i];
        const rightPillar = pillars[i + 1];

        if (i === gateIndex) {
          gates.push(
            await createGateExplosion(
              scene,
              model,
              leftPillar.position.x,
              0,
              z + 3,
              8,
              2,
              leftPillar,
              rightPillar
            )
          );
        } else {
          gates.push(
            await createGate2(
              world,
              scene,
              leftPillar.position.x,
              0,
              z + 3,
              8,
              2,
              leftPillar,
              rightPillar
            )
          );
        }
      }
    }

    AddVisualGateHelpers();
    resolve();
  });
}

async function initGroundCylinders() {
  return new Promise(async (resolve) => {
    horizontalCylinders.push(
      await createHorizontalCylinder(world, scene, -20, -2.5, 65, 2, 40)
    );
    horizontalCylinders.push(
      await createHorizontalCylinder(world, scene, 0, -2.5, 65, 2, 40)
    );
    horizontalCylinders.push(
      await createHorizontalCylinder(world, scene, 20, -2.5, 65, 2, 40)
    );

    resolve();
  });
}

function AddVisualGateHelpers() {
  // Add visual helpers for the gates
  gates.forEach((gate) => {
    const helper = new THREE.BoxHelper(gate, "blue");
    gateHelpers.push(helper);
    //scene.add(helper);
  });
}

function AddVisualCylinderHelpers() {
  // Add visual helpers for the cylinders
  cylinders.forEach((cylinder) => {
    const helper = new THREE.BoxHelper(cylinder, "blue");
    cylinderHelpers.push(helper);
    //scene.add(helper);
  });
}

let timerInterval, countdownInterval;

// Update the camera position to follow the player and initial panning
function updateCamera() {
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
function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
function startGameTimer() {
  startCountdown(); // Only start the countdown, don't start the timer yet
}

function removeEventListeners() {
  //remove event listeners
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
  window.removeEventListener("mousemove", onMouseMove, false);
  //remove event listener for 'p' key
}

function startCountdown() {
  removeEventListeners(); // Remove any existing event listeners

  const mapCountdownSounds = {
    3: countdownThreeSound,
    2: countdownTwoSound,
    1: countdownOneSound,
    GO: countdownGoSound,
  };

  function playCountdownSound(count) {
    // Stop any currently playing sound
    if (mapCountdownSounds[count].isPlaying) {
      mapCountdownSounds[count].stop();
    }
    // Play the sound for the current countdown number
    mapCountdownSounds[count].play();
  }

  // Clear existing countdown element if it exists
  let countdownDisplay = document.getElementById("countdown");
  if (countdownDisplay) {
    countdownDisplay.remove();
  }

  let count = 3;
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

function initializeTimer() {
  startTime = Date.now();
  elapsedTime = 0;
  timerRunning = true;
  updateTimerDisplay(0);
  timerInterval = setInterval(updateTimer, 100);
}

// Update game timer
function updateTimer() {
  if (!timerRunning) return;

  const currentTime = Date.now(); // Get the current timestamp in milliseconds
  // Calculate the time elapsed since the timer started
  elapsedTime = currentTime - startTime;

  // Update the display
  updateTimerDisplay(elapsedTime);
}

// Create a function to show the timer
function showTimer() {
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

// Create a container for the hearts when the game starts
function createHeartsContainer() {
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

// Update the timer display
function updateTimerDisplay(timeInMs) {
  const timer = document.getElementById("game-timer");
  if (timer) {
    const seconds = Math.max(0, timeInMs / 1000).toFixed(1); // Ensure we never show negative time
    timer.textContent = seconds + " s";
  }
}

// Reset timer function (useful for restarts)
function resetTimer() {
  elapsedTime = 0; // Reset elapsed time
  timerRunning = false;
  updateTimerDisplay(0);
}

// Add these variables to your global scope
let isPanning = false;
let panProgress = 0;
let panStartPosition = null;
let panEndPosition = null;
let panStartTime = null;
let panDuration = 5000; // 10 seconds

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

let isPlayerDead = false;
let deathCooldown = 2000; // 2 seconds in milliseconds
let lastDeathTime = 0;

//display game timer
let frame = 0;
function animate() {
  //console.log("Frame:", frame);
  frame++;
  stats.begin();

  checkJumpState();

  // update the game timer
  updateTimer();
  //console.log("elapsedTime", elapsedTime);

  //check if the player has reached the end of the game
  checkForWin();

  // Update the physics world on every frame
  const deltaTime = clock.getDelta();
  world.step(1 / 60, deltaTime, 10);

  updateParticles(deltaTime);

  if (gate) {
    checkCollision(model); // Check collision with the gate
  }

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
    /*Actual bounding boxes for the player and obstacles*/

    //player bounding box
    const playerBoundingBox = new THREE.Box3().setFromObject(model);

    //wreckingballs bounding boxes
    wreckingBalls.forEach((wreckingBall) => {
      const wreckingBallBoundingBox = new THREE.Box3().setFromObject(
        wreckingBall
      );

      if (playerBoundingBox.intersectsBox(wreckingBallBoundingBox)) {
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

    rodsZHelpers.forEach((helper) => {
      if (helper) helper.update();
    });

    /*HELPERS TO VISUALIZE BOUNDING BOXES */

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

  // if (dieParticles) {
  //   updateParticles();
  // }

  animateWreckingBalls(deltaTime);
  // cannonDebugger.update();
  renderer.render(scene, camera);
  //controls.update();

  stats.end();

  if (minimapElements && model) {
    updateMinimap(minimapElements, model);
  }
}

// Create a function to show the loading screen
let loadingAnimationInterval;

function showLoadingScreen() {
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
function hideLoadingScreen() {
  clearInterval(loadingAnimationInterval); // Clear the animation interval
  const loadingScreen = document.getElementById("loading-screen");
  if (loadingScreen) {
    document.body.removeChild(loadingScreen);
  }
}

function showGameMenu() {
  document.getElementById("gameMenu").style.display = "block";
}

function hideGameMenu() {
  document.getElementById("gameMenu").style.display = "none";
}

function generateHearts(currentLives) {
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

// Example usage: generateHearts(3);

function toggleMenu() {
  const gameMenu = document.getElementById("gameMenu");

  if (gameMenu.style.display === "block") {
    gameMenu.style.display = "none";

    //unpauseGame

    isGamePaused = false;

    //take control of mouse
    document.body.requestPointerLock();

    //click anywhere on the screen
    document.body.click();

    // unpauseGame();
  } else {
    //pauseGame
    isGamePaused = true;

    document.exitPointerLock();

    const resumeButton = document.getElementById("resumeButton");

    const restartButton = document.getElementById("restartButton");
    const level3Button = document.getElementById("level3Button");

    //hide advance to level 3 button
    if (level3Button) {
      level3Button.style.display = "none";
    }

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

    // pauseGame();
  }
}

function showWinScreen(elapsedTime) {
  const gameMenu = document.getElementById("gameMenu");
  elapsedTime = elapsedTime / 1000;
  // Hide start and resume buttons

  document.getElementById("resumeButton").style.display = "none";
  document.getElementById("restartButton").style.display = "block"; // Show restart button

  document.getElementById("volume-control").style.display = "none";

  //show advance to level 2 button
  document.getElementById("level3Button").style.display = "block";

  // add event listener to the level 2 button
  document.getElementById("level3Button").addEventListener("click", () => {
    // go to level 3 here
    window.location.href = "level3.html";
  });

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
  let bestTime = localStorage.getItem("bestTimeLevel2");

  if (!bestTime) {
    localStorage.setItem("bestTimeLevel2", elapsedTime);
    bestTime = localStorage.getItem("bestTimeLevel2");
  }

  // Create a best time message
  const bestTimeMessage = document.createElement("p");
  bestTimeMessage.id = "bestTimeMessage";
  bestTimeMessage.textContent = `Best Time: ${bestTime} seconds`; // Show the best time
  winMessage.appendChild(bestTimeMessage);

  //new best time
  if (elapsedTime <= bestTime) {
    localStorage.setItem("bestTimeLevel2", elapsedTime);
    congratsMessage.textContent = "Congratulations! New Best Time!";
  }

  // Create the final time message
  const finalTime = document.createElement("p");
  finalTime.textContent = `Your time: ${elapsedTime.toFixed(3)} seconds`; // Show the final time
  winMessage.appendChild(finalTime);

  // Append the win message to the game menu
  gameMenu.appendChild(winMessage);
}

function generateBestTime() {
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
  let bestTime = localStorage.getItem("bestTimeLevel2");

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
function resetGame() {
  // Logic to reset your game
  console.log("Game is restarting...");
}

function restartGame() {
  //let loader = document.getElementById("loading-screen");
  //loader.style.display = "block";
  //showLoadingScreen();
  //initGateObstacles();
  //hideLoadingScreen();
  //loader.style.display = "none";
  popedGates.forEach((gate) => {
    gate.exploded = false;
    gateExplosion(gate.position);
    scene.add(gate);
  });

  // do countdown again
  //reset timer to 0
  resetTimer();
  startCountdown();

  playerBody.position.set(0, 10, 10);
  //restart timer
  //resetTimer();
  currentLives = 3;
  generateHearts(currentLives);
  gameWon = false;
}

async function startGame() {
  try {
    let resumeButton = document.getElementById("resumeButton");
    let restartButton = document.getElementById("restartButton");
    let menuButton = document.getElementById("mainMenuButton");

    // Add event listener to the menu button
    menuButton.addEventListener("click", () => {
      window.location.href = "/";
    });

    // Add an event listener to the volume slider
    function updateVolume() {
      const volume = volumeSlider.value;
      gameVolume = volume;
      updateGameVolume();
    }
    volumeSlider.addEventListener("input", updateVolume);
    volumeSlider.value = gameVolume;

    // Add event listener to the resume button
    resumeButton.addEventListener("click", () => {
      toggleMenu();
      document.body.requestPointerLock();
    });

    // Add event listener to the restart button
    restartButton.addEventListener("click", () => {
      toggleMenu();
      generateBestTime();
      restartGame();
    });

    // Immediately start the game initialization process
    //showLoadingScreen();
    hideGameMenu();

    // Render the game
    await init();

    //show minimap
    let minimap = document.getElementById("minimap-container");
    if (minimap) {
      minimap.style.display = "block";
    }

    // Hide the controls UI
    let controlsInfo = document.getElementById("controls-info");
    if (controlsInfo) {
      controlsInfo.style.display = "none";
    }

    //take control of the mouse
    document.body.requestPointerLock();

    showTimer();
    hideLoadingScreen();
    createHeartsContainer();
    generateHearts(3);
    generateBestTime();
    renderer.setAnimationLoop(animate);
    startCountdown();
  } catch (error) {
    console.error("Error during initialization:", error);
    hideLoadingScreen();
    alert("An error occurred while loading the game. Please try again.");
  }
}

// Start the game immediately when the script loads
startGame();
