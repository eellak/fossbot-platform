import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, IconButton, MenuItem, Paper, Skeleton, Stack, Switch, TextField, Typography,
} from '@mui/material';
import { IconChartBar, IconCopy, IconPlus, IconRefresh, IconTrash, IconUsersGroup } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider';
import {
  assignCourseToClass, createClassChallenge, createClassGroup, listAuthoredCourses, listTeacherClassGroups,
  readClassChallengeStatistics, regenerateClassJoinCode, removeClassMember, resetClassChallengeSeason, updateClassChallenge, updateClassGroup,
  updateCourseAssignment,
} from 'src/courses/CoursesApi';
import type { ClassChallengeStatistics, CourseAssignment, CourseSummary, LeaderboardType, TeacherClassGroup } from 'src/courses/types';

const boardTypes: LeaderboardType[] = ['highest_score', 'fastest', 'fewest_movements', 'shortest_path', 'most_optional'];

export default function ClassGroupsTeacherPage({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [groups, setGroups] = useState<TeacherClassGroup[]>([]);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [nextGroups, nextCourses] = await Promise.all([listTeacherClassGroups(token), listAuthoredCourses(token)]);
      setGroups(nextGroups); setCourses(nextCourses.filter((course) => course.latest_published_release_id));
      setSelectedId((current) => current && nextGroups.some((group) => group.id === current) ? current : nextGroups[0]?.id || null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('education.classrooms.loadFailed')); }
    finally { setLoading(false); }
  }, [t, token]);
  useEffect(() => { void load(); }, [load]);
  const selected = groups.find((group) => group.id === selectedId) || null;

  const run = async (action: () => Promise<unknown>) => {
    setError('');
    try { await action(); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('education.classrooms.saveFailed')); }
  };
  const create = () => run(async () => {
    if (!name.trim()) return;
    const group = await createClassGroup(token, name);
    setName(''); setCreateOpen(false); setSelectedId(group.id);
  });

  if (loading && !groups.length) return <Box sx={{ p: 3 }}><Skeleton variant="rounded" height={100} /><Skeleton variant="rounded" height={360} sx={{ mt: 2 }} /></Box>;
  return <Box sx={{ maxWidth: embedded ? 'none' : 1280, mx: 'auto', p: embedded ? 0 : { xs: 2, md: 3 } }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2} mb={embedded ? 2 : 3}>
      {!embedded && <Box><Typography variant="h3" component="h1">{t('education.classrooms.teacherTitle')}</Typography><Typography color="text.secondary">{t('education.classrooms.teacherSubtitle')}</Typography></Box>}
      <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={() => setCreateOpen(true)}>{t('education.classrooms.create')}</Button>
    </Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
      <Paper variant="outlined" sx={{ p: 1, width: { xs: '100%', md: 280 }, flexShrink: 0 }}>
        {groups.map((group) => <Button key={group.id} fullWidth color={group.id === selectedId ? 'primary' : 'inherit'} variant={group.id === selectedId ? 'contained' : 'text'} startIcon={<IconUsersGroup size={18} />} onClick={() => setSelectedId(group.id)} sx={{ justifyContent: 'flex-start', mb: 0.5 }}>{group.name}</Button>)}
        {!groups.length && <Typography color="text.secondary" sx={{ p: 2 }}>{t('education.classrooms.empty')}</Typography>}
      </Paper>
      <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
        {selected ? <GroupDetail group={selected} courses={courses} token={token} run={run} t={t} /> : <Alert severity="info">{t('education.classrooms.select')}</Alert>}
      </Box>
    </Stack>
    <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>{t('education.classrooms.create')}</DialogTitle>
      <DialogContent><TextField autoFocus fullWidth required label={t('education.classrooms.name')} value={name} onChange={(event) => setName(event.target.value)} sx={{ mt: 1 }} /></DialogContent>
      <DialogActions><Button onClick={() => setCreateOpen(false)}>{t('cancel')}</Button><Button variant="contained" disabled={!name.trim()} onClick={() => void create()}>{t('education.classrooms.create')}</Button></DialogActions>
    </Dialog>
  </Box>;
}

function GroupDetail({ group, courses, token, run, t }: { group: TeacherClassGroup; courses: CourseSummary[]; token: string; run: (action: () => Promise<unknown>) => Promise<void>; t: any }) {
  const [courseId, setCourseId] = useState('');
  const availableCourses = courses.filter((course) => !group.assignments.some((assignment) => assignment.course_id === course.id));
  return <Stack spacing={2}>
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <Box><Typography variant="h4">{group.name}</Typography><Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Chip label={t('education.classrooms.joinCode', { code: group.join_code })} /><IconButton size="small" onClick={() => navigator.clipboard.writeText(group.join_code)} aria-label={t('education.classrooms.copyCode')}><IconCopy size={17} /></IconButton><Button size="small" startIcon={<IconRefresh size={16} />} onClick={() => void run(() => regenerateClassJoinCode(token, group.id))}>{t('education.classrooms.rotateCode')}</Button></Stack></Box>
        <Stack>
          <FormControlLabel control={<Switch checked={group.leaderboards_enabled} onChange={(event) => void run(() => updateClassGroup(token, group.id, { leaderboards_enabled: event.target.checked }))} />} label={t('education.classrooms.enableBoards')} />
          <Typography variant="caption" color="text.secondary">{t('education.classrooms.disabledDefault')}</Typography>
        </Stack>
      </Stack>
      <Alert severity="info" sx={{ mt: 2 }}>{t('education.classrooms.aliasPrivacy')}</Alert>
    </Paper>
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6">{t('education.classrooms.members', { count: group.members.length })}</Typography>
      <Stack spacing={1} sx={{ mt: 1 }}>
        {group.members.map((member) => <Stack key={member.id} direction="row" alignItems="center" gap={1} sx={{ py: 0.5 }}>
          <Box sx={{ flex: 1 }}><Typography>{member.student_username}</Typography><Typography variant="caption" color="text.secondary">{member.display_alias}</Typography></Box>
          <Chip size="small" color={member.leaderboard_opt_in ? 'success' : 'default'} label={member.leaderboard_opt_in ? t('education.classrooms.optedIn') : t('education.classrooms.optedOut')} />
          <IconButton color="error" onClick={() => void run(() => removeClassMember(token, group.id, member.id))} aria-label={t('education.classrooms.removeMember')}><IconTrash size={17} /></IconButton>
        </Stack>)}
        {!group.members.length && <Typography color="text.secondary">{t('education.classrooms.noMembers')}</Typography>}
      </Stack>
    </Paper>
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6">{t('education.classrooms.assignments')}</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ my: 1.5 }}>
        <TextField select fullWidth size="small" label={t('education.classrooms.course')} value={courseId} onChange={(event) => setCourseId(event.target.value)}>
          {availableCourses.map((course) => <MenuItem key={course.id} value={course.id}>{course.title}</MenuItem>)}
        </TextField>
        <Button disabled={!courseId} onClick={() => void run(async () => { await assignCourseToClass(token, group.id, Number(courseId)); setCourseId(''); })}>{t('education.classrooms.assign')}</Button>
      </Stack>
      <Stack spacing={2}>{group.assignments.map((assignment) => <AssignmentDetail key={assignment.id} assignment={assignment} group={group} token={token} run={run} t={t} />)}</Stack>
      {!group.assignments.length && <Typography color="text.secondary">{t('education.classrooms.noAssignments')}</Typography>}
    </Paper>
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}><Box><Typography fontWeight={700}>{t('education.classrooms.season', { season: group.challenge_season })}</Typography><Typography variant="caption" color="text.secondary">{t('education.classrooms.seasonHelp')}</Typography></Box><Button onClick={() => void run(() => resetClassChallengeSeason(token, group.id))}>{t('education.classrooms.resetSeason')}</Button></Stack>
    </Paper>
  </Stack>;
}

function AssignmentDetail({ assignment, group, token, run, t }: { assignment: CourseAssignment; group: TeacherClassGroup; token: string; run: (action: () => Promise<unknown>) => Promise<void>; t: any }) {
  const challenged = new Set(assignment.challenges.map((challenge) => `${challenge.lesson_key}:${challenge.activity_key}`));
  const missions = assignment.missions.filter((mission) => !challenged.has(`${mission.lesson_key}:${mission.activity_key}`));
  const [missionKey, setMissionKey] = useState('');
  const [boardType, setBoardType] = useState<LeaderboardType>('highest_score');
  const [adding, setAdding] = useState(false);
  const [statistics, setStatistics] = useState<ClassChallengeStatistics | null>(null);
  const [statisticsOpen, setStatisticsOpen] = useState(false);
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  const [statisticsError, setStatisticsError] = useState('');
  const selectedMission = useMemo(() => missions.find((mission) => `${mission.lesson_key}:${mission.activity_key}` === missionKey), [missionKey, missions]);
  const allowedBoards = boardTypes.filter((type) => type !== 'highest_score' || selectedMission?.score_enabled);
  const showStatistics = async (challengeId: number) => {
    setStatisticsOpen(true); setStatisticsLoading(true); setStatisticsError(''); setStatistics(null);
    try { setStatistics(await readClassChallengeStatistics(token, challengeId)); }
    catch (reason) { setStatisticsError(reason instanceof Error ? reason.message : t('education.classrooms.statisticsLoadFailed')); }
    finally { setStatisticsLoading(false); }
  };
  const addChallenge = async () => {
    if (!selectedMission) return;
    await run(() => createClassChallenge(token, assignment.id, {
      lesson_key: selectedMission.lesson_key,
      activity_key: selectedMission.activity_key,
      board_type: boardType,
      tie_tolerance: boardType === 'fastest' ? 100 : boardType === 'shortest_path' ? 0.05 : 0,
      enabled: false,
    }));
    setMissionKey(''); setAdding(false);
  };
  return <Box sx={{ pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
      <Box><Typography fontWeight={700}>{assignment.course_title}</Typography><Typography variant="caption" color="text.secondary">{t('education.student.version', { version: assignment.release_version })} · {t(`education.classrooms.policies.${assignment.update_policy}`)}</Typography></Box>
      {assignment.update_available && assignment.latest_release_id && <Button size="small" onClick={() => void run(() => updateCourseAssignment(token, assignment.id, { release_id: assignment.latest_release_id }))}>{t('education.classrooms.useLatest')}</Button>}
    </Stack>
    <Stack divider={<Divider flexItem />} sx={{ mt: 1 }}>
      {assignment.challenges.map((challenge) => <Stack key={challenge.id} direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1} sx={{ py: 1 }}>
        <Box sx={{ flex: 1 }}><Typography variant="body2" fontWeight={650}>{challenge.activity_title}</Typography><Typography variant="caption" color="text.secondary">{t(`education.classrooms.boards.${challenge.board_type}`)} · {t('education.classrooms.releaseContext', { version: challenge.release_version, season: challenge.season })}</Typography></Box>
        <Button size="small" startIcon={<IconChartBar size={16} />} onClick={() => void showStatistics(challenge.id)}>{t('education.classrooms.viewStatistics')}</Button>
        <FormControlLabel sx={{ mr: 0 }} control={<Switch checked={challenge.enabled} onChange={(event) => void run(() => updateClassChallenge(token, challenge.id, { enabled: event.target.checked }))} />} label={challenge.enabled ? t('education.classrooms.enabled') : t('education.classrooms.disabled')} />
      </Stack>)}
    </Stack>
    {!assignment.challenges.length && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{t('education.classrooms.noChallenges')}</Typography>}
    {missions.length > 0 && !adding && <Button size="small" startIcon={<IconPlus size={16} />} onClick={() => setAdding(true)} sx={{ mt: 1 }}>{t('education.classrooms.addChallenge')}</Button>}
    {adding && <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
      <Typography fontWeight={650} sx={{ mb: 1 }}>{t('education.classrooms.addChallenge')}</Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
        <TextField select fullWidth size="small" label={t('education.classrooms.mission')} value={missionKey} onChange={(event) => { setMissionKey(event.target.value); const mission = missions.find((item) => `${item.lesson_key}:${item.activity_key}` === event.target.value); if (boardType === 'highest_score' && !mission?.score_enabled) setBoardType('fastest'); }}>
          {missions.map((mission) => <MenuItem key={`${mission.lesson_key}:${mission.activity_key}`} value={`${mission.lesson_key}:${mission.activity_key}`}>{mission.lesson_title} · {mission.activity_title}</MenuItem>)}
        </TextField>
        <TextField select size="small" label={t('education.classrooms.boardType')} value={boardType} onChange={(event) => setBoardType(event.target.value as LeaderboardType)} sx={{ minWidth: 210 }}>
          {allowedBoards.map((type) => <MenuItem key={type} value={type}>{t(`education.classrooms.boards.${type}`)}</MenuItem>)}
        </TextField>
        <Stack direction="row" spacing={1} justifyContent="flex-end"><Button onClick={() => { setAdding(false); setMissionKey(''); }}>{t('cancel')}</Button><Button variant="contained" disabled={!selectedMission} onClick={() => void addChallenge()}>{t('education.classrooms.addChallenge')}</Button></Stack>
      </Stack>
      <Typography variant="caption" color="text.secondary">{group.leaderboards_enabled ? t('education.classrooms.challengeStillDisabled') : t('education.classrooms.enableGroupFirst')}</Typography>
    </Box>}
    <Dialog open={statisticsOpen} onClose={() => setStatisticsOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>{statistics?.activity_title || t('education.classrooms.challengeStatistics')}</DialogTitle>
      <DialogContent>
        {statisticsLoading && <Skeleton variant="rounded" height={220} />}
        {statisticsError && <Alert severity="error">{statisticsError}</Alert>}
        {statistics && <ChallengeStatistics statistics={statistics} t={t} />}
      </DialogContent>
      <DialogActions><Button onClick={() => setStatisticsOpen(false)}>{t('close')}</Button></DialogActions>
    </Dialog>
  </Box>;
}

function ChallengeStatistics({ statistics, t }: { statistics: ClassChallengeStatistics; t: any }) {
  const metrics = [
    [t('education.classrooms.participants'), `${statistics.participant_count} / ${statistics.member_count}`],
    [t('education.classrooms.successfulStudents'), statistics.successful_participant_count],
    [t('education.classrooms.attempts'), statistics.attempt_count],
    [t('education.classrooms.successRate'), `${statistics.success_rate}%`],
    [t('education.classrooms.optedInCount'), statistics.opted_in_count],
  ];
  if (statistics.best_value !== null && statistics.best_value !== undefined) metrics.push([t('education.classrooms.bestResult'), statistics.best_value]);
  if (statistics.average_value !== null && statistics.average_value !== undefined) metrics.push([t('education.classrooms.averageResult'), statistics.average_value]);
  return <Stack spacing={2}>
    <Typography color="text.secondary">{t(`education.classrooms.boards.${statistics.board_type}`)} · {t('education.classrooms.releaseContext', { version: statistics.release_version, season: statistics.season })}</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1 }}>
      {metrics.map(([label, value]) => <Box key={String(label)} sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 1 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }}>{value}</Typography></Box>)}
    </Box>
    <Box><Typography variant="subtitle2">{t('education.classrooms.outcomes')}</Typography><Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>{Object.entries(statistics.outcomes).map(([outcome, count]) => <Chip key={outcome} size="small" label={`${t(`education.mission.outcomes.${outcome}`, outcome)} · ${count}`} />)}{!Object.keys(statistics.outcomes).length && <Typography variant="body2" color="text.secondary">{t('education.classrooms.noAttempts')}</Typography>}</Stack></Box>
  </Stack>;
}
