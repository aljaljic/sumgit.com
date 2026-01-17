<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import logo from '$lib/assets/logo.png';
	import Footer from '$lib/components/Footer.svelte';
</script>

<div class="flex min-h-screen flex-col">
	<!-- Header -->
	<header class="border-b border-border/40 px-6 py-4">
		<div class="mx-auto flex max-w-6xl items-center justify-between">
			<a href="/" class="flex items-center gap-2">
				<img src={logo} alt="sumgit" class="h-8 w-8 rounded-md" />
				<span class="text-xl font-bold tracking-tight">sumgit</span>
			</a>
			<Button href="/" variant="ghost" class="gap-2">
				<ArrowLeft class="h-4 w-4" />
				Back
			</Button>
		</div>
	</header>

	<!-- Main content -->
	<main class="flex-1 px-6 py-12">
		<div class="mx-auto max-w-3xl">
			<h1 class="mb-2 text-3xl font-bold">Privacy Policy</h1>
			<p class="mb-8 text-sm text-muted-foreground">Last updated: January 2025</p>

			<div class="space-y-8 text-muted-foreground">
				<section>
					<h2 class="mb-3 text-xl font-semibold text-foreground">1. Introduction</h2>
					<p>
						sumgit ("we", "our", or "us") is committed to protecting your privacy. This Privacy
						Policy explains how we collect, use, and safeguard your information when you use our
						service.
					</p>
				</section>

				<section>
					<h2 class="mb-3 text-xl font-semibold text-foreground">2. Information We Collect</h2>
					<p class="mb-3">We collect the following types of information:</p>
					<ul class="list-inside list-disc space-y-2 pl-4">
						<li>
							<strong class="text-foreground">GitHub Account Data:</strong> Your GitHub username, email,
							and profile information provided through GitHub OAuth
						</li>
						<li>
							<strong class="text-foreground">Repository Metadata:</strong> Repository names, descriptions,
							commit messages, timestamps, and author information
						</li>
						<li>
							<strong class="text-foreground">Usage Data:</strong> Information about how you interact
							with our Service, including pages visited and features used
						</li>
					</ul>
				</section>

				<section>
					<h2 class="mb-3 text-xl font-semibold text-foreground">3. What We Do NOT Collect</h2>
					<p class="mb-3">We explicitly do not collect or store:</p>
					<ul class="list-inside list-disc space-y-2 pl-4">
						<li>Your source code or file contents</li>
						<li>Private repository content beyond commit metadata</li>
						<li>GitHub access tokens (we use OAuth sessions)</li>
						<li>Payment information (we use third-party payment processors)</li>
					</ul>
				</section>

				<section>
					<h2 class="mb-3 text-xl font-semibold text-foreground">4. How We Use Your Information</h2>
					<p class="mb-3">We use collected information to:</p>
					<ul class="list-inside list-disc space-y-2 pl-4">
						<li>Provide and maintain the Service</li>
						<li>Analyze your commit history to identify milestones</li>
						<li>Generate AI-powered summaries of your development progress</li>
						<li>Improve and optimize our Service</li>
						<li>Communicate with you about your account or the Service</li>
					</ul>
				</section>

				<section>
					<h2 class="mb-3 text-xl font-semibold text-foreground">5. Data Storage and Security</h2>
					<p>
						Your data is stored securely using Supabase, which provides enterprise-grade security
						including encryption at rest and in transit. We implement appropriate technical and
						organizational measures to protect your personal information against unauthorized access,
						alteration, disclosure, or destruction.
					</p>
				</section>

				<section>
					<h2 class="mb-3 text-xl font-semibold text-foreground">6. Third-Party Services</h2>
					<p class="mb-3">We use the following third-party services:</p>
					<ul class="list-inside list-disc space-y-2 pl-4">
						<li>
							<strong class="text-foreground">GitHub:</strong> For authentication and repository access
						</li>
						<li>
							<strong class="text-foreground">Supabase:</strong> For data storage and authentication
						</li>
						<li>
							<strong class="text-foreground">OpenAI:</strong> For AI-powered commit analysis (only commit
							metadata is shared)
						</li>
						<li>
							<strong class="text-foreground">Cloudflare:</strong> For hosting and content delivery
						</li>
					</ul>
				</section>

				<section>
					<h2 class="mb-3 text-xl font-semibold text-foreground">7. Data Retention</h2>
					<p>
						We retain your data for as long as your account is active. You can request deletion of
						your data at any time by disconnecting your GitHub account and contacting us. Upon
						deletion request, we will remove your personal data within 30 days, except where
						retention is required by law.
					</p>
				</section>

				<section>
					<h2 class="mb-3 text-xl font-semibold text-foreground">8. Your Rights</h2>
					<p class="mb-3">You have the right to:</p>
					<ul class="list-inside list-disc space-y-2 pl-4">
						<li>Access the personal data we hold about you</li>
						<li>Request correction of inaccurate data</li>
						<li>Request deletion of your data</li>
						<li>Revoke GitHub access permissions at any time</li>
						<li>Export your data in a portable format</li>
					</ul>
				</section>

				<section>
					<h2 class="mb-3 text-xl font-semibold text-foreground">9. Cookies</h2>
					<p>
						We use essential cookies to maintain your session and authentication state. We do not
						use tracking cookies or third-party advertising cookies. You can control cookie settings
						through your browser preferences.
					</p>
				</section>

				<section>
					<h2 class="mb-3 text-xl font-semibold text-foreground">10. Changes to This Policy</h2>
					<p>
						We may update this Privacy Policy from time to time. We will notify you of any changes
						by posting the new Privacy Policy on this page and updating the "Last updated" date.
					</p>
				</section>

				<section>
					<h2 class="mb-3 text-xl font-semibold text-foreground">11. Contact Us</h2>
					<p>
						If you have questions about this Privacy Policy or wish to exercise your data rights,
						please contact us at
						<a href="mailto:support@codedeen.com" class="text-primary hover:underline">
							support@codedeen.com
						</a>.
					</p>
				</section>
			</div>
		</div>
	</main>

	<Footer />
</div>
