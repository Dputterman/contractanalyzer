import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Box,
  Divider
} from '@mui/material';
import { useDropzone } from 'react-dropzone';
import { CloudUpload as CloudUploadIcon, Delete as DeleteIcon } from '@mui/icons-material';

const UploadDialog = ({ open, onClose, onUpload }) => {
  const [files, setFiles] = useState([]);

  useEffect(() => {
    console.log('UploadDialog opened:', open);
  }, [open]);

  const onDrop = useCallback((acceptedFiles) => {
    console.log('Files dropped:', acceptedFiles);
    setFiles(prev => {
      const newFiles = [...prev, ...acceptedFiles];
      console.log('Updated files state:', newFiles);
      return newFiles;
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleRemoveFile = (index) => {
    console.log('Removing file at index:', index);
    setFiles(prev => {
      const newFiles = prev.filter((_, i) => i !== index);
      console.log('Updated files state after removal:', newFiles);
      return newFiles;
    });
  };

  const handleUpload = () => {
    console.log('handleUpload called in UploadDialog');
    console.log('Files to be uploaded:', files);
    onUpload(files);
    setFiles([]);
    onClose();
  };

  console.log('Rendering UploadDialog. Current files:', files);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload Documents</DialogTitle>
      <DialogContent>
        <Box
          {...getRootProps()}
          sx={{
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'grey.300',
            borderRadius: 2,
            p: 3,
            mb: 3,
            textAlign: 'center',
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
        >
          <input {...getInputProps()} />
          <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Drag & Drop Files Here
          </Typography>
          <Typography variant="body2" color="textSecondary">
            or click to select files
          </Typography>
        </Box>
        {files.length > 0 && (
          <>
            <Typography variant="subtitle1" gutterBottom>
              Selected Files:
            </Typography>
            <List>
              {files.map((file, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={file.name}
                    secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" onClick={() => handleRemoveFile(index)}>
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      <Divider />
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          color="primary"
          variant="contained"
          disabled={files.length === 0}
          startIcon={<CloudUploadIcon />}
        >
          Upload and Process
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UploadDialog;