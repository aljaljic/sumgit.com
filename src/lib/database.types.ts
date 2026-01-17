export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
	public: {
		Tables: {
			profiles: {
				Row: {
					id: string;
					github_username: string | null;
					github_access_token: string | null;
					created_at: string;
				};
				Insert: {
					id: string;
					github_username?: string | null;
					github_access_token?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					github_username?: string | null;
					github_access_token?: string | null;
					created_at?: string;
				};
				Relationships: [];
			};
			github_installations: {
				Row: {
					id: string;
					user_id: string;
					installation_id: number;
					account_login: string;
					account_type: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					installation_id: number;
					account_login: string;
					account_type: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					installation_id?: number;
					account_login?: string;
					account_type?: string;
					created_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'github_installations_user_id_fkey';
						columns: ['user_id'];
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
			repositories: {
				Row: {
					id: string;
					user_id: string;
					github_repo_url: string;
					repo_name: string;
					repo_owner: string;
					last_analyzed_at: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					github_repo_url: string;
					repo_name: string;
					repo_owner: string;
					last_analyzed_at?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					github_repo_url?: string;
					repo_name?: string;
					repo_owner?: string;
					last_analyzed_at?: string | null;
					created_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'repositories_user_id_fkey';
						columns: ['user_id'];
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
			milestones: {
				Row: {
					id: string;
					repository_id: string;
					title: string;
					description: string | null;
					commit_sha: string | null;
					milestone_date: string;
					x_post_suggestion: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					repository_id: string;
					title: string;
					description?: string | null;
					commit_sha?: string | null;
					milestone_date: string;
					x_post_suggestion?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					repository_id?: string;
					title?: string;
					description?: string | null;
					commit_sha?: string | null;
					milestone_date?: string;
					x_post_suggestion?: string | null;
					created_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'milestones_repository_id_fkey';
						columns: ['repository_id'];
						referencedRelation: 'repositories';
						referencedColumns: ['id'];
					}
				];
			};
		};
		Views: Record<string, never>;
		Functions: Record<string, never>;
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
}

// Helper types for easier access
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Repository = Database['public']['Tables']['repositories']['Row'];
export type Milestone = Database['public']['Tables']['milestones']['Row'];
export type GitHubInstallation = Database['public']['Tables']['github_installations']['Row'];
