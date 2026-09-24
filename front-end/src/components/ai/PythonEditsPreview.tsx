import { alpha, Box, Divider, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { PythonEditPreview } from 'src/ai/suggestions/pythonEdits';

const codeSx = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: 12.5,
  lineHeight: 1.7,
} as const;

function DiffLines({ lines, startLine, sign, tone }: { lines: string[]; startLine: number; sign: string; tone: 'removed' | 'added' }) {
  return <>{lines.map((line, index) => (
    <Box key={`${tone}-${index}`} sx={{ display: 'flex', alignItems: 'flex-start' }}>
      <Box component="span" sx={{ width: 30, flex: '0 0 auto', pr: 1, textAlign: 'right', color: 'text.disabled', userSelect: 'none' }}>{startLine + index}</Box>
      <Box component="span" sx={{
        flex: 1,
        minWidth: 0,
        px: 0.5,
        color: tone === 'removed' ? 'error.main' : 'success.main',
        bgcolor: (theme) => alpha(theme.palette[tone === 'removed' ? 'error' : 'success'].main, tone === 'removed' ? 0.08 : 0.1),
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
      }}>{sign} {line || ' '}</Box>
    </Box>
  ))}</>;
}

/**
 * Review a python_edits suggestion as one focused block per line range. Showing every edit on its
 * own keeps a multi-change proposal readable instead of collapsing it into one full-file diff.
 */
export default function PythonEditsPreview({ edits }: { edits: PythonEditPreview[] }) {
  const { t } = useTranslation();
  return <Stack divider={<Divider flexItem />} spacing={1.5}>
    {edits.map((edit, index) => {
      const beforeIndent = edit.before.length === 1 ? (edit.before[0].match(/^\s*/) || [''])[0].replace(/\t/g, '    ').length : null;
      const afterIndent = edit.after.length === 1 ? (edit.after[0].match(/^\s*/) || [''])[0].replace(/\t/g, '    ').length : null;
      const indentationOnly = beforeIndent !== null && afterIndent !== null && beforeIndent !== afterIndent && edit.before[0].trim() === edit.after[0].trim();
      return <Box key={`${edit.startLine}-${edit.endLine}-${index}`}>
        <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.75 }}>
          {edit.startLine === edit.endLine
            ? t('aiAssistant.edits.changeLine', { number: index + 1, line: edit.startLine })
            : t('aiAssistant.edits.changeLines', { number: index + 1, start: edit.startLine, end: edit.endLine })}
        </Typography>
        <Box tabIndex={0} sx={codeSx}>
          <DiffLines lines={edit.before} startLine={edit.startLine} sign="−" tone="removed" />
          {edit.after.length > 0
            ? <DiffLines lines={edit.after} startLine={edit.startLine} sign="+" tone="added" />
            : <Box sx={{ display: 'flex' }}>
                <Box component="span" sx={{ width: 30, flex: '0 0 auto', pr: 1 }} />
                <Box component="span" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>{t('aiAssistant.edits.removedRange')}</Box>
              </Box>}
        </Box>
        {indentationOnly && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          {t('aiAssistant.edits.indentationChanged', { before: beforeIndent, after: afterIndent })}
        </Typography>}
      </Box>;
    })}
  </Stack>;
}
