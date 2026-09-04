/**
 * Check Avi Builder releases from the product repository.
 */

const AVI_BUILDER_REPOSITORY = process.env.AVI_BUILDER_REPOSITORY || 'k652gzv77y/avi-builder';

export interface CheckUpdatesResult {
  available: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseUrl?: string;
  releaseNotes?: string | null;
  publishedAt?: string | null;
  updateInstructions?: {
    method: 'github-sync' | 'git-pull' | 'manual';
    steps: string[];
    autoSyncUrl?: string;
  };
  message?: string;
  error?: string;
}

/**
 * Simple version comparison (semantic versioning)
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aNum = aParts[i] || 0;
    const bNum = bParts[i] || 0;

    if (aNum > bNum) return 1;
    if (aNum < bNum) return -1;
  }

  return 0;
}

/**
 * Check for updates from the Avi Builder repository.
 */
export async function checkForUpdates(currentVersion: string): Promise<CheckUpdatesResult> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${AVI_BUILDER_REPOSITORY}/releases/latest`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Avi-Builder-Update-Checker',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return {
        available: false,
        currentVersion,
        message: 'Unable to check for updates',
      };
    }

    const release = await response.json();
    const latestVersion = release.tag_name?.replace(/^v/, '') || '1.0.0';

    const hasUpdate =
      latestVersion !== currentVersion &&
      compareVersions(latestVersion, currentVersion) > 0;

    // Detect deployment environment
    const isVercel = process.env.VERCEL === '1';
    const vercelGitProvider = process.env.VERCEL_GIT_PROVIDER;
    const vercelGitRepoOwner = process.env.VERCEL_GIT_REPO_OWNER;
    const vercelGitRepoSlug = process.env.VERCEL_GIT_REPO_SLUG;

    const repositoryUrl = vercelGitProvider === 'github' && vercelGitRepoOwner && vercelGitRepoSlug
      ? `https://github.com/${vercelGitRepoOwner}/${vercelGitRepoSlug}`
      : `https://github.com/${AVI_BUILDER_REPOSITORY}`;
    const updateMethod = isVercel ? 'github-sync' : 'git-pull';
    const steps = [
      `Open <a href="${repositoryUrl}" target="_blank" class="underline font-semibold">the Avi Builder repository</a>`,
      'Merge or pull the release you want to deploy',
      'Deploy the selected branch through Vercel',
      'Reload Avi Builder after deployment to apply any migrations',
    ];

    return {
      available: hasUpdate,
      currentVersion,
      latestVersion,
      releaseUrl: release.html_url,
      releaseNotes: release.body,
      publishedAt: release.published_at,
      updateInstructions: {
        method: updateMethod,
        steps,
        autoSyncUrl: repositoryUrl,
      },
    };
  } catch (error) {
    console.error('Failed to check for updates:', error);
    return {
      available: false,
      currentVersion,
      error: 'Failed to check for updates',
    };
  }
}
