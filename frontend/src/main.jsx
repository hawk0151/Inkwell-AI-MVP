// frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

import { BrowserRouter } from 'react-router-dom';
// We are now only using our own AuthProvider for all authentication
import { AuthProvider } from './contexts/AuthContext.jsx';

// Import TanStack Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a client for TanStack Query
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {/*
          The conflicting <GoogleOAuthProvider> has been removed.
          AuthProvider now handles all login methods, including Google.
        */}
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
)