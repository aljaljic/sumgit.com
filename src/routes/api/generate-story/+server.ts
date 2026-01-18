import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import { PRIVATE_OPENAI_API_KEY } from '$env/static/private';
import type { Repository, Milestone } from '$lib/database.types';
import type { StoryChapter } from '$lib/types/story';

const openai = new OpenAI({
	apiKey: PRIVATE_OPENAI_API_KEY,
	fetch: globalThis.fetch,
	timeout: 120000,
	maxRetries: 0
});

const STORY_SYSTEM_PROMPT = `You are a creative storyteller who writes compelling first-person narratives about software projects.

Given a list of development milestones from a repository, write an engaging story about the project's journey. Write from the developer's perspective in first person.

Each chapter should:
- Be 200-400 words
- Cover a meaningful period or theme in the project's development
- Include emotional elements (challenges, victories, lessons learned)
- Flow naturally from one chapter to the next
- Feel authentic and personal, like a developer journal

Write 3-6 chapters depending on the milestone count. Group related milestones into chapters by theme or time period.

Return JSON: {
  "chapters": [
    {
      "title": "Chapter title (keep it short and evocative)",
      "content": "The narrative content...",
      "date_range": "Month Year - Month Year" or "Month Year"
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

		const userMessage = `Write a narrative story about the development journey of "${repo.repo_owner}/${repo.repo_name}".

Here are the milestones to weave into the story:

${milestonesText}

Create an engaging first-person narrative that captures the spirit of building this project. Make it feel personal and authentic.`;

		const response = await openai.chat.completions.create({
			model: 'gpt-4o',
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

		return json({
			success: true,
			story: {
				repository_id,
				chapters
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
