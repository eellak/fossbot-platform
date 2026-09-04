export const MARKETPLACE_COPY = {
  stageLibrary: 'Stage library',
  myStages: 'My stages',
  builtInStages: 'Built-in stages',
  marketplace: 'Marketplace',
  published: 'Published',
  unpublished: 'Unpublished',
  connectGitHub: 'Connect GitHub',
  saveToGitHub: 'Save to GitHub',
  openFromGitHub: 'Open from GitHub',
  publishStage: 'Publish stage',
  forkStage: 'Fork stage',
} as const;

export const MARKETPLACE_REPORT_CATEGORIES = [
  { value: 'broken_misleading', label: 'Broken or misleading' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'copyright_attribution', label: 'Copyright or attribution' },
  { value: 'safety', label: 'Safety' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Other' },
] as const;

export function marketplaceReportCategoryLabel(value: string): string {
  return MARKETPLACE_REPORT_CATEGORIES.find((category) => category.value === value)?.label || value.replace(/_/g, ' ');
}
