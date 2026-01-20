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
					source: string | null;
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
					source?: string | null;
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
					source?: string | null;
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
			credit_balances: {
				Row: {
					id: string;
					user_id: string;
					balance: number;
					lifetime_purchased: number;
					lifetime_used: number;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					balance?: number;
					lifetime_purchased?: number;
					lifetime_used?: number;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					balance?: number;
					lifetime_purchased?: number;
					lifetime_used?: number;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			credit_transactions: {
				Row: {
					id: string;
					user_id: string;
					amount: number;
					balance_after: number;
					transaction_type: 'welcome_bonus' | 'purchase' | 'usage' | 'refund' | 'admin_adjustment';
					operation_type: string | null;
					repository_id: string | null;
					stripe_session_id: string | null;
					stripe_payment_intent_id: string | null;
					description: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					amount: number;
					balance_after: number;
					transaction_type: 'welcome_bonus' | 'purchase' | 'usage' | 'refund' | 'admin_adjustment';
					operation_type?: string | null;
					repository_id?: string | null;
					stripe_session_id?: string | null;
					stripe_payment_intent_id?: string | null;
					description?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					amount?: number;
					balance_after?: number;
					transaction_type?: 'welcome_bonus' | 'purchase' | 'usage' | 'refund' | 'admin_adjustment';
					operation_type?: string | null;
					repository_id?: string | null;
					stripe_session_id?: string | null;
					stripe_payment_intent_id?: string | null;
					description?: string | null;
					created_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'credit_transactions_repository_id_fkey';
						columns: ['repository_id'];
						referencedRelation: 'repositories';
						referencedColumns: ['id'];
					}
				];
			};
			stripe_customers: {
				Row: {
					id: string;
					user_id: string;
					stripe_customer_id: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					stripe_customer_id: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					stripe_customer_id?: string;
					created_at?: string;
				};
				Relationships: [];
			};
			stories: {
				Row: {
					id: string;
					repository_id: string;
					user_id: string;
					narrative_style: string;
					chapters: Json;
					share_token: string | null;
					is_public: boolean;
					created_at: string;
				};
				Insert: {
					id?: string;
					repository_id: string;
					user_id: string;
					narrative_style: string;
					chapters: Json;
					share_token?: string | null;
					is_public?: boolean;
					created_at?: string;
				};
				Update: {
					id?: string;
					repository_id?: string;
					user_id?: string;
					narrative_style?: string;
					chapters?: Json;
					share_token?: string | null;
					is_public?: boolean;
					created_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'stories_repository_id_fkey';
						columns: ['repository_id'];
						referencedRelation: 'repositories';
						referencedColumns: ['id'];
					}
				];
			};
			share_tokens: {
				Row: {
					id: string;
					token: string;
					user_id: string;
					repository_id: string;
					content_type: 'milestones' | 'timeline' | 'recap' | 'story';
					config: Json;
					is_active: boolean;
					view_count: number;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					token: string;
					user_id: string;
					repository_id: string;
					content_type: 'milestones' | 'timeline' | 'recap' | 'story';
					config?: Json;
					is_active?: boolean;
					view_count?: number;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					token?: string;
					user_id?: string;
					repository_id?: string;
					content_type?: 'milestones' | 'timeline' | 'recap' | 'story';
					config?: Json;
					is_active?: boolean;
					view_count?: number;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'share_tokens_user_id_fkey';
						columns: ['user_id'];
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'share_tokens_repository_id_fkey';
						columns: ['repository_id'];
						referencedRelation: 'repositories';
						referencedColumns: ['id'];
					}
				];
			};
		};
		Views: Record<string, never>;
		Functions: {
			deduct_credits: {
				Args: {
					p_user_id: string;
					p_amount: number;
					p_operation_type: string;
					p_repository_id?: string;
					p_description?: string;
				};
				Returns: {
					success: boolean;
					new_balance: number;
					error_message: string | null;
				}[];
			};
			add_credits: {
				Args: {
					p_user_id: string;
					p_amount: number;
					p_transaction_type: string;
					p_stripe_session_id?: string;
					p_stripe_payment_intent_id?: string;
					p_description?: string;
				};
				Returns: {
					success: boolean;
					new_balance: number;
					error_message: string | null;
				}[];
			};
			refund_credits: {
				Args: {
					p_user_id: string;
					p_amount: number;
					p_operation_type: string;
					p_description?: string;
				};
				Returns: {
					success: boolean;
					new_balance: number;
					error_message: string | null;
				}[];
			};
		};
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
}

// Helper types for easier access
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Repository = Database['public']['Tables']['repositories']['Row'];
export type Milestone = Database['public']['Tables']['milestones']['Row'];
export type GitHubInstallation = Database['public']['Tables']['github_installations']['Row'];
export type CreditBalance = Database['public']['Tables']['credit_balances']['Row'];
export type CreditTransaction = Database['public']['Tables']['credit_transactions']['Row'];
export type StripeCustomer = Database['public']['Tables']['stripe_customers']['Row'];
export type DbStory = Database['public']['Tables']['stories']['Row'];
export type DbShareToken = Database['public']['Tables']['share_tokens']['Row'];
