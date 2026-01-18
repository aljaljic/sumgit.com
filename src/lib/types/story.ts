export interface StoryChapter {
	title: string;
	content: string;
	date_range: string;
}

export interface Story {
	id?: string;
	repository_id: string;
	chapters: StoryChapter[];
	created_at?: string;
}

export interface GenerateStoryResponse {
	success: boolean;
	story?: Story;
	error?: string;
}
