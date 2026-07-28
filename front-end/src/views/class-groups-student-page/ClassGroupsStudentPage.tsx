import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Paper, Skeleton, Stack, Switch, TextField, Typography,
} from '@mui/material';
import { IconLogin, IconTrophy } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider';
import {
  joinClassGroup, leaveClassGroup, listJoinedClassGroups, readClassLeaderboard, updateClassMembership,
} from 'src/courses/CoursesApi';
import type { ClassLeaderboard, StudentClassGroup } from 'src/courses/types';

export default function ClassGroupsStudentPage({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<StudentClassGroup[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [leaderboard, setLeaderboard] = useState<ClassLeaderboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setGroups(await listJoinedClassGroups(token)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('education.classrooms.loadFailed')); }
    finally { setLoading(false); }
  }, [t, token]);
  useEffect(() => { void load(); }, [load]);
  const run = async (action: () => Promise<unknown>) => {
    setError('');
    try { await action(); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('education.classrooms.saveFailed')); }
  };
  const showBoard = async (challengeId: number) => {
    setError('');
    try { setLeaderboard(await readClassLeaderboard(token, challengeId)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('education.classrooms.boardUnavailable')); }
  };

  return <Box sx={{ maxWidth: embedded ? 'none' : 1000, mx: 'auto', p: embedded ? 0 : { xs: 2, md: 3 } }}>
    {!embedded && <><Typography variant="h3" component="h1">{t('education.classrooms.studentTitle')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>{t('education.classrooms.studentSubtitle')}</Typography></>}
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField fullWidth label={t('education.classrooms.enterCode')} value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} />
        <Button variant="contained" startIcon={<IconLogin size={17} />} disabled={!joinCode.trim()} onClick={() => void run(async () => { await joinClassGroup(token, joinCode); setJoinCode(''); })}>{t('education.classrooms.join')}</Button>
      </Stack>
    </Paper>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {loading ? <Skeleton variant="rounded" height={240} /> : <Stack spacing={2}>
      {groups.map((group) => <StudentGroupCard key={group.id} group={group} token={token} navigate={navigate} run={run} showBoard={showBoard} t={t} />)}
      {!groups.length && <Alert severity="info">{t('education.classrooms.notJoined')}</Alert>}
    </Stack>}
    <Dialog open={Boolean(leaderboard)} onClose={() => setLeaderboard(null)} fullWidth maxWidth="sm">
      <DialogTitle>{leaderboard?.activity_title}</DialogTitle>
      <DialogContent>
        {leaderboard && <Stack spacing={1}>
          <Typography color="text.secondary">{t(`education.classrooms.boards.${leaderboard.board_type}`)} · {t('education.classrooms.releaseContext', { version: leaderboard.release_version, season: leaderboard.season })}</Typography>
          <Alert severity="info">{t('education.classrooms.friendlyNote')}</Alert>
          {leaderboard.entries.map((entry) => <Paper key={`${entry.rank}-${entry.alias}`} variant="outlined" sx={{ p: 1.25 }}><Stack direction="row" justifyContent="space-between"><Typography fontWeight={650}>{entry.rank}. {entry.alias}</Typography><Typography>{entry.value}</Typography></Stack></Paper>)}
          {!leaderboard.entries.length && <Typography color="text.secondary">{t('education.classrooms.noResults')}</Typography>}
        </Stack>}
      </DialogContent>
      <DialogActions><Button onClick={() => setLeaderboard(null)}>{t('close')}</Button></DialogActions>
    </Dialog>
  </Box>;
}

function StudentGroupCard({ group, token, navigate, run, showBoard, t }: { group: StudentClassGroup; token: string; navigate: any; run: (action: () => Promise<unknown>) => Promise<void>; showBoard: (challengeId: number) => Promise<void>; t: any }) {
  const [alias, setAlias] = useState(group.membership.display_alias);
  return <Paper variant="outlined" sx={{ p: 2 }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
      <Box><Typography variant="h5">{group.name}</Typography><Typography variant="caption" color="text.secondary">{t('education.classrooms.season', { season: group.challenge_season })}</Typography></Box>
      <Button color="error" onClick={() => void run(() => leaveClassGroup(token, group.id))}>{t('education.classrooms.leave')}</Button>
    </Stack>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ my: 2 }}>
      <TextField size="small" label={t('education.classrooms.alias')} value={alias} onChange={(event) => setAlias(event.target.value)} onBlur={() => alias.trim() !== group.membership.display_alias && alias.trim().length >= 2 && void run(() => updateClassMembership(token, group.id, { display_alias: alias.trim() }))} />
      <FormControlLabel control={<Switch checked={group.membership.leaderboard_opt_in} onChange={(event) => void run(() => updateClassMembership(token, group.id, { leaderboard_opt_in: event.target.checked }))} />} label={t('education.classrooms.optIn')} />
    </Stack>
    <Alert severity="info" sx={{ mb: 2 }}>{group.membership.leaderboard_opt_in ? t('education.classrooms.optInHelp') : t('education.classrooms.optOutHelp')}</Alert>
    <Stack spacing={1}>{group.assignments.map((assignment) => <Paper key={assignment.id} variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}><Box><Typography fontWeight={700}>{assignment.course_title}</Typography><Typography variant="caption" color="text.secondary">{t('education.student.version', { version: assignment.release_version })}</Typography></Box><Button onClick={() => navigate(`/courses/${assignment.course_id}`)}>{t('education.student.viewCourse')}</Button></Stack>
      <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>
        {assignment.challenges.filter((challenge) => challenge.enabled).map((challenge) => <Button key={challenge.id} size="small" variant="outlined" startIcon={<IconTrophy size={16} />} disabled={!group.leaderboards_enabled || !group.membership.leaderboard_opt_in} onClick={() => void showBoard(challenge.id)}>{challenge.activity_title}</Button>)}
      </Stack>
    </Paper>)}</Stack>
  </Paper>;
}
