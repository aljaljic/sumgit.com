import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PRIVATE_SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import type { WidgetContentType, WidgetConfig } from '$lib/types/share';

const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_ROLE_KEY);

// Generate a URL-friendly share token (21 chars like nanoid)
function generateShareToken(): string {
	const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
	const array = new Uint8Array(21);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

export const POST: RequestHandler = async ({ request, locals, url }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { repository_id, content_type, config } = body as {
		repository_id: string;
		content_type: WidgetContentType;
		config?: Partial<WidgetConfig>;
	};

	if (!repository_id) {
		throw error(400, 'Repository ID required');
	}

	if (!content_type || !['milestones', 'timeline', 'recap', 'story', 'changelog'].includes(content_type)) {
		throw error(400, 'Valid content type required');
	}

	// Verify the user owns this repository
	const { data: repository } = await locals.supabase
		.from('repositories')
		.select('id, user_id')
		.eq('id', repository_id)
		.eq('user_id', user.id)
		.single();

	if (!repository) {
		throw error(404, 'Repository not found');
	}

	// Check if a share token already exists for this repository and content type
	const { data: existingToken } = await locals.supabase
		.from('share_tokens')
		.select('*')
		.eq('repository_id', repository_id)
		.eq('content_type', content_type)
		.eq('user_id', user.id)
		.single();

	if (existingToken) {
		// Update existing token config and reactivate if needed
		const existingConfig = existingToken.config as unknown as WidgetConfig | null;
		const updatedConfig: WidgetConfig = {
			theme: config?.theme ?? existingConfig?.theme ?? 'light',
			showBranding: config?.showBranding ?? existingConfig?.showBranding ?? true,
			showDate: config?.showDate ?? existingConfig?.showDate,
			showCommit: config?.showCommit ?? existingConfig?.showCommit
		};

		const { error: updateError } = await supabaseAdmin
			.from('share_tokens')
			.update({
				config: updatedConfig,
				is_active: true
			})
			.eq('id', existingToken.id);

		if (updateError) {
			console.error('Failed to update share token:', updateError);
			throw error(500, 'Failed to update share token');
		}

		const embedUrl = `${url.origin}/embed/${existingToken.token}`;
		const iframeCode = `<iframe src="${embedUrl}" width="100%" height="400" frameborder="0" style="border-radius: 8px;"></iframe>`;

		return json({
			success: true,
			token: existingToken.token,
			embed_url: embedUrl,
			iframe_code: iframeCode
		});
	}

	// Create new share token
	const token = generateShareToken();
	const tokenConfig: WidgetConfig = {
		theme: config?.theme ?? 'light',
		showBranding: config?.showBranding ?? true,
		showDate: config?.showDate,
		showCommit: config?.showCommit
	};

	const { error: insertError } = await supabaseAdmin.from('share_tokens').insert({
		token,
		user_id: user.id,
		repository_id,
		content_type,
		config: tokenConfig
	});

	if (insertError) {
		console.error('Failed to create share token:', insertError);
		throw error(500, 'Failed to create share token');
	}

	const embedUrl = `${url.origin}/embed/${token}`;
	const iframeCode = `<iframe src="${embedUrl}" width="100%" height="400" frameborder="0" style="border-radius: 8px;"></iframe>`;

	return json({
		success: true,
		token,
		embed_url: embedUrl,
		iframe_code: iframeCode
	});
};
