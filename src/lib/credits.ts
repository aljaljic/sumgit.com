export const CREDIT_COSTS = {
	quick_analyze: 1,
	timeline_analyze: 5,
	generate_story: 10,
	generate_recap: 3
} as const;

export type OperationType = keyof typeof CREDIT_COSTS;

export const CREDIT_PACKAGES = [
	{ id: 'pack_10', credits: 10, price: 500, priceDisplay: '$5' },
	{ id: 'pack_50', credits: 50, price: 2000, priceDisplay: '$20' },
	{ id: 'pack_100', credits: 100, price: 3500, priceDisplay: '$35' }
] as const;

export type CreditPackage = (typeof CREDIT_PACKAGES)[number];

export function getPackageById(id: string): CreditPackage | undefined {
	return CREDIT_PACKAGES.find((p) => p.id === id);
}

export function formatCredits(credits: number): string {
	return `${credits} credit${credits === 1 ? '' : 's'}`;
}
