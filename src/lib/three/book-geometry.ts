import * as THREE from 'three';
import type { StoryChapter } from '$lib/types/story';
import { createTextTexture, createCoverTexture } from './text-texture';

export interface BookMesh {
	group: THREE.Group;
	pages: THREE.Mesh[];
	covers: {
		front: THREE.Mesh;
		back: THREE.Mesh;
	};
	spine: THREE.Mesh;
}

const BOOK_WIDTH = 3.5;
const BOOK_HEIGHT = 4.5;
const BOOK_DEPTH = 0.4;
const PAGE_THICKNESS = 0.015;

export async function createBook(
	chapters: StoryChapter[],
	repoName: string
): Promise<BookMesh> {
	const group = new THREE.Group();
	const pages: THREE.Mesh[] = [];

	// Materials
	const coverMaterial = new THREE.MeshStandardMaterial({
		color: 0x2d1b0e,
		roughness: 0.8,
		metalness: 0.1
	});

	const spineMaterial = new THREE.MeshStandardMaterial({
		color: 0x1a0f08,
		roughness: 0.9,
		metalness: 0.05
	});

	// Front cover
	const frontCoverGeometry = new THREE.BoxGeometry(
		BOOK_WIDTH,
		BOOK_HEIGHT,
		0.05
	);
	const frontCoverTexture = createCoverTexture(repoName);
	const frontCoverMaterial = new THREE.MeshStandardMaterial({
		map: frontCoverTexture,
		roughness: 0.7,
		metalness: 0.1
	});
	const frontCover = new THREE.Mesh(frontCoverGeometry, frontCoverMaterial);
	frontCover.position.set(BOOK_WIDTH / 2, 0, BOOK_DEPTH / 2 + 0.025);
	frontCover.castShadow = true;
	frontCover.receiveShadow = true;

	// Set pivot point for front cover (left edge)
	frontCover.geometry.translate(-BOOK_WIDTH / 2, 0, 0);
	group.add(frontCover);

	// Back cover
	const backCoverGeometry = new THREE.BoxGeometry(
		BOOK_WIDTH,
		BOOK_HEIGHT,
		0.05
	);
	const backCover = new THREE.Mesh(backCoverGeometry, coverMaterial);
	backCover.position.set(BOOK_WIDTH / 2, 0, -BOOK_DEPTH / 2 - 0.025);
	backCover.castShadow = true;
	backCover.receiveShadow = true;
	backCover.geometry.translate(-BOOK_WIDTH / 2, 0, 0);
	group.add(backCover);

	// Spine
	const spineGeometry = new THREE.BoxGeometry(0.1, BOOK_HEIGHT, BOOK_DEPTH);
	const spine = new THREE.Mesh(spineGeometry, spineMaterial);
	spine.position.set(-0.05, 0, 0);
	spine.castShadow = true;
	spine.receiveShadow = true;
	group.add(spine);

	// Create pages for each chapter (async for image loading)
	const totalPages = chapters.length;
	const pageSpacing = BOOK_DEPTH / (totalPages + 1);

	// Load all page textures in parallel
	const pageTextures = await Promise.all(
		chapters.map((chapter, index) => createTextTexture(chapter, index + 1, totalPages))
	);

	chapters.forEach((chapter, index) => {
		// Create page with text texture
		const pageGeometry = new THREE.BoxGeometry(
			BOOK_WIDTH - 0.1,
			BOOK_HEIGHT - 0.1,
			PAGE_THICKNESS
		);

		const pageTexture = pageTextures[index];
		const pageMaterial = new THREE.MeshStandardMaterial({
			map: pageTexture,
			roughness: 0.9,
			metalness: 0,
			side: THREE.DoubleSide
		});

		const page = new THREE.Mesh(pageGeometry, pageMaterial);

		// Position pages in stack (front to back)
		const zPos = BOOK_DEPTH / 2 - pageSpacing * (index + 1);
		page.position.set(BOOK_WIDTH / 2 - 0.05, 0, zPos);

		// Set pivot on left edge for page turning
		page.geometry.translate(-(BOOK_WIDTH - 0.1) / 2, 0, 0);

		page.castShadow = true;
		page.receiveShadow = true;

		// Store original z position for animation
		page.userData.originalZ = zPos;
		page.userData.pageIndex = index;

		pages.push(page);
		group.add(page);
	});

	// Position the whole book - centered for better visibility
	group.position.set(0, 0, 0);
	group.rotation.x = -0.15;

	return {
		group,
		pages,
		covers: { front: frontCover, back: backCover },
		spine
	};
}
