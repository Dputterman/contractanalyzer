import React, { useEffect, useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Card,
  CardHeader,
  CardContent,
  Button,
  TextField,
  InputAdornment,
  Typography,
  Box
} from '@mui/material';
import { Search as SearchIcon, Upload as UploadIcon, Folder as FolderIcon } from '@mui/icons-material';
import { DndContext, closestCenter, useSensor, useSensors, KeyboardSensor, PointerSensor } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { flexRender } from '@tanstack/react-table';
import UploadDialog from './UploadDialog';
import ProgressDialog from './ProgressDialog.js';

const LegalAnalyzerUI = ({
  handleUpload,
  isLoading,
  processingStatus,
  cancelProcessing,
  error,
  table,
  openDetailView,
  documents,
  columnOrder: initialColumnOrder,
  isDialogOpen,
  setIsDialogOpen,
  getRootProps,
  getInputProps,
  isDragActive,
  selectedFiles,
  sensors,
  handleDragEnd,
  currentProgress = 0,
  totalFiles = 0
}) => {

  const [hoveredRowId, setHoveredRowId] = useState(null);
  const [localColumnOrder, setLocalColumnOrder] = useState(initialColumnOrder);

  useEffect(() => {
    setLocalColumnOrder(initialColumnOrder);
  }, [initialColumnOrder]);

  useEffect(() => {
    const columns = table.getAllLeafColumns();
    const columnIds = columns.map(column => column.id);
    setLocalColumnOrder(columnIds);
  }, [table]);

  const DraggableTableHeader = ({ header }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: header.id });

    const style = {
      transform: transform ? CSS.Transform.toString(transform) : undefined,
      transition,
    };

    return (
      <TableCell ref={setNodeRef} style={style} {...attributes} {...listeners}>
        {header.isPlaceholder
          ? null
          : header.column && header.column.columnDef
            ? flexRender(header.column.columnDef.header, header.getContext())
            : header.id}
      </TableCell>
    );
  };

  const orderedColumns = useMemo(
    () => localColumnOrder.map(columnId => {
      const column = table.getColumn(columnId);
      if (!column) {
        console.error("Column not found for ID:", columnId);
        return null;
      }
      return column;
    }).filter(Boolean),
    [table, localColumnOrder]
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <Box component="header" sx={{ bgcolor: 'background.paper', boxShadow: 1 }}>
        <Box sx={{ maxWidth: '1200px', mx: 'auto', py: 3, px: { xs: 2, sm: 3, md: 4 } }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
            Legal Document Analyzer
          </Typography>
        </Box>
      </Box>

      <Box component="main" sx={{ maxWidth: '1200px', mx: 'auto', py: 3, px: { xs: 2, sm: 3, md: 4 } }}>
        <Card sx={{ mb: 4 }}>
          <CardHeader
            avatar={<FolderIcon />}
            title="Total Documents"
          />
          <CardContent>
            <Typography variant="h4" component="p" sx={{ fontWeight: 'bold' }}>
              {documents.length}
            </Typography>
            <Typography variant="body1">Documents</Typography>
          </CardContent>
        </Card>

        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <TextField
            placeholder="Search documents..."
            variant="outlined"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1, mr: 2 }}
          />
          <Button
            onClick={() => setIsDialogOpen(true)}
            variant="contained"
            color="primary"
            startIcon={<UploadIcon />}
          >
            Upload Documents
          </Button>
        </Box>

        <UploadDialog
          open={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onUpload={handleUpload}
          getRootProps={getRootProps}
          getInputProps={getInputProps}
          isDragActive={isDragActive}
          selectedFiles={selectedFiles}
        />

        <ProgressDialog
          open={isLoading}
          onClose={() => {}}
          progress={currentProgress}
          total={totalFiles}
          onCancel={cancelProcessing}
        />

        {isLoading && (
          <Paper sx={{ p: 2, mb: 3 }} elevation={3}>
            <Typography>{processingStatus}</Typography>
            <Button onClick={cancelProcessing} color="secondary">
              Cancel
            </Button>
          </Paper>
        )}

        {error && (
          <Box sx={{ bgcolor: 'error.light', color: 'error.main', p: 2, mb: 3, borderRadius: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Error</Typography>
            <Typography>{error}</Typography>
          </Box>
        )}

        <Card>
          <CardHeader title="Document Analysis Results" />
          <CardContent>
            <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={localColumnOrder}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        {orderedColumns.map(column => (
                          <DraggableTableHeader key={column.id} header={column} />
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {table.getRowModel().rows.length ? (
                        table.getRowModel().rows.map(row => (
                          <TableRow
                            key={row.id}
                            hover
                            onClick={() => openDetailView(row.original)}
                            onMouseEnter={() => setHoveredRowId(row.id)}
                            onMouseLeave={() => setHoveredRowId(null)}
                            sx={{
                              cursor: 'pointer',
                              bgcolor: hoveredRowId === row.id ? 'action.hover' : 'inherit'
                            }}
                            tabIndex={0}
                          >
                            {orderedColumns.map(column => (
                              <TableCell 
                                key={column.id} 
                                sx={{ 
                                  maxWidth: 200,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {flexRender(column.columnDef.cell, row.getVisibleCells().find(cell => cell.column.id === column.id)?.getContext() || {})}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={orderedColumns.length} align="center" sx={{ py: 3 }}>
                            <Typography color="text.secondary">No results.</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </SortableContext>
              </DndContext>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default LegalAnalyzerUI;np