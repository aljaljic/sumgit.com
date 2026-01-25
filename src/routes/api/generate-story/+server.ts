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
import { handleError } from '$lib/server/errors';
import { secureLog } from '$lib/server/logger';

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
	changelog: 'modern product illustration, clean tech aesthetic, professional design, minimal and elegant',
	'space-opera': 'cinematic sci-fi concept art, dramatic space lighting, futuristic',
	noir: 'black and white noir photography style, dramatic shadows, 1940s aesthetic',
	anime: 'anime art style, dramatic action scene, vibrant colors, manga-inspired',
	ghibli: 'anime illustration inspired by Studio Ghibli, hand-drawn animation aesthetic, soft watercolor textures, whimsical and dreamlike, lush nature details, warm nostalgic lighting'
};

const NARRATIVE_PROMPTS: Record<NarrativeStyleId, string> = {
	fantasy: `You are a bard of ancient times, chronicling the epic rise of a legendary product in the style of J.R.R. Tolkien.

Given a list of development milestones from a repository, weave them into SHORT fantasy product announcements:

- Features = magical artifacts forged, powerful enchantments bestowed
- Bug fixes = dark forces vanquished, shadow creatures defeated
- Launches = kingdoms united, great victories won
- Updates = new powers awakened, ancient wisdom unlocked
- Improvements = the realm strengthened, defenses fortified

Each chapter should:
- Be 100-150 words MAXIMUM (keep it short!)
- Announce product updates with epic fantasy grandeur
- Frame each feature as a legendary achievement
- Use rich fantasy language (thee, thy, hath, verily, etc.)

Write exactly 3-4 chapters total. Keep them SHORT but evocative.`,

	changelog: `You are telling the story of a product's evolution - like a founder updating users on the journey. Professional but human, proud of what's built, honest about the process.

Given a list of development milestones from a repository, transform them into a compelling product evolution narrative:

- Code = product capabilities, features shipped
- Bugs = issues squashed, user pain points fixed
- Features = new capabilities, things users can now do
- Deployments = releases, launches, going live
- Refactoring = performance wins, under-the-hood improvements

Each chapter should:
- Be 100-150 words MAXIMUM (keep it short!)
- Focus on user value - what can people do now?
- Professional but warm, not corporate/stiff
- Feel like a product team celebrating milestones with their users

Write exactly 3-4 chapters total. Keep them SHORT but meaningful.`,

	'space-opera': `You are a starship AI announcing mission updates about a product's voyage across the cosmos in the style of Star Trek captain's logs.

Given a list of development milestones from a repository, transform them into galactic product announcements:

- Features = new systems online, capabilities discovered in uncharted space
- Bug fixes = anomalies neutralized, system malfunctions resolved
- Launches = new sectors reached, warp jumps successful
- Updates = ship upgrades complete, new modules integrated
- Improvements = warp core optimized, shields strengthened

Each chapter should:
- Be 100-150 words MAXIMUM (keep it short!)
- Announce product updates as official starship transmissions
- Frame each feature as a cosmic achievement
- Reference stardate-style entries

Write exactly 3-4 chapters total. Keep them SHORT but evocative.`,

	noir: `You are a hard-boiled detective announcing case breakthroughs about a product's evolution, in the style of Raymond Chandler.

Given a list of development milestones from a repository, transform them into noir-style product announcements:

- Features = cases cracked, mysteries solved, breakthroughs in the night
- Bug fixes = criminals caught, loose ends tied up
- Launches = justice served, the city sleeps safer tonight
- Updates = new leads followed, pieces falling into place
- Improvements = cleaning up the streets, order restored

Each chapter should:
- Be 100-150 words MAXIMUM (keep it short!)
- Announce product updates with noir atmosphere
- Frame each feature as a case solved
- Write in first person, past tense, moody but triumphant

Write exactly 3-4 chapters total. Keep them SHORT but atmospheric.`,

	anime: `You are narrating a shonen anime about a product's epic evolution into the ultimate app. Think Naruto meets product launches.

Given a list of development milestones from a repository, transform them into epic product announcements in anime style:

- Features = new ultimate abilities unlocked, power-ups revealed
- Bug fixes = villains defeated, obstacles overcome
- Launches = tournament victories, epic battle wins
- Updates = training arcs complete, new forms achieved
- Improvements = breaking through limits, leveling up

Each chapter should:
- Be 100-150 words MAXIMUM (keep it short!)
- Announce product updates with over-the-top dramatic energy
- Frame each feature/update as an epic achievement
- Have "This isn't even our final form!" energy

Write exactly 3-4 chapters total. Keep them SHORT but INTENSE.`,

	ghibli: `You are narrating a whimsical Studio Ghibli film about a product blossoming into something wonderful. Think Spirited Away meets heartfelt product updates.

Given a list of development milestones from a repository, transform them into gentle product announcements in Ghibli style:

- Features = magical gifts appearing, new spirits joining the journey
- Bug fixes = mischievous spirits befriended, small troubles resolved
- Launches = festivals in spirit villages, celebrations of growth
- Updates = seasons changing, the garden blooming anew
- Improvements = tending the bathhouse, nurturing what matters

Each chapter should:
- Be 100-150 words MAXIMUM (keep it short!)
- Announce product updates with gentle wonder and warmth
- Frame each feature as a small magic worth celebrating
- Include nature imagery - forests, rivers, wind, clouds
- Emphasize the product growing and finding its place

Write exactly 3-4 chapters total. Keep them SHORT but magical.`
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
					// Generate image using GPT-4o image generation
					const imageResponse = await openai.images.generate({
						model: 'gpt-image-1.5',
						prompt: chapter.image_prompt,
						n: 1,
						size: '1024x1024',
						quality: 'medium'
					});

					const imageData = imageResponse.data?.[0];
					if (!imageData) {
						secureLog.error(`No image data for chapter ${index}`);
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
						secureLog.error(`No image data format for chapter ${index}`);
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
						secureLog.error(`Upload error for chapter ${index}:`, uploadError);
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
					secureLog.error(`Image generation error for chapter ${index}:`, imgError);
					return chapter;
				}
			})
		);

		// Persist story to database
		const { data: insertedStory, error: insertError } = await supabaseAdmin
			.from('stories')
			.insert({
				repository_id,
				user_id: user.id,
				narrative_style: style,
				chapters: chaptersWithImages,
				is_public: false
			})
			.select()
			.single();

		if (insertError) {
			console.error('Failed to persist story:', insertError);
			// Still return the story even if persistence fails
		}

		return json({
			success: true,
			story: {
				id: insertedStory?.id,
				repository_id,
				user_id: user.id,
				narrative_style: style,
				chapters: chaptersWithImages,
				is_public: false,
				created_at: insertedStory?.created_at
			},
			credits_remaining: creditResult.newBalance
		});
	} catch (err) {
		// Refund credits on failure
		if (creditsDeducted) {
			await refundCredits(user.id, 'generate_story', 'Refund due to story generation failure');
		}

		// Use sanitized error handling
		handleError(err, 'Story generation');
	}
};
