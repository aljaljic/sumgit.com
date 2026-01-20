export type WidgetContentType = 'milestones' | 'timeline' | 'recap' | 'story';
export type WidgetTheme = 'light' | 'dark' | 'auto';

export interface WidgetConfig {
	theme: WidgetTheme;
	showBranding: boolean;
}

export interface ShareToken {
	id: string;
	token: string;
	user_id: string;
	repository_id: string;
	content_type: WidgetContentType;
	config: WidgetConfig;
	is_active: boolean;
	view_count: number;
	created_at: string;
	updated_at: string;
}

export interface CreateShareTokenRequest {
	repository_id: string;
	content_type: WidgetContentType;
	config?: Partial<WidgetConfig>;
}

export interface CreateShareTokenResponse {
	success: boolean;
	token?: string;
	embed_url?: string;
	iframe_code?: string;
	error?: string;
}

export interface ShareTokenListItem extends ShareToken {
	repository_name?: string;
	repository_owner?: string;
}
