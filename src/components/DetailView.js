import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, Button, IconButton, TextField, Box, Typography } from '@mui/material';
import Split from 'react-split'; // Importing the default export
import { FiSend, FiArrowLeft } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { openai } from '../LegalAnalyzerApp.js';

const ASSISTANT_ID = process.env.REACT_APP_OPENAI_ASSISTANT_ID;

const DetailView = ({ onBack, assistantId, fileIds }) => {
  const [chatMessages, setChatMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const threadRef = useRef(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    const initializeThread = async () => {
      if (!threadRef.current) {
        try {
          const thread = await openai.beta.threads.create();
          threadRef.current = thread;
          console.log(`conversation: thread created. threadId: ${thread.id}`);
        } catch (error) {
          console.error('Error initializing thread:', error);
          toast.error('Failed to initialize chat thread');
        }
      }
    };
    initializeThread();
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const sendMessage = async (message) => {
    if (!threadRef.current) {
      console.error('Thread not initialized');
      toast.error('Chat thread not initialized');
      return;
    }

    toast.promise(
      (async () => {
        try {
          setChatMessages(prevMessages => [...prevMessages, { role: 'user', content: message }]);
          setInputMessage('');

          await openai.beta.threads.messages.create(threadRef.current.id, {
            role: 'user',
            content: message
          });

          const run = await openai.beta.threads.runs.create(threadRef.current.id, {
            assistant_id: ASSISTANT_ID,
          });

          let runRetrieve;
          do {
            await new Promise(resolve => setTimeout(resolve, 1000));
            runRetrieve = await openai.beta.threads.runs.retrieve(threadRef.current.id, run.id);
          } while (runRetrieve.status !== 'completed');

          const updatedMessages = await openai.beta.threads.messages.list(threadRef.current.id);
          const messageResponse = updatedMessages.data.find(msg => msg.role === 'assistant');

          if (messageResponse && messageResponse.content[0].text) {
            const newChatMessages = messageResponse.content[0].text.value;
            setChatMessages(prevMessages => [...prevMessages, { role: 'assistant', content: newChatMessages }]);
          } else {
            throw new Error('Unexpected response format');
          }
        } catch (error) {
          console.error('Error sending message:', error);
          throw error;
        }
      })(),
      {
        pending: 'Sending message...',
        success: 'Message sent!',
        error: 'Error sending message'
      }
    );
  };

  const handleSendMessage = () => {
    if (inputMessage.trim() !== '') {
      sendMessage(inputMessage);
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f0f4f8' }}>
      <Box sx={{ bgcolor: '#ffffff', p: 2, borderBottom: '1px solid #e0e0e0' }}>
        <Button startIcon={<FiArrowLeft />} onClick={onBack}>
          Back to Documents
        </Button>
      </Box>
      <Split
        direction="vertical"
        sizes={[50, 50]}
        minSize={100}
        gutterSize={8}
        gutterAlign="center"
        snapOffset={30}
      >
        <Box sx={{ p: 2, bgcolor: '#ffffff', borderRadius: 2, boxShadow: 1, m: 2, overflowY: 'auto' }}>
          <Typography variant="h5">Document View</Typography>
          <Typography variant="body1">Document content will be displayed here.</Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#ffffff', borderRadius: 2, boxShadow: 1, m: 2 }}>
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }} ref={chatContainerRef}>
            {chatMessages.map((msg, index) => (
              <Box
                component={motion.div}
                key={index}
                sx={{
                  mb: 2,
                  p: 1,
                  borderRadius: 2,
                  maxWidth: '80%',
                  bgcolor: msg.role === 'user' ? '#007bff' : '#e9ecef',
                  color: msg.role === 'user' ? 'white' : '#333',
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Typography variant="subtitle1">
                  {msg.role === 'user' ? 'You' : 'Assistant'}:
                </Typography>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
                <Typography variant="caption" display="block" gutterBottom>
                  {format(new Date(), 'HH:mm')}
                </Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', p: 2, borderTop: '1px solid #e0e0e0' }}>
            <TextField
              fullWidth
              variant="outlined"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type your message..."
            />
            <IconButton color="primary" onClick={handleSendMessage}>
              <FiSend />
            </IconButton>
          </Box>
        </Box>
      </Split>
      <ToastContainer />
    </Box>
  );
};

export default DetailView;
