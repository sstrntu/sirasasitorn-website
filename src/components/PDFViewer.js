import React from 'react';
import './PDFViewer.css';

const PDFViewer = () => {
  return (
    <div className="pdf-viewer">
      <iframe
        src="/Resume.pdf#zoom=100"
        width="100%"
        height="100%"
        title="Resume PDF"
        frameBorder="0"
      />
    </div>
  );
};

export default PDFViewer;