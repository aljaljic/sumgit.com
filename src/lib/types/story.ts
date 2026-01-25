export interface StoryChapter {
	title: string;
	content: string;
	date_range: string;
	image_prompt?: string;
	image_url?: string;
}

export interface Story {
	id: string;
	repository_id: string;
	user_id: string;
	narrative_style: NarrativeStyleId;
	chapters: StoryChapter[];
	share_token?: string | null;
	is_public: boolean;
	created_at: string;
}

export interface GenerateStoryResponse {
	success: boolean;
	story?: Story;
	error?: string;
}

export type NarrativeStyleId = 'fantasy' | 'changelog' | 'space-opera' | 'noir' | 'anime' | 'ghibli';

export interface NarrativeStyle {
	id: NarrativeStyleId;
	name: string;
	description: string;
	icon: string;
}

export const NARRATIVE_STYLES: NarrativeStyle[] = [
	{
		id: 'fantasy',
		name: 'Fantasy',
		description: 'Tolkien-esque epic tales',
		icon: '⚔️'
	},
	{
		id: 'changelog',
		name: 'Changelog',
		description: 'Product update announcements',
		icon: '📋'
	},
	{
		id: 'space-opera',
		name: 'Space Opera',
		description: "Sci-fi captain's log",
		icon: '🌌'
	},
	{
		id: 'noir',
		name: 'Noir Detective',
		description: 'Hard-boiled mystery',
		icon: '🔍'
	},
	{
		id: 'anime',
		name: 'Anime',
		description: 'Shonen dramatic journey',
		icon: '⚡'
	},
	{
		id: 'ghibli',
		name: 'Ghibli',
		description: 'Whimsical Studio Ghibli tale',
		icon: '🌿'
	}
];
