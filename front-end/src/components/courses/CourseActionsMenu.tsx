import { useState } from 'react';
import { Divider, IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import { IconDotsVertical } from '@tabler/icons-react';

export interface CourseAction {
  key: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  dividerBefore?: boolean;
}

/** Three-dot course menu shared by the dashboard course cards and teacher list. */
export default function CourseActionsMenu({ label, actions }: { label: string; actions: CourseAction[] }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Tooltip title={label}>
        <IconButton
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={Boolean(anchor)}
          onClick={(event) => {
            event.stopPropagation();
            setAnchor(event.currentTarget);
          }}
        >
          <IconDotsVertical size={20} />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {actions.flatMap((action) => [
          ...(action.dividerBefore ? [<Divider key={`${action.key}-divider`} sx={{ my: 0.5 }} />] : []),
          <MenuItem
            key={action.key}
            onClick={() => {
              setAnchor(null);
              action.onClick();
            }}
            sx={action.danger ? { color: 'error.main' } : undefined}
          >
            {action.label}
          </MenuItem>,
        ])}
      </Menu>
    </>
  );
}
