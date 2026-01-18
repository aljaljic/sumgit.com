import * as THREE from 'three';

export interface BookScene {
	scene: THREE.Scene;
	camera: THREE.PerspectiveCamera;
	renderer: THREE.WebGLRenderer;
	dispose: () => void;
}

export function createBookScene(container: HTMLElement): BookScene {
	// Scene setup with dark background
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x0a0a0a);

	// Camera setup - positioned closer to fill the viewport
	const aspect = container.clientWidth / container.clientHeight;
	const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
	camera.position.set(0, 0.3, 2.5);
	camera.lookAt(0, 0, 0);

	// Renderer with shadows
	const renderer = new THREE.WebGLRenderer({
		antialias: true,
		alpha: true
	});
	renderer.setSize(container.clientWidth, container.clientHeight);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	container.appendChild(renderer.domElement);

	// Lighting
	const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
	scene.add(ambientLight);

	const mainLight = new THREE.DirectionalLight(0xffffff, 1);
	mainLight.position.set(5, 10, 7);
	mainLight.castShadow = true;
	mainLight.shadow.mapSize.width = 2048;
	mainLight.shadow.mapSize.height = 2048;
	mainLight.shadow.camera.near = 0.5;
	mainLight.shadow.camera.far = 50;
	mainLight.shadow.camera.left = -10;
	mainLight.shadow.camera.right = 10;
	mainLight.shadow.camera.top = 10;
	mainLight.shadow.camera.bottom = -10;
	scene.add(mainLight);

	// Softer fill light
	const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
	fillLight.position.set(-5, 5, -5);
	scene.add(fillLight);

	// Handle resize
	const handleResize = () => {
		const width = container.clientWidth;
		const height = container.clientHeight;
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		renderer.setSize(width, height);
	};
	window.addEventListener('resize', handleResize);

	// Cleanup function
	const dispose = () => {
		window.removeEventListener('resize', handleResize);
		renderer.dispose();
		scene.clear();
		if (container.contains(renderer.domElement)) {
			container.removeChild(renderer.domElement);
		}
	};

	return { scene, camera, renderer, dispose };
}
