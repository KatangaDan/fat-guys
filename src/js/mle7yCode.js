import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TextureLoader } from "three";
import { Vector3 } from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import finish from "../img/finish.jpg";
import galaxy from "../img/galaxy.jpg";
import basicBg from "../img/sky.jpg";
import godofWarSound from "../sounds/sound2.mp3";
import { mod } from "three/webgpu";

const fatGuyURL = new URL("../assets/FatGuy.glb", import.meta.url);

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 5, 10);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const textureLoader = new THREE.TextureLoader();

const listener = new THREE.AudioListener();
camera.add(listener);
const audioLoader = new THREE.AudioLoader();

// Game state variables
let gameStarted = false;
let isPaused = false;
let isGameWon = false;
let animationFrameId;
let lastTime = 0;

// DOM elements
let gameContainer;
let menuElement;
let startButton;
let resumeButton;
let restartButton;

// Player model and animation variables
let model;
let mixer;
let runningAction;
let backRunningAction;
let jumpAction;
let idleAction;
let currentAction = null;
const fadeDuration = 0.07;
const animationSpeed = 1.5;

// Camera and controls variables
let cameraGoal;
const cameraOffset = new THREE.Vector3(0, 8, 13);
const cameraLerpFactor = 0.1;
let cameraRotation = new THREE.Euler(0, 0, 0, "YXZ");
const mouseSensitivity = 0.002;
let isFirstPerson = false;
let finishLine;
let controls;

// Movement variables
let velocity = new THREE.Vector3();
const maxSpeed = 0.3;
const acceleration = 0.05;
const deceleration = 0.1;
const turnSpeed = 0.2;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let jumping = false;
let velocityY = 0;
const gravity = -0.5;
const groundLevel = 1;

// Obstacle and platform variables
let obstacleDirection = 1;
let platformDirection = 1;

// Function to create ground
function createGround() {
  const geometry = new THREE.PlaneGeometry(100, 300);
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x87ceeb });
  const ground = new THREE.Mesh(geometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
}

function initBackground() {
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
}

initBackground();

// Function to create cylindrical obstacle
function createCylindricalObstacle(x, y, z, id, color) {
  const obstacleGeometry = new THREE.CylinderGeometry(1, 1, 10, 32);
  const obstacleMaterial = new THREE.MeshStandardMaterial({ color: color });
  const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
  obstacle.position.set(x, y, z);
  obstacle.castShadow = true;
  obstacle.name = id;
  scene.add(obstacle);
}

// Function to create floating platform
function createFloatingPlatform(x, y, z, id, color) {
  const platformGeometry = new THREE.BoxGeometry(6, 0.5, 6);
  const platformMaterial = new THREE.MeshStandardMaterial({ color: color });
  const platform = new THREE.Mesh(platformGeometry, platformMaterial);
  platform.position.set(x, y, z);
  platform.castShadow = true;
  platform.name = id;
  scene.add(platform);
}

// Function to create lighting
function createLighting() {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(10, 10, 10);
  directionalLight.castShadow = true;
  scene.add(directionalLight);
}

// Function to create finish line
function createFinishLine() {
  const finishLineGeometry = new THREE.BoxGeometry(6, 0.1, 3);
  const finishLineMaterial = new THREE.MeshStandardMaterial({
    map: textureLoader.load(finish),
  });
  const finishLine = new THREE.Mesh(finishLineGeometry, finishLineMaterial);
  finishLine.position.set(0, 0.1, -135);
  finishLine.scale.x = 10;
  finishLine.scale.z = 10;
  scene.add(finishLine);
  return finishLine;
}

// Function to load player model
function loadPlayerModel() {
  const assetLoader = new GLTFLoader();
  assetLoader.load(
    fatGuyURL.href,
    function (gltf) {
      model = gltf.scene;
      model.position.set(0, 2, 150);
      model.scale.set(0.5, 0.5, 0.5);
      model.rotation.y = Math.PI;
      scene.add(model);

      // Create and add camera goal as a child of the model
      cameraGoal = new THREE.Object3D();
      cameraGoal.position.copy(cameraOffset);
      model.add(cameraGoal);

      mixer = new THREE.AnimationMixer(model);
      const clips = gltf.animations;

      runningAction = mixer.clipAction(
        THREE.AnimationClip.findByName(clips, "Running")
      );
      runningAction.timeScale = animationSpeed;

      backRunningAction = mixer.clipAction(
        THREE.AnimationClip.findByName(clips, "Running Backward")
      );
      backRunningAction.timeScale = animationSpeed;

      jumpAction = mixer.clipAction(
        THREE.AnimationClip.findByName(clips, "Jump")
      );
      jumpAction.timeScale = animationSpeed;

      idleAction = mixer.clipAction(
        THREE.AnimationClip.findByName(clips, "Idle")
      );
      idleAction.timeScale = animationSpeed;
      idleAction.setLoop(THREE.LoopRepeat);
      idleAction.play();

      currentAction = idleAction;
    },
    undefined,
    function (error) {
      console.error("Error loading player model:", error);
    }
  );
}

// Function to check idle state
function checkIdleState() {
  if (
    !moveForward &&
    !moveBackward &&
    !moveRight &&
    !moveLeft &&
    !jumping &&
    velocity.length() < 0.01
  ) {
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

// Function to handle key down events
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

// Function to handle key up events
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

// Function to handle mouse movement
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

// Function to toggle view
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

// Function to update movement
function updateMovement(delta) {
  if (!model) return;

  const moveVector = new THREE.Vector3(0, 0, 0);
  if (moveForward) moveVector.z -= 1;
  if (moveBackward) moveVector.z += 1;
  if (moveLeft) moveVector.x -= 1;
  if (moveRight) moveVector.x += 1;

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
  const isMoving =
    moveForward || moveBackward || moveLeft || moveRight || jumping;

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

// Function to move obstacle
function moveObstacle(id, speed) {
  const obstacle = scene.getObjectByName(id);

  if (obstacle) {
    obstacle.position.x += speed * obstacleDirection;
    if (obstacle.position.x > 48 || obstacle.position.x < -48) {
      obstacleDirection *= -1;
    }
  }
}

// Function to move platform
function movePlatform(id) {
  const platform = scene.getObjectByName(id);

  if (platform) {
    platform.position.x += 0.25 * platformDirection;
    if (platform.position.x > 48 || platform.position.x < -48) {
      platformDirection *= -1;
    }
  }
}

// Function to show win overlay
function showWinOverlay() {
  isGameWon = true;
  isPaused = true;
  gameStarted = false;
  controls.unlock();

  const overlay = document.createElement("div");
  overlay.id = "winOverlay";
  overlay.className = "menu";

  const message = document.createElement("h1");
  message.textContent = "Congratulations!";

  const subMessage = document.createElement("p");
  subMessage.textContent = "You've completed the level!";

  const playAgainButton = document.createElement("button");
  playAgainButton.textContent = "Play Again";
  playAgainButton.addEventListener("click", () => {
    document.body.removeChild(overlay);
    resetGame();
    startGame();
  });

  const mainMenuButton = document.createElement("button");
  mainMenuButton.textContent = "Main Menu";
  mainMenuButton.addEventListener("click", () => {
    document.body.removeChild(overlay);
    resetGame();
    showMainMenu();
  });

  overlay.appendChild(message);
  overlay.appendChild(subMessage);
  overlay.appendChild(playAgainButton);
  overlay.appendChild(mainMenuButton);

  document.body.appendChild(overlay);
  showCursor();
}

// Function to check for win
function checkForWin() {
  if (model.position.z < finishLine.position.z) {
    showWinOverlay();
    isPaused = true; // Pause the game
    controls.unlock(); // Unlock controls
  }
}

// Function to reset game
function resetGame() {
  if (model) {
    model.position.set(0, 2, 150); // Reset to starting position
    model.rotation.y = Math.PI; // Reset rotation to face the correct direction
    velocity.set(0, 0, 0);
    moveForward = moveBackward = moveLeft = moveRight = jumping = false;
    cameraRotation.set(0, 0, 0);

    if (currentAction) {
      currentAction.stop();
    }
    idleAction.reset().play();
    currentAction = idleAction;
  }

  isPaused = false;
  gameStarted = false;
  isGameWon = false;

  // Reset camera position relative to the model's starting position
  camera.position.set(0, 7, 163);
  camera.lookAt(0, 2, 150); // Look at the model's starting position

  // Reset any moving obstacles or platforms
  resetObstaclesAndPlatforms();

  // Cancel any ongoing animation frame
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

// New function to reset obstacles and platforms
function resetObstaclesAndPlatforms() {
  // Reset the position of the moving platform
  const platform = scene.getObjectByName("danish");
  if (platform) {
    platform.position.set(0, 0.25, -5);
  }

  // Reset the direction of obstacles and platforms
  obstacleDirection = 1;
  platformDirection = 1;

  // If we have other moving obstacles, reset them here
}

// Function to update camera position
function updateCameraPosition() {
  if (!model) return; // if model is not loaded, return

  if (isFirstPerson) {
    const headPosition = model.position.clone().add(new THREE.Vector3(0, 2, 0)); // get the model's head position
    camera.position.copy(headPosition); // set the camera position to the model's head position
    camera.rotation.copy(controls.getObject().rotation); // set the camera rotation to the model's rotation
  } else {
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

// Function to hide cursor
function hideCursor() {
  if (gameContainer) {
    gameContainer.style.cursor = "none";
  }
}

// Function to show cursor
function showCursor() {
  if (gameContainer) {
    gameContainer.style.cursor = "auto";
  }
}

// Function to show pause overlay
function showPauseOverlay() {
  const overlay = document.createElement("div");
  overlay.id = "pauseOverlay";
  overlay.className = "menu";

  const message = document.createElement("h1");
  message.textContent = "Game Paused";

  const resumeButton = document.createElement("button");
  resumeButton.textContent = "Resume";
  resumeButton.addEventListener("click", togglePause);

  overlay.appendChild(message);
  overlay.appendChild(resumeButton);
  document.body.appendChild(overlay);

  showCursor();
}

// Function to remove pause overlay
function removePauseOverlay() {
  const overlay = document.getElementById("pauseOverlay");
  if (overlay) {
    document.body.removeChild(overlay);
  }

  hideCursor();
}

// Function to toggle pause
function togglePause() {
  if (isGameWon) return; // Don't toggle pause if the game is won

  isPaused = !isPaused;
  if (isPaused) {
    controls.unlock();
    showPauseMenu();
  } else {
    menuElement.style.display = "none";
    gameContainer.style.display = "block";
    lastTime = performance.now();
    animate();
    controls.lock();
  }
}

// Function to show pause menu
function showPauseMenu() {
  menuElement.style.display = "block";
  gameContainer.style.display = "none";
  startButton.style.display = "none";
  resumeButton.style.display = "block";
  restartButton.style.display = "block";
  showCursor();
}

// Function to initialize menu
function initializeMenu() {
  gameContainer = document.getElementById("gameContainer");
  menuElement = document.getElementById("gameMenu");
  startButton = document.getElementById("startButton");
  resumeButton = document.getElementById("resumeButton");
  restartButton = document.getElementById("restartButton");

  startButton.addEventListener("click", startGame);
  resumeButton.addEventListener("click", resumeGame);
  restartButton.addEventListener("click", restartGame);

  showMainMenu(); // show the main menu on initialization
}

// Function to start game
function startGame() {
  gameStarted = true;
  isPaused = false;
  menuElement.style.display = "none";
  gameContainer.style.display = "block";
  gameContainer.appendChild(renderer.domElement);
  hideCursor();
  controls.lock();
  lastTime = performance.now();
  animate();

  // Remove menu canvas if it exists
  const menuCanvas = menuElement.querySelector("canvas");
  if (menuCanvas) {
    menuElement.removeChild(menuCanvas);
  }
  const sound = new THREE.Audio(listener);
  audioLoader.load(godofWarSound, function (buffer) {
    sound.setBuffer(buffer);
    sound.setLoop(true); // Set to true for background music
    sound.setVolume(0.4); // Adjust the volume as needed
    sound.play();
  });
}

// Function to resume game
function resumeGame() {
  menuElement.style.display = "none";
  gameContainer.style.display = "block";
  togglePause();
}

// Function to restart game
function restartGame() {
  resetGame();
  menuElement.style.display = "none";
  gameContainer.style.display = "block";
  if (isPaused) {
    isPaused = false;
  }
  startGame(); // properly restart the game loop
}

// Function to show main menu
function showMainMenu() {
  menuElement.style.display = "block";
  gameContainer.style.display = "none";
  startButton.style.display = "block";
  resumeButton.style.display = "none";
  restartButton.style.display = "none";
  showCursor();
  isPaused = true;
}

// Function to animate
function animate() {
  if (!isPaused && gameStarted) {
    animationFrameId = requestAnimationFrame(animate);

    const currentTime = performance.now();
    const delta = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    if (mixer) {
      mixer.update(delta);
    }

    if (model) {
      updateMovement(delta);
      checkIdleState();
      checkForWin();
    }

    movePlatform("danish");

    updateCameraPosition();

    renderer.render(scene, camera);
  }
}

// Function to setup controls
function setupControls() {
  controls = new PointerLockControls(camera, renderer.domElement);

  document.addEventListener("click", () => {
    if (gameStarted && !isPaused) {
      controls.lock();
    }
  });

  controls.addEventListener("lock", () => {
    console.log("PointerLock activated");
    hideCursor();
  });

  controls.addEventListener("unlock", () => {
    console.log("PointerLock deactivated");
    showCursor();
  });
}

// Event listeners
window.addEventListener("load", initializeMenu);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && gameStarted && !isGameWon) {
    event.preventDefault();
    togglePause();
  }
});
window.addEventListener("resize", function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
document.addEventListener("mousemove", onMouseMove, false);
window.addEventListener("keydown", (event) => {
  if (event.key === "v") {
    toggleView();
  }
});

// Initialize the game
createGround();
createCylindricalObstacle(5, 2.5, 130, "obs-1", "#ffffff");
createCylindricalObstacle(15, 2.5, 115, "obs-2", "blue");
createCylindricalObstacle(-5, 2.5, 125, "obs-3", "red");
createCylindricalObstacle(-15, 2.5, 105, "obs-4", "#ffffff");
createCylindricalObstacle(-35, 2.5, 110, "obs-5", "blue");
createCylindricalObstacle(-25, 2.5, 120, "obs-6", "red");
createCylindricalObstacle(25, 2.5, 135, "obs-7", "#ffffff");
createCylindricalObstacle(40, 2.5, 135, "obs-8", "blue");
createCylindricalObstacle(35, 2.5, 120, "obs-9", "red");
createFloatingPlatform(0, 0.25, -5, "danish", "#ff0000");
createLighting();
finishLine = createFinishLine();
loadPlayerModel();
setupControls();

document.body.appendChild(renderer.domElement);
