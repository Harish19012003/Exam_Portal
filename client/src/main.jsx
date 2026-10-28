import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App.jsx';
import { loadIcons } from '@iconify/react';
import { startSessionKeeper } from './api/client.js';

// Core CSS imports
import './index.css';

startSessionKeeper();

// Iconify fetches icons on first render, which makes menus jump when they open.
// Fetch the ones used in lazily rendered UI (menus, toolbars) up front.
loadIcons([
  'hugeicons:call', 'hugeicons:code', 'hugeicons:copy-01', 'hugeicons:delete-02',
  'hugeicons:file-01', 'hugeicons:file-02', 'hugeicons:file-attachment', 'hugeicons:file-download',
  'hugeicons:file-upload', 'hugeicons:flow-connection', 'hugeicons:folder-open', 'hugeicons:image-01',
  'hugeicons:link-01', 'hugeicons:link-square-02', 'hugeicons:mail-01', 'hugeicons:printer',
  'hugeicons:search-01', 'hugeicons:share-01', 'hugeicons:sidebar-right', 'hugeicons:star',
  'hugeicons:upload-01', 'material-symbols:construction', 'mdi:whatsapp',
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
