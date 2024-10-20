import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TextureLoader } from 'three';
import { Vector3 } from "three";

import finish from "../img/finish.jpg";
import galaxy from "../img/galaxy.jpg";
import { mod } from "three/webgpu";

import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

const fatGuyURL = new URL("../assets/FatGuy.glb", import.meta.url);

let cameraGoal; // for camera goal

// Setup the scene
const scene = new THREE.Scene();

// Setup the camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 5, 10);

// Create the renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.shadowMap.enabled = true;

const textureLoader = new THREE.TextureLoader();

// Add background world
/*const cubeTextureLoader = new THREE.CubeTextureLoader();
scene.background = cubeTextureLoader.load([
    galaxy,
    galaxy,
    galaxy,
    galaxy,
    galaxy,
    galaxy
]);*/

// Create ground
const geometry = new THREE.PlaneGeometry(100, 300);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x87ceeb });
const ground = new THREE.Mesh(geometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// cylindrical obstacle
function createCylindricalObstacle(x, y, z, id, color) {
  const obstacleGeometry = new THREE.CylinderGeometry(1, 1, 10, 32);
  const obstacleMaterial = new THREE.MeshStandardMaterial({ color: color });
  const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
  obstacle.position.set(x, y, z);
  obstacle.castShadow = true;
  obstacle.name = id; // Set the object's id
  scene.add(obstacle);
}

// initial positions are centred
createCylindricalObstacle(5, 2.5, 130, "obs-1", "#ffffff");
createCylindricalObstacle(15, 2.5, 115, "obs-2", "blue");
createCylindricalObstacle(-5, 2.5, 125, "obs-3", "red");

// initial positions centred left
createCylindricalObstacle(-15, 2.5, 105, "obs-4", "#ffffff");
createCylindricalObstacle(-35, 2.5, 110, "obs-5", "blue");
createCylindricalObstacle(-25, 2.5, 120, "obs-6", "red");

// initial positions centred right
createCylindricalObstacle(25, 2.5, 135, "obs-7", "#ffffff");
createCylindricalObstacle(40, 2.5, 135, "obs-8", "blue");
createCylindricalObstacle(35, 2.5, 120, "obs-9", "red");

// create floating platforms

function createFloatingPlatform(x, y, z, id, color) {
  const platformGeometry = new THREE.BoxGeometry(6, 0.5, 6);
  const platformMaterial = new THREE.MeshStandardMaterial({ color: color });
  const platform = new THREE.Mesh(platformGeometry, platformMaterial);
  platform.position.set(x, y, z);
  platform.castShadow = true;
  platform.name = id; // Set the object's id
  scene.add(platform);
}

createFloatingPlatform(0, 0.25, -5, "danish", "#ff0000");

// Player Model
/*const playerGeometry = new THREE.SphereGeometry(1, 32, 32);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xff4500 });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.set(0, 2, 150);
player.castShadow = true;
scene.add(player);*/

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 10, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Finish Line
const finishLineGeometry = new THREE.BoxGeometry(6, 0.1, 3);
const finishLineMaterial = new THREE.MeshStandardMaterial({
  map: textureLoader.load(finish),
});
const finishLine = new THREE.Mesh(finishLineGeometry, finishLineMaterial);
finishLine.position.set(0, 0.1, -135);
finishLine.scale.x = 10;
finishLine.scale.z = 10;
scene.add(finishLine);

const assetLoader = new GLTFLoader();
let model; // Declare model globally but set it to null initially

let mixer; // for animation mixer

let runningAction; // for running animation
let backRunningAction; // for backward running animation
let jumpAction; // for jump animation
let idleAction; // for idle animation

// variables for camera control
const cameraOffset = new THREE.Vector3(0, 8, 13); // Changed to position camera behind and above the model
const cameraLerpFactor = 0.1;
let cameraRotation = new THREE.Euler(0, 0, 0, "YXZ");
const mouseSensitivity = 0.002; // for mouse sensitivity

let velocity = new THREE.Vector3();
const maxSpeed = 0.3; // for speed
const acceleration = 0.05; // for acceleration
const deceleration = 0.1; // for deceleration
const turnSpeed = 0.2; // for rotation

let isFirstPerson = false; // for view toggle
let controls; // for pointer lock controls

// for smooth animation transitions and avoid ghosting
let currentAction = null;
const fadeDuration = 0.07; // Duration of crossfade between animations
const animationSpeed = 1.5; // 1.0 is normal speed, 2.0 is double speed, etc.

assetLoader.load(
  fatGuyURL.href,
  function (gltf) {
    model = gltf.scene;
    model.position.set(0, 2, 150);
    model.scale.set(0.5, 0.5, 0.5);
    model.rotation.y = Math.PI; // Face the model forward
    scene.add(model);

    // Create and add camera goal as a child of the model
    cameraGoal = new THREE.Object3D();
    cameraGoal.position.copy(cameraOffset);
    model.add(cameraGoal);

    mixer = new THREE.AnimationMixer(model);
    const clips = gltf.animations;

    const clip = THREE.AnimationClip.findByName(clips, "Running");
    runningAction = mixer.clipAction(clip);
    runningAction.timeScale = animationSpeed;

    const backClip = THREE.AnimationClip.findByName(clips, "Running Backward");
    backRunningAction = mixer.clipAction(backClip);
    backRunningAction.timeScale = animationSpeed;

    const jumpClip = THREE.AnimationClip.findByName(clips, "Jump");
    jumpAction = mixer.clipAction(jumpClip);
    jumpAction.timeScale = animationSpeed;

    // Set idle animations
    const idleClip = THREE.AnimationClip.findByName(clips, "Idle");
    idleAction = mixer.clipAction(idleClip);
    idleAction.timeScale = animationSpeed;
    idleAction.setLoop(THREE.LoopRepeat);
    idleAction.play(); // Play the initial idle animation

    currentAction = idleAction; // Set the initial action
  },
  undefined,
  function (error) {
    console.error("Error loading player model:", error);
  }
);

// Movement variables
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let jumping = false;
let velocityY = 0;
const gravity = -0.5;
const groundLevel = 1; // Adjust this value based on ground level

// function to check if the player is idle
function checkIdleState() {
  if (!moveForward && !moveBackward && !moveRight && !moveLeft && !jumping && velocity.length() < 0.01) {
    if (currentAction !== idleAction) {
      console.log("Transitioning to idle");
      idleAction.reset().fadeIn(fadeDuration);
      idleAction.play();
      if (currentAction) {
        currentAction.fadeOut(fadeDuration);
      }
      currentAction = idleAction;
    }
  }
}

// Handle key events
function handleKeyDown(event) {
  switch (event.key) {
    case "w":
    case "ArrowUp":
      moveForward = true;
      if (runningAction && !runningAction.isRunning()) {
        runningAction.reset(); // Reset to the start of the animation
        runningAction.setLoop(THREE.LoopRepeat); // Ensure the animation loops
        runningAction.play(); // Play the animation
      }
      if (idleAction && idleAction.isRunning()) {
        idleAction.fadeOut(0.5); // Stop the idle animation
        idleAction.stop();
      }
      break;
    case "s":
    case "ArrowDown":
      moveBackward = true;
      if (backRunningAction && !backRunningAction.isRunning()) {
        backRunningAction.reset(); // Reset to the start of the animation
        backRunningAction.setLoop(THREE.LoopRepeat); // Ensure the animation loops
        backRunningAction.play(); // Play the animation
      }
      if (idleAction && idleAction.isRunning()) {
        idleAction.fadeOut(0.5); // Stop the idle animation
        idleAction.stop();
      }
      break;
    case "a":
    case "ArrowLeft":
      moveLeft = true;
      if (runningAction && !runningAction.isRunning()) {
        runningAction.reset(); // Reset to the start of the animation
        runningAction.setLoop(THREE.LoopRepeat); // Ensure the animation loops
        runningAction.play(); // Play the animation
      }
      if (idleAction && idleAction.isRunning()) {
        idleAction.fadeOut(0.5); // Stop the idle animation
        idleAction.stop();
      }
      break;
    case "d":
    case "ArrowRight":
      moveRight = true;
      if (runningAction && !runningAction.isRunning()) {
        runningAction.reset(); // Reset to the start of the animation
        runningAction.setLoop(THREE.LoopRepeat); // Ensure the animation loops
        runningAction.play(); // Play the animation
      }
      if (idleAction && idleAction.isRunning()) {
        idleAction.fadeOut(0.5); // Stop the idle animation
        idleAction.stop();
      }
      break;

    case " ":
      jumping = true;
      velocityY = 2.8; // Initial jump velocity
      console.log("jump");
      if (jumpAction && !jumpAction.isRunning()) {
        jumpAction.reset(); // Reset to the start of the animation
        jumpAction.setLoop(THREE.LoopRepeat); // Ensure the animation loops
        jumpAction.play(); // Play the animation
      }
      if (idleAction && idleAction.isRunning()) {
        idleAction.fadeOut(0.5); // Stop the idle animation
        idleAction.stop();
      }
      break;
  }
}

// function to handle key up events
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
    case " ":
      jumping = false;
      break;
  }
}

window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);

// function to handle mouse movement
function onMouseMove(event) {
  if (controls.isLocked) {
    cameraRotation.y -= event.movementX * mouseSensitivity;
    cameraRotation.x -= event.movementY * mouseSensitivity;
    cameraRotation.x = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, cameraRotation.x)
    );
  }
}

// event listeners for mouse control
document.addEventListener("mousemove", onMouseMove, false);

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

// event listener for the 'v' key to toggle views
window.addEventListener("keydown", (event) => {
  if (event.key === "v") {
    toggleView();
  }
});

// function to update movement
function updateMovement(delta) {
  if (!model) return; // if model is not loaded, return

  const moveVector = new THREE.Vector3(0, 0, 0);
  if (moveForward) moveVector.z -= 1;
  if (moveBackward) moveVector.z += 1;
  if (moveLeft) moveVector.x -= 1;
  if (moveRight) moveVector.x += 1;

  // Apply camera rotation to movement
  moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation.y);

  // Accelerate or decelerate
  if (moveVector.length() > 0) {
    velocity.add(moveVector.normalize().multiplyScalar(acceleration)); // accelerate
  } else {
    velocity.multiplyScalar(1 - deceleration); // decelerate
  }

  // Limit speed
  if (velocity.length() > maxSpeed) {
    velocity.normalize().multiplyScalar(maxSpeed);
  }

  // Apply movement
  model.position.add(velocity);

  // Check if the player is moving in any direction
  const isMoving = moveForward || moveBackward || moveLeft || moveRight || jumping;

  if (isMoving) {
    // Determine which movement animation to play
    let targetAction = runningAction;
    if (moveBackward && !moveForward && !moveLeft && !moveRight) {
      targetAction = backRunningAction;
    }

    // Crossfade to the appropriate movement animation
    if (currentAction !== targetAction) {
      targetAction.reset().fadeIn(fadeDuration);
      if (currentAction) {
        currentAction.fadeOut(fadeDuration);
      }
      currentAction = targetAction;
    }

    // Rotate model based on movement direction
    const targetRotation = Math.atan2(velocity.x, velocity.z);
    model.rotation.y = THREE.MathUtils.lerp(
      model.rotation.y,
      targetRotation,
      turnSpeed
    );
  } else {
    // Check for idle state if not moving
    checkIdleState();
  }

  // Handle jumping
  if (jumping) {
    velocityY += gravity; // Apply gravity
    model.position.y += velocityY; // Update character position

    if (model.position.y <= groundLevel) {
      model.position.y = groundLevel; // Ensure character doesn't fall below ground
      velocityY = 0;
      jumping = false;
      console.log("land");
    }
  }
}

// Move obstacle
let obstacleDirection = 1;

function moveObstacle(id, speed) {
  const obstacle = scene.getObjectByName(id);

  if (obstacle) {
    obstacle.position.x += speed * obstacleDirection;
    if (obstacle.position.x > 48 || obstacle.position.x < -48) {
      obstacleDirection *= -1;
    }
  }
}

// Move platform
let platformDirection = 1;

function movePlatform(id) {
  const platform = scene.getObjectByName(id);

  if (platform) {
    platform.position.x += 0.25 * platformDirection;
    if (platform.position.x > 48 || platform.position.x < -48) {
      platformDirection *= -1;
    }
  }
}

// Check for win condition
function checkForWin() {
  if (model.position.z < finishLine.position.z) {
    alert("You've completed the level!");
    resetGame();
  }
}

// Reset game state
function resetGame() {
  model.position.set(0, 2, 150);
}

const clock = new THREE.Clock();

// function to update camera position
function updateCameraPosition() {
  if (!model) return; // if model is not loaded, return

  if (isFirstPerson) {
    const headPosition = model.position.clone().add(new THREE.Vector3(0, 2, 0)); // get the model's head position
    camera.position.copy(headPosition); // set the camera position to the model's head position
    camera.rotation.copy(controls.getObject().rotation); // set the camera rotation to the model's rotation
  } else {
    // Third-person view
    const cameraPosition = new THREE.Vector3(
      Math.sin(cameraRotation.y) * cameraOffset.z, // set the camera position based on the camera offset and rotation
      cameraOffset.y,
      Math.cos(cameraRotation.y) * cameraOffset.z
    );
    cameraPosition.add(model.position); // add the model's position to the camera position
    camera.position.lerp(cameraPosition, cameraLerpFactor); // lerp the camera position to the camera goal position

    // Calculate a look-at point slightly in front of and above the model
    const lookAtPoint = model.position
      .clone()
      .add(
        new THREE.Vector3(0, 2, -5).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          cameraRotation.y
        )
      );

    // Make the camera look at the point in front of the model
    camera.lookAt(lookAtPoint);
  }
}

// hide the cursor
function hideCursor() {
  document.body.style.cursor = "none";
}
hideCursor();

// Start the animation loop
function animate() {
  const delta = clock.getDelta();

  if (mixer) {
    mixer.update(delta);
  }

  requestAnimationFrame(animate);

  if (model) {
    updateMovement(delta);
    checkIdleState(); // Add this line to check for idle state every frame
    checkForWin();
  }

  movePlatform("danish");

  updateCameraPosition();

  renderer.render(scene, camera);
}

// Start the animation loop
animate();

window.addEventListener("resize", function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

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

setupControls();
