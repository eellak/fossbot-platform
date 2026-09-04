import Chip from '@mui/material/Chip';
import { isBetaFeature, type BetaFeature } from 'src/config/betaFeatures';

type Props = {
  feature: BetaFeature;
};

export type StatusBadgeLabel = 'Beta' | 'Preview' | 'Soon';

export function StatusBadge({ label }: { label: StatusBadgeLabel }) {
  return (
    <Chip
      color="primary"
      size="small"
      label={label}
      sx={{
        height: 20,
        borderRadius: 1,
        color: 'primary.contrastText',
        fontSize: '0.6875rem',
        fontWeight: 700,
        '& .MuiChip-label': { px: 0.75 },
      }}
    />
  );
}

export default function BetaBadge({ feature }: Props) {
  if (!isBetaFeature(feature)) return null;

  return <StatusBadge label="Beta" />;
}
