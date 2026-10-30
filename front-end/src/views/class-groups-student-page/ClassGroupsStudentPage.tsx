import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Paper, Skeleton, Stack, Switch, TextField, Typography,
} from '@mui/material';
import { IconLogin, IconTrophy } from '@tabler/icons-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider';
import {
  joinClassGroup, leaveClassGroup, listJoinedClassGroups, previewClassGroup, readClassLeaderboard, updateClassMembership,
} from 'src/courses/CoursesApi';
import type { ClassGroupPreview, ClassLeaderboard, StudentClassGroup } from 'src/courses/types';

export default function ClassGroupsStudentPage({ embedded = false, previewAppearance = true }: { embedded?: boolean; previewAppearance?: boolean }) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const attemptedJoin = useRef('');
  const [groups, setGroups] = useState<StudentClassGroup[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [pendingJoin, setPendingJoin] = useState<{ code: string; group: ClassGroupPreview } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [leaderboard, setLeaderboard] = useState<ClassLeaderboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const previewMaxWidth = previewAppearance ? 640 : undefined;

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setGroups(await listJoinedClassGroups(token)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('education.classrooms.loadFailed')); }
    finally { setLoading(false); }
  }, [t, token]);
  useEffect(() => { void load(); }, [load]);

  const showJoinPreview = useCallback(async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;
    setError('');
    setPreviewLoading(true);
    try {
      setPendingJoin({ code, group: await previewClassGroup(token, code) });
    } catch (reason) {
      setJoinCode(code);
      setError(reason instanceof Error ? reason.message : t('education.classrooms.saveFailed'));
      setSearchParams({}, { replace: true });
    } finally {
      setPreviewLoading(false);
    }
  }, [setSearchParams, t, token]);

  useEffect(() => {
    const code = (searchParams.get('join') || '').trim().toUpperCase();
    if (!code || attemptedJoin.current === code) return;
    attemptedJoin.current = code;
    setJoinCode(code);
    void showJoinPreview(code);
  }, [searchParams, showJoinPreview]);

  const acceptJoin = async () => {
    if (!pendingJoin) return;
    setJoining(true);
    setError('');
    try {
      await joinClassGroup(token, pendingJoin.code);
      setPendingJoin(null);
      setJoinCode('');
      setSearchParams({}, { replace: true });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('education.classrooms.saveFailed'));
    } finally {
      setJoining(false);
    }
  };

  const cancelJoin = () => {
    setPendingJoin(null);
    setJoinCode('');
    setSearchParams({}, { replace: true });
  };
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
    <Paper variant="outlined" sx={{ p: 2, mb: 2, maxWidth: previewMaxWidth }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
        <TextField
          fullWidth
          size={previewAppearance ? 'small' : 'medium'}
          label={t('education.classrooms.enterCode')}
          value={joinCode}
          onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
          sx={previewAppearance ? { flex: 1, minWidth: 0 } : undefined}
        />
        <Button
          variant="contained"
          startIcon={<IconLogin size={17} />}
          disabled={!joinCode.trim() || previewLoading}
          onClick={() => void showJoinPreview(joinCode)}
          sx={previewAppearance ? { flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'center' } } : undefined}
        >
          {t('education.classrooms.join')}
        </Button>
      </Stack>
    </Paper>
    {error && <Alert severity="error" sx={{ mb: 2, maxWidth: previewMaxWidth }}>{error}</Alert>}
    {loading ? <Skeleton variant="rounded" height={240} sx={{ maxWidth: previewMaxWidth }} /> : <Stack spacing={2}>
      {groups.map((group) => <StudentGroupCard key={group.id} group={group} token={token} navigate={navigate} run={run} showBoard={showBoard} t={t} />)}
      {!groups.length && (previewAppearance
        ? <Typography color="text.secondary" variant="body2" sx={{ py: 1, maxWidth: previewMaxWidth }}>{t('education.classrooms.notJoined')}</Typography>
        : <Alert severity="info">{t('education.classrooms.notJoined')}</Alert>)}
    </Stack>}
    <Dialog open={Boolean(pendingJoin)} onClose={() => !joining && cancelJoin()} fullWidth maxWidth="sm">
      <DialogTitle>{t('education.classrooms.joinPreviewTitle')}</DialogTitle>
      <DialogContent>
        {pendingJoin && <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="h5">{pendingJoin.group.name}</Typography>
          {pendingJoin.group.teacher_name && <Typography color="text.secondary">{t('education.classrooms.joinPreviewTeacher', { teacher: pendingJoin.group.teacher_name })}</Typography>}
          <Typography>{t('education.classrooms.joinPreviewMembers', { count: pendingJoin.group.member_count })}</Typography>
          <Box>
            <Typography variant="subtitle2">{t('education.classrooms.joinPreviewAssignments')}</Typography>
            {pendingJoin.group.assignments.length
              ? <Box component="ul" sx={{ m: 0, pl: 3 }}>{pendingJoin.group.assignments.map((assignment) => <li key={`${assignment.course_title}-${assignment.release_version}`}><Typography>{assignment.course_title} · {t('education.student.version', { version: assignment.release_version })}</Typography></li>)}</Box>
              : <Typography color="text.secondary">{t('education.classrooms.joinPreviewNoAssignments')}</Typography>}
          </Box>
          {pendingJoin.group.already_member && <Alert severity="info">{t('education.classrooms.joinPreviewAlreadyMember')}</Alert>}
          <Alert severity="info">{t('education.classrooms.joinPreviewPrivacy')}</Alert>
        </Stack>}
      </DialogContent>
      <DialogActions>
        <Button disabled={joining} onClick={cancelJoin}>{t('cancel')}</Button>
        <Button variant="contained" disabled={joining} onClick={() => void acceptJoin()}>{pendingJoin?.group.already_member ? t('education.classrooms.continueToClass') : t('education.classrooms.join')}</Button>
      </DialogActions>
    </Dialog>
    <Dialog open={Boolean(leaderboard)} onClose={() => setLeaderboard(null)} fullWidth maxWidth="sm">
      <DialogTitle>{leaderboard?.activity_title}</DialogTitle>
      <DialogContent>
        {leaderboard && <Stack spacing={1}>
          <Typography color="text.secondary">{t(`education.classrooms.boards.${leaderboard.board_type}`)} · {t('education.classrooms.releaseContext', { version: leaderboard.release_version, season: leaderboard.season })}</Typography>
          <Alert severity="info">{t('education.classrooms.friendlyNote')}</Alert>
          {leaderboard.entries.map((entry) => <Paper key={`${entry.rank}-${entry.alias}`} variant="outlined" sx={{ p: 1.25 }}><Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}><Stack direction="row" spacing={1} alignItems="center"><Typography fontWeight={650}>{entry.rank}. {entry.alias}</Typography>{entry.is_guest && <Chip size="small" label={t('guest.session')} />}</Stack><Typography>{entry.value}</Typography></Stack></Paper>)}
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
      <TextField size="small" label={t('education.classrooms.alias')} value={alias} disabled={Boolean(group.membership.is_guest)} onChange={(event) => setAlias(event.target.value)} onBlur={() => !group.membership.is_guest && alias.trim() !== group.membership.display_alias && alias.trim().length >= 2 && void run(() => updateClassMembership(token, group.id, { display_alias: alias.trim() }))} />
      <FormControlLabel control={<Switch checked={group.membership.leaderboard_opt_in} onChange={(event) => void run(() => updateClassMembership(token, group.id, { leaderboard_opt_in: event.target.checked }))} />} label={t('education.classrooms.optIn')} />
    </Stack>
    <Alert severity="info" sx={{ mb: 2 }}>{group.membership.leaderboard_opt_in ? t('education.classrooms.optInHelp') : t('education.classrooms.optOutHelp')}</Alert>
    <Stack spacing={1}>{group.assignments.map((assignment) => <Paper key={assignment.id} variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}><Box><Typography fontWeight={700}>{assignment.course_title}</Typography><Typography variant="caption" color="text.secondary">{t('education.student.version', { version: assignment.release_version })}</Typography></Box><Button onClick={() => navigate(`/courses/${assignment.course_id}${group.membership.is_guest && assignment.enrollment_id ? `?enrollment=${assignment.enrollment_id}` : ''}`)}>{t('education.student.viewCourse')}</Button></Stack>
      <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>
        {assignment.challenges.filter((challenge) => challenge.enabled).map((challenge) => <Button key={challenge.id} size="small" variant="outlined" startIcon={<IconTrophy size={16} />} disabled={!group.leaderboards_enabled || !group.membership.leaderboard_opt_in} onClick={() => void showBoard(challenge.id)}>{challenge.activity_title}</Button>)}
      </Stack>
    </Paper>)}</Stack>
  </Paper>;
}
