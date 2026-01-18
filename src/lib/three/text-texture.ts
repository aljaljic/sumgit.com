import * as THREE from 'three';
import type { StoryChapter } from '$lib/types/story';

const TEXTURE_WIDTH = 512;
const TEXTURE_HEIGHT = 640;

export function createTextTexture(
	chapter: StoryChapter,
	pageNum: number,
	totalPages: number
): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = TEXTURE_WIDTH;
	canvas.height = TEXTURE_HEIGHT;
	const ctx = canvas.getContext('2d')!;

	// Page background (cream paper color)
	ctx.fillStyle = '#f5f0e6';
	ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

	// Add subtle paper texture
	ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
	for (let i = 0; i < 100; i++) {
		const x = Math.random() * TEXTURE_WIDTH;
		const y = Math.random() * TEXTURE_HEIGHT;
		const size = Math.random() * 2;
		ctx.fillRect(x, y, size, size);
	}

	const padding = 40;
	const contentWidth = TEXTURE_WIDTH - padding * 2;

	// Chapter title
	ctx.fillStyle = '#1a1a1a';
	ctx.font = 'bold 24px Georgia, serif';
	ctx.textAlign = 'left';

	const title = chapter.title;
	ctx.fillText(title, padding, 60, contentWidth);

	// Date range
	ctx.font = 'italic 14px Georgia, serif';
	ctx.fillStyle = '#666';
	ctx.fillText(chapter.date_range, padding, 85);

	// Decorative line
	ctx.strokeStyle = '#ccc';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(padding, 100);
	ctx.lineTo(TEXTURE_WIDTH - padding, 100);
	ctx.stroke();

	// Chapter content
	ctx.font = '16px Georgia, serif';
	ctx.fillStyle = '#333';
	ctx.textAlign = 'left';

	const lineHeight = 24;
	const maxLines = Math.floor((TEXTURE_HEIGHT - 160) / lineHeight);
	const words = chapter.content.split(' ');
	let line = '';
	let y = 130;
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
	ctx.font = '12px Georgia, serif';
	ctx.fillStyle = '#888';
	ctx.textAlign = 'center';
	ctx.fillText(`${pageNum} / ${totalPages}`, TEXTURE_WIDTH / 2, TEXTURE_HEIGHT - 30);

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}

export function createCoverTexture(repoName: string): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = TEXTURE_WIDTH;
	canvas.height = TEXTURE_HEIGHT;
	const ctx = canvas.getContext('2d')!;

	// Cover background (rich brown leather)
	const gradient = ctx.createLinearGradient(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
	gradient.addColorStop(0, '#3d2517');
	gradient.addColorStop(0.5, '#4a2c1a');
	gradient.addColorStop(1, '#2d1b0e');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

	// Decorative border
	ctx.strokeStyle = '#b8860b';
	ctx.lineWidth = 3;
	ctx.strokeRect(20, 20, TEXTURE_WIDTH - 40, TEXTURE_HEIGHT - 40);

	// Inner border
	ctx.lineWidth = 1;
	ctx.strokeRect(30, 30, TEXTURE_WIDTH - 60, TEXTURE_HEIGHT - 60);

	// Corner decorations
	const cornerSize = 20;
	const corners = [
		[40, 40],
		[TEXTURE_WIDTH - 40, 40],
		[40, TEXTURE_HEIGHT - 40],
		[TEXTURE_WIDTH - 40, TEXTURE_HEIGHT - 40]
	];

	ctx.fillStyle = '#b8860b';
	corners.forEach(([x, y]) => {
		ctx.beginPath();
		ctx.arc(x, y, 5, 0, Math.PI * 2);
		ctx.fill();
	});

	// Title
	ctx.fillStyle = '#d4af37';
	ctx.font = 'bold 32px Georgia, serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	// Word wrap for long repo names
	const maxWidth = TEXTURE_WIDTH - 80;
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

	const lineHeight = 40;
	const startY = TEXTURE_HEIGHT / 2 - (lines.length - 1) * lineHeight / 2;

	lines.forEach((line, i) => {
		ctx.fillText(line, TEXTURE_WIDTH / 2, startY + i * lineHeight);
	});

	// Subtitle
	ctx.font = 'italic 18px Georgia, serif';
	ctx.fillStyle = '#c4a030';
	ctx.fillText('The Story', TEXTURE_WIDTH / 2, TEXTURE_HEIGHT - 80);

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}
