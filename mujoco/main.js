
import * as THREE           from 'three';
import { OrbitControls    } from '../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { downloadExampleScenesFolder, loadSceneFromURL, getPosition, getQuaternion, toMujocoPos, standardNormal } from './mujocoUtils.js';
import   load_mujoco        from './mujoco-lib/mujoco_wasm.js';
import { EffectComposer } from '../node_modules/three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../node_modules/three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from '../node_modules/three/examples/jsm/postprocessing/ShaderPass.js';

// Load the MuJoCo Module
const mujoco = await load_mujoco();

// Set up Emscripten's Virtual File System
var initialScene = "humanoid-aa.xml";
mujoco.FS.mkdir('/working');
mujoco.FS.mount(mujoco.MEMFS, { root: '.' }, '/working');
mujoco.FS.writeFile("/working/" + initialScene, await(await fetch("./mujoco/scenes/" + initialScene)).text());

export const CRTShader = {
	uniforms: {
		tDiffuse: { value: null }, // Rendered scene
		uTime: { value: 0.0 },     // Time for animation
		uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
		uBrightness: { value: 3 }, // Brightness control
	},
	vertexShader: `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}
	`,
	fragmentShader: `
		uniform sampler2D tDiffuse;
		uniform float uTime;
		uniform vec2 uResolution;
		uniform float uBrightness;

		varying vec2 vUv;

		void main() {
			vec2 uv = vUv;

			uv = uv * 2.0 - 1.0;
			uv = uv * 0.5 + 0.5;
			
			// Fetch texture color
			vec4 color = texture2D(tDiffuse, uv);

			// Moving scanlines
			float scanlineSpeed = 0.5; // Speed of scanlines
			float scanline = sin((uv.y * uResolution.y * 0.5) + uTime * scanlineSpeed) * 0.05;
			color.rgb -= scanline * 0.2;

			// Apply brightness adjustment
			color.rgb *= uBrightness;

			// Ensure colors remain in the valid range
			color.rgb = clamp(color.rgb, 0.0, 1.0);

			gl_FragColor = color;
		}
	`,
};
const crtPass = new ShaderPass(CRTShader);

export class MuJoCoDemo {
	constructor() {
		this.mujoco = mujoco;

		// Load in the state from XML
		this.model      = new mujoco.Model("/working/" + initialScene);
		this.state      = new mujoco.State(this.model);
		window.simulation = new mujoco.Simulation(this.model, this.state);

		// Define Random State Variables
		this.params = { scene: initialScene, paused: false, help: false, ctrlnoiserate: 0.0, ctrlnoisestd: 0.0, keyframeNumber: 0 };
		this.mujoco_time = 0.0;
		this.bodies  = {}, this.lights = {};
		this.tmpVec  = new THREE.Vector3();
		this.tmpQuat = new THREE.Quaternion();

		this.startTime = 0; // Tracks the elapsed time since the last frame
		this.step = 0; // Index of the current timestep in the array
		this.timeStepIndex = 0; // Index of the current timestep in the array
		this.actionStepIndex = 0; // Index of the current timestep in the array
		
		this.scene = new THREE.Scene();
		this.scene.name = 'scene';

		// Get the dimensions of the target container
		this.container = document.querySelector('#mujocoappbody');

		// Update camera aspect ratio to match container dimensions
		this.camera = new THREE.PerspectiveCamera(45, this.container.clientWidth / this.container.clientHeight, 0.001, 100);
		this.camera.name = 'PerspectiveCamera';
		this.camera.position.set(0, 2.5, 3);
		this.scene.add(this.camera);

		this.scene.background = new THREE.Color(0, 0, 0);
		this.scene.fog = new THREE.Fog(this.scene.background, 10, 25.5);

		this.ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
		this.ambientLight.name = 'AmbientLight';
		this.scene.add(this.ambientLight);

		this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: this.container });
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);

		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
		this.renderer.setAnimationLoop( this.render.bind(this) );


				// Post-processing setup
				this.composer = new EffectComposer(this.renderer);
				this.composer.addPass(new RenderPass(this.scene, this.camera));

				// Add CRT Shader Pass
				this.composer.addPass(crtPass);



		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.target.set(0, 0.7, 0);
		this.controls.panSpeed = 2;
		this.controls.zoomSpeed = 1;
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.10;
		this.controls.screenSpacePanning = true;
				// Prevent camera from going below y = 0

		this.controls.update();

		window.addEventListener('resize', this.onWindowResize.bind(this));
	}

	clampCameraPosition() {
		this.camera.position.y = Math.max(this.camera.position.y, 0.1);
	}



		async init() {
			// Download the the examples to MuJoCo's virtual file system
			await downloadExampleScenesFolder(mujoco);

			[this.model, this.state, window.simulation, this.bodies, this.lights] =  await loadSceneFromURL(mujoco, initialScene, this);
			window.bodies = this.bodies

			window.lol = this


		}

		onWindowResize() {
			this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
			this.camera.updateProjectionMatrix();
			this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
		}

		
		updateModelWithObservation(observation) {
			for (let i = 0; i < window.simulation.qfrc_applied.length; i++) { this.simulation.qfrc_applied[i] = 0.0; }

			// Destructure observation components
			const [qpos, qvel] = [ //cinert, cvel, 
				observation.slice(0, 22),
				observation.slice(22, 45)
			];
		
			// Update qpos (positions)
			for (let i = 0; i < qpos.length; i++) {
				window.simulation.qpos[i + 2] = qpos[i];
			}
		
			// Update qvel (velocities)
			for (let i = 0; i < qvel.length; i++) {
				window.simulation.qvel[i] = qvel[i];
			}
			
			// Update positions and orientations
			for (let b = 0; b < this.model.nbody; b++) {
				if (this.bodies[b]) {
					getPosition(this.simulation.xpos, b, this.bodies[b].position);
					getQuaternion(this.simulation.xquat, b, this.bodies[b].quaternion);
					this.bodies[b].updateWorldMatrix();
				}
			}
				
			// Update light transforms.
			for (let l = 0; l < this.model.nlight; l++) {
				if (this.lights[l]) {
					getPosition(this.simulation.light_xpos, l, this.lights[l].position);
					getPosition(this.simulation.light_xdir, l, this.tmpVec);
					this.lights[l].lookAt(this.tmpVec.add(this.lights[l].position));
				}
			}
		
			// Additional updates for lights, tendons, or other elements
			this.updateTendonTransforms();
		}
		
		// Helper function to apply external forces to a body
		applyExternalForceToBody(bodyIndex, force, torque) {
			if (window.simulation.qfrc_applied[bodyIndex]) {
				window.simulation.qfrc_applied[bodyIndex].add(force);
				// Apply torque here if necessary
			}
		}
	
	//window.simulation.step();
	updateModel(){

        // Clear old perturbations, apply new ones.
        for (let i = 0; i < window.simulation.qfrc_applied.length; i++) { this.simulation.qfrc_applied[i] = 0.0; }

		// Update body transforms.
		for (let b = 0; b < this.model.nbody; b++) {
			if (this.bodies[b]) {
				getPosition  (this.simulation.xpos , b, this.bodies[b].position);
				getQuaternion(this.simulation.xquat, b, this.bodies[b].quaternion);
				this.bodies[b].updateWorldMatrix();
			}
		}
  
  
	  this.updateTendonTransforms()
	}

	updateTendonTransforms(){

	  // Update tendon transforms.
	  let numWraps = 0;
	  if (this.mujocoRoot && this.mujocoRoot.cylinders) {
		let mat = new THREE.Matrix4();
		for (let t = 0; t < this.model.ntendon; t++) {
		  let startW = this.simulation.ten_wrapadr[t];
		  let r = this.model.tendon_width[t];
		  for (let w = startW; w < startW + this.simulation.ten_wrapnum[t] -1 ; w++) {
			let tendonStart = getPosition(this.simulation.wrap_xpos, w    , new THREE.Vector3());
			let tendonEnd   = getPosition(this.simulation.wrap_xpos, w + 1, new THREE.Vector3());
			let tendonAvg   = new THREE.Vector3().addVectors(tendonStart, tendonEnd).multiplyScalar(0.5);
  
			let validStart = tendonStart.length() > 0.01;
			let validEnd   = tendonEnd  .length() > 0.01;
  
			if (validStart) { this.mujocoRoot.spheres.setMatrixAt(numWraps    , mat.compose(tendonStart, new THREE.Quaternion(), new THREE.Vector3(r, r, r))); }
			if (validEnd  ) { this.mujocoRoot.spheres.setMatrixAt(numWraps + 1, mat.compose(tendonEnd  , new THREE.Quaternion(), new THREE.Vector3(r, r, r))); }
			if (validStart && validEnd) {
			  mat.compose(tendonAvg, new THREE.Quaternion().setFromUnitVectors(
				new THREE.Vector3(0, 1, 0), tendonEnd.clone().sub(tendonStart).normalize()),
				new THREE.Vector3(r, tendonStart.distanceTo(tendonEnd), r));
			  this.mujocoRoot.cylinders.setMatrixAt(numWraps, mat);
			  numWraps++;
			}
		  }
		}
		this.mujocoRoot.cylinders.count = numWraps;
		this.mujocoRoot.spheres  .count = numWraps > 0 ? numWraps + 1: 0;
		this.mujocoRoot.cylinders.instanceMatrix.needsUpdate = true;
		this.mujocoRoot.spheres  .instanceMatrix.needsUpdate = true;
	  }
	}
	render(timeMS) {
		

		//if(ailive.trainings.engine) ailive.trainings.engine.updateModel()
			
		this.controls.update();
		// Render!
		//this.renderer.render( this.scene, this.camera );
		crtPass.uniforms.uTime.value += timeMS / 1000

		this.clampCameraPosition();
		this.composer.render()
	}
}

window.MuJoCoDemo = MuJoCoDemo

window.totalsteps = 0
window.sssssss = []



window.ailive.init();