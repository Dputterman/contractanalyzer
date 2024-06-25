import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { DndContext, closestCenter, useSensor, useSensors, KeyboardSensor, PointerSensor } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import LegalAnalyzerUI from './components/LegalAnalyzerUI';
import DetailView from './components/DetailView';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { extractionPrompt } from './prompts/extractionPrompt';
import { OpenAI } from 'openai';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Initialize Firebase Storage
const storage = getStorage();

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
  const [externalInfo, setExternalInfo] = useState([]); // Define externalInfo
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [columnOrder, setColumnOrder] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [cancelProcess, setCancelProcess] = useState(false);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [selectedDocumentContent, setSelectedDocumentContent] = useState('');
  const [currentProgress, setCurrentProgress] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);

  const openDetailView = (document) => {
    setSelectedDocumentContent(document.content);
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
        setExternalInfo(data.externalInfo || []); // Load externalInfo
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

  const saveDocuments = async (docs, externalInfo, columns) => {
    try {
      await setDoc(doc(db, 'legalAnalyzer', 'documents'), {
        documents: docs,
        externalInfo: externalInfo,
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

      const contractData = parseContractData(assistantMessage.content[0].text.value);

      // Upload file blob to Firebase Storage
      const storageRef = ref(storage, `files/${file.name}`);
      await uploadBytes(storageRef, file);
      const fileBlobUrl = await getDownloadURL(storageRef);

      const openaiId = openaiFile.id;

      return { contractData, openaiId, fileBlobUrl };
    } catch (error) {
      console.error('Error in addDocument:', error);
      throw error;
    }
  }, [cancelProcess]);

  const handleUpload = useCallback(async (files) => {
    if (!isUploadReady) {
      setError('Please wait for the assistant to be ready.');
      return;
    }

    setIsLoading(true);
    setCancelProcess(false);
    setCurrentProgress(0);
    setTotalFiles(files.length);

    const existingFileNames = documents.map(doc => doc.filename);
    const newDocuments = [];
    const newExternalInfo = [];

    for (let i = 0; i < files.length; i++) {
      if (cancelProcess) {
        break;
      }

      const file = files[i];
      if (existingFileNames.includes(file.name)) {
        continue;
      }

      try {
        const { contractData, openaiId, fileBlobUrl } = await addDocument(file, i, files.length);
        newDocuments.push({ 
          filename: file.name, 
          contractData: JSON.stringify(contractData)  // Stringify contractData
        });
        newExternalInfo.push({ openaiId, fileBlobUrl });
        setCurrentProgress(i + 1);
      } catch (error) {
        setError(`Error processing file: ${file.name}`);
        break;
      }
    }

    const updatedDocuments = [...documents, ...newDocuments];
    const updatedExternalInfo = [...externalInfo, ...newExternalInfo];
    if (updatedDocuments.length > 0 && columnOrder.length === 0) {
      setColumnOrder(Object.keys(updatedDocuments[0]));
    }

    try {
      await saveDocuments(updatedDocuments, updatedExternalInfo, columnOrder);
      await loadDocuments();
    } catch (error) {
      setError('Error saving documents. Please try again.');
    }

    setIsLoading(false);
    setCurrentProgress(0);
    setTotalFiles(0);
    setIsDialogOpen(false);
  }, [isUploadReady, documents, externalInfo, columnOrder, addDocument, saveDocuments, loadDocuments]);

  const columns = useMemo(() => {
    if (documents.length === 0) return [];
    return [
      {
        accessorKey: 'filename',
        header: 'Filename',
        id: 'filename',
        cell: ({ row }) => row.original.filename,
        columnDef: { header: 'Filename' }
      },
      {
        accessorKey: 'contractData',
        header: 'Contract Data',
        id: 'contractData',
        cell: ({ row }) => {
          const data = row.original.contractData;
          return typeof data === 'object' ? JSON.stringify(data) : data;
        },
        columnDef: { header: 'Contract Data' }
      },
      ...columnOrder.map(key => ({
        accessorKey: key,
        header: key.replace(/_/g, ' '),
        id: key,
        cell: info => {
          const value = info.getValue ? info.getValue() : null;
          return typeof value === 'object' ? JSON.stringify(value) : value;
        },
        columnDef: { header: key.replace(/_/g, ' ') }
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

  return isDetailViewOpen ? (
    <DetailView 
      onBack={() => setIsDetailViewOpen(false)}
      assistantId={ASSISTANT_ID}
      fileIds={selectedDocumentContent}
    />
  ) : (
    <LegalAnalyzerUI
      isDialogOpen={isDialogOpen}
      setIsDialogOpen={setIsDialogOpen}
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
      currentProgress={currentProgress}
      totalFiles={totalFiles}
    />
  );
};

export default LegalAnalyzerApp;
