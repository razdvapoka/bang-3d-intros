import "defaults.css";
import * as THREE from "three";
import * as CANNON from "cannon";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import modelUrl from "./models/objects-clear.glb";

var DEBUG = false;

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
var boundingPlanes = [];

var cubes;
var bodies;

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

function initCannon() {
  world = new CANNON.World();
  world.gravity.set(0, 0, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 10;

  bodies = cubes.map(cube => {
    const s2 = new THREE.Vector3();
    const b = new THREE.BoxHelper(cube, 0xff0000);
    b.geometry.computeBoundingBox();
    b.geometry.boundingBox.getSize(s2);
    if (DEBUG) {
      scene.add(b);
    }
    const size = s2.divideScalar(2);
    const shape = new CANNON.Box(new CANNON.Vec3(size.x, size.y, size.z));
    const body = new CANNON.Body({
      mass: 100,
      position: cube.position,
      quaternion: cube.quaternion
    });
    body.addShape(shape);
    body.angularVelocity.set(0, Math.random() > 0.5 ? 10 : -10, 0);
    body.angularDamping = 0.5;
    return body;
  });

  bodies.forEach(body => {
    world.addBody(body);
  });

  boundingPlanes.forEach(plane => {
    const planeShape = new CANNON.Plane();
    const planeBody = new CANNON.Body({
      mass: 0,
      position: plane.position,
      quaternion: plane.quaternion
    });
    planeBody.addShape(planeShape);
    world.addBody(planeBody);
  });
}

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
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function createPlaneMesh(position, width, height, color = 0x777777) {
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshLambertMaterial({ color });
  material.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  return mesh;
}

function initPlanes() {
  const box = boundingBox.geometry.boundingBox;

  // bottom
  const bottom = createPlaneMesh(
    new THREE.Vector3(0, box.min.y - (Math.abs(box.min.y) + Math.abs(box.max.y)) * 0.05, 0),
    Math.abs(box.min.x) + Math.abs(box.max.x),
    Math.abs(box.min.z) + Math.abs(box.max.z)
  );
  bottom.rotateX(-Math.PI / 2);
  boundingPlanes.push(bottom);

  // left
  const left = createPlaneMesh(
    new THREE.Vector3(box.min.x - (Math.abs(box.min.x) + Math.abs(box.max.x)) * 0.05, 0, 0),
    Math.abs(box.min.y) + Math.abs(box.max.y),
    Math.abs(box.min.z) + Math.abs(box.max.z)
  );
  left.rotateY(Math.PI / 2).rotateZ(Math.PI / 2);
  boundingPlanes.push(left);

  // right
  const right = createPlaneMesh(
    new THREE.Vector3(box.max.x + (Math.abs(box.min.x) + Math.abs(box.max.x)) * 0.05, 0, 0),
    Math.abs(box.min.y) + Math.abs(box.max.y),
    Math.abs(box.min.z) + Math.abs(box.max.z)
  );
  right.rotateY(-Math.PI / 2).rotateZ(-Math.PI / 2);
  boundingPlanes.push(right);

  // top
  const top = createPlaneMesh(
    new THREE.Vector3(0, box.max.y + (Math.abs(box.min.y) + Math.abs(box.max.y)) * 0.05, 0),
    Math.abs(box.min.x) + Math.abs(box.max.x),
    Math.abs(box.min.z) + Math.abs(box.max.z)
  );
  top.rotateX(Math.PI / 2);
  boundingPlanes.push(top);

  // front
  const front = createPlaneMesh(
    new THREE.Vector3(0, 0, box.max.z + (Math.abs(box.min.z) + Math.abs(box.max.z)) * 0.5, 0),
    Math.abs(box.min.x) + Math.abs(box.max.x),
    Math.abs(box.min.y) + Math.abs(box.max.y),
    0xffffff
  );
  front.rotateX(-Math.PI);
  boundingPlanes.push(front);

  // back
  const back = createPlaneMesh(
    new THREE.Vector3(0, 0, box.min.z - (Math.abs(box.min.z) + Math.abs(box.max.z)) * 0.5, 0),
    Math.abs(box.min.x) + Math.abs(box.max.x),
    Math.abs(box.min.y) + Math.abs(box.max.y),
    0xffffff
  );

  boundingPlanes.push(back);

  boundingPlanes.forEach(p => {
    p.scale.set(1.1, 1.1, 1.1);
  });

  if (DEBUG) {
    boundingPlanes.slice(0, 4).forEach(p => {
      scene.add(p);
    });
  }
}

function initScene() {
  scene = new THREE.Scene();
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
  controls.autoRotate = false;
  controls.autoRotateSpeed = -10;
  controls.screenSpacePanning = true;
}

function loadModel() {
  var loader = new GLTFLoader();
  loader.load(modelUrl, function(gltf) {
    const object = gltf.scene;
    content = object;
    object.children = object.children.filter(child => !child.name.startsWith("Cylinder"));
    cubes = object.children;
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());

    object.position.x += object.position.x - center.x;
    object.position.y += object.position.y - center.y;
    object.position.z += object.position.z - center.z;
    controls.maxDistance = size * 10;
    camera.near = size / 100;
    camera.far = size * 100;
    camera.updateProjectionMatrix();

    camera.position.copy(center);
    camera.position.y = 0;
    camera.position.z += size / 1.5;

    content.traverse(node => {
      if (node.isLight) {
        state.addLights = false;
      } else if (node.isMesh) {
        // TODO(https://github.com/mrdoob/three.js/pull/18235): Clean up.
        node.material.depthWrite = !node.material.transparent;
      }
    });

    updateTextureEncoding();
    scene.add(gltf.scene);

    boundingBox = new THREE.BoxHelper(gltf.scene, 0xff0000);
    if (DEBUG) {
      scene.add(boundingBox);
    }
    boundingBox.geometry.computeBoundingBox();

    initPlanes();
    initCannon();

    render();
  });
}

function initLights() {
  light1 = new THREE.AmbientLight(state.ambientColor, state.ambientIntensity);
  light1.name = "ambient_light";

  light2 = new THREE.DirectionalLight(state.directColor, state.directIntensity);
  light2.position.set(0.5, 0, 0.866); // ~60º
  light2.name = "main_light";
  return [light1, light2];
}

function initCamera() {
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
  camera.add(light1);
  camera.add(light2);
  scene.add(camera);
}

function init() {
  initScene();
  initLights();
  initCamera();
  initRenderer();
  loadModel();
  initControls();
  window.addEventListener("resize", onWindowResize, false);
  window.addEventListener("mousemove", onMouseMove, false);
}

function onMouseMove(e) {
  const x = (e.clientX / window.innerWidth) * 2 - 1;
  const y = (e.clientY / window.innerHeight) * 2 - 1;
  mx = x;
  my = -y;
}

function updatePhysics() {
  world.step(timeStep);
  bodies.forEach((body, index) => {
    cubes[index].position.copy(body.position);
    cubes[index].quaternion.copy(body.quaternion);
  });
  world.gravity.set(10000 * mx, 10000 * my, 0);
}

function render() {
  requestAnimationFrame(render);
  controls.update();
  updatePhysics();
  renderer.render(scene, camera);
}

init();
