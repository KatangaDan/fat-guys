import * as THREE from 'three';

// Create the scene
const scene = new THREE.Scene();

// Create a camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 5);

// Create a renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

// Add directional light to simulate the sun
const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
sunLight.position.set(5, 10, 7.5);
scene.add(sunLight);

// Create the ground (grass)
const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Create the sky
const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
const skyMaterial = new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide });
const sky = new THREE.Mesh(skyGeometry, skyMaterial);
scene.add(sky);

// Create a simple box character
const characterGeometry = new THREE.BoxGeometry(1, 1, 1);
const characterMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
const character = new THREE.Mesh(characterGeometry, characterMaterial);
character.position.set(0, 0.5, 0);
scene.add(character);

// Keyboard input handling
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    w: false,
    s: false,
    a: false,
    d: false
};

//Background Sound
// 1. Create an audio listener and add it to the camera
const listener = new THREE.AudioListener();
camera.add(listener);

// 2. Create a global audio source (this will play the music)
const sound = new THREE.Audio(listener);

// 3. Load a sound and set it as the Audio object's buffer
const audioLoader = new THREE.AudioLoader();
audioLoader.load('../sounds/sound.mp3', function(buffer) {
    sound.setBuffer(buffer);
    sound.setLoop(true);  // Set to true for background music
    sound.setVolume(1); // Adjust the volume as needed
    sound.play();
});

document.addEventListener('keydown', (event) => {
    if (keys.hasOwnProperty(event.key)) {
        keys[event.key] = true;
    }
});

document.addEventListener('keyup', (event) => {
    if (keys.hasOwnProperty(event.key)) {
        keys[event.key] = false;
    }
});

function animate() {
    requestAnimationFrame(animate);

    // Update character position based on keys pressed
    if (keys.ArrowUp || keys.w) character.position.z -= 0.1;
    if (keys.ArrowDown || keys.s) character.position.z += 0.1;
    if (keys.ArrowLeft || keys.a) character.position.x -= 0.1;
    if (keys.ArrowRight || keys.d) character.position.x += 0.1;

    renderer.render(scene, camera);
}

animate();