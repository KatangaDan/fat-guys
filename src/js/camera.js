import * as THREE from 'three';

let scene, camera, renderer;
let cameraSpeed = 0.1;

function init() {
    // Create scene
    scene = new THREE.Scene();

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // Create renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Add a simple cube to the scene
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // Add event listener for keyboard input
    document.addEventListener('keydown', onDocumentKeyDown, false);
    // Start rendering loop
    animate();
}

function onDocumentKeyDown(event) {
    const keyCode = event.which;
    if (keyCode == 87) {
        // W key - move forward
        camera.position.z -= cameraSpeed;
    } else if (keyCode == 83) {
        // S key - move backward
        camera.position.z += cameraSpeed;
    } else if (keyCode == 65) {
        // A key - move left
        camera.position.x -= cameraSpeed;
    } else if (keyCode == 68) {
        // D key - move right
        camera.position.x += cameraSpeed;
    } else if (keyCode == 81) {
        // Q key - move up
        camera.position.y += cameraSpeed;
    } else if (keyCode == 69) {
        // E key - move down
        camera.position.y -= cameraSpeed;
    }
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// Initialize the scene
init();