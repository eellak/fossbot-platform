import { Alert, Box, Divider, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { LessonPreviewItem, LessonPreviewValue, SuggestionPreview } from 'src/ai/suggestions/codeSuggestions';

const words = (value: string) => value
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/_/g, ' ')
  .replace(/^./, (first) => first.toUpperCase());

function valueText(value: LessonPreviewValue, yes: string, no: string): string {
  if (typeof value === 'boolean') return value ? yes : no;
  if (Array.isArray(value)) return value.map((item) => valueText(item, yes, no)).join(' • ');
  if (value && typeof value === 'object') return Object.entries(value).map(([key, item]) => `${words(key)}: ${valueText(item as LessonPreviewValue, yes, no)}`).join(' • ');
  return String(value);
}

function ReviewItem({ item }: { item: LessonPreviewItem }) {
  const { t } = useTranslation();
  const activityType = item.activityType ? t(`education.activities.types.${item.activityType}`, words(item.activityType)) : '';
  return <Paper variant="outlined" sx={{ p: 1.25, bgcolor: 'background.default' }}>
    <Typography variant="subtitle2">{t(`aiAssistant.authoring.review.titles.${item.title}`, { type: activityType })}</Typography>
    {item.fields.length > 0 && <Stack divider={<Divider flexItem />} sx={{ mt: 0.75 }}>
      {item.fields.map((field) => <Box key={field.name} sx={{ py: 0.75 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>{t(`aiAssistant.authoring.review.fields.${field.name}`, words(field.name))}</Typography>
        <Typography variant="body2" sx={{ mt: 0.25, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{valueText(field.value, t('aiAssistant.authoring.review.yes'), t('aiAssistant.authoring.review.no'))}</Typography>
      </Box>)}
    </Stack>}
  </Paper>;
}

export default function LessonSuggestionPreview({ preview }: { preview: SuggestionPreview }) {
  const { t } = useTranslation();
  const lesson = preview.lesson;
  if (!lesson) return null;
  return <Stack spacing={1.25} sx={{ mt: 1 }}>
    <Box>
      <Typography variant="caption" color="text.secondary">{t('aiAssistant.authoring.studentVisible')}</Typography>
      <Stack spacing={0.75} sx={{ mt: 0.5 }}>{lesson.studentVisible.map((item, index) => <ReviewItem key={`${item.title}-${index}`} item={item} />)}</Stack>
    </Box>
    {lesson.teacherOnly.length > 0 && <Alert severity="warning">
      <Typography variant="subtitle2">{t('aiAssistant.authoring.teacherOnly')}</Typography>
      <Stack spacing={0.75} sx={{ mt: 0.75 }}>{lesson.teacherOnly.map((item, index) => <ReviewItem key={`${item.title}-${index}`} item={item} />)}</Stack>
    </Alert>}
    {preview.validation?.length ? <Alert severity="warning">{t('aiAssistant.authoring.validationIssues', { count: preview.validation.length })}</Alert> : <Alert severity="success">{t('aiAssistant.authoring.validationPass')}</Alert>}
  </Stack>;
}
