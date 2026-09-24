import React, { useId, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import { Card, CardContent, Collapse, Typography, Stack, Box } from '@mui/material';
import { IconChevronDown } from '@tabler/icons-react';
import { useSelector } from 'src/store/Store';
import { AppState } from 'src/store/Store';

type Props = {
  title?: React.ReactNode;
  titleAdornment?: React.ReactNode;
  subtitle?: string;
  action?: JSX.Element | any;
  footer?: JSX.Element;
  cardheading?: string | JSX.Element;
  headtitle?: string | JSX.Element;
  headsubtitle?: string | JSX.Element;
  children?: React.ReactNode;
  middlecontent?: string | JSX.Element;
  compact?: boolean;
  /** Clicking the card title collapses its body. */
  collapsible?: boolean;
  /** Body starts collapsed (only used when `collapsible`). */
  defaultCollapsed?: boolean;
};

const DashboardCard = ({
  title,
  titleAdornment,
  subtitle,
  children,
  action,
  footer,
  cardheading,
  headtitle,
  headsubtitle,
  middlecontent,
  compact = false,
  collapsible = false,
  defaultCollapsed = false,
}: Props) => {
  const customizer = useSelector((state: AppState) => state.customizer);
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const contentId = useId();

  const theme = useTheme();
  const borderColor = theme.palette.divider;
  const canCollapse = collapsible && Boolean(title);

  return (
    <Card
      sx={{ padding: 0, ...(!customizer.isCardShadow && { border: `1px solid ${borderColor}` }) }}
      elevation={customizer.isCardShadow ? 9 : 0}
      variant={!customizer.isCardShadow ? 'outlined' : undefined}
    >
      {cardheading ? (
        <CardContent>
          <Typography variant="h5">{headtitle}</Typography>
          <Typography variant="subtitle2" color="textSecondary">
            {headsubtitle}
          </Typography>
        </CardContent>
      ) : (
        <CardContent sx={{ p: compact ? 3 : '30px' }}>
          {title ? (
            <Stack
              direction="row"
              spacing={2}
              justifyContent="space-between"
              alignItems={'center'}
              mb={!canCollapse || expanded ? (compact ? 2 : 3) : 0}
            >
              <Box
                {...(canCollapse ? {
                  role: 'button' as const,
                  tabIndex: 0,
                  'aria-expanded': expanded,
                  'aria-controls': contentId,
                  onClick: () => setExpanded((value) => !value),
                  onKeyDown: (event: React.KeyboardEvent) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    setExpanded((value) => !value);
                  },
                } : {})}
                sx={canCollapse ? {
                  minWidth: 0,
                  cursor: 'pointer',
                  borderRadius: 1,
                  '&:focus-visible': { outline: '2px solid', outlineColor: 'text.primary', outlineOffset: 2 },
                } : undefined}
              >
                {title ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="h5">{title}</Typography>
                    {titleAdornment}
                    {canCollapse && (
                      <IconChevronDown
                        size={18}
                        aria-hidden
                        style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
                      />
                    )}
                  </Stack>
                ) : ''}

                {subtitle ? (
                  <Typography variant="subtitle2" color="textSecondary">
                    {subtitle}
                  </Typography>
                ) : (
                  ''
                )}
              </Box>
              {action}
            </Stack>
          ) : null}

          {canCollapse ? (
            <Collapse in={expanded}>
              <Box id={contentId}>
                {React.Children.map(children, (child, index) => (
                  <div key={index}>{child}</div>
                ))}
              </Box>
            </Collapse>
          ) : (
            React.Children.map(children, (child, index) => (
              <div key={index}>{child}</div>
            ))
          )}
        </CardContent>
      )}

      {middlecontent}
      {footer}
    </Card>
  );
};

export default DashboardCard;
