import { memo, useState } from 'react';
import type { SourceResponse } from './types';
import './SourceViewer.css';

interface SourceViewerProps {
  source: SourceResponse | null;
  loading: boolean;
  error: string | null;
  nodeId?: string | null;
}

function SourceViewer({ source, loading, error, nodeId }: SourceViewerProps) {
  if (loading) {
    return (
      <div className="source-viewer-loading">
        <p>Loading source code...</p>
      </div>
    );
  }

  if (error) {
    const isExternal = error.includes('External') || error.includes('external');
    const isMissing = error.includes('not found') || error.includes('not available');
    
    return (
      <div className="source-viewer-error">
        <div className={`error-box ${isExternal ? 'error-box-warning' : isMissing ? 'error-box-missing' : 'error-box-error'}`}>
          <div className="error-header">
            <p className="error-title">
              {isExternal ? 'External Function' : isMissing ? 'No Source Available' : 'Error'}
            </p>
            <span className={`status-badge ${isExternal ? 'badge-external' : isMissing ? 'badge-missing' : 'badge-error'}`}>
              {isExternal ? 'EXTERNAL' : isMissing ? 'NO SOURCE' : 'ERROR'}
            </span>
          </div>
          <p className="error-message">{error}</p>
          {isExternal && (
            <p className="error-hint">
              This function is from the standard library or an external package. Source code is not available in the database.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="source-viewer-empty">
        <p>Click on a node in the graph to view its source code.</p>
      </div>
    );
  }

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(source.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isExternal = nodeId?.startsWith('ext::') || false;

  return (
    <div className="source-viewer">
      <div className="source-header">
        <div className="source-header-top">
          <h3>
            {source.file_name}
          </h3>
          <span className={`status-badge ${isExternal ? 'badge-external' : 'badge-internal'}`}>
            {isExternal ? 'EXTERNAL' : 'INTERNAL'}
          </span>
        </div>
        <p className="source-lines">
          Lines {source.start_line} - {source.end_line}
        </p>
      </div>
      <div style={{ position: 'relative' }}>
        <pre className="source-code">
          <code>{source.code}</code>
        </pre>
        <button
          onClick={handleCopy}
          className={`copy-button ${copied ? 'copied' : ''}`}
          title={copied ? 'Copied!' : 'Copy code'}
          aria-label="Copy code to clipboard"
        >
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 8l3 3 7-7"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="5" y="5" width="8" height="8" rx="1"/>
              <path d="M3 3v8h8"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

export default memo(SourceViewer);
