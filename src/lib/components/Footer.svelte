<script lang="ts">
	import logo from '$lib/assets/logo.png';
</script>

<footer class="border-t border-border/40 bg-background">
	<div class="mx-auto max-w-6xl px-6 py-12">
		<div class="grid gap-8 md:grid-cols-5">
			<!-- Logo & Tagline -->
			<div class="md:col-span-2">
				<div class="flex items-center gap-2">
					<img src={logo} alt="SumGit" class="h-8 w-8 rounded-md" />
					<span class="text-xl font-bold tracking-tight">SumGit</span>
				</div>
				<p class="mt-3 text-sm text-muted-foreground">
					Share your app's journey with the world.
				</p>
			</div>

			<!-- Links -->
			<div>
				<h4 class="mb-3 text-sm font-semibold">Links</h4>
				<ul class="space-y-2 text-sm text-muted-foreground">
					<li>
						<a href="/dashboard" class="transition-colors hover:text-foreground">Dashboard</a>
					</li>
					<li>
						<a
							href="https://github.com/apps/sumgitapp"
							target="_blank"
							rel="noopener noreferrer"
							class="transition-colors hover:text-foreground"
						>
							GitHub App
						</a>
					</li>
				</ul>
			</div>

			<!-- Legal -->
			<div>
				<h4 class="mb-3 text-sm font-semibold">Legal</h4>
				<ul class="space-y-2 text-sm text-muted-foreground">
					<li>
						<a href="/terms" class="transition-colors hover:text-foreground">Terms of Service</a>
					</li>
					<li>
						<a href="/privacy" class="transition-colors hover:text-foreground">Privacy Policy</a>
					</li>
				</ul>
			</div>

			<!-- More by CodeDeen -->
			<div>
				<h4 class="mb-3 text-sm font-semibold">More by CodeDeen</h4>
				<ul class="space-y-2 text-sm text-muted-foreground">
					<li>
						<a
							href="https://codedeen.com"
							target="_blank"
							rel="noopener noreferrer"
							class="transition-colors hover:text-foreground"
						>
							CodeDeen
						</a>
					</li>
					<li>
						<a
							href="https://svelteship.com"
							target="_blank"
							rel="noopener noreferrer"
							class="transition-colors hover:text-foreground"
						>
							SvelteShip
						</a>
					</li>
					<li>
						<a
							href="https://fastbatch.app"
							target="_blank"
							rel="noopener noreferrer"
							class="transition-colors hover:text-foreground"
						>
							FastBatch
						</a>
					</li>
					<li>
						<a
							href="https://postchad.com"
							target="_blank"
							rel="noopener noreferrer"
							class="transition-colors hover:text-foreground"
						>
							PostChad
						</a>
					</li>
					<li>
						<a
							href="https://islamjeopardy.com"
							target="_blank"
							rel="noopener noreferrer"
							class="transition-colors hover:text-foreground"
						>
							IslamJeopardy
						</a>
					</li>
				</ul>
			</div>
		</div>

		<!-- Copyright -->
		<div class="mt-12 border-t border-border/40 pt-8 text-center text-sm text-muted-foreground">
			<p>Copyright © {new Date().getFullYear()} - All rights reserved</p>
		</div>
	</div>
</footer>
