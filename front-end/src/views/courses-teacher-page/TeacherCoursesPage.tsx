import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, Menu, MenuItem, Paper, Skeleton, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { IconDotsVertical, IconPlus, IconSchool, IconSearch } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider';
import { addLesson, archiveCourse, createCourse, listAuthoredCourses, readCourseDraft } from 'src/courses/CoursesApi';
import type { CourseSummary } from 'src/courses/types';
import ClassGroupsTeacherPage from '../class-groups-teacher-page/ClassGroupsTeacherPage';
import { pageTabsSx, TabbedPageHeader } from 'src/components/shared/PageHeader';
import { useConfirmDialog } from 'src/components/shared/ConfirmDialog';
import ListCard from 'src/components/shared/ListCard';

export default function TeacherCoursesPage() {
  const { t } = useTranslation();
  const confirmDialog = useConfirmDialog();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', objective: '' });
  const [menu, setMenu] = useState<{ anchor: HTMLElement; course: CourseSummary } | null>(null);
  const [tab, setTab] = useState(0);

  const load = async () => {
    setLoading(true); setError('');
    try { setCourses(await listAuthoredCourses(token)); } catch { setError(t('education.errors.load')); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [token]);

  const filtered = useMemo(() => courses.filter((course) => `${course.title} ${course.description}`.toLowerCase().includes(search.toLowerCase())), [courses, search]);
  const pageTitle = tab === 1 ? t('education.classrooms.teacherTitle') : t('education.courseList.title');
  const pageSubtitle = tab === 1 ? t('education.classrooms.teacherSubtitle') : t('education.courseList.subtitle');

  const submitCreate = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.objective.trim()) return;
    setCreating(true); setError('');
    try {
      const course = await createCourse(token, { title: form.title, description: form.description, learning_objectives: [form.objective] });
      navigate(`/teach/courses/${course.id}`);
    } catch { setError(t('education.errors.create')); setCreating(false); }
  };

  const duplicate = async (source: CourseSummary) => {
    setMenu(null); setError('');
    try {
      const draft = await readCourseDraft(token, source.id);
      const copy = await createCourse(token, {
        title: `${draft.title} (${t('education.copy')})`, description: draft.description, learning_objectives: draft.learning_objectives,
        visibility: draft.visibility, cover_image_url: draft.cover_image_url, age_range: draft.age_range, difficulty: draft.difficulty,
        estimated_duration_minutes: draft.estimated_duration_minutes, prerequisites: draft.prerequisites, tags: draft.tags,
      });
      for (const lesson of draft.lessons) {
        await addLesson(token, copy.id, {
          title: lesson.title, activities: lesson.activities, completion_policy: lesson.completion_policy, start_mode: 'fresh',
          editor_type: lesson.editor_type, starter_content: lesson.starter_content, simulator_settings: lesson.simulator_settings, stageReference: lesson.stageReference,
        });
      }
      navigate(`/teach/courses/${copy.id}`);
    } catch { setError(t('education.errors.duplicate')); }
  };

  const archive = async (course: CourseSummary) => {
    setMenu(null);
    const confirmed = await confirmDialog.confirm({
      title: t('education.courseList.archive'),
      message: t('education.courseList.archiveConfirm', { title: course.title }),
      confirmLabel: t('education.courseList.archive'),
      cancelLabel: t('cancel'),
      danger: true,
    });
    if (!confirmed) return;
    try { await archiveCourse(token, course.id); await load(); } catch { setError(t('education.errors.archive')); }
  };

  return (
    <Stack spacing={3}>
      <TabbedPageHeader
        title={pageTitle}
        description={pageSubtitle}
        action={tab === 0 ? <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={() => setCreateOpen(true)}>{t('education.courseList.create')}</Button> : undefined}
        tabs={<Tabs value={tab} onChange={(_, value) => setTab(value)} aria-label={t('education.courseList.title')} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={pageTabsSx}>
          <Tab label={t('education.courseList.title')} />
          <Tab label={t('education.classrooms.teacherTitle')} />
        </Tabs>}
      />
      {tab === 0 && <Box><TextField fullWidth value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('education.courseList.search')} inputProps={{ 'aria-label': t('education.courseList.search') }} InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={18} /></InputAdornment> }} sx={{ mb: 2 }} />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? <Stack spacing={1}>{[1, 2, 3].map((item) => <Skeleton key={item} variant="rounded" height={92} />)}</Stack> : filtered.length === 0 ? (
        <Paper variant="outlined" sx={{ py: 7, px: 3, textAlign: 'center' }}><Typography variant="h5">{search ? t('education.courseList.noResults') : t('education.courseList.empty')}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{t('education.courseList.emptyHelp')}</Typography></Paper>
      ) : <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        {filtered.map((course, index) => <ListCard
          key={course.id}
          surface="row"
          divided={index > 0}
          title={course.title}
          description={course.description}
          fallbackIcon={<IconSchool size={20} />}
          status={<Chip size="small" color={course.status === 'published' ? 'success' : course.status === 'archived' ? 'default' : 'warning'} label={t(`education.status.${course.status}`)} />}
          meta={course.latest_published_release_version ? t('education.courseList.latestRelease', { version: course.latest_published_release_version }) : t('education.courseList.noRelease')}
          openLabel={t('education.courseList.edit')}
          onOpen={() => navigate(`/teach/courses/${course.id}`)}
          action={<IconButton aria-label={t('education.courseList.actions')} onClick={(event) => setMenu({ anchor: event.currentTarget, course })}><IconDotsVertical size={20} /></IconButton>}
        />)}
      </Box>}</Box>}
      {tab === 1 && <ClassGroupsTeacherPage embedded />}
      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => menu && navigate(`/teach/courses/${menu.course.id}`)}>{t('education.courseList.edit')}</MenuItem>
        <MenuItem onClick={() => menu && navigate(`/teach/courses/${menu.course.id}/progress`)}>{t('education.analytics.title')}</MenuItem>
        <MenuItem onClick={() => menu && duplicate(menu.course)}>{t('education.courseList.duplicate')}</MenuItem>
        <MenuItem onClick={() => menu && archive(menu.course)}>{t('education.courseList.archive')}</MenuItem>
      </Menu>
      <Dialog open={createOpen} onClose={() => !creating && setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('education.create.title')}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <TextField autoFocus required label={t('education.fields.title')} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <TextField required multiline minRows={3} label={t('education.fields.description')} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <TextField required label={t('education.fields.firstObjective')} value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} helperText={t('education.create.requiredHelp')} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setCreateOpen(false)} disabled={creating}>{t('cancel')}</Button><Button variant="contained" onClick={submitCreate} disabled={creating || !form.title.trim() || !form.description.trim() || !form.objective.trim()}>{t('education.courseList.create')}</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
