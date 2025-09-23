import React, { useState, useEffect } from 'react';
import './PDFViewer.css';

const PDFViewer = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    // For mobile, provide a direct link without automatic opening
    return (
      <div className="pdf-viewer mobile-pdf">
        <div className="pdf-mobile-content">
          <h2>📄 Resume</h2>
          <p>Tap the button below to view the PDF:</p>
          <a
            href="/Resume.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="view-btn"
            style={{ fontSize: '18px', padding: '16px 32px' }}
          >
            📄 View Resume PDF
          </a>
        </div>
      </div>
    );
  }

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