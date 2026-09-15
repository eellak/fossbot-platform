import { Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { UserRole, type User } from 'src/authentication/AuthInterfaces';
import UsersCard from 'src/components/admin-panel/UsersCard';
import PageContainer from 'src/components/container/PageContainer';
import PageHeader from 'src/components/shared/PageHeader';

// Sample rows belong to the comparison route only. Negative ids keep the shared
// user-management controls read-only, so fixtures can never reach the users API.
const PREVIEW_FIXTURES: User[] = [
  { id: -1, username: 'ada_google', firstname: 'Ada', lastname: 'Lovelace', email: 'ada.lovelace@example.com', role: UserRole.USER, beta_tester: false, activated: true, provider: 'google', firebase_uid: 'preview-google', access_revoked: false, marketplace_roles: [] },
  { id: -2, username: 'alan_github', firstname: 'Alan', lastname: 'Turing', email: 'alan.turing@example.com', role: UserRole.TUTOR, beta_tester: true, activated: true, provider: 'github', firebase_uid: 'preview-github', access_revoked: false, marketplace_roles: ['verifier'] },
  { id: -3, username: 'grace_linked', firstname: 'Grace', lastname: 'Hopper', email: 'grace.hopper@example.com', role: UserRole.USER, beta_tester: false, activated: false, provider: 'google,github', firebase_uid: 'preview-linked', access_revoked: true, marketplace_roles: ['moderator'] },
  ...Array.from({ length: 17 }, (_, index): User => {
    const n = index + 1;
    return {
      id: -(n + 10),
      username: `sample_user_${String(n).padStart(2, '0')}`,
      firstname: 'Sample',
      lastname: `User ${n}`,
      email: `sample.user.${n}@example.com`,
      role: n % 5 === 0 ? UserRole.ADMIN : n % 2 === 0 ? UserRole.TUTOR : UserRole.USER,
      beta_tester: n % 4 === 0,
      activated: n % 7 !== 0,
      provider: n % 3 === 0 ? 'github' : n % 3 === 1 ? 'google' : 'google,github',
      firebase_uid: `preview-sample-${n}`,
      access_revoked: n % 9 === 0,
      marketplace_roles: n % 3 === 0 ? ['verifier'] : n % 4 === 0 ? ['moderator'] : [],
    };
  }),
];

export default function AdminPanelPreview() {
  const { t } = useTranslation();

  return <PageContainer title={t('admin-panel.title')} description={t('admin-panel.usageDescription')}>
    <Stack spacing={3}>
      <PageHeader title={t('admin-panel.title')} description={t('admin-panel.usageDescription')} />
      <UsersCard previewUsers={PREVIEW_FIXTURES} />
    </Stack>
  </PageContainer>;
}
