import "defaults.css";
import * as THREE from "three";

let camera;
let renderer;
let scene;
let objects = [];

const DEBUG = true;
const ASPECT = 1;
const CUBE_SIZE = 400;

function initCamera() {
  const left = 0;
  const right = window.innerWidth;
  const top = 0;
  const bottom = window.innerHeight; // defautl canvas size
  const near = -1000;
  const far = 1000;
  camera = new THREE.OrthographicCamera(
    left / ASPECT,
    right / ASPECT,
    top / ASPECT,
    bottom / ASPECT,
    near,
    far
  );
  camera.updateProjectionMatrix();
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer();
  renderer.setClearColor(0xffffff);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
}

function initControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.update();
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  var ambient = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambient);
  var directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
  directionalLight.position.set(100, 350, 250);
  directionalLight.castShadow = true;
  scene.add(directionalLight);
  if (DEBUG) {
    const axesHelper = new THREE.AxesHelper(5000);
    scene.add(axesHelper);
  }
}

function initObjects() {
  const cubeGeo = new THREE.BoxBufferGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
  const cubeMat = new THREE.MeshPhongMaterial({ color: "#8AC" });
  const mesh = new THREE.Mesh(cubeGeo, cubeMat);
  mesh.position.set(window.innerWidth / 2, window.innerHeight / 2, CUBE_SIZE);
  scene.add(mesh);
}

function onWindowResize() {
  camera.right = window.innerWidth;
  camera.bottom = window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function initEventListeners() {
  window.addEventListener("resize", onWindowResize);
}

function render() {
  requestAnimationFrame(render);
  controls.update();
  renderer.render(scene, camera);
}

function main() {
  initCamera();
  initRenderer();
  initScene();
  initObjects();
  initEventListeners();
  console.log("sr");
  render();
}

main();
