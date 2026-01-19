import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import { PRIVATE_OPENAI_API_KEY } from '$env/static/private';
import { PRIVATE_SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import type { Repository, Milestone } from '$lib/database.types';
import type { StoryChapter, NarrativeStyleId } from '$lib/types/story';
import { checkAndDeductCredits, refundCredits } from '$lib/server/credits';
import { CREDIT_COSTS } from '$lib/credits';

const openai = new OpenAI({
	apiKey: PRIVATE_OPENAI_API_KEY,
	fetch: globalThis.fetch,
	timeout: 120000,
	maxRetries: 0
});

// Supabase client with service role for storage operations
const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_ROLE_KEY);

const IMAGE_STYLE_SUFFIXES: Record<NarrativeStyleId, string> = {
	fantasy: 'epic fantasy oil painting, dramatic lighting, rich colors',
	'indie-hacker': 'modern flat illustration, vibrant startup aesthetic, clean minimal design',
	'space-opera': 'cinematic sci-fi concept art, dramatic space lighting, futuristic',
	noir: 'black and white noir photography style, dramatic shadows, 1940s aesthetic',
	anime: 'anime art style, dramatic action scene, vibrant colors, manga-inspired'
};

const NARRATIVE_PROMPTS: Record<NarrativeStyleId, string> = {
	fantasy: `You are a bard of ancient times, chronicling the epic tales of code-smiths and their magical creations in the style of J.R.R. Tolkien.

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

Write exactly 3-4 chapters total. Keep them SHORT but evocative.`,

	'indie-hacker': `You are a fellow indie hacker telling the story of a builder's journey. Write like you're sharing war stories over coffee.

Given a list of development milestones from a repository, transform them into a compelling founder's journey narrative:

- Code = building, shipping, hacking together
- Bugs = fires to put out, things breaking at 2am
- Features = MVPs, launches, shipped features
- Deployments = launches, going live, shipping day
- Refactoring = paying down tech debt, cleaning up the mess

Each chapter should:
- Be 100-150 words MAXIMUM (keep it short!)
- Keep it real, casual, and relatable
- Use phrases like "shipped it", "went live", "fixed that bug", "pivoted"
- Feel like a genuine indie hacker sharing their journey

Write exactly 3-4 chapters total. Keep them SHORT but authentic.`,

	'space-opera': `You are the ship's AI chronicling a crew's expedition across the digital cosmos in the style of Star Trek captain's logs.

Given a list of development milestones from a repository, transform them into a galactic exploration narrative:

- Code = ship systems, quantum algorithms, subspace protocols
- Bugs = anomalies, system malfunctions, hostile code signatures
- Features = new modules, upgraded systems, discoveries
- Deployments = warp jumps, arriving at new sectors
- Refactoring = recalibrating systems, optimizing warp cores

Each chapter should:
- Be 100-150 words MAXIMUM (keep it short!)
- Use formal but evocative language
- Reference stardate-style entries
- Feel like official ship's logs from a space exploration mission

Write exactly 3-4 chapters total. Keep them SHORT but evocative.`,

	noir: `You are a hard-boiled detective narrating a case file about tracking down bugs and building features, in the style of Raymond Chandler.

Given a list of development milestones from a repository, transform them into a noir mystery narrative:

- Code = the dame, the case, the puzzle pieces
- Bugs = criminals, suspects, things that don't add up
- Features = breakthroughs, solved cases, cracked codes
- Deployments = closing the case, justice served
- Refactoring = cleaning up the mess, tying loose ends

Each chapter should:
- Be 100-150 words MAXIMUM (keep it short!)
- Write in first person, past tense
- Be moody, atmospheric, cynical but with heart
- Feel like pages from a detective's case file

Write exactly 3-4 chapters total. Keep them SHORT but atmospheric.`,

	anime: `You are narrating a shonen anime about a young developer's journey to become the greatest code master. Think Naruto meets Silicon Valley.

Given a list of development milestones from a repository, transform them into an epic anime journey:

- Code = techniques, jutsu, special moves, ultimate abilities
- Bugs = villains, final bosses, rivals who push the protagonist
- Features = power-ups, new techniques mastered, level ups
- Deployments = tournament victories, boss battles won
- Refactoring = intense training arcs, pushing past limits

Each chapter should:
- Be 100-150 words MAXIMUM (keep it short!)
- Be over-the-top dramatic with inner monologues
- Emphasize friendship powering everything
- Have "I won't give up!" energy

Write exactly 3-4 chapters total. Keep them SHORT but INTENSE.`
};

function buildSystemPrompt(style: NarrativeStyleId): string {
	const basePrompt = NARRATIVE_PROMPTS[style];
	const imageStyle = IMAGE_STYLE_SUFFIXES[style];

	return `${basePrompt}

Return JSON: {
  "chapters": [
    {
      "title": "Chapter title matching the narrative style",
      "content": "The narrative content...",
      "date_range": "Month Year - Month Year" or "Month Year",
      "image_prompt": "A detailed prompt for generating an illustration for this chapter. Describe the scene vividly: setting, characters, lighting, mood. Style: ${imageStyle}."
    }
  ]
}`;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const { repository_id, narrative_style = 'fantasy' } = await request.json();
	const style = (narrative_style as NarrativeStyleId) in NARRATIVE_PROMPTS
		? (narrative_style as NarrativeStyleId)
		: 'fantasy';

	if (!repository_id) {
		throw error(400, 'Repository ID required');
	}

	// Check and deduct credits before processing
	const creditResult = await checkAndDeductCredits(user.id, 'generate_story', repository_id);
	if (!creditResult.success) {
		throw error(402, {
			message: creditResult.error || 'Insufficient credits',
			credits_required: CREDIT_COSTS.generate_story,
			credits_available: creditResult.newBalance
		} as any);
	}

	let creditsDeducted = true;

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

		const userMessage = `Chronicle the journey of "${repo.repo_owner}/${repo.repo_name}".

Here are the key milestones:

${milestonesText}

Transform these events into a compelling narrative (3-4 chapters, 100-150 words each).`;

		const response = await openai.chat.completions.create({
			model: 'gpt-5-mini',
			messages: [
				{ role: 'system', content: buildSystemPrompt(style) },
				{ role: 'user', content: userMessage }
			],
			response_format: { type: 'json_object' },
			max_completion_tokens: 4000
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
			},
			credits_remaining: creditResult.newBalance
		});
	} catch (err) {
		console.error('Story generation error:', err);

		// Refund credits on failure
		if (creditsDeducted) {
			await refundCredits(user.id, 'generate_story', 'Refund due to story generation failure');
		}

		if (err instanceof Error) {
			const errorMsg = err.message.toLowerCase();

			if (errorMsg.includes('timeout') || errorMsg.includes('connection')) {
				throw error(503, 'AI service temporarily unavailable. Please try again.');
			}
		}

		throw error(500, 'Failed to generate story. Please try again.');
	}
};
