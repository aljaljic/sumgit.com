import * as THREE from 'three';
import gsap from 'gsap';
import type { StoryChapter } from '$lib/types/story';
import { createTextTexture, createCoverTexture, createTitlePageTexture, createBackCoverTexture, createSpineTexture, createPageEdgeTexture } from './text-texture';

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
	isClosed: boolean;
	openBook: () => Promise<void>;
	nextPage: () => Promise<void>;
	prevPage: () => Promise<void>;
	closeBook: () => Promise<void>;
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
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.1;
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	container.appendChild(renderer.domElement);

	// 3-point studio lighting
	// Key light (warm, main illumination)
	const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
	keyLight.position.set(5, 8, 8);
	keyLight.castShadow = true;
	keyLight.shadow.mapSize.width = 4096;
	keyLight.shadow.mapSize.height = 4096;
	keyLight.shadow.camera.near = 1;
	keyLight.shadow.camera.far = 25;
	keyLight.shadow.bias = -0.0001;
	keyLight.shadow.normalBias = 0.02;
	scene.add(keyLight);

	// Fill light (cool, softer)
	const fillLight = new THREE.DirectionalLight(0xe6f0ff, 0.4);
	fillLight.position.set(-5, 3, 3);
	scene.add(fillLight);

	// Rim/back light (edge separation)
	const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
	rimLight.position.set(0, 2, -5);
	scene.add(rimLight);

	// Ambient (lower for more contrast)
	const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
	scene.add(ambientLight);

	// Build the book geometry
	const group = new THREE.Group();
	const pages: THREE.Mesh[] = [];

	// Front cover
	const frontCoverGeometry = new THREE.BoxGeometry(BOOK_WIDTH, BOOK_HEIGHT, 0.05);
	frontCoverGeometry.translate(-BOOK_WIDTH / 2, 0, 0);
	const frontCoverTexture = await createCoverTexture(repoName, chapters[0]?.image_url);
	const frontCover = new THREE.Mesh(
		frontCoverGeometry,
		new THREE.MeshStandardMaterial({
			map: frontCoverTexture,
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
		new THREE.MeshStandardMaterial({
			map: createBackCoverTexture(),
			roughness: 0.7,
			metalness: 0.1
		})
	);
	backCover.position.set(BOOK_WIDTH / 2, 0, -BOOK_DEPTH / 2 - 0.025);
	backCover.castShadow = true;
	backCover.visible = false; // Hidden until book closes
	group.add(backCover);

	// Book spine - must be child of frontCover to rotate with it
	const spineWidth = 0.08;
	const spineGeometry = new THREE.BoxGeometry(spineWidth, BOOK_HEIGHT, BOOK_DEPTH + 0.1);
	const spineTexture = createSpineTexture(repoName);
	const spine = new THREE.Mesh(
		spineGeometry,
		new THREE.MeshStandardMaterial({
			map: spineTexture,
			roughness: 0.6,
			metalness: 0.1
		})
	);
	// Position relative to frontCover's local coordinates (geometry is translated by -BOOK_WIDTH/2)
	// So x=0 is the right edge (hinge), and we want spine just to the right of that
	spine.position.set(spineWidth / 2, 0, -0.025 - BOOK_DEPTH / 2);
	spine.castShadow = true;
	frontCover.add(spine);

	// Page stack edges (visible paper stack)
	const pageStackGeometry = new THREE.BoxGeometry(0.02, BOOK_HEIGHT - 0.2, BOOK_DEPTH - 0.1);
	const pageStackTexture = createPageEdgeTexture();
	const pageStack = new THREE.Mesh(
		pageStackGeometry,
		new THREE.MeshStandardMaterial({
			map: pageStackTexture,
			roughness: 0.9,
			metalness: 0
		})
	);
	// Page stack edges - at left edge of open pages
	pageStack.position.set(-(BOOK_WIDTH / 2) + 0.01, 0, 0);
	group.add(pageStack);

	// Create page textures: title page + chapters
	const titleTexture = createTitlePageTexture(repoName);
	const chapterTextures = await Promise.all(
		chapters.map((chapter, i) => createTextTexture(chapter, i + 1, chapters.length))
	);
	const pageTextures = [titleTexture, ...chapterTextures];

	const pageSpacing = BOOK_DEPTH / (pageTextures.length + 1);
	pageTextures.forEach((texture, index) => {
		const pageGeometry = new THREE.PlaneGeometry(BOOK_WIDTH - 0.1, BOOK_HEIGHT - 0.1);
		pageGeometry.translate((BOOK_WIDTH - 0.1) / 2, 0, 0);

		const page = new THREE.Mesh(
			pageGeometry,
			new THREE.MeshStandardMaterial({
				map: texture,
				roughness: 0.9,
				metalness: 0,
				side: THREE.DoubleSide
			})
		);

		const zPos = BOOK_DEPTH / 2 - pageSpacing * (index + 1);
		page.position.set(-(BOOK_WIDTH / 2) + 0.05, 0, zPos);
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
	let isClosed = false;
	const totalPages = pageTextures.length;

	const updatePageVisibility = () => {
		pages.forEach((page, i) => {
			page.visible = i === currentPage && !isClosed;
		});
	};

	const openBook = async () => {
		if (isAnimating || currentPage >= 0) return;
		isAnimating = true;
		await Promise.all([
			gsap.to(frontCover.rotation, { y: -Math.PI * 0.9, duration: 0.8, ease: 'power2.inOut' }),
			gsap.to(camera.position, { z: 9, duration: 0.8, ease: 'power2.inOut' })
		]);
		frontCover.visible = false; // Hide cover and spine when book is open
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
		if (currentPage >= totalPages - 1) {
			// Close the book when on last page
			await closeBook();
			return;
		}
		isAnimating = true;

		// Show next page BEFORE animation (it's behind the current page)
		if (currentPage + 1 < totalPages) {
			pages[currentPage + 1].visible = true;
		}

		await turnPage(pages[currentPage], 'forward');

		// Hide the turned page, keep next page visible
		pages[currentPage].visible = false;
		currentPage++;
		isAnimating = false;
	};

	const closeToFrontCover = async () => {
		if (isAnimating || currentPage < 0) return;
		isAnimating = true;

		// Hide current page
		pages[currentPage].visible = false;

		// Show front cover and close it
		frontCover.visible = true;
		await Promise.all([
			gsap.to(frontCover.rotation, { y: 0, duration: 0.8, ease: 'power2.inOut' }),
			gsap.to(camera.position, { z: 5, duration: 0.8, ease: 'power2.inOut' })
		]);

		currentPage = -1; // Reset to closed state (before first page)
		isAnimating = false;
	};

	const prevPage = async () => {
		if (isAnimating) return;
		// If book is closed, reopen it
		if (isClosed) {
			await reopenBook();
			return;
		}
		if (currentPage <= 0) {
			await closeToFrontCover();
			return;
		}
		isAnimating = true;
		currentPage--;
		updatePageVisibility();
		await turnPage(pages[currentPage], 'backward');
		isAnimating = false;
	};

	const closeBook = async () => {
		if (isAnimating || isClosed || currentPage < 0) return;
		isAnimating = true;

		// Hide current page
		updatePageVisibility();

		// Show front cover before closing animation
		frontCover.visible = true;

		// Animate front cover closing
		await Promise.all([
			gsap.to(frontCover.rotation, { y: 0, duration: 0.8, ease: 'power2.inOut' }),
			gsap.to(camera.position, { z: 5, duration: 0.8, ease: 'power2.inOut' })
		]);

		// Rotate group to show back cover
		backCover.visible = true;
		await gsap.to(group.rotation, { y: Math.PI, duration: 1.0, ease: 'power2.inOut' });

		isClosed = true;
		isAnimating = false;
	};

	const reopenBook = async () => {
		if (isAnimating || !isClosed) return;
		isAnimating = true;

		// Rotate back to front
		await gsap.to(group.rotation, { y: 0, duration: 1.0, ease: 'power2.inOut' });
		backCover.visible = false;

		// Open front cover
		await Promise.all([
			gsap.to(frontCover.rotation, { y: -Math.PI * 0.9, duration: 0.8, ease: 'power2.inOut' }),
			gsap.to(camera.position, { z: 9, duration: 0.8, ease: 'power2.inOut' })
		]);

		frontCover.visible = false; // Hide cover and spine when book is open
		isClosed = false;
		updatePageVisibility();
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
		get isClosed() { return isClosed; },
		openBook,
		nextPage,
		prevPage,
		closeBook,
		dispose
	};
}
