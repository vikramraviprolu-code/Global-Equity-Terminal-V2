// Single source of truth for app version + feature flags.
// Bump on every shipped change: minor for features, patch for fixes.

export const APP_VERSION = "1.3.0";
export const APP_RELEASE_DATE = "2026-04-29";
export const APP_CODENAME = "Console";

export const FEATURE_FLAGS = {
  newsCatalysts: true,
  portfolio: true,
  alerts: true,
  aiNarrative: true,
  diffMode: true,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;
export const isEnabled = (f: FeatureFlag) => FEATURE_FLAGS[f];
