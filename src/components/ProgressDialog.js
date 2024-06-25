import React, { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  LinearProgress,
  Typography,
  Box
} from '@mui/material';

const ProgressDialog = ({ open, onClose, progress, total, onCancel }) => {
  useEffect(() => {
    console.debug('ProgressDialog mounted');
    return () => {
      console.debug('ProgressDialog unmounted');
    };
  }, []);

  useEffect(() => {
    console.debug(`Progress updated: ${progress}/${total}`);
  }, [progress, total]);

  const handleCancel = () => {
    console.debug('Cancel button clicked');
    onCancel();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Processing Documents</DialogTitle>
      <DialogContent>
        <Box sx={{ width: '100%', mb: 2 }}>
          <LinearProgress variant="determinate" value={(progress / total) * 100} />
        </Box>
        <Typography variant="body1">
          Processing document {progress} of {total}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} color="secondary">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProgressDialog;
