import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { DndContext, closestCenter, useSensor, useSensors, KeyboardSensor, PointerSensor } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import LegalAnalyzerUI from './components/LegalAnalyzerUI';
import DetailView from './components/DetailView';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { extractionPrompt } from './prompts/extractionPrompt.js';
import { Dialog, DialogTitle, IconButton, Typography, Button, Box, TextField, InputAdornment } from '@mui/material';
import { Add as AddIcon, Upload as UploadIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import { Alert } from '@mui/material';
import { OpenAI } from 'openai';

const ASSISTANT_ID = process.env.REACT_APP_OPENAI_ASSISTANT_ID;
const VECTOR_STORE_ID = process.env.REACT_APP_OPENAI_VECTOR_STORE_ID;

export const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const LegalAnalyzerApp = () => {
  const [isUploadReady, setIsUploadReady] = useState(false);
  const [assistant, setAssistant] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [columnOrder, setColumnOrder] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [cancelProcess, setCancelProcess] = useState(false);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [selectedDocumentContent, setSelectedDocumentContent] = useState('');

  const openDetailView = (document) => {
    setSelectedDocumentContent(document.content);npm 
    setIsDetailViewOpen(true);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadDocuments = useCallback(async () => {
    try {
      const docRef = doc(db, 'legalAnalyzer', 'documents');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setDocuments(data.documents || []);
        if (data.documents && data.documents.length > 0) {
          setColumnOrder(Object.keys(data.documents[0]));
        }
      } else {
        console.log('No such document!');
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  }, []);

  useEffect(() => {
    const fetchAssistant = async () => {
      try {
        const assistantData = await openai.beta.assistants.retrieve(ASSISTANT_ID);
        setAssistant(assistantData);
        setIsUploadReady(true);
      } catch (error) {
        console.error('Error fetching assistant:', error);
        setError('Error fetching assistant. Please check your configuration.');
      }
    };

    if (openai && ASSISTANT_ID) {
      fetchAssistant();
    }

    loadDocuments();
  }, [loadDocuments]);

  const saveDocuments = async (docs, columns) => {
    try {
      await setDoc(doc(db, 'legalAnalyzer', 'documents'), {
        documents: docs,
        columnOrder: columns,
      });
      console.log('Documents saved successfully');
    } catch (error) {
      console.error('Error saving documents:', error);
    }
  };

  const parseContractData = (content) => {
    const fields = {};
    const fieldRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let match;

    while ((match = fieldRegex.exec(content)) !== null) {
      fields[match[1]] = match[2].trim();
    }

    return fields;
  };

  const cancelProcessing = useCallback(() => {
    setCancelProcess(true);
    setIsLoading(false);
    setProcessingStatus('Processing cancelled');
  }, []);

  const addDocument = useCallback(async (file, index, totalFiles) => {
    try {
      setProcessingStatus(`Processing document ${index + 1}/${totalFiles}`);

      const openaiFile = await openai.files.create({
        file: file,
        purpose: 'assistants',
      });

      await openai.beta.vectorStores.files.create(
        VECTOR_STORE_ID,
        {
          file_id: openaiFile.id,
        }
      );

      const promptContent = `Use file retrieval for file: ${file.name}\n${extractionPrompt}`;
      const thread = await openai.beta.threads.create();
      await openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: promptContent,
      });

      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: ASSISTANT_ID,
      });

      let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      while (runStatus.status !== 'completed') {
        if (cancelProcess) {
          throw new Error("Process cancelled by user");
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      }

      const messages = await openai.beta.threads.messages.list(thread.id);
      const assistantMessage = messages.data.find(m => m.role === 'assistant');

      return assistantMessage.content[0].text.value;
    } catch (error) {
      console.error('Error in addDocument:', error);
      throw error;
    }
  }, [cancelProcess]);

  const onDrop = useCallback((acceptedFiles) => {
    setSelectedFiles(acceptedFiles);
    setIsDialogOpen(false);
  }, []);

  const handleUpload = async () => {
    if (!isUploadReady) {
      setError('Please wait for the assistant to be ready.');
      return;
    }

    setIsLoading(true);
    setCancelProcess(false);
    setProcessingStatus('Starting to process documents...');

    const totalFiles = selectedFiles.length;

    const existingFileNames = documents.map(doc => doc.filename);
    const newDocuments = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      if (existingFileNames.includes(file.name)) {
        console.log(`Skipping existing file: ${file.name}`);
        continue;
      }
      try {
        const content = await addDocument(file, i, totalFiles);
        const contractData = parseContractData(content);
        newDocuments.push({ filename: file.name, ...contractData });
      } catch (error) {
        setError(`Error processing file: ${file.name}`);
      }
    }

    const updatedDocuments = [...documents, ...newDocuments];
    if (updatedDocuments.length > 0 && columnOrder.length === 0) {
      setColumnOrder(Object.keys(updatedDocuments[0]));
    }

    try {
      await saveDocuments(updatedDocuments, columnOrder);
      await loadDocuments();
    } catch (error) {
      console.error('Error during saveDocuments:', error);
    }
    setIsLoading(false);
    setSelectedFiles([]);
    setProcessingStatus('');
  };

  const columns = useMemo(() => {
    if (documents.length === 0) return [];
    return [
      {
        accessorKey: 'actions',
        header: 'Actions',
        id: 'actions',
        cell: ({ row }) => (
          <IconButton onClick={() => openDetailView(row.original)}>
            <VisibilityIcon />
          </IconButton>
        ),
      },
      ...columnOrder.map(key => ({
        accessorKey: key,
        header: key.replace(/_/g, ' '),
        id: key,
      }))
    ];
  }, [documents, columnOrder]);

  const table = useReactTable({
    data: documents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { columnOrder },
    onColumnOrderChange: setColumnOrder,
  });

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return isDetailViewOpen ? (
    <DetailView 
      fileContent={selectedDocumentContent}
      onBack={() => setIsDetailViewOpen(false)}
    />
  ) : (
  <LegalAnalyzerUI
    isDialogOpen={isDialogOpen}
    setIsDialogOpen={setIsDialogOpen}
    getRootProps={getRootProps}
    getInputProps={getInputProps}
    isDragActive={isDragActive}
    selectedFiles={selectedFiles}
    handleUpload={handleUpload}
    isLoading={isLoading}
    processingStatus={processingStatus}
    cancelProcessing={cancelProcessing}
    error={error}
    sensors={sensors}
    handleDragEnd={handleDragEnd}
    table={table}
    columnOrder={columnOrder}
    openDetailView={openDetailView}
    documents={documents}
  />
  );
};

export default LegalAnalyzerApp;
