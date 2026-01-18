import * as THREE from 'three';
import gsap from 'gsap';
import type { StoryChapter } from '$lib/types/story';
import { createTextTexture, createCoverTexture } from './text-texture';

// Book dimensions
const BOOK_WIDTH = 3.5;
const BOOK_HEIGHT = 4.5;
const BOOK_DEPTH = 0.4;
const PAGE_THICKNESS = 0.015;

export interface Book {
	scene: THREE.Scene;
	camera: THREE.PerspectiveCamera;
	renderer: THREE.WebGLRenderer;
	currentPage: number;
	totalPages: number;
	isAnimating: boolean;
	openBook: () => Promise<void>;
	nextPage: () => Promise<void>;
	prevPage: () => Promise<void>;
	dispose: () => void;
}

export async function createBook(
	container: HTMLElement,
	chapters: StoryChapter[],
	repoName: string
): Promise<Book> {
	// Scene setup
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x0a0a0a);

	const width = container.clientWidth || 800;
	const height = container.clientHeight || 600;
	const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
	camera.position.set(0, 0.2, 5);
	camera.lookAt(0, 0, 0);

	const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
	renderer.setSize(width, height);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	container.appendChild(renderer.domElement);

	// Lighting
	scene.add(new THREE.AmbientLight(0xffffff, 0.4));

	const mainLight = new THREE.DirectionalLight(0xffffff, 1);
	mainLight.position.set(5, 10, 7);
	mainLight.castShadow = true;
	mainLight.shadow.mapSize.width = 2048;
	mainLight.shadow.mapSize.height = 2048;
	scene.add(mainLight);

	scene.add(new THREE.DirectionalLight(0xffffff, 0.3).translateX(-5).translateY(5).translateZ(-5));

	// Build the book geometry
	const group = new THREE.Group();
	const pages: THREE.Mesh[] = [];

	// Front cover
	const frontCoverGeometry = new THREE.BoxGeometry(BOOK_WIDTH, BOOK_HEIGHT, 0.05);
	frontCoverGeometry.translate(-BOOK_WIDTH / 2, 0, 0);
	const frontCover = new THREE.Mesh(
		frontCoverGeometry,
		new THREE.MeshStandardMaterial({
			map: createCoverTexture(repoName),
			roughness: 0.7,
			metalness: 0.1
		})
	);
	frontCover.position.set(BOOK_WIDTH / 2, 0, BOOK_DEPTH / 2 + 0.025);
	frontCover.castShadow = true;
	group.add(frontCover);

	// Back cover
	const backCoverGeometry = new THREE.BoxGeometry(BOOK_WIDTH, BOOK_HEIGHT, 0.05);
	backCoverGeometry.translate(-BOOK_WIDTH / 2, 0, 0);
	const backCover = new THREE.Mesh(
		backCoverGeometry,
		new THREE.MeshStandardMaterial({ color: 0x2d1b0e, roughness: 0.8, metalness: 0.1 })
	);
	backCover.position.set(BOOK_WIDTH / 2, 0, -BOOK_DEPTH / 2 - 0.025);
	backCover.castShadow = true;
	group.add(backCover);

	// Spine
	const spine = new THREE.Mesh(
		new THREE.BoxGeometry(0.1, BOOK_HEIGHT, BOOK_DEPTH),
		new THREE.MeshStandardMaterial({ color: 0x1a0f08, roughness: 0.9, metalness: 0.05 })
	);
	spine.position.set(-0.05, 0, 0);
	spine.castShadow = true;
	group.add(spine);

	// Create pages
	const pageTextures = await Promise.all(
		chapters.map((chapter, i) => createTextTexture(chapter, i + 1, chapters.length))
	);

	const pageSpacing = BOOK_DEPTH / (chapters.length + 1);
	chapters.forEach((_, index) => {
		const pageGeometry = new THREE.PlaneGeometry(BOOK_WIDTH - 0.1, BOOK_HEIGHT - 0.1);
		pageGeometry.translate(-(BOOK_WIDTH - 0.1) / 2, 0, 0);

		const page = new THREE.Mesh(
			pageGeometry,
			new THREE.MeshStandardMaterial({
				map: pageTextures[index],
				roughness: 0.9,
				metalness: 0,
				side: THREE.FrontSide
			})
		);

		const zPos = BOOK_DEPTH / 2 - pageSpacing * (index + 1);
		page.position.set(BOOK_WIDTH / 2 - 0.05, 0, zPos);
		page.userData.originalZ = zPos;
		page.castShadow = true;
		page.visible = false;
		pages.push(page);
		group.add(page);
	});

	group.rotation.x = -0.15;
	group.scale.set(1.8, 1.8, 1.8);
	scene.add(group);

	// Animation state
	let currentPage = -1;
	let isAnimating = false;
	const totalPages = chapters.length;

	const updatePageVisibility = () => {
		pages.forEach((page, i) => {
			page.visible = i === currentPage;
		});
	};

	const openBook = async () => {
		if (isAnimating || currentPage >= 0) return;
		isAnimating = true;
		await gsap.to(frontCover.rotation, { y: -Math.PI * 0.9, duration: 0.8, ease: 'power2.inOut' });
		currentPage = 0;
		updatePageVisibility();
		isAnimating = false;
	};

	const turnPage = async (page: THREE.Mesh, direction: 'forward' | 'backward') => {
		const targetRotation = direction === 'forward' ? -Math.PI : 0;
		page.rotation.y = direction === 'forward' ? 0 : -Math.PI;

		const tl = gsap.timeline();
		tl.to(page.rotation, { y: targetRotation, duration: 0.6, ease: 'power2.inOut' });
		tl.to(page.position, { z: page.userData.originalZ + (direction === 'forward' ? -0.1 : 0.1), duration: 0.3, ease: 'power2.out' }, 0);
		tl.to(page.position, { z: page.userData.originalZ, duration: 0.3, ease: 'power2.in' }, 0.3);
		await tl.play();
	};

	const nextPage = async () => {
		if (isAnimating) return;
		if (currentPage < 0) { await openBook(); return; }
		if (currentPage >= totalPages - 1) return;
		isAnimating = true;
		await turnPage(pages[currentPage], 'forward');
		currentPage++;
		updatePageVisibility();
		isAnimating = false;
	};

	const prevPage = async () => {
		if (isAnimating || currentPage <= 0) return;
		isAnimating = true;
		currentPage--;
		updatePageVisibility();
		await turnPage(pages[currentPage], 'backward');
		isAnimating = false;
	};

	// Resize handler
	const handleResize = () => {
		const w = container.clientWidth;
		const h = container.clientHeight;
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		renderer.setSize(w, h);
	};
	window.addEventListener('resize', handleResize);

	const dispose = () => {
		window.removeEventListener('resize', handleResize);
		renderer.dispose();
		scene.clear();
		if (container.contains(renderer.domElement)) {
			container.removeChild(renderer.domElement);
		}
	};

	return {
		scene,
		camera,
		renderer,
		get currentPage() { return currentPage; },
		totalPages,
		get isAnimating() { return isAnimating; },
		openBook,
		nextPage,
		prevPage,
		dispose
	};
}
