import "defaults.css";
import * as THREE from "three";
import * as CANNON from "cannon";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import modelUrl from "./models/b.glb";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

let camera;
let renderer;
let scene;
let controls;
let world;
let objects = [];
let walls = [];
let bodies = [];
let wallBodies = [];
let mx = 0;
let my = 0;

const DEBUG = false;
const FACTOR = 70;
const CUBE_SIZE = 10;
const ROOM_DEPTH = 20;
const WALL_WIDTH = 0.01;
const SCALE_COEFF = 0.002;
const TIME_STEP = 1 / 60;
const GRAVITY_COEFF = 100;
const VELOCITY_COEFF = 20;

function initCamera() {
  camera = new THREE.OrthographicCamera(
    window.innerWidth / -FACTOR,
    window.innerWidth / FACTOR,
    window.innerHeight / FACTOR,
    window.innerHeight / -FACTOR,
    -1000,
    1000
  );
  camera.updateProjectionMatrix();
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    logarithmicDepthBuffer: false
  });
  renderer.setClearColor(0xffffff);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
}

function initControls() {
  if (DEBUG) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, -10);
    controls.update();
  }
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(DEBUG ? 0xffffff : 0x000000);
  var ambient = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambient);
  var directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
  directionalLight.position.set(-1000, -1000, 250);
  directionalLight.castShadow = true;
  scene.add(directionalLight);
  if (DEBUG) {
    const axesHelper = new THREE.AxesHelper(5000);
    scene.add(axesHelper);
  }
}

function initObjects() {
  for (let i = 0; i < 5; i++) {
    const cubeGeo =
      i % 2 === 0
        ? new THREE.BoxBufferGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE)
        : new THREE.SphereBufferGeometry(CUBE_SIZE / 2, CUBE_SIZE / 2, CUBE_SIZE / 2);
    const cubeMat = new THREE.MeshPhongMaterial({ color: "#8AC" });
    const mesh = new THREE.Mesh(cubeGeo, cubeMat);
    mesh.position.set(0, 0, (i + 1) * (CUBE_SIZE + 5));
    scene.add(mesh);
    objects.push(mesh);
  }
}

function updateCannonWalls() {
  walls.forEach((wall, wallIndex) => {
    const wallBody = wallBodies[wallIndex];
    wallBody.position.copy(wall.position);
  });
}

function onWindowResize() {
  camera.left = window.innerWidth / -FACTOR;
  camera.right = window.innerWidth / FACTOR;
  camera.top = window.innerHeight / FACTOR;
  camera.bottom = window.innerHeight / -FACTOR;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  initWalls();
  updateCannonWalls();
}

function onMouseMove(e) {
  const x = (e.clientX / window.innerWidth) * 2 - 1;
  const y = (e.clientY / window.innerHeight) * 2 - 1;
  mx = x;
  my = -y;
}

function initEventListeners() {
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("click", onClick);
}

function initWall(width, height, position) {
  var geometry = new THREE.BoxBufferGeometry(width, height, WALL_WIDTH);
  const material = new THREE.MeshPhongMaterial({
    color: 0x00ffff,
    opacity: 0.5,
    transparent: true,
    side: THREE.DoubleSide
  });
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
    (window.innerWidth / FACTOR) * 2,
    ROOM_DEPTH,
    new THREE.Vector3(0, -(window.innerHeight / FACTOR) + WALL_WIDTH / 2, 0)
  );
  bottom.rotateX(-Math.PI / 2);
  walls.push(bottom);

  // left

  const left = initWall(
    (window.innerHeight / FACTOR) * 2,
    ROOM_DEPTH,
    new THREE.Vector3(window.innerWidth / -FACTOR + WALL_WIDTH / 2, 0, 0)
  );
  left.rotateZ(Math.PI / 2).rotateX(Math.PI / 2);
  walls.push(left);

  // right

  const right = initWall(
    (window.innerHeight / FACTOR) * 2,
    ROOM_DEPTH,
    new THREE.Vector3(window.innerWidth / FACTOR - WALL_WIDTH / 2, 0, 0)
  );
  right.rotateZ(-Math.PI / 2).rotateX(Math.PI / 2);
  walls.push(right);

  // top

  const top = initWall(
    (window.innerWidth / FACTOR) * 2,
    ROOM_DEPTH,
    new THREE.Vector3(0, window.innerHeight / FACTOR - WALL_WIDTH / 2, 0)
  );
  top.rotateX(Math.PI / 2);
  walls.push(top);

  // back

  const back = initWall(
    (window.innerWidth / FACTOR) * 2,
    (window.innerHeight / FACTOR) * 2,
    new THREE.Vector3(0, 0, -ROOM_DEPTH / 2)
  );
  walls.push(back);

  const front = initWall(
    (window.innerWidth / FACTOR) * 2,
    (window.innerHeight / FACTOR) * 2,
    new THREE.Vector3(0, 0, ROOM_DEPTH / 2)
  );
  front.rotateX(Math.PI);
  walls.push(front);

  if (DEBUG) {
    walls.forEach(wall => scene.add(wall));
  }
}

function loadModel() {
  return new Promise(resolve => {
    var loader = new GLTFLoader();
    loader.load(modelUrl, function(gltf) {
      for (let i = 0; i < 15; i++) {
        const letter = gltf.scene.children[1].clone();
        const letterBox = new THREE.Box3().setFromObject(letter);
        const letterSize = letterBox.getSize();
        letter.scale.set(SCALE_COEFF, SCALE_COEFF, SCALE_COEFF);
        letter.position.set(0, 0, 0);
        const letterMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
        letter.material = letterMaterial;
        scene.add(letter);
        objects.push(letter);
        //const letterBoxHelper = new THREE.BoxHelper(letter, 0xff0000);
        // scene.add(letterBoxHelper);
      }
      resolve(gltf);
    });
  });
}

function initCannon() {
  world = new CANNON.World();
  world.gravity.set(0, 0, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 10;

  objects.forEach(object => {
    const meshBoxSize = new THREE.Box3().setFromObject(object).getSize();
    const shape = new CANNON.Box(
      new CANNON.Vec3(meshBoxSize.x / 2, meshBoxSize.y / 2, meshBoxSize.z / 2)
    );
    const body = new CANNON.Body({
      mass: 100,
      position: object.position,
      quaternion: object.quaternion
    });
    body.addShape(shape);
    world.addBody(body);
    bodies.push(body);
  });
}

function onClick() {
  bodies.forEach(body => {
    body.angularVelocity.set(
      Math.random() * VELOCITY_COEFF,
      Math.random() * VELOCITY_COEFF,
      Math.random() * VELOCITY_COEFF
    );
    body.angularDamping = 0.5;
  });
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

function updatePhysics() {
  world.step(TIME_STEP);
  bodies.forEach((body, bodyIndex) => {
    const object = objects[bodyIndex];
    object.position.copy(body.position);
    object.quaternion.copy(body.quaternion);
  });
  world.gravity.set(GRAVITY_COEFF * mx, GRAVITY_COEFF * my, 0);
}

function render() {
  requestAnimationFrame(render);
  if (controls) {
    controls.update();
  }
  updatePhysics();
  renderer.render(scene, camera);
}

function main() {
  initCamera();
  initRenderer();
  initScene();
  initWalls();
  initEventListeners();
  initControls();
  loadModel().then(() => {
    initCannon();
    initCannonWalls();
    render();
  });
}

main();
