import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as CANNON from "cannon-es";
import CannonDebugger from "cannon-es-debugger";
import Stats from "stats.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { createCrown, createCannonBall } from "./obstacles";

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
  gameWon = false;

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

async function init() {
  return new Promise(async (resolve, reject) => {
    try {
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
      await createGroundPiece(0, 0, 0, 60, 60);
      const crown = await createCrown(scene, 0, 0, 65);
      const cannonBall = createCannonBall(scene, 2);
      // const cylinder3 = await createSpinningBeam(scene, 20, 0, 65, 2, 40);

      //Init particle background system
      await initBackgroundParticleSystem();

      // Create finish line
      await initFinishLine();

      console.log("Game initialized successfully!");

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

async function die() {
  currentLives--;

  // Create particle explosion at player's current position
  createParticleExplosion(model.position);

  //Hide the player model
  model.visible = false;

  const respawnPosition =
    playerBody.position.z < 210
      ? { x: 0, y: 10, z: 10 }
      : { x: 0, y: 10, z: 230 };

  const hitsound = new THREE.Audio(listener);
  audioLoader.load(Phitsound, function (buffer) {
    hitsound.setBuffer(buffer);
    hitsound.setLoop(false);
    hitsound.setVolume(1);
    hitsound.play();
  });

  // Wait for particle effect and then respawn
  await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay

  //true death
  if (currentLives <= 0) {
    playerBody.position.set(0, 10, 10);
    currentLives = 3;
    generateHearts(currentLives);
    //reset timer
    resetTimer();
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

function checkForWin() {
  if (
    playerBody.position.z > 487 &&
    playerBody.position.y > 0 &&
    gameWon == false
  ) {
    gameWon = true;
    console.log("You win!");
    showWinScreen(elapsedTime);
    //Stop the timer
    timerRunning = false;
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
        model.position.set(0, 10, 2);
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

function crossfadeAction(fromAction, toAction, duration) {
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
function checkIdleState() {
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
    texture.repeat.set(10, 10);
    groundMaterial.map = texture;

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

// Update the camera position to follow the player
function updateCamera() {
  if (!model) return;

  if (isFirstPerson) {
    const headPosition = model.position.clone().add(new THREE.Vector3(0, 2, 0)); // get the model's head position
    camera.position.copy(headPosition); // set the camera position to the model's head position
    camera.rotation.copy(controls.getObject().rotation); // set the camera rotation to the model's rotation
  } else {
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
}
// Start game timer
function startGameTimer() {
  startTime = Date.now(); // Get the current timestamp in milliseconds
  elapsedTime = 0; // Reset elapsed time
  timerRunning = true;
  updateTimerDisplay(0);
  // Start the interval to update the timer every 100 ms (or your desired interval)
  // timerInterval = setInterval(updateTimer, 100);
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
  timer.style.top = "10px";
  timer.style.right = "10px";
  timer.style.color = "white";
  timer.style.padding = "10px";
  timer.style.borderRadius = "5px";
  timer.style.fontSize = "24px";
  timer.style.zIndex = "10000"; // Higher than other game elements

  // Initial timer content
  timer.textContent = "0.000 s";

  document.body.appendChild(timer);
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
  startTime = Date.now(); // Get the current timestamp in milliseconds
  elapsedTime = 0; // Reset elapsed time
  timerRunning = true;
  updateTimerDisplay(0);
}

let isPlayerDead = false;
let deathCooldown = 2000; // 2 seconds in milliseconds
let lastDeathTime = 0;

//display game timer
let frame = 0;
function animate() {
  //console.log("Frame:", frame);
  frame++;

  //start timer on 2nd frame because theres a big time difference between the first frame and the second frame
  if (frame === 2) {
    startGameTimer();
    //showTimer;
  }

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
    /*Actual bounding boxes for the player and obstacles*/

    //player bounding box
    const playerBoundingBox = new THREE.Box3().setFromObject(model);

    /*Actual bounding boxes for the player and obstacles*/

    /*HELPERS TO VISUALIZE BOUNDING BOXES */
    if (playerHelper) {
      playerHelper.update();
    }

    //Update gate helpers
    // gateHelpers.forEach((helper) => {
    //   if (helper) helper.update();
    // });

    //Particle system
    if (particleSystem) {
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

  //Animate the gates
  //   animateGates(deltaTime);
  //   animateCylinders(deltaTime);
  //   animateFans(deltaTime);
  //   animateRodsX(deltaTime);
  //   animateRodsZ(deltaTime);

  // cannonDebugger.update();
  renderer.render(scene, camera);
  //controls.update();

  stats.end();
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
    heartImg.style.width = "30px"; // Adjust size as needed
    heartImg.style.marginLeft = "5px"; // Space between hearts
    heartImg.style.position = "relative";
    heartImg.style.zIndex = "10001"; // Higher than other game elements
    heartsContainer.appendChild(heartImg);
  }
}

// Create a container for the hearts when the game starts
function createHeartsContainer() {
  const heartsContainer = document.createElement("div");
  heartsContainer.id = "hearts-container";
  heartsContainer.style.position = "fixed";
  heartsContainer.style.top = "20px";
  heartsContainer.style.right = "100px"; // Adjust based on timer position
  heartsContainer.style.display = "flex";
  heartsContainer.style.zIndex = "10000"; // Higher than other game elements

  //add a thick border around this container
  //heartsContainer.style.border = "2px solid white";
  document.body.appendChild(heartsContainer);
}

// Example usage: generateHearts(3);

function toggleMenu() {
  const gameMenu = document.getElementById("gameMenu");
  if (gameMenu.style.display === "block") {
    gameMenu.style.display = "none";

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

    if (winMessage) {
      winMessage.remove();
    }

    if (congratsMessage) {
      congratsMessage.remove();
    }
    if (bestTimeMessage) {
      bestTimeMessage.remove();
    }

    gameMenu.style.display = "block";

    // pauseGame();
  }
}

function showWinScreen(elapsedTime) {
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

function generateBestTime() {
  //clear the best time container
  if (document.getElementById("best-time")) {
    document.getElementById("best-time").remove();
  }

  const bestTimeContainer = document.createElement("div");
  bestTimeContainer.id = "best-time";

  // Style the best time container
  bestTimeContainer.style.position = "fixed";
  bestTimeContainer.style.top = "50px"; // Adjust to position it below the timer
  bestTimeContainer.style.right = "10px"; // Same right alignment as the timer
  bestTimeContainer.style.color = "white"; // Text color
  bestTimeContainer.style.fontSize = "20px"; // Font size
  bestTimeContainer.style.zIndex = "10000"; // Higher than other game elements

  // Retrieve the best time from localStorage
  let bestTime = localStorage.getItem("bestTime");

  // Format the display message
  if (bestTime) {
    bestTimeContainer.textContent = `Best Time: ${parseFloat(bestTime).toFixed(
      3
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

      // unpauseGame();
    });

    //Add event listener to the restart button
    restartButton.addEventListener("click", () => {
      // window.location.reload();
      toggleMenu();

      //if wasd dont have event listeners, add them back
      window.addEventListener("keydown", handleKeyDown);

      //Respawn the player(make it a function cause timer needs to be reset, etc)
      playerBody.position.set(0, 10, 10);

      //restart timer
      resetTimer();

      currentLives = 3;
      generateHearts(currentLives);

      gameWon = false;

      generateBestTime();
    });

    //Add event listener to the start button
    startButton.addEventListener("click", async () => {
      showLoadingScreen();
      hideGameMenu();
      await init();
      //startGameTimer();
      showTimer();
      hideLoadingScreen();
      createHeartsContainer();
      generateHearts(3);
      generateBestTime();

      renderer.setAnimationLoop(animate);

      //Add pause event listener
      document.addEventListener("keydown", (event) => {
        if (event.key === "P" || event.key === "p") {
          toggleMenu();

          document.exitPointerLock();
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