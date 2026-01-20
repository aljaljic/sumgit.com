import * as THREE from 'three';
import type { StoryChapter } from '$lib/types/story';

const TEXTURE_WIDTH = 1024;
const TEXTURE_HEIGHT = 1280;
const IMAGE_HEIGHT = 400; // 40% of content area for image

// Load image from URL and return as HTMLImageElement
async function loadImage(url: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = () => {
			console.error('Failed to load image:', url);
			resolve(null);
		};
		img.src = url;
	});
}

export async function createTextTexture(
	chapter: StoryChapter,
	pageNum: number,
	totalPages: number
): Promise<THREE.CanvasTexture> {
	const canvas = document.createElement('canvas');
	canvas.width = TEXTURE_WIDTH;
	canvas.height = TEXTURE_HEIGHT;
	const ctx = canvas.getContext('2d')!;

	// Page background (white)
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

	const padding = 80;
	const contentWidth = TEXTURE_WIDTH - padding * 2;

	let contentStartY = 120;

	// Load and draw chapter image if available
	if (chapter.image_url) {
		const img = await loadImage(chapter.image_url);
		if (img) {
			// Draw image at top of page with padding
			const imgX = padding;
			const imgY = padding;
			const imgWidth = contentWidth;
			const imgHeight = IMAGE_HEIGHT;

			// Draw a decorative border around the image
			ctx.strokeStyle = '#8B4513';
			ctx.lineWidth = 3;
			ctx.strokeRect(imgX - 2, imgY - 2, imgWidth + 4, imgHeight + 4);

			// Draw the image, scaling to fit
			const scale = Math.min(imgWidth / img.width, imgHeight / img.height);
			const scaledWidth = img.width * scale;
			const scaledHeight = img.height * scale;
			const offsetX = imgX + (imgWidth - scaledWidth) / 2;
			const offsetY = imgY + (imgHeight - scaledHeight) / 2;

			ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

			// Update content start position to below image
			contentStartY = imgY + imgHeight + 40;
		}
	}

	// Chapter title
	ctx.fillStyle = '#1a1a1a';
	ctx.font = 'bold 44px Georgia, serif';
	ctx.textAlign = 'left';

	const title = chapter.title;
	ctx.fillText(title, padding, contentStartY, contentWidth);

	// Date range
	ctx.font = 'italic 24px Georgia, serif';
	ctx.fillStyle = '#444';
	ctx.fillText(chapter.date_range, padding, contentStartY + 40);

	// Decorative line
	ctx.strokeStyle = '#ccc';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(padding, contentStartY + 60);
	ctx.lineTo(TEXTURE_WIDTH - padding, contentStartY + 60);
	ctx.stroke();

	// Chapter content
	ctx.font = '28px Georgia, serif';
	ctx.fillStyle = '#1a1a1a';
	ctx.textAlign = 'left';

	const lineHeight = 40;
	const textStartY = contentStartY + 100;
	const availableHeight = TEXTURE_HEIGHT - textStartY - 80;
	const maxLines = Math.floor(availableHeight / lineHeight);
	const words = chapter.content.split(' ');
	let line = '';
	let y = textStartY;
	let lineCount = 0;

	for (const word of words) {
		const testLine = line + word + ' ';
		const metrics = ctx.measureText(testLine);

		if (metrics.width > contentWidth && line !== '') {
			ctx.fillText(line.trim(), padding, y);
			line = word + ' ';
			y += lineHeight;
			lineCount++;

			if (lineCount >= maxLines - 1) {
				// Add ellipsis if content is truncated
				line += '...';
				break;
			}
		} else {
			line = testLine;
		}
	}

	if (line && lineCount < maxLines) {
		ctx.fillText(line.trim(), padding, y);
	}

	// Page number
	ctx.font = '24px Georgia, serif';
	ctx.fillStyle = '#666';
	ctx.textAlign = 'center';
	ctx.fillText(`${pageNum} / ${totalPages}`, TEXTURE_WIDTH / 2, TEXTURE_HEIGHT - 40);

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}

function drawCoverBackground(ctx: CanvasRenderingContext2D) {
	// Cover background (rich brown leather)
	const gradient = ctx.createLinearGradient(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
	gradient.addColorStop(0, '#3d2517');
	gradient.addColorStop(0.5, '#4a2c1a');
	gradient.addColorStop(1, '#2d1b0e');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

	// Decorative border
	ctx.strokeStyle = '#b8860b';
	ctx.lineWidth = 6;
	ctx.strokeRect(40, 40, TEXTURE_WIDTH - 80, TEXTURE_HEIGHT - 80);

	// Inner border
	ctx.lineWidth = 2;
	ctx.strokeRect(60, 60, TEXTURE_WIDTH - 120, TEXTURE_HEIGHT - 120);

	// Corner decorations
	const corners = [
		[80, 80],
		[TEXTURE_WIDTH - 80, 80],
		[80, TEXTURE_HEIGHT - 80],
		[TEXTURE_WIDTH - 80, TEXTURE_HEIGHT - 80]
	];

	ctx.fillStyle = '#b8860b';
	corners.forEach(([x, y]) => {
		ctx.beginPath();
		ctx.arc(x, y, 10, 0, Math.PI * 2);
		ctx.fill();
	});
}

export async function createCoverTexture(repoName: string, imageUrl?: string): Promise<THREE.CanvasTexture> {
	const canvas = document.createElement('canvas');
	canvas.width = TEXTURE_WIDTH;
	canvas.height = TEXTURE_HEIGHT;
	const ctx = canvas.getContext('2d')!;

	drawCoverBackground(ctx);

	let titleStartY = TEXTURE_HEIGHT / 2;

	// Load and draw cover image if provided
	if (imageUrl) {
		const img = await loadImage(imageUrl);
		if (img) {
			const imgPadding = 100;
			const imgWidth = TEXTURE_WIDTH - imgPadding * 2;
			const imgHeight = 450;
			const imgX = imgPadding;
			const imgY = 120;

			// Draw decorative frame around image
			ctx.strokeStyle = '#b8860b';
			ctx.lineWidth = 4;
			ctx.strokeRect(imgX - 4, imgY - 4, imgWidth + 8, imgHeight + 8);
			ctx.lineWidth = 2;
			ctx.strokeRect(imgX - 10, imgY - 10, imgWidth + 20, imgHeight + 20);

			// Draw the image, scaling to fit
			const scale = Math.min(imgWidth / img.width, imgHeight / img.height);
			const scaledWidth = img.width * scale;
			const scaledHeight = img.height * scale;
			const offsetX = imgX + (imgWidth - scaledWidth) / 2;
			const offsetY = imgY + (imgHeight - scaledHeight) / 2;

			ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

			// Move title below image
			titleStartY = imgY + imgHeight + 150;
		}
	}

	// Title
	ctx.fillStyle = '#d4af37';
	ctx.font = 'bold 64px Georgia, serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	// Word wrap for long repo names
	const maxWidth = TEXTURE_WIDTH - 160;
	const words = repoName.split(/[-_/]/);
	let lines: string[] = [];
	let currentLine = '';

	for (const word of words) {
		const testLine = currentLine ? `${currentLine} ${word}` : word;
		const metrics = ctx.measureText(testLine);

		if (metrics.width > maxWidth && currentLine) {
			lines.push(currentLine);
			currentLine = word;
		} else {
			currentLine = testLine;
		}
	}
	if (currentLine) lines.push(currentLine);

	const lineHeight = 80;
	const startY = titleStartY - (lines.length - 1) * lineHeight / 2;

	lines.forEach((line, i) => {
		ctx.fillText(line, TEXTURE_WIDTH / 2, startY + i * lineHeight);
	});

	// Subtitle (only if no image, otherwise it's below title)
	ctx.font = 'italic 36px Georgia, serif';
	ctx.fillStyle = '#c4a030';
	const subtitleY = imageUrl ? startY + lines.length * lineHeight + 30 : TEXTURE_HEIGHT - 160;
	ctx.fillText('The Story', TEXTURE_WIDTH / 2, subtitleY);

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}

export function createBackCoverTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = TEXTURE_WIDTH;
	canvas.height = TEXTURE_HEIGHT;
	const ctx = canvas.getContext('2d')!;

	drawCoverBackground(ctx);

	// "The End" text
	ctx.fillStyle = '#d4af37';
	ctx.font = 'italic 72px Georgia, serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('The End', TEXTURE_WIDTH / 2, TEXTURE_HEIGHT / 2 - 30);

	// Decorative flourish below
	ctx.strokeStyle = '#b8860b';
	ctx.lineWidth = 3;
	const flourishY = TEXTURE_HEIGHT / 2 + 60;

	// Left curl
	ctx.beginPath();
	ctx.moveTo(TEXTURE_WIDTH / 2 - 180, flourishY);
	ctx.quadraticCurveTo(TEXTURE_WIDTH / 2 - 120, flourishY + 50, TEXTURE_WIDTH / 2 - 60, flourishY);
	ctx.stroke();

	// Center dot
	ctx.fillStyle = '#b8860b';
	ctx.beginPath();
	ctx.arc(TEXTURE_WIDTH / 2, flourishY, 8, 0, Math.PI * 2);
	ctx.fill();

	// Right curl
	ctx.beginPath();
	ctx.moveTo(TEXTURE_WIDTH / 2 + 60, flourishY);
	ctx.quadraticCurveTo(TEXTURE_WIDTH / 2 + 120, flourishY + 50, TEXTURE_WIDTH / 2 + 180, flourishY);
	ctx.stroke();

	// Additional decorative line above
	ctx.strokeStyle = '#b8860b';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(TEXTURE_WIDTH / 2 - 120, TEXTURE_HEIGHT / 2 - 100);
	ctx.lineTo(TEXTURE_WIDTH / 2 + 120, TEXTURE_HEIGHT / 2 - 100);
	ctx.stroke();

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}

export function createTitlePageTexture(repoName: string): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = TEXTURE_WIDTH;
	canvas.height = TEXTURE_HEIGHT;
	const ctx = canvas.getContext('2d')!;

	// Page background (white)
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

	// Decorative border
	const borderPadding = 60;
	ctx.strokeStyle = '#8B4513';
	ctx.lineWidth = 4;
	ctx.strokeRect(borderPadding, borderPadding, TEXTURE_WIDTH - borderPadding * 2, TEXTURE_HEIGHT - borderPadding * 2);

	// Inner decorative border
	ctx.lineWidth = 1;
	ctx.strokeRect(borderPadding + 15, borderPadding + 15, TEXTURE_WIDTH - (borderPadding + 15) * 2, TEXTURE_HEIGHT - (borderPadding + 15) * 2);

	// Corner flourishes
	const corners = [
		[borderPadding + 30, borderPadding + 30],
		[TEXTURE_WIDTH - borderPadding - 30, borderPadding + 30],
		[borderPadding + 30, TEXTURE_HEIGHT - borderPadding - 30],
		[TEXTURE_WIDTH - borderPadding - 30, TEXTURE_HEIGHT - borderPadding - 30]
	];

	ctx.fillStyle = '#8B4513';
	corners.forEach(([x, y]) => {
		ctx.beginPath();
		ctx.arc(x, y, 6, 0, Math.PI * 2);
		ctx.fill();
	});

	// Decorative flourish above title
	ctx.strokeStyle = '#8B4513';
	ctx.lineWidth = 2;
	const flourishY = TEXTURE_HEIGHT / 2 - 180;
	ctx.beginPath();
	ctx.moveTo(TEXTURE_WIDTH / 2 - 150, flourishY);
	ctx.quadraticCurveTo(TEXTURE_WIDTH / 2 - 75, flourishY - 30, TEXTURE_WIDTH / 2, flourishY);
	ctx.quadraticCurveTo(TEXTURE_WIDTH / 2 + 75, flourishY + 30, TEXTURE_WIDTH / 2 + 150, flourishY);
	ctx.stroke();

	// Repo name (title)
	ctx.fillStyle = '#2d1b0e';
	ctx.font = 'bold 56px Georgia, serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	// Word wrap for long repo names
	const maxWidth = TEXTURE_WIDTH - 160;
	const words = repoName.split(/[-_/]/);
	let lines: string[] = [];
	let currentLine = '';

	for (const word of words) {
		const testLine = currentLine ? `${currentLine} ${word}` : word;
		const metrics = ctx.measureText(testLine);

		if (metrics.width > maxWidth && currentLine) {
			lines.push(currentLine);
			currentLine = word;
		} else {
			currentLine = testLine;
		}
	}
	if (currentLine) lines.push(currentLine);

	const lineHeight = 70;
	const titleStartY = TEXTURE_HEIGHT / 2 - 80 - (lines.length - 1) * lineHeight / 2;

	lines.forEach((line, i) => {
		ctx.fillText(line, TEXTURE_WIDTH / 2, titleStartY + i * lineHeight);
	});

	// Decorative line below title
	const lineY = titleStartY + lines.length * lineHeight + 20;
	ctx.strokeStyle = '#8B4513';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(TEXTURE_WIDTH / 2 - 120, lineY);
	ctx.lineTo(TEXTURE_WIDTH / 2 + 120, lineY);
	ctx.stroke();

	// Subtitle "The Story"
	ctx.font = 'italic 36px Georgia, serif';
	ctx.fillStyle = '#5a3d2b';
	ctx.fillText('The Story', TEXTURE_WIDTH / 2, lineY + 60);

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}

export function createEndPageTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = TEXTURE_WIDTH;
	canvas.height = TEXTURE_HEIGHT;
	const ctx = canvas.getContext('2d')!;

	// Page background (white)
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

	// "The End" text
	ctx.fillStyle = '#2d1b0e';
	ctx.font = 'italic 72px Georgia, serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('The End', TEXTURE_WIDTH / 2, TEXTURE_HEIGHT / 2 - 30);

	// Decorative flourish below
	ctx.strokeStyle = '#8B4513';
	ctx.lineWidth = 2;
	const flourishY = TEXTURE_HEIGHT / 2 + 50;

	// Left curl
	ctx.beginPath();
	ctx.moveTo(TEXTURE_WIDTH / 2 - 150, flourishY);
	ctx.quadraticCurveTo(TEXTURE_WIDTH / 2 - 100, flourishY + 40, TEXTURE_WIDTH / 2 - 50, flourishY);
	ctx.stroke();

	// Center dot
	ctx.fillStyle = '#8B4513';
	ctx.beginPath();
	ctx.arc(TEXTURE_WIDTH / 2, flourishY, 5, 0, Math.PI * 2);
	ctx.fill();

	// Right curl
	ctx.beginPath();
	ctx.moveTo(TEXTURE_WIDTH / 2 + 50, flourishY);
	ctx.quadraticCurveTo(TEXTURE_WIDTH / 2 + 100, flourishY + 40, TEXTURE_WIDTH / 2 + 150, flourishY);
	ctx.stroke();

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}

export function createSpineTexture(repoName: string): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 256;
	canvas.height = 1280;
	const ctx = canvas.getContext('2d')!;

	// Leather gradient background
	const gradient = ctx.createLinearGradient(0, 0, 256, 0);
	gradient.addColorStop(0, '#2d1b0e');
	gradient.addColorStop(0.5, '#4a2c1a');
	gradient.addColorStop(1, '#2d1b0e');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, 256, 1280);

	// Gold decorative border
	ctx.strokeStyle = '#b8860b';
	ctx.lineWidth = 4;
	ctx.strokeRect(20, 40, 216, 1200);

	// Rotated title
	ctx.save();
	ctx.translate(128, 640);
	ctx.rotate(-Math.PI / 2);
	ctx.fillStyle = '#d4af37';
	ctx.font = 'bold 32px Georgia, serif';
	ctx.textAlign = 'center';
	ctx.fillText(repoName.substring(0, 30), 0, 0);
	ctx.restore();

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}

export function createPageEdgeTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 64;
	canvas.height = 512;
	const ctx = canvas.getContext('2d')!;

	// White base
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, 64, 512);

	// Horizontal lines for page edges
	ctx.strokeStyle = '#e0d8c8';
	ctx.lineWidth = 1;
	for (let y = 0; y < 512; y += 3) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(64, y);
		ctx.stroke();
	}

	// Age staining gradient
	const stainGradient = ctx.createLinearGradient(0, 0, 64, 0);
	stainGradient.addColorStop(0, 'rgba(139, 90, 43, 0.15)');
	stainGradient.addColorStop(0.5, 'rgba(139, 90, 43, 0.05)');
	stainGradient.addColorStop(1, 'rgba(139, 90, 43, 0.15)');
	ctx.fillStyle = stainGradient;
	ctx.fillRect(0, 0, 64, 512);

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}
