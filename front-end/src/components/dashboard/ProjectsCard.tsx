import React from 'react';
import DashboardCard from '../shared/DashboardCardWithChildren';
import Fab from '@mui/material/Fab';
import PageContainer from 'src/components/container/PageContainer';
import NewProjectDialog from './NewProjectDialog';

import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  InputAdornment,
  ListItemText,
  Menu,
  MenuItem,
  Pagination,
  Select,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAdd } from '@fortawesome/free-solid-svg-icons';
import {
  IconCode,
  IconCodeDots,
  IconDotsVertical,
  IconLayoutGrid,
  IconLayoutList,
  IconMap,
  IconPlus,
  IconPuzzle,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useAuth } from 'src/authentication/AuthProvider';
import type { Project } from 'src/authentication/AuthInterfaces';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../notifications/NotificationProvider';

const LIST_PROJECTS_PER_PAGE = 5;
const CARD_PROJECTS_PER_PAGE = 6;
const VIEW_MODE_STORAGE_KEY = 'fossbot-projects-view-mode';

const readStoredViewMode = (): 'list' | 'cards' => {
  try {
    return window.localStorage.getItem(VIEW_MODE_STORAGE_KEY) === 'cards' ? 'cards' : 'list';
  } catch {
    return 'list';
  }
};

const ProjectsCard = ({ previewAppearance = true }: { previewAppearance?: boolean }) => {
  const { t } = useTranslation();

  const auth = useAuth();
  const [showDrawer, setShowDrawer] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'cards'>(readStoredViewMode);
  const [projectMenu, setProjectMenu] = useState<{ anchor: HTMLElement; projectId: number; projectName: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const { notify } = useNotifications();

  const handleDrawerClose = () => {
    setShowDrawer(false);
  };

  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (auth.authStatus === 'loading') {
      return;
    }

    if (auth.authStatus !== 'authenticated' || !auth.token) {
      setLoading(false);
      return;
    }

    const fetchProjects = async () => {
      setLoading(true);
      try {
        const fetchedProjects = await auth.getProjectsAction();

        if (fetchedProjects) {
          setProjects(fetchedProjects);
          setPage(1);
        }
      } catch (error) {
        notify(t('alertMessages.projectsFetchError'), { severity: 'error' });
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [auth.authStatus, auth.token]);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // Storage can be unavailable; the in-memory preference still applies.
    }
  }, [viewMode]);

  const confirmDeleteProject = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeleteBusy(true);
    try {
      const success = await auth.deleteProjectByIdAction(target.id);
      if (success) {
        setProjects((prevProjects) => prevProjects.filter((project) => project.id !== target.id));
        notify(t('alertMessages.projectDeleted'), { severity: 'success' });
        setPendingDelete(null);
      } else {
        notify(t('alertMessages.projectDeleteError'), { severity: 'error' });
      }
    } catch (error) {
      notify(t('alertMessages.projectDeleteError'), { severity: 'error' });
      console.error('Error deleting project:', error);
    } finally {
      setDeleteBusy(false);
    }
  };

  const getProjectUrl = (project: Project) => (
    project.project_type === 'python' ? `/monaco-page/${project.id}` : `/blockly-page/${project.id}`
  );

  const getProjectMetric = (project: Project) => {
    if (project.project_type === 'python') {
      const lineCount = (project.code || '')
        .split(/\r\n?|\n/)
        .filter((line) => line.trim().length > 0).length;
      return t('projects-card.lines', { count: lineCount });
    }

    const blockCount = ((project.code || '').match(/<block\b/g) || []).length;
    return t('projects-card.blocks', { count: blockCount });
  };

  const getStageTitle = (project: Project) => {
    const stageReference = project.stageReference;
    if (!stageReference) return t('projects-card.defaultStage');
    return stageReference.title || stageReference.repoName || t('projects-card.linkedStage');
  };

  const query = search.trim().toLocaleLowerCase();
  const stageOptions = Array.from(new Set(projects.map(getStageTitle))).sort((a, b) => a.localeCompare(b));
  const filteredProjects = projects.filter((project) => {
      const projectType = project.project_type === 'python' ? 'Python' : t('blockly');
      const searchableText = [
        project.name,
        project.description,
        projectType,
        getStageTitle(project),
      ].filter(Boolean).join(' ').toLocaleLowerCase();

      return (
        (!query || searchableText.includes(query))
        && (typeFilter === 'all' || project.project_type === typeFilter)
        && (stageFilter === 'all' || getStageTitle(project) === stageFilter)
      );
    });

  const hasActiveFilters = Boolean(query || typeFilter !== 'all' || stageFilter !== 'all');
  const clearFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setStageFilter('all');
    setPage(1);
  };

  const projectsPerPage = viewMode === 'cards' ? CARD_PROJECTS_PER_PAGE : LIST_PROJECTS_PER_PAGE;
  const pageCount = Math.max(1, Math.ceil(filteredProjects.length / projectsPerPage));
  const pageStart = (page - 1) * projectsPerPage;
  const visibleProjects = filteredProjects.slice(pageStart, pageStart + projectsPerPage);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, pageCount));
  }, [pageCount]);

  return (
    <PageContainer>
      <NewProjectDialog
        showDrawer={showDrawer}
        handleDrawerClose={handleDrawerClose}
        isDescriptionDisabled={false}
        editorInitialValue='python'
        code=''
      />
      <DashboardCard
        title={t('projects-card.card-title')}
        subtitle={t('projects-card.subtitle')}
        compact={previewAppearance}
        action={
          previewAppearance && !loading && projects.length === 0 ? undefined : previewAppearance ? <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={() => setShowDrawer(true)} sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{t('newProject')}</Button> : <Fab color="success" aria-label="add" onClick={() => setShowDrawer(true)}>
            <FontAwesomeIcon icon={faAdd} size="2x" />
          </Fab>
        }
      >
        {loading ? (
          <Stack spacing={1.25} aria-busy="true" aria-label={t('loading')}>
            {Array.from({ length: viewMode === 'cards' ? 6 : 4 }).map((_, index) => (
              <Skeleton key={index} variant="rounded" height={viewMode === 'cards' ? 96 : 64} />
            ))}
          </Stack>
        ) : previewAppearance && projects.length === 0 ? (
          <Box sx={{ py: 1 }}>
            <Typography variant="subtitle2" fontWeight={600}>{t('projects-card.emptyTitle')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('projects-card.emptyDescription')}
            </Typography>
            <Button
              variant="contained"
              startIcon={<IconPlus size={18} />}
              onClick={() => setShowDrawer(true)}
              sx={{ mt: 2 }}
            >
              {t('newProject')}
            </Button>
          </Box>
        ) : (
          <Box>
            {projects.length > 0 && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
                <TextField
                  size="small"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder={t('projects-card.search')}
                  inputProps={{ 'aria-label': t('projects-card.search') }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <IconSearch size={18} aria-hidden="true" />
                      </InputAdornment>
                    ),
                    endAdornment: search ? (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          edge="end"
                          aria-label={t('projects-card.clearSearch')}
                          onClick={() => {
                            setSearch('');
                            setPage(1);
                          }}
                        >
                          <IconX size={17} />
                        </IconButton>
                      </InputAdornment>
                    ) : undefined,
                  }}
                  sx={{ flex: 1, minWidth: 0 }}
                />
                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150 } }}>
                  <InputLabel id="projects-type-filter-label">{t('projects-card.typeFilter')}</InputLabel>
                  <Select
                    labelId="projects-type-filter-label"
                    value={typeFilter}
                    label={t('projects-card.typeFilter')}
                    onChange={(event) => {
                      setTypeFilter(event.target.value);
                      setPage(1);
                    }}
                  >
                    <MenuItem value="all">{t('projects-card.allTypes')}</MenuItem>
                    <MenuItem value="python">Python</MenuItem>
                    <MenuItem value="blockly">{t('blockly')}</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150 } }}>
                  <InputLabel id="projects-stage-filter-label">{t('projects-card.stageFilter')}</InputLabel>
                  <Select
                    labelId="projects-stage-filter-label"
                    value={stageFilter}
                    label={t('projects-card.stageFilter')}
                    onChange={(event) => {
                      setStageFilter(event.target.value);
                      setPage(1);
                    }}
                  >
                    <MenuItem value="all">{t('projects-card.allStages')}</MenuItem>
                    {stageOptions.map((stage) => <MenuItem key={stage} value={stage}>{stage}</MenuItem>)}
                  </Select>
                </FormControl>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={viewMode}
                  onChange={(_, nextView) => {
                    if (!nextView) return;
                    setViewMode(nextView);
                    setPage(1);
                  }}
                  aria-label={t('projects-card.viewMode')}
                  sx={{ alignSelf: { xs: 'flex-end', sm: 'center' }, ml: { xs: 0, sm: 'auto' } }}
                >
                  <ToggleButton value="list" aria-label={t('projects-card.listView')} title={t('projects-card.listView')}>
                    <IconLayoutList size={18} />
                  </ToggleButton>
                  <ToggleButton value="cards" aria-label={t('projects-card.cardView')} title={t('projects-card.cardView')}>
                    <IconLayoutGrid size={18} />
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            )}

            {projects.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('projects-card.noProjectsFound')}
              </Typography>
            ) : filteredProjects.length === 0 ? (
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <Typography variant="body2" fontWeight={600}>
                  {t(hasActiveFilters ? 'projects-card.noSearchResults' : 'projects-card.noProjectsFound')}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  {t('projects-card.tryAnotherSearch')}
                </Typography>
                <Button
                  size="small"
                  onClick={clearFilters}
                  sx={{ mt: 1 }}
                >
                  {t('projects-card.clearFilters')}
                </Button>
              </Box>
            ) : (
              <Stack
                spacing={viewMode === 'cards' ? 0 : 0.5}
                sx={viewMode === 'cards' ? {
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
                  gap: 1.25,
                } : undefined}
              >
                {visibleProjects.map((project) => {
                  const isPython = project.project_type === 'python';
                  const projectType = isPython ? 'Python' : t('blockly');

                  return (
                    <Stack
                      key={project.id}
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={viewMode === 'cards' ? {
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 1.25,
                        alignItems: 'stretch',
                      } : { py: 0.25 }}
                    >
                      <ButtonBase
                        component={RouterLink}
                        to={getProjectUrl(project)}
                        aria-label={t('projects-card.openProject', { title: project.name })}
                        sx={{
                          minWidth: 0,
                          flex: 1,
                          justifyContent: 'flex-start',
                          alignItems: viewMode === 'cards' ? 'flex-start' : 'center',
                          textAlign: 'left',
                          borderRadius: 1,
                          p: 0.5,
                          ml: -0.5,
                          '&:hover': { bgcolor: 'action.hover' },
                          '&:hover .project-title': { color: 'primary.main', textDecoration: 'underline' },
                        }}
                      >
                        <Box
                          className="visual-language-supporting-panel"
                          sx={{
                            width: 36,
                            height: 36,
                            mr: 1.5,
                            flexShrink: 0,
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: 'primary.light',
                            color: 'primary.main',
                          }}
                          aria-hidden="true"
                        >
                          {isPython ? <IconCode size={20} /> : <IconPuzzle size={20} />}
                        </Box>

                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography className="project-title" variant="body2" color="primary.main" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
                            {project.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, overflowWrap: 'anywhere' }}>
                            {project.description || '—'}
                          </Typography>
                          <Stack direction="row" alignItems="center" gap={{ xs: 1, sm: 1.5 }} flexWrap="wrap" sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                              {projectType}
                            </Typography>
                            <Stack direction="row" spacing={0.5} alignItems="center" color="text.secondary">
                              <IconCodeDots size={15} aria-hidden="true" />
                              <Typography variant="caption">{getProjectMetric(project)}</Typography>
                            </Stack>
                            <Stack direction="row" spacing={0.5} alignItems="center" color="text.secondary" sx={{ minWidth: 0 }}>
                              <IconMap size={15} aria-hidden="true" />
                              <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
                                {t('projects-card.stage')}: {getStageTitle(project)}
                              </Typography>
                            </Stack>
                          </Stack>
                        </Box>
                      </ButtonBase>

                      <Tooltip title={t('projects-card.actions', { title: project.name })}>
                        <IconButton
                          aria-label={t('projects-card.actions', { title: project.name })}
                          aria-haspopup="menu"
                          aria-expanded={projectMenu?.projectId === project.id}
                          onClick={(event) => setProjectMenu({ anchor: event.currentTarget, projectId: project.id, projectName: project.name })}
                          sx={{ width: 44, height: 44, alignSelf: 'flex-start' }}
                        >
                          <IconDotsVertical size={18} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  );
                })}
              </Stack>
            )}

            {filteredProjects.length > projectsPerPage && (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'center', sm: 'center' }}
                justifyContent="space-between"
                spacing={1}
                sx={{ mt: 1.25, pt: 0.5 }}
              >
                <Typography variant="caption" color="text.secondary">
                  {t('projects-card.showing', {
                    start: pageStart + 1,
                    end: Math.min(pageStart + projectsPerPage, filteredProjects.length),
                    count: filteredProjects.length,
                  })}
                </Typography>
                <Pagination
                  count={pageCount}
                  page={page}
                  onChange={(_, nextPage) => setPage(nextPage)}
                  size="small"
                  color="primary"
                  siblingCount={0}
                  aria-label={t('projects-card.pagination')}
                />
              </Stack>
            )}
          </Box>
        )}
        <Menu
          anchorEl={projectMenu?.anchor || null}
          open={Boolean(projectMenu)}
          onClose={() => setProjectMenu(null)}
        >
          <MenuItem
            onClick={() => {
              if (!projectMenu) return;
              const { projectId, projectName } = projectMenu;
              setProjectMenu(null);
              setPendingDelete({ id: projectId, name: projectName });
            }}
            sx={{ color: 'error.main' }}
          >
            <Box component="span" sx={{ width: 18, mr: 1.25, display: 'inline-flex', justifyContent: 'center', flexShrink: 0 }}>
              <IconTrash size={18} />
            </Box>
            <ListItemText>{t('projects-card.delete')}</ListItemText>
          </MenuItem>
        </Menu>
        <Dialog
          open={Boolean(pendingDelete)}
          onClose={deleteBusy ? undefined : () => setPendingDelete(null)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>{t('projects-card.deleteTitle')}</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              {pendingDelete ? t('projects-card.deleteBody', { title: pendingDelete.name }) : ''}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button disabled={deleteBusy} onClick={() => setPendingDelete(null)}>{t('cancel')}</Button>
            <Button
              color="error"
              variant="contained"
              disabled={deleteBusy}
              startIcon={deleteBusy ? <CircularProgress color="inherit" size={16} /> : undefined}
              onClick={() => void confirmDeleteProject()}
            >
              {deleteBusy ? t('projects-card.deleting') : t('projects-card.deleteConfirm')}
            </Button>
          </DialogActions>
        </Dialog>
      </DashboardCard>
    </PageContainer>
  );
};

export default ProjectsCard;
