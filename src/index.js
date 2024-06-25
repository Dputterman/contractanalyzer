import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';  // Or './app' if you're using lowercase

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
