import * as THREE from "three";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as dat from "dat.gui";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// import images 
import galaxy from '../img/galaxy.jpg';
import stars from '../img/stars.jpg';
import shush from '../img/shush-em.jpg';
import niko from '../img/niko.jpeg';
import doku from '../img/doku.jpeg';

const characterURL= new URL('../assets/mirrorChracter.glb', import.meta.url);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1, // Corrected near clipping plane
    1000
);

// Create the renderer
const renderer = new THREE.WebGLRenderer();
renderer.shadowMap.enabled = true;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const axesHelper = new THREE.AxesHelper(5);
const orbit = new OrbitControls(camera, renderer.domElement);
scene.add(axesHelper);

camera.position.set(-10, 30, 30);
orbit.target = new THREE.Vector3(-12, 2, 10);

// allow for keys to control scene
orbit.keys = {
    LEFT: "KeyA",
    UP: "ArrowUp",
    RIGHT: "KeyD",
    BOTTOM: "ArrowDown",
    FORWARD: "KeyW",
    BACKWARD: "KeyS"  // Added backward movement
};

orbit.listenToKeyEvents(window);
orbit.keyPanSpeed = 50;

// Movement variables
let moveForward = false;
let moveBackward = false;
const moveSpeed = 0.75;

// Add event listeners for key down and key up
window.addEventListener('keydown', (event) => {
    if (event.code === orbit.keys.FORWARD) {
        moveForward = true;
    }
    if (event.code === orbit.keys.BACKWARD) {
        moveBackward = true;
    }
});

window.addEventListener('keyup', (event) => {
    if (event.code === orbit.keys.FORWARD) {
        moveForward = false;
    }
    if (event.code === orbit.keys.BACKWARD) {
        moveBackward = false;
    }
});

// Add a box to the scene
const boxGeometry = new THREE.BoxGeometry();
const boxMaterial = new THREE.MeshBasicMaterial({color: 0x00FF00});
const box = new THREE.Mesh(boxGeometry, boxMaterial);
scene.add(box);

// Add a plane to the scene
const planeGeometry = new THREE.PlaneGeometry(100, 100);
const planeMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
    side: THREE.DoubleSide    
});

const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -0.5 * Math.PI;
plane.receiveShadow = true;

scene.add(plane);

const gridHelper = new THREE.GridHelper(100);
scene.add(gridHelper);

// Add a sphere to the scene
const sphereGeometry = new THREE.SphereGeometry(4, 50, 50);
const sphereMaterial = new THREE.MeshStandardMaterial({
    color: 0x0000FF,
});
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphere.position.set(-10, 10, 0);
sphere.castShadow = true;
scene.add(sphere);

// Add ambient light to the scene
const ambientLight = new THREE.AmbientLight(0x333333);
scene.add(ambientLight);

// Add spot light to the scene
const spotLight = new THREE.SpotLight(0xFFFFFF, 500000);
scene.add(spotLight);
spotLight.position.set(-100, 100, 0);
spotLight.castShadow = true;
spotLight.angle = 0.2;

// Add fog to the scene
scene.fog = new THREE.Fog(0xFFFFFF, 0, 200);

// Add background world
const textureLoader = new THREE.TextureLoader();

const box2MultiMaterial = [
    new THREE.MeshBasicMaterial({map: textureLoader.load(doku)}),
    new THREE.MeshBasicMaterial({map: textureLoader.load(shush)}),
    new THREE.MeshBasicMaterial({map: textureLoader.load(shush)}),
    new THREE.MeshBasicMaterial({map: textureLoader.load(niko)}),
    new THREE.MeshBasicMaterial({map: textureLoader.load(niko)}),
    new THREE.MeshBasicMaterial({map: textureLoader.load(doku)}),
];
const box2 = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), box2MultiMaterial);
box2.position.set(0, 15, 10);
box2.castShadow = true;
scene.add(box2);

const cubeTextureLoader = new THREE.CubeTextureLoader();
scene.background = cubeTextureLoader.load([
    galaxy,
    galaxy,
    galaxy,
    galaxy,
    galaxy,
    galaxy
]);

// Add imported character to the scene
const assetLoader = new GLTFLoader();
assetLoader.load(characterURL.href, function(gltf) {
    const model = gltf.scene;
    scene.add(model);
    model.position.set(-12, 2, 10);
});

// Add dat.gui to allow color wheel on frontend
const gui = new dat.GUI();
const options = {
    sphereColor: '#ffea00',
    wireframe: false,
    speed: 0.1,
    angle: 0.2,
    penumbra: 0,
    intensity: 1
};

gui.addColor(options, 'sphereColor').onChange(function(e){
    sphere.material.color.set(e);
});

gui.add(options, 'wireframe').onChange(function(e){
    sphere.material.wireframe = e;
});

gui.add(options, 'speed', 0, 0.1);
gui.add(options, 'angle', 0, 1);
gui.add(options, 'penumbra', 0, 1);
gui.add(options, 'intensity', 0, 500000);

let step = 0;

function animate(time) {
    orbit.update();

    // Handle forward movement
    if (moveForward) {
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        camera.position.add(direction.multiplyScalar(moveSpeed));
    }

    // Handle backward movement
    if (moveBackward) {
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        camera.position.add(direction.multiplyScalar(-moveSpeed));
    }

    box.rotation.x = time / 1000;
    box.rotation.y = time / 1000;

    step += options.speed;
    sphere.position.y = 10 * Math.abs(Math.sin(step));

    spotLight.angle = options.angle;
    spotLight.penumbra = options.penumbra;
    spotLight.intensity = options.intensity;

    // Render the scene
    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
