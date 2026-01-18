import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import { PRIVATE_OPENAI_API_KEY } from '$env/static/private';
import { PRIVATE_SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import type { Repository, Milestone } from '$lib/database.types';
import type { StoryChapter } from '$lib/types/story';

const openai = new OpenAI({
	apiKey: PRIVATE_OPENAI_API_KEY,
	fetch: globalThis.fetch,
	timeout: 120000,
	maxRetries: 0
});

// Supabase client with service role for storage operations
const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_ROLE_KEY);

const STORY_SYSTEM_PROMPT = `You are a bard of ancient times, chronicling the epic tales of code-smiths and their magical creations in the style of J.R.R. Tolkien.

Given a list of development milestones from a repository, weave them into a SHORT fantasy epic. Transform the technical journey into a tale of magic and adventure:

- Code and programming = arcane magic, spells, enchantments
- Bugs and errors = orcs, shadow creatures, dark forces
- Features = magical artifacts, enchantments, blessed items
- Deployments = great battles, triumphant moments
- Refactoring = forging anew, purifying with ancient fire

Each chapter should:
- Be 100-150 words MAXIMUM (keep it short!)
- Use rich, epic fantasy language (thee, thy, hath, verily, etc.)
- Include dramatic imagery of quests, forges, and mystical realms
- Flow as an interconnected saga

Write exactly 3-4 chapters total. Keep them SHORT but evocative.

Return JSON: {
  "chapters": [
    {
      "title": "Epic fantasy chapter title",
      "content": "The narrative in Tolkien-esque prose...",
      "date_range": "Month Year - Month Year" or "Month Year",
      "image_prompt": "A detailed prompt for generating a fantasy illustration for this chapter. Describe the scene vividly: setting, characters, lighting, mood. Style: epic fantasy oil painting, dramatic lighting, rich colors."
    }
  ]
}`;

export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const { repository_id } = await request.json();

	if (!repository_id) {
		throw error(400, 'Repository ID required');
	}

	// Get repository
	const { data: repoData } = await locals.supabase
		.from('repositories')
		.select('*')
		.eq('id', repository_id)
		.eq('user_id', user.id)
		.single();

	const repo = repoData as Repository | null;

	if (!repo) {
		throw error(404, 'Repository not found');
	}

	// Get milestones
	const { data: milestonesData } = await locals.supabase
		.from('milestones')
		.select('*')
		.eq('repository_id', repository_id)
		.order('milestone_date', { ascending: true });

	const milestones = (milestonesData ?? []) as Milestone[];

	if (milestones.length === 0) {
		throw error(400, 'No milestones found. Please analyze the repository first.');
	}

	try {
		// Format milestones for the prompt
		const milestonesText = milestones
			.map((m) => `- [${m.milestone_date}] ${m.title}: ${m.description}`)
			.join('\n');

		const userMessage = `Chronicle the epic saga of "${repo.repo_owner}/${repo.repo_name}" - a tale of code-smiths and their magical creation.

Here are the legendary milestones of this quest:

${milestonesText}

Weave these events into a SHORT fantasy epic (3-4 chapters, 100-150 words each). Make it dramatic and mystical!`;

		const response = await openai.chat.completions.create({
			model: 'gpt-5-mini',
			messages: [
				{ role: 'system', content: STORY_SYSTEM_PROMPT },
				{ role: 'user', content: userMessage }
			],
			response_format: { type: 'json_object' },
			temperature: 0.8,
			max_tokens: 4000
		});

		const content = response.choices[0]?.message?.content;
		if (!content) {
			throw error(500, 'Empty response from AI');
		}

		const parsed = JSON.parse(content);
		const chapters = (parsed.chapters ?? []) as StoryChapter[];

		if (chapters.length === 0) {
			throw error(500, 'No chapters generated');
		}

		// Generate images for each chapter
		const chaptersWithImages = await Promise.all(
			chapters.map(async (chapter, index) => {
				if (!chapter.image_prompt) {
					return chapter;
				}

				try {
					// Generate image using dall-e-3
					const imageResponse = await openai.images.generate({
						model: 'dall-e-3',
						prompt: chapter.image_prompt,
						n: 1,
						size: '1024x1024',
						quality: 'standard'
					});

					const imageData = imageResponse.data?.[0];
					if (!imageData) {
						console.error(`No image data for chapter ${index}`);
						return chapter;
					}

					let imageData8: Uint8Array;

					if (imageData.b64_json) {
						// Base64 response (gpt-image-1 default) - use web-compatible decoding
						const binaryString = atob(imageData.b64_json);
						imageData8 = new Uint8Array(binaryString.length);
						for (let i = 0; i < binaryString.length; i++) {
							imageData8[i] = binaryString.charCodeAt(i);
						}
					} else if (imageData.url) {
						// URL response - fetch the image
						const imgResponse = await fetch(imageData.url);
						const arrayBuffer = await imgResponse.arrayBuffer();
						imageData8 = new Uint8Array(arrayBuffer);
					} else {
						console.error(`No image data format for chapter ${index}`);
						return chapter;
					}

					// Upload to Supabase storage
					const fileName = `${repository_id}/${index}.png`;
					const { error: uploadError } = await supabaseAdmin.storage
						.from('story-images')
						.upload(fileName, imageData8, {
							contentType: 'image/png',
							upsert: true
						});

					if (uploadError) {
						console.error(`Upload error for chapter ${index}:`, uploadError);
						return chapter;
					}

					// Get public URL
					const { data: urlData } = supabaseAdmin.storage
						.from('story-images')
						.getPublicUrl(fileName);

					return {
						...chapter,
						image_url: urlData.publicUrl
					};
				} catch (imgError) {
					console.error(`Image generation error for chapter ${index}:`, imgError);
					return chapter;
				}
			})
		);

		return json({
			success: true,
			story: {
				repository_id,
				chapters: chaptersWithImages
			}
		});
	} catch (err) {
		console.error('Story generation error:', err);

		if (err instanceof Error) {
			const errorMsg = err.message.toLowerCase();

			if (errorMsg.includes('timeout') || errorMsg.includes('connection')) {
				throw error(503, 'AI service temporarily unavailable. Please try again.');
			}
		}

		throw error(500, 'Failed to generate story. Please try again.');
	}
};
