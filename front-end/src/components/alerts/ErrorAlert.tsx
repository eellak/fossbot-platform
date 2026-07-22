import * as React from 'react';
import { Snackbar, Alert, AlertTitle } from '@mui/material';
import { AlertDetails } from './AlertDetails';

const alertText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  if (value == null) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const ErrorAlert = ({title, description}: AlertDetails) => {
  const [open, setOpen] = React.useState(false);
  const safeTitle = alertText(title);
  const safeDescription = alertText(description);

  const handleClick = () => {
    setOpen(true);
  };

  const handleClose = (reason: any) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
  };
  React.useEffect(() => {
    // Update the document title using the browser API
    const timer = setTimeout(() => {
      handleClick();
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <React.Fragment>
      <Snackbar
        open={open}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        autoHideDuration={6000}
        onClose={handleClose}
      >
        <Alert
          onClose={handleClose}
          severity="error"
          variant="filled"
          sx={{ width: '100%', color: 'white' }}
        >
          <AlertTitle>{safeTitle}</AlertTitle>
          {safeDescription}
        </Alert>
      </Snackbar>
    </React.Fragment>
  );
};

export default ErrorAlert;
