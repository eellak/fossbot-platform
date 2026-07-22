import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import PublicIcon from '@mui/icons-material/Public';
import { useAuth } from 'src/authentication/AuthProvider';
import { resolveStageAssetUrl, stageAssetBaseUrlFromStageUrl } from 'src/simulator/stages/assets';
import type { MarketplaceStageEntry } from 'src/stages/MarketplaceApi';
import { loadStageFromProvider, type ProviderStageListItem } from 'src/stages/StagesApi';
import { marketplaceFirstPageSnapshot, refreshMarketplaceFirstPage, refreshUserStages, stageListUserKey, subscribeMarketplaceFirstPage, subscribeUserStages, userStagesSnapshot } from 'src/stages/stageListCache';
import { GitHubIdentity, StageCard, StageCardSkeleton } from 'src/stages/StageCard';
import { getGitHubLoginUrl, getGitHubProviderStatus, type GitHubProviderStatus } from 'src/stages/ProviderAuthApi';
import { MARKETPLACE_COPY } from 'src/stages/marketplaceCopy';

export type StageSelectionSource = 'default' | 'github' | 'marketplace';

export interface StageSelection {
  sourceType: StageSelectionSource;
  title: string;
  url?: string;
  repoOwner?: string;
  repoName?: string;
  visibility?: string | null;
  marketplaceEntryPath?: string | null;
  commitSha?: string | null;
}

interface DefaultStageOption {
  title: string;
  description: string;
  image: string;
  url: string;
}

interface CardDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void | Promise<void>;
  onSelectStage?: (stage: StageSelection) => void | Promise<void>;
}

const defaultStages: DefaultStageOption[] = [
  {
    title: 'White Tiles',
    description: 'Good stage to start using the robot, especially the commands that make the robot move in default steps.',
    image: '/js-simulator/stages/white_tiles.png',
    url: '/js-simulator/stages/stage_white_rect.json',
  },
  {
    title: 'Objects on the floor',
    description: 'This stage can be used for obstacle avoidance and object detection exercises.',
    image: '/js-simulator/stages/stage_object.png',
    url: '/js-simulator/stages/stage_object.json',
  },
  {
    title: 'Maze',
    description: 'A simple maze, good for navigation exercises.',
    image: '/js-simulator/stages/stage_maze.png',
    url: '/js-simulator/stages/stage_maze.json',
  },
  {
    title: 'Colors on the floor',
    description: 'An exercise to help kids learn the colors.',
    image: '/js-simulator/stages/stage_colors.png',
    url: '/js-simulator/stages/stage_numbers.json',
  },
  {
    title: 'The Eiffel tower',
    description: 'An example of using 3D models within the simulator.',
    image: '/js-simulator/stages/stage_eiffel.png',
    url: '/js-simulator/stages/stage_eiffel.json',
  },
  {
    title: 'The farm',
    description: "Let's learn about the animals.",
    image: '/js-simulator/stages/stage_animals.png',
    url: '/js-simulator/stages/stage_animals.json',
  },
  {
    title: 'White paper',
    description: 'A stage with a white floor, perfect for drawing.',
    image: '/js-simulator/stages/stage_white_paper.png',
    url: '/js-simulator/stages/stage_white_paper.json',
  },
];

function marketplaceEntryPath(entry: MarketplaceStageEntry): string {
  return `stages/${entry.repoOwner}/${entry.repoName}.json`;
}

function githubRawStageUrl(stage: ProviderStageListItem): string {
  return `https://raw.githubusercontent.com/${stage.repoOwner}/${stage.repoName}/${stage.defaultBranch || 'main'}/stage.json`;
}

function marketplaceRawStageUrl(stage: MarketplaceStageEntry): string {
  return `https://raw.githubusercontent.com/${stage.repoOwner}/${stage.repoName}/${stage.commitSha}/stage.json`;
}

function resolveStageEntryAssets(entry: any, stageUrl: string): any {
  if (!entry || typeof entry !== 'object') return entry;
  const stageAssetBaseUrl = stageAssetBaseUrlFromStageUrl(stageUrl);
  const resolve = (value: unknown) => (
    typeof value === 'string'
      ? resolveStageAssetUrl(value, { stageAssetBaseUrl })
      : value
  );
  const next = { ...entry };
  next.filename = resolve(next.filename);
  next.texture = resolve(next.texture);
  next.source = resolve(next.source);
  if (next.collision && typeof next.collision === 'object') {
    next.collision = { ...next.collision, source: resolve(next.collision.source) };
  }
  return next;
}

async function legacySimulatorStageUrl(stageUrl: string): Promise<string> {
  const response = await fetch(stageUrl);
  if (!response.ok) throw new Error(`Could not load stage JSON: HTTP ${response.status}`);
  const payload = await response.json();
  const config = Array.isArray(payload) ? payload : payload?.config;
  if (!Array.isArray(config)) throw new Error('Stage JSON does not contain a simulator config array.');
  const resolvedConfig = config.map((entry) => resolveStageEntryAssets(entry, stageUrl));
  return URL.createObjectURL(new Blob([JSON.stringify(resolvedConfig)], { type: 'application/json' }));
}

function emitStageSelection(stage: StageSelection): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<StageSelection>('fossbot:stage-selected', { detail: stage }));
}

const CardDialog: React.FC<CardDialogProps> = ({ open, onClose, onSelect, onSelectStage }) => {
  const { token, user } = useAuth();
  const userKey = stageListUserKey(user);
  const [tab, setTab] = useState<StageSelectionSource>('default');
  const [userStages, setUserStages] = useState<ProviderStageListItem[]>([]);
  const [marketplaceStages, setMarketplaceStages] = useState<MarketplaceStageEntry[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [userError, setUserError] = useState('');
  const [marketplaceError, setMarketplaceError] = useState('');
  const [providerStatus, setProviderStatus] = useState<GitHubProviderStatus | null>(null);
  const [providerLoading, setProviderLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab('default');
  }, [open]);

  useEffect(() => {
    if (!open || !token || !userKey) return undefined;
    let active = true;
    setProviderLoading(true);
    getGitHubProviderStatus(token)
      .then((status) => {
        if (!active) return;
        setProviderStatus(status);
        if (status.connected && !status.needsReconnect) void refreshUserStages(userKey, token);
      })
      .catch((error) => { if (active) setUserError(error instanceof Error ? error.message : 'Could not check the GitHub connection.'); })
      .finally(() => { if (active) setProviderLoading(false); });
    const sync = () => {
      const snapshot = userStagesSnapshot(userKey);
      setUserStages(snapshot.data || []);
      setUserLoading(snapshot.refreshing && !snapshot.data);
      setUserError(snapshot.refreshError || '');
    };
    sync();
    const unsubscribe = subscribeUserStages(userKey, sync);
    return () => { active = false; unsubscribe(); };
  }, [open, token, userKey]);

  const handleConnect = async () => {
    if (!token) return;
    setConnecting(true);
    setUserError('');
    try {
      window.location.assign(await getGitHubLoginUrl(token));
    } catch (error) {
      setUserError(error instanceof Error ? error.message : 'Could not start GitHub connection.');
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    const sync = () => {
      const snapshot = marketplaceFirstPageSnapshot();
      setMarketplaceStages(snapshot.data?.stages || []);
      setMarketplaceLoading(snapshot.refreshing && !snapshot.data);
      setMarketplaceError(snapshot.refreshError || '');
    };
    sync();
    const unsubscribe = subscribeMarketplaceFirstPage(sync);
    void refreshMarketplaceFirstPage();
    return unsubscribe;
  }, [open]);

  const tabCounts = useMemo(() => ({
    default: defaultStages.length,
    github: userStages.length,
    marketplace: marketplaceStages.length,
  }), [marketplaceStages.length, userStages.length]);

  const handleDefaultSelect = async (stage: DefaultStageOption) => {
    const selection = { sourceType: 'default' as const, title: stage.title, url: stage.url };
    emitStageSelection(selection);
    if (onSelectStage) await onSelectStage(selection);
    await onSelect(stage.url);
    onClose();
  };

  const handleUserSelect = async (stage: ProviderStageListItem) => {
    const stageUrl = githubRawStageUrl(stage);
    const selection = {
      sourceType: 'github' as const,
      title: stage.title || stage.repoName,
      url: stage.private ? stage.repoUrl : stageUrl,
      repoOwner: stage.repoOwner,
      repoName: stage.repoName,
      visibility: stage.visibility || (stage.private ? 'private' : 'public'),
    };
    emitStageSelection(selection);
    if (onSelectStage) {
      await onSelectStage(selection);
    } else {
      try {
        if (stage.private && token) {
          // Private repos can't use raw.githubusercontent.com; load via backend API
          const loaded = await loadStageFromProvider(token, stage.repoOwner, stage.repoName);
          const blob = new Blob([JSON.stringify(loaded.record.config)], { type: 'application/json' });
          await onSelect(URL.createObjectURL(blob));
        } else {
          await onSelect(await legacySimulatorStageUrl(stageUrl));
        }
      } catch (error) {
        setUserError(error instanceof Error ? error.message : 'Could not prepare this GitHub stage for the simulator.');
        return;
      }
    }
    onClose();
  };

  const handleMarketplaceSelect = async (stage: MarketplaceStageEntry) => {
    const stageUrl = marketplaceRawStageUrl(stage);
    const selection = {
      sourceType: 'marketplace' as const,
      title: stage.title,
      url: stageUrl,
      repoOwner: stage.repoOwner,
      repoName: stage.repoName,
      visibility: 'public',
      marketplaceEntryPath: marketplaceEntryPath(stage),
      commitSha: stage.commitSha,
    };
    emitStageSelection(selection);
    if (onSelectStage) {
      await onSelectStage(selection);
    } else {
      try {
        await onSelect(await legacySimulatorStageUrl(stageUrl));
      } catch (error) {
        setMarketplaceError(error instanceof Error ? error.message : 'Could not prepare this marketplace stage for the simulator.');
        return;
      }
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Select a stage</DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(_event, value) => setTab(value)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab value="default" label={<span>Built-in <Typography component="span" variant="caption" color="text.secondary">{tabCounts.default}</Typography></span>} />
          <Tab value="github" label={<span>{MARKETPLACE_COPY.myStages} <Typography component="span" variant="caption" color="text.secondary">{tabCounts.github}</Typography></span>} />
          <Tab value="marketplace" label={<span>{MARKETPLACE_COPY.marketplace} <Typography component="span" variant="caption" color="text.secondary">{tabCounts.marketplace}</Typography></span>} />
        </Tabs>

        {tab === 'default' && (
          <Grid container spacing={2}>
            {defaultStages.map((stage) => (
              <Grid key={stage.url} item xs={12} sm={6} md={3}>
                <StageCard title={stage.title} description={stage.description} previewUrl={stage.image} actionLabel="Select" onAction={() => handleDefaultSelect(stage)} />
              </Grid>
            ))}
          </Grid>
        )}

        {tab === 'github' && (
          <Stack spacing={2}>
            {(!token || (!providerLoading && (!providerStatus?.connected || providerStatus.needsReconnect))) && (
              <Box sx={{ py: 3, textAlign: 'center' }}><Typography variant="subtitle1" fontWeight={800}>Connect GitHub to use your saved stages.</Typography>{token && <Button variant="contained" startIcon={connecting ? undefined : <GitHubIcon />} onClick={handleConnect} disabled={connecting} sx={{ mt: 2 }}>{connecting ? 'Connecting…' : MARKETPLACE_COPY.connectGitHub}</Button>}</Box>
            )}
            {userError && <Alert severity={userStages.length ? "warning" : "error"}>{userError}</Alert>}
            {userLoading || providerLoading ? (
              <Grid container spacing={2}>{Array.from({ length: 6 }).map((_, item) => <Grid key={item} item xs={12} sm={6} md={4}><StageCardSkeleton /></Grid>)}</Grid>
            ) : providerStatus?.connected && !providerStatus.needsReconnect && userStages.length ? (
              <Grid container spacing={2}>
                {userStages.map((stage) => (
                    <Grid key={`${stage.repoOwner}/${stage.repoName}`} item xs={12} sm={6} md={4}>
                      <StageCard
                        title={stage.title || stage.repoName}
                        description={stage.description || `${stage.repoOwner}/${stage.repoName}`}
                        metadata={<GitHubIdentity username={stage.repoOwner} />}
                        badges={<Chip size="small" label={stage.private ? 'Private' : 'Public'} color={stage.private ? 'warning' : 'success'} variant="outlined" />}
                        actionLabel="Select"
                        onAction={() => handleUserSelect(stage)}
                      />
                    </Grid>
                ))}
              </Grid>
            ) : token && providerStatus?.connected && !providerStatus.needsReconnect ? (
              <Box sx={{ py: 3, textAlign: 'center' }}><Typography variant="subtitle1" fontWeight={800}>No saved stages yet</Typography><Typography variant="body2" color="text.secondary">Create one in Stage Builder.</Typography></Box>
            ) : null}
          </Stack>
        )}

        {tab === 'marketplace' && (
          <Stack spacing={2}>
            {marketplaceError && <Alert severity={marketplaceStages.length ? "warning" : "error"}>{marketplaceError}</Alert>}
            {marketplaceLoading ? (
              <Grid container spacing={2}>{Array.from({ length: 6 }).map((_, item) => <Grid key={item} item xs={12} sm={6} md={4}><StageCardSkeleton /></Grid>)}</Grid>
            ) : marketplaceStages.length ? (
              <Grid container spacing={2}>
                {marketplaceStages.map((stage) => (
                  <Grid key={`${stage.repoOwner}/${stage.repoName}`} item xs={12} sm={6} md={4}>
                    <StageCard
                      title={stage.title}
                      description={stage.description || `${stage.repoOwner}/${stage.repoName}`}
                      previewUrl={stage.previewUrl}
                      metadata={<GitHubIdentity username={stage.author?.githubUsername || stage.repoOwner} />}
                      badges={<Chip size="small" icon={<PublicIcon />} label={stage.badges?.verified ? 'Verified' : 'Published'} color={stage.badges?.verified ? 'primary' : 'default'} variant="outlined" />}
                      actionLabel="Select"
                      onAction={() => handleMarketplaceSelect(stage)}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Box sx={{ py: 3, textAlign: 'center' }}><Typography variant="subtitle1" fontWeight={800}>No marketplace stages yet</Typography><Typography variant="body2" color="text.secondary">Check again after stages have been published.</Typography></Box>
            )}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CardDialog;
