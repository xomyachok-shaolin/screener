import { createRoot } from 'react-dom/client';
import React from 'react';
import VideoUploadApp from './VideoUploadApp'; // Assuming your main component is in a separate file

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<VideoUploadApp />);

