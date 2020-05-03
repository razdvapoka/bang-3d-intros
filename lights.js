import "defaults.css";
import * as THREE from "three";
import * as dat from "dat.gui";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import modelUrl from "./models/glow.glb";

const vertexShader = `
  varying vec2 vUv;

  void main() {

    vUv = uv;

    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

  }
`;

const fragmentShader = `
  uniform sampler2D baseTexture;
  uniform sampler2D bloomTexture;

  varying vec2 vUv;

  vec4 getTexture( sampler2D texelToLinearTexture ) {

    return mapTexelToLinear( texture2D( texelToLinearTexture , vUv ) );

  }

  void main() {

    gl_FragColor = ( getTexture( baseTexture ) + vec4( 1.0 ) * getTexture( bloomTexture ) );

  }
`;

const ENTIRE_SCENE = 0;
const BLOOM_SCENE = 1;
let objects;
let vines = [];
let columns = [];
let scene;
let camera;
let controls;
let renderer;
let renderScene;
let bloomPass;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let bloomComposer;
let finalComposer;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_SCENE);
const darkMaterial = new THREE.MeshBasicMaterial({ color: "black" });
const materials = {};

var params = {
  exposure: 1,
  bloomStrength: 5,
  bloomThreshold: 0,
  bloomRadius: 0,
  scene: "Scene with Glow",
  columnColor: 0x000000,
  vineColor: 0x000000
};

function initRenderScene() {
  renderScene = new RenderPass(scene, camera);
}

function initBloomComposer() {
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5,
    0.4,
    0.85
  );
  bloomPass.threshold = params.bloomThreshold;
  bloomPass.strength = params.bloomStrength;
  bloomPass.radius = params.bloomRadius;

  bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(renderScene);
  bloomComposer.addPass(bloomPass);
}

function initFinalComposer() {
  var finalPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: bloomComposer.renderTarget2.texture }
      },
      vertexShader,
      fragmentShader,
      defines: {}
    }),
    "baseTexture"
  );
  finalPass.needsSwap = true;
  finalComposer = new EffectComposer(renderer);
  finalComposer.addPass(renderScene);
  finalComposer.addPass(finalPass);
}

function onDocumentMouseClick(event) {
  event.preventDefault();

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  var intersects = raycaster.intersectObjects(scene.children);
  if (intersects.length > 0) {
    var object = intersects[0].object;
    object.layers.toggle(BLOOM_SCENE);
    // render();
  }
}

function onResize() {
  var width = window.innerWidth;
  var height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);

  bloomComposer.setSize(width, height);
  finalComposer.setSize(width, height);

  // render();
}

function loadModel() {
  return new Promise(resolve => {
    var loader = new GLTFLoader();
    loader.load(modelUrl, function(gltf) {
      objects = gltf.scene.children.filter(c => c.type === "Object3D");
      resolve(gltf);
    });
  });
}

function setupScene() {
  scene.traverse(disposeMaterial);
  scene.children.length = 0;

  objects.forEach((object, objectIndex) => {
    const vine = object.children.find(o => o.name === "neon");
    const column = object.children.find(o => o.name === "dark");
    vine.position.x = -10 + objectIndex * 10;
    column.position.x = -10 + objectIndex * 10;
    const color = new THREE.Color();
    color.setHSL(Math.random(), 0.7, Math.random() * 0.2 + 0.05);
    column.material = new THREE.MeshBasicMaterial({ color });
    vine.scale.setScalar(0.3);
    column.scale.setScalar(0.3);
    vines.push(vine);
    columns.push(column);
    vine.layers.enable(BLOOM_SCENE);
    scene.add(column);
    scene.add(vine);
  });
}

function disposeMaterial(obj) {
  if (obj.material) {
    obj.material.dispose();
  }
}

function render() {
  switch (params.scene) {
    case "Scene only":
      renderer.render(scene, camera);
      break;
    case "Glow only":
      renderBloom(false);
      break;
    case "Scene with Glow":
    default:
      // render scene with bloom
      renderBloom(true);

      // render the entire scene, then render bloom scene on top
      finalComposer.render();
      break;
  }
  window.requestAnimationFrame(() => {
    render();
    vines.forEach((vine, vineIndex) => {
      vine.rotation.y += 0.01;
      columns[vineIndex].rotation.y += 0.01;
    });
  });
}

function renderBloom(mask) {
  if (mask === true) {
    scene.traverse(darkenNonBloomed);
    bloomComposer.render();
    scene.traverse(restoreMaterial);
  } else {
    camera.layers.set(BLOOM_SCENE);
    bloomComposer.render();
    camera.layers.set(ENTIRE_SCENE);
  }
}

function darkenNonBloomed(obj) {
  if (obj.isMesh && bloomLayer.test(obj.layers) === false) {
    materials[obj.uuid] = obj.material;
    obj.material = darkMaterial;
  }
}

function restoreMaterial(obj) {
  if (materials[obj.uuid]) {
    obj.material = materials[obj.uuid];
    delete materials[obj.uuid];
  }
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ReinhardToneMapping;
  document.body.appendChild(renderer.domElement);
}

function initScene() {
  scene = new THREE.Scene();
  // scene.add(new THREE.AmbientLight(0x404040, 1000));
  // const directionalLight = new THREE.DirectionalLight(0xffffff, 30);
  // directionalLight.position.set(20, 10, 20);
  // scene.add(directionalLight);
}

function initGUI() {
  var gui = new dat.GUI();

  gui
    .add(params, "scene", ["Scene with Glow", "Glow only", "Scene only"])
    .onChange(function(value) {
      switch (value) {
        case "Scene with Glow":
          bloomComposer.renderToScreen = false;
          break;
        case "Glow only":
          bloomComposer.renderToScreen = true;
          break;
        case "Scene only":
          // nothing to do
          break;
      }

      // render();
    });

  var objFolder = gui.addFolder("Objects Parameters");
  objFolder.addColor(params, "columnColor").onChange(function() {
    columns.forEach(column => {
      column.material.color.set(params.columnColor);
    });
    // render();
  });
  objFolder.addColor(params, "vineColor").onChange(function() {
    vines.forEach(vine => {
      vine.material.emissive.set(params.vineColor);
    });
    // render();
  });

  var folder = gui.addFolder("Bloom Parameters");

  folder.add(params, "exposure", 0.1, 2).onChange(function(value) {
    renderer.toneMappingExposure = Math.pow(value, 4.0);
    // render();
  });

  folder.add(params, "bloomThreshold", 0.0, 1.0).onChange(function(value) {
    bloomPass.threshold = Number(value);
    // render();
  });

  folder.add(params, "bloomStrength", 0.0, 10.0).onChange(function(value) {
    bloomPass.strength = Number(value);
    // render();
  });

  folder
    .add(params, "bloomRadius", 0.0, 1.0)
    .step(0.01)
    .onChange(function(value) {
      bloomPass.radius = Number(value);
      // render();
    });
}

function initCamera() {
  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 200);
  camera.position.set(0, 0, 20);
  camera.lookAt(0, 0, 0);
}

function initControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.maxPolarAngle = Math.PI * 0.5;
  controls.minDistance = 1;
  controls.maxDistance = 100;
  // controls.addEventListener("change", render);
}

function initEventHandlers() {
  window.addEventListener("click", onDocumentMouseClick, false);
  window.addEventListener("resize", onResize);
}

function main() {
  initRenderer();
  initScene();
  initCamera();
  initControls();
  loadModel().then(() => {
    setupScene();
    initRenderScene();
    initBloomComposer();
    initFinalComposer();
    initGUI();
    initEventHandlers();
    render();
  });
}

main();
