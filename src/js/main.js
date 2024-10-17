import * as THREE from "three";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import finish from "../img/finish.jpg";
import galaxy from '../img/galaxy.jpg';
import { mod } from "three/webgpu";

const fatGuyURL = new URL('../assets/FatGuy.glb', import.meta.url);

// Setup the scene
const scene = new THREE.Scene();

// Setup the camera (Third-Person Perspective)
const camera = new THREE.PerspectiveCamera(
  70,
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

//enable orbit so you can rotate, pan etc
const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

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
function createCylindricalObstacle(x, y, z, id, color){

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
createCylindricalObstacle(40, 2.5, 135 , "obs-8", "blue");
createCylindricalObstacle(35, 2.5, 120, "obs-9", "red");

// create floating platforms

function createFloatingPlatform(x, y, z, id, color){

    const platformGeometry = new THREE.BoxGeometry(6, 0.5, 6);
    const platformMaterial = new THREE.MeshStandardMaterial({ color: color });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.set(x,y,z);;
    platform.castShadow = true;
    platform.name = id; // Set the object's id
    scene.add(platform);

}

createFloatingPlatform(0, 0.25, -5,"danish","#ff0000");


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
const finishLineGeometry = new THREE.BoxGeometry(6,0.1, 3);
const finishLineMaterial = new THREE.MeshStandardMaterial({ map: textureLoader.load(finish)});
const finishLine = new THREE.Mesh(finishLineGeometry, finishLineMaterial);
finishLine.position.set(0, 0.1, -135);
finishLine.scale.x = 10;
finishLine.scale.z = 10;
scene.add(finishLine);

const assetLoader  = new GLTFLoader();
let model; // Declare model globally but set it to null initially

let mixer;

let runningAction;
let backRunningAction;

assetLoader.load(fatGuyURL.href, function (gltf) {
    model = gltf.scene;  // Set the model only when it is loaded
    model.position.set(0, 2, 150);  // Initial model position
    model.scale.set(0.5, 0.5, 0.5);  // Initial model scale
    model.rotation.y = Math.PI;  // Initial model rotation
    scene.add(model);  // Add the model to the scene only after it’s fully loaded

    mixer = new THREE.AnimationMixer(model);
    const clips = gltf.animations;
    const clip = THREE.AnimationClip.findByName(clips, 'Running');
    const backClip = THREE.AnimationClip.findByName(clips, 'Running Backward');
    runningAction = mixer.clipAction(clip);
    backRunningAction = mixer.clipAction(backClip);
    //action.play();

}, undefined, function (error) {
    console.error('Error loading player model:', error);
});


// Movement variables
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
const playerSpeed = 0.75;

// Handle key events  
function handleKeyDown(event) {
  switch (event.key) {
    case "w":
    case "ArrowUp":
      moveForward = true;
      if (runningAction && !runningAction.isRunning()) {
        runningAction.reset();  // Reset to the start of the animation
        runningAction.setLoop(THREE.LoopRepeat);  // Ensure the animation loops
        runningAction.play();   // Play the animation
      }
      break;
    case "s":
    case "ArrowDown":
      moveBackward = true;
      if (backRunningAction && !backRunningAction.isRunning()) {
        backRunningAction.reset();  // Reset to the start of the animation
        backRunningAction.setLoop(THREE.LoopRepeat);  // Ensure the animation loops
        backRunningAction.play();   // Play the animation
      }
      break;
    case "a":
    case "ArrowLeft":
      moveLeft = true;
      break;
    case "d":
    case "ArrowRight":
      moveRight = true;
      break;
  }
}

function handleKeyUp(event) {
  switch (event.key) {
    case "w":
    case "ArrowUp":
      moveForward = false;
      if (runningAction) {
        //runningAction.stop();  // Stop the animation when key is released
        runningAction.fadeOut(0.5);  // Fade out the animation when key is released
    }
      break;
    case "s":
    case "ArrowDown":
      moveBackward = false;
      if (backRunningAction) {
        //runningAction.stop();  // Stop the animation when key is released
        backRunningAction.fadeOut(0.5);  // Fade out the animation when key is released
    }
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

window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);

// Update player movement
function updateMovement() {
  if (moveForward) model.position.z -= playerSpeed;
  if (moveBackward) model.position.z += playerSpeed;
  if (moveLeft) model.position.x -= playerSpeed;
  if (moveRight) model.position.x += playerSpeed;
}

// Move obstacle
let obstacleDirection = 1;

function moveObstacle(id, speed) {

    const obstacle = scene.getObjectByName(id);
    
    if (obstacle) {
        obstacle.position.x += speed* obstacleDirection;
        if (obstacle.position.x > 48 || obstacle.position.x < -48) {
            obstacleDirection *= -1;
        }
    }
}

// Move platform
let platformDirection = 1;

function movePlatform(id) {    

    const platform = scene.getObjectByName(id);
    
    if(platform){
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
//   platform.position.set(0, 0.25, -5);// why?
}

const clock = new THREE.Clock();

// Animate the scene
function animate() {
  
  if (mixer) {
    mixer.update(clock.getDelta());
  }

  requestAnimationFrame(animate);
  updateMovement();
  movePlatform("danish");
  // moveObstacle("obs-1",0.45);
  // moveObstacle("obs-2",0.35);
  // moveObstacle("obs-3",0.55);

  // moveObstacle("obs-4",0.55);
  // moveObstacle("obs-5",0.35);
  // moveObstacle("obs-6",0.45);
  checkForWin();

  camera.position.set(
    model.position.x,
    model.position.y + 5,
    model.position.z + 10
  );
  camera.lookAt(model.position);

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
