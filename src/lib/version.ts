// Single source of truth for app version + feature flags.
// Bump on every shipped change: minor for features, patch for fixes.

export const APP_VERSION = "1.12.0";
export const APP_RELEASE_DATE = "2026-05-03";
export const APP_CODENAME = "Tasks";

export const FEATURE_FLAGS = {
  newsCatalysts: true,
  portfolio: true,
  alerts: true,
  aiNarrative: true,
  diffMode: true,
  askTerminal: true,
  morningBrief: true,
  thesisTracker: true,
  scheduledBrief: true,
  thesisAlerts: true,
  emailDelivery: true,
  watchlistSharing: true,
  multiProviderFallbacks: true,
  providerBadges: true,
  userGuide: true,
  tasks: true,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;
export const isEnabled = (f: FeatureFlag) => FEATURE_FLAGS[f];
