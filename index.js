import "defaults.css";
import * as THREE from "three";
import * as CANNON from "cannon";
import * as dat from "dat.gui";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import modelUrl from "./models/letters.glb";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

let camera;
let renderer;
let scene;
let ambientLight;
let directionalLight;
let directionalLightHelper;
let controls;
let world;
let objects = [];
let walls = [];
let bodies = [];
let wallBodies = [];
let logo;
let logoBody;
let mx = 0;
let my = 0;
let gravityTimeout;
let axesHelper;
let state = {
  followMouse: true,
  updatePhysics: true,
  debug: false,
  controlsEnabled: false,
  lightHelper: false
};

const FACTOR = 70;
const CUBE_SIZE = 10;
const ROOM_DEPTH = 20;
const WALL_WIDTH = 0.01;
const SCALE_COEFF = 0.002;
const TIME_STEP = 1 / 60;
const GRAVITY_COEFF = 100;
const ANGULAR_VELOCITY_COEFF = 30;
const VELOCITY_COEFF = 60;
const GRAVITY_RESET_TIMEOUT = 5000;
const GUI = true;

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
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, -10);
  controls.enabled = state.controlsEnabled;
  controls.update();
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(state.debug ? 0xffffff : 0x000000);
  ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);
  directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
  directionalLight.position.set(20, 10, 20);
  directionalLight.castShadow = true;
  directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight, 20);
  if (state.directionalLightHelper) {
    scene.add(directionalLightHelper);
  }
  scene.add(directionalLight);
  axesHelper = new THREE.AxesHelper(5000);
  if (state.debug) {
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
  logo.position.set(window.innerWidth / -FACTOR + 1.5, window.innerHeight / FACTOR - 1.5, 0);
  logoBody.position.copy(logo.position);
}

function onMouseMove(e) {
  if (state.followMouse) {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = (e.clientY / window.innerHeight) * 2 - 1;
    mx = x;
    my = -y;
    if (gravityTimeout) {
      window.clearTimeout(gravityTimeout);
    }
    gravityTimeout = window.setTimeout(() => {
      mx = 0;
      my = 0;
      bodies.forEach(body => {
        body.velocity.set(
          Math.random() * Math.sign(-mx) * VELOCITY_COEFF,
          Math.random() * Math.sign(-my) * VELOCITY_COEFF,
          Math.random() * VELOCITY_COEFF
        );
      });
    }, GRAVITY_RESET_TIMEOUT);
  }
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
    opacity: 0.2,
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

  if (state.debug) {
    walls.forEach(wall => scene.add(wall));
  }
}

function loadModel() {
  return new Promise(resolve => {
    var loader = new GLTFLoader();
    loader.load(modelUrl, function(gltf) {
      const meshes = gltf.scene.children.filter(child => child.type === "Mesh");
      meshes.forEach(mesh => {
        const letter = mesh;
        const letterBox = new THREE.Box3().setFromObject(letter);
        const letterSize = letterBox.getSize(new THREE.Vector3());
        letter.scale.set(SCALE_COEFF, SCALE_COEFF, SCALE_COEFF);
        const letterMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
        letter.material = letterMaterial;
        scene.add(letter);
        if (letter.name === "Logo") {
          letter.position.set(
            window.innerWidth / -FACTOR + 1.5,
            window.innerHeight / FACTOR - 1.5,
            0
          );
          logo = letter;
        } else {
          letter.position.set(0, 0, 0);
          objects.push(letter);
        }
        //const letterBoxHelper = new THREE.BoxHelper(letter, 0xff0000);
        // scene.add(letterBoxHelper);
      });
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
    const meshBoxSize = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
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
      Math.random() * ANGULAR_VELOCITY_COEFF,
      Math.random() * ANGULAR_VELOCITY_COEFF,
      Math.random() * ANGULAR_VELOCITY_COEFF
    );
    body.angularDamping = 0.5;
    body.velocity.set(
      Math.random() * -mx * VELOCITY_COEFF,
      Math.random() * -my * VELOCITY_COEFF,
      Math.random() * ANGULAR_VELOCITY_COEFF
    );
  });
  mx = 0;
  my = 0;
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

function initCannonLogo() {
  const logoBoxSize = new THREE.Box3().setFromObject(logo).getSize(new THREE.Vector3());
  const logoShape = new CANNON.Box(
    new CANNON.Vec3(logoBoxSize.x / 2, logoBoxSize.y / 2, logoBoxSize.z / 2)
  );
  logoBody = new CANNON.Body({
    mass: 0,
    position: logo.position,
    quaternion: logo.quaternion
  });
  logoBody.addShape(logoShape);
  world.addBody(logoBody);
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
  if (state.updatePhysics) {
    updatePhysics();
  }
  if (state.lightHelper) {
    directionalLight.updateMatrixWorld();
    directionalLightHelper.position.setFromMatrixPosition(directionalLight.matrixWorld);
    directionalLightHelper.updateMatrix();
    directionalLightHelper.update();
  }
  renderer.render(scene, camera);
}

class ColorGUIHelper {
  constructor(object, prop) {
    this.object = object;
    this.prop = prop;
  }
  get value() {
    return `#${this.object[this.prop].getHexString()}`;
  }
  set value(hexString) {
    this.object[this.prop].set(hexString);
  }
}

function onLightHelperChange(value) {
  if (value) {
    scene.add(directionalLightHelper);
  } else {
    scene.remove(directionalLightHelper);
  }
}

function onControlsEnabledChange(value) {
  if (!value) {
    controls.reset();
  }
}

function onDebugChange(value) {
  if (value) {
    scene.add(axesHelper);
    scene.background = new THREE.Color(0xffffff);
    walls.forEach(wall => scene.add(wall));
  } else {
    scene.remove(axesHelper);
    scene.background = new THREE.Color(0x000000);
    walls.forEach(wall => scene.remove(wall));
    controls.reset();
    controls.enabled = false;
  }
}

function initGUI() {
  const gui = new dat.GUI();
  const ambientFolder = gui.addFolder("ambient light");
  ambientFolder.addColor(new ColorGUIHelper(ambientLight, "color"), "value").name("color");
  ambientFolder.add(ambientLight, "intensity", 0, 2, 0.01);
  ambientFolder.open();
  const directionalFolder = gui.addFolder("directional light");
  directionalFolder.addColor(new ColorGUIHelper(directionalLight, "color"), "value").name("color");
  directionalFolder.add(directionalLight, "intensity", 0, 2, 0.01);
  directionalFolder.add(directionalLight.position, "x", -200, 200, 1);
  directionalFolder.add(directionalLight.position, "y", -200, 200, 1);
  directionalFolder.add(directionalLight.position, "z", -200, 200, 1);
  directionalFolder.open();
  gui.add(state, "followMouse", false, true);
  gui.add(state, "updatePhysics", false, true);
  const controlsEnabledController = gui.add(controls, "enabled", false, true).name("controls");
  controlsEnabledController.onChange(onControlsEnabledChange);
  const debugController = gui.add(state, "debug", false, true);
  debugController.onChange(onDebugChange);
  const lightHelperController = gui.add(state, "lightHelper", false, true).name("light helper");
  lightHelperController.onChange(onLightHelperChange);
  gui.addColor(new ColorGUIHelper(scene, "background"), "value").name("background color");
  gui.close();
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
    initCannonLogo();
    if (GUI) {
      initGUI();
    }
    render();
  });
}

main();
