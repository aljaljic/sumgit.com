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

export type NarrativeStyleId = 'fantasy' | 'indie-hacker' | 'space-opera' | 'noir' | 'anime';

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
		id: 'indie-hacker',
		name: 'Indie Hacker',
		description: 'Startup founder journey',
		icon: '🚀'
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
	}
];
