import gsap from 'gsap';
import type * as THREE from 'three';
import type { BookMesh } from './book-geometry';

export interface PageAnimator {
	currentPage: number;
	totalPages: number;
	isAnimating: boolean;
	nextPage: () => Promise<void>;
	prevPage: () => Promise<void>;
	goToPage: (pageIndex: number) => Promise<void>;
	openBook: () => Promise<void>;
}

export function createPageAnimator(book: BookMesh): PageAnimator {
	let currentPage = -1; // -1 means book is closed
	const totalPages = book.pages.length;
	let isAnimating = false;

	const openBook = async (): Promise<void> => {
		if (isAnimating || currentPage >= 0) return;
		isAnimating = true;

		// Animate front cover opening
		await gsap.to(book.covers.front.rotation, {
			y: -Math.PI * 0.9,
			duration: 0.8,
			ease: 'power2.inOut'
		});

		currentPage = 0;
		isAnimating = false;
	};

	const turnPage = async (page: THREE.Mesh, direction: 'forward' | 'backward'): Promise<void> => {
		const targetRotation = direction === 'forward' ? -Math.PI : 0;
		const startRotation = direction === 'forward' ? 0 : -Math.PI;

		// Reset rotation before animation
		page.rotation.y = startRotation;

		// Create page turning animation with bend effect
		const tl = gsap.timeline();

		// Main rotation with easing
		tl.to(page.rotation, {
			y: targetRotation,
			duration: 0.6,
			ease: 'power2.inOut'
		});

		// Add subtle lift effect during turn
		tl.to(
			page.position,
			{
				z: page.userData.originalZ + (direction === 'forward' ? -0.1 : 0.1),
				duration: 0.3,
				ease: 'power2.out'
			},
			0
		);
		tl.to(
			page.position,
			{
				z: page.userData.originalZ,
				duration: 0.3,
				ease: 'power2.in'
			},
			0.3
		);

		await tl.play();
	};

	const nextPage = async (): Promise<void> => {
		if (isAnimating) return;

		// Open book if closed
		if (currentPage < 0) {
			await openBook();
			return;
		}

		if (currentPage >= totalPages - 1) return;

		isAnimating = true;
		const page = book.pages[currentPage];
		await turnPage(page, 'forward');
		currentPage++;
		isAnimating = false;
	};

	const prevPage = async (): Promise<void> => {
		if (isAnimating || currentPage <= 0) return;

		isAnimating = true;
		currentPage--;
		const page = book.pages[currentPage];
		await turnPage(page, 'backward');
		isAnimating = false;
	};

	const goToPage = async (pageIndex: number): Promise<void> => {
		if (isAnimating || pageIndex < 0 || pageIndex >= totalPages) return;

		// Open book if closed
		if (currentPage < 0) {
			await openBook();
		}

		while (currentPage < pageIndex) {
			await nextPage();
		}
		while (currentPage > pageIndex) {
			await prevPage();
		}
	};

	return {
		get currentPage() {
			return currentPage;
		},
		totalPages,
		get isAnimating() {
			return isAnimating;
		},
		nextPage,
		prevPage,
		goToPage,
		openBook
	};
}
