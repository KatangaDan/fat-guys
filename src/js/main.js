//Imports
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as CANNON from "cannon-es";
import CannonDebugger from "cannon-es-debugger";
import Stats from "stats.js";

// Import assets
import finish from "../img/finish.jpg";
import galaxy from "../img/galaxy.jpg";

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
  modelCenterOffset;

//Movement flags
let moveForward = false,
  moveBackward = false,
  moveLeft = false,
  moveRight = false;

//Speed constants
const PLAYER_SPEED = 20;
const jumpForce = 2000;

//Jumping flag
let isJumping = false;

function init() {
  initScene();
  initLighting();
  initPhysics();
  createGroundPiece(0, 0, 0, 100, 500);
  initPlayer();
  initEventListeners();
}

function initScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    70, // Field of view (45-75)
    window.innerWidth / window.innerHeight,
    0.1, // Min distance objects are rendered
    1000 //Max distance objects are rendered
  );

  //Set camera position
  camera.position.set(0, 30, -50);

  //Create a renderer
  renderer = new THREE.WebGLRenderer({ antialias: true }); // Add antialias for smoother edges
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.setAnimationLoop(animate);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Better shadow quality
  document.body.appendChild(renderer.domElement);

  //Create controls for testing
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; // Smooth motion
  controls.enableZoom = true; // Allow zooming
  controls.enablePan = true; // Allow panning
  controls.maxPolarAngle = Math.PI / 2; // Restrict vertical rotation (optional)

  //Create an axis
  const axesHelper = new THREE.AxesHelper(1000); // Size of the axes
  scene.add(axesHelper);

  //Start clock
  clock = new THREE.Clock();
}

function initLighting() {
  // Add ambient and directional lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
  directionalLight.position.set(0, 50, -20);
  //Cover entire scene
  directionalLight.castShadow = true;

  scene.add(directionalLight);
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
      model.scale.set(0.5, 0.5, 0.5);

      // Enable shadows for all meshes in the model
      model.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });

      scene.add(model);

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
  console.log(
    playerBody.position.y -
      (playerBody.aabb.upperBound.y - playerBody.aabb.lowerBound.y) / 2 -
      0.1
  );
  // Check if the player is grounded and if they are , allow them to jump
  if (
    playerBody.position.y -
      (playerBody.aabb.upperBound.y - playerBody.aabb.lowerBound.y) / 2 -
      0.1 <
    0.1
  ) {
    isJumping = true;
    playerBody.applyImpulse(new CANNON.Vec3(0, jumpForce, 0), model.position);
  }
}

// Update player movement based on key presses
function updateMovement(deltaTime) {
  const translationStep = PLAYER_SPEED * deltaTime;

  if (moveForward) playerBody.position.z += translationStep;
  if (moveBackward) playerBody.position.z -= translationStep;
  if (moveLeft) playerBody.position.x += translationStep;
  if (moveRight) playerBody.position.x -= translationStep;

  // Reset isJumping flag if the player has landed (velocity in the Y direction is near 0)
  if (
    playerBody.position.y -
      (playerBody.aabb.upperBound.y - playerBody.aabb.lowerBound.y) / 2 -
      0.1 <
    0.1
  ) {
    isJumping = false;
  }
  playerBody.angularVelocity.set(0, 0, 0);
}

function createGroundPiece(x, y, z, width, length) {
  //X, Y, Z IS THE POSITION OF THE GROUND PIECE, STARTING FROM THE CENTER
  //Create a simple plane for the ground
  const groundGeometry = new THREE.PlaneGeometry(width, length);
  const groundMaterial = new THREE.MeshStandardMaterial({ color: "grey" });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.position.set(x, y, z + length / 2);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  //Create a cannon.js body for the ground
  const groundShape = new CANNON.Box(
    new CANNON.Vec3(width / 2, 0.1, length / 2)
  );
  const groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
  groundBody.position.set(x, y, z + length / 2);
  world.addBody(groundBody);
}

function animate() {
  // Update the physics world on every frame
  const deltaTime = clock.getDelta();
  world.step(1 / 60, deltaTime, 10);

  // make the model follow the physics body
  if (model && playerBody) {
    //Update the movement of the player
    updateMovement(deltaTime);

    // Set the model's position to match the playerBody, adjusted by the center offset
    model.position.copy(playerBody.position).add(modelCenterOffset);

    // //Set camera position
    updateCamera();
  }

  cannonDebugger.update();
  renderer.render(scene, camera);
  //   controls.update();
}

// Update the camera position to follow the player
function updateCamera() {
  camera.position.set(
    model.position.x,
    model.position.y + 6,
    model.position.z - 12
  );
  camera.lookAt(model.position);
}
init();
