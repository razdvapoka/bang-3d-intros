import "defaults.css";
import * as THREE from "three";
import * as CANNON from "cannon";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import modelUrl from "./models/objects-clear.glb";

var DEBUG = false;
const cubeSize = 200;
const WALL_WIDTH = 20;

var mesh;
var objectBox;
var objectSize;
var scene;
var camera;
var renderer;
var controls;
var content;
var light1;
var light2;

var mx = 0;
var my = 0;

var boundingBox;
var walls = [];
var wallBodies = [];

var cubes;
var bodies;
var body;

var world,
  mass,
  shape,
  timeStep = 1 / 60;

var state = {
  // Lights
  exposure: 1.0,
  textureEncoding: "sRGB",
  ambientIntensity: 0.3,
  ambientColor: 0xffffff,
  directIntensity: 0.8 * Math.PI, // TODO(#116)
  directColor: 0xffffff,
  addLights: true
};

function traverseMaterials(object, callback) {
  object.traverse(node => {
    if (!node.isMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach(callback);
  });
}

function updateTextureEncoding() {
  const encoding = state.textureEncoding === "sRGB" ? THREE.sRGBEncoding : THREE.LinearEncoding;
  traverseMaterials(content, material => {
    if (material.map) material.map.encoding = encoding;
    if (material.emissiveMap) material.emissiveMap.encoding = encoding;
    if (material.map || material.emissiveMap) material.needsUpdate = true;
  });
}

function onWindowResize() {
  camera.right = window.innerWidth;
  camera.bottom = window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  initWalls();
  updateCannonWalls();
}

function initCannon() {
  world = new CANNON.World();
  world.gravity.set(0, 0, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 10;

  const shape = new CANNON.Box(new CANNON.Vec3(cubeSize / 2, cubeSize / 2, cubeSize / 2));
  body = new CANNON.Body({
    mass: 10,
    position: mesh.position,
    quaternion: mesh.quaternion
  });
  body.addShape(shape);
  body.angularVelocity.set(0, Math.random() > 0.5 ? 10 : -10, 0);
  body.angularDamping = 0.5;
  world.addBody(body);
}

function initCannonWalls() {
  walls.forEach(wall => {
    const wallShape = new CANNON.Plane();
    const wallBody = new CANNON.Body({
      mass: 0,
      position: wall.position,
      quaternion: wall.quaternion
    });
    wallBody.addShape(wallShape);
    world.addBody(wallBody);
    wallBodies.push(wallBody);
  });
}

function updateCannonWalls() {
  walls.forEach((wall, wallIndex) => {
    const wallBody = wallBodies[wallIndex];
    wallBody.position.copy(wall.position);
  });
}

function updatePhysics() {
  world.step(timeStep);
  mesh.position.copy(body.position);
  mesh.quaternion.copy(body.quaternion);
  world.gravity.set(10000 * mx, 10000 * my, 0);
}

function initWall(width, height, position) {
  var geometry = new THREE.BoxBufferGeometry(width, height, WALL_WIDTH);
  var material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  var wall = new THREE.Mesh(geometry, material);
  wall.position.copy(position);
  return wall;
}

function initWalls() {
  walls.forEach(wall => {
    scene.remove(wall);
    wall.geometry.dispose();
    wall.material.dispose();
  });
  walls = [];

  // bottom

  const bottom = initWall(
    window.innerWidth,
    cubeSize * 2,
    new THREE.Vector3(window.innerWidth / 2, window.innerHeight - WALL_WIDTH / 2, cubeSize)
  );
  bottom.rotateX(Math.PI / 2);
  walls.push(bottom);

  // left

  const left = initWall(
    window.innerHeight,
    cubeSize * 2,
    new THREE.Vector3(WALL_WIDTH / 2, window.innerHeight / 2, cubeSize)
  );
  left.rotateZ(Math.PI / 2).rotateX(Math.PI / 2);
  walls.push(left);

  // right

  const right = initWall(
    window.innerHeight,
    cubeSize * 2,
    new THREE.Vector3(window.innerWidth - WALL_WIDTH / 2, window.innerHeight / 2, cubeSize)
  );
  right.rotateZ(-Math.PI / 2).rotateX(Math.PI / 2);
  walls.push(right);

  // top

  const top = initWall(
    window.innerWidth,
    cubeSize * 2,
    new THREE.Vector3(window.innerWidth / 2, WALL_WIDTH / 2, cubeSize)
  );
  top.rotateX(-Math.PI / 2);
  walls.push(top);

  // walls.forEach(p => scene.add(p))
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  if (DEBUG) {
    const axesHelper = new THREE.AxesHelper(5000);
    scene.add(axesHelper);
  }
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.physicallyCorrectLights = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setClearColor(0xffffff);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);
  renderer.toneMappingExposure = 1.0;
}

function initControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, -500);
  controls.update();
}

function initLights() {
  light1 = new THREE.AmbientLight(state.ambientColor, state.ambientIntensity);
  light1.name = "ambient_light";

  light2 = new THREE.DirectionalLight(state.directColor, state.directIntensity);
  light2.position.set(0, 0, -100);
  light2.name = "main_light";
  scene.add(light1);
  scene.add(light2);
}

function initCamera() {
  const left = 0;
  const right = window.innerWidth; // default canvas size
  const top = 0;
  const bottom = window.innerHeight; // defautl canvas size
  const near = -10000;
  const far = 10000;
  camera = new THREE.OrthographicCamera(left, right, top, bottom, near, far);
  scene.add(camera);
}

function initObject() {
  const cubeGeo = new THREE.BoxBufferGeometry(cubeSize, cubeSize, cubeSize);
  const cubeMat = new THREE.MeshPhongMaterial({ color: "#8AC" });
  mesh = new THREE.Mesh(cubeGeo, cubeMat);
  mesh.position.set(window.innerWidth / 2, window.innerHeight / 2, cubeSize);
  scene.add(mesh);
}

function init() {
  initScene();
  initLights();
  initCamera();
  initRenderer();
  initControls();
  initObject();
  initWalls();
  initCannon();
  initCannonWalls();
  render();
  window.addEventListener("resize", onWindowResize, false);
  window.addEventListener("mousemove", onMouseMove, false);
}

function onMouseMove(e) {
  const x = (e.clientX / window.innerWidth) * 2 - 1;
  const y = (e.clientY / window.innerHeight) * 2 - 1;
  mx = x;
  my = y;
}

function render() {
  requestAnimationFrame(render);
  controls.update();
  updatePhysics();
  renderer.render(scene, camera);
}

init();
