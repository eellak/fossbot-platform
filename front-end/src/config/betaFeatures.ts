export const betaFeatures = {
  stages: true,
  education: true,
  interactive: true,
} as const;

export type BetaFeature = keyof typeof betaFeatures;

export function isBetaFeature(feature: BetaFeature): boolean {
  return betaFeatures[feature];
}
