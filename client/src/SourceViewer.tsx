import { memo } from 'react';
import type { SourceResponse } from './types';
import './SourceViewer.css';

interface SourceViewerProps {
  source: SourceResponse | null;
  loading: boolean;
  error: string | null;
}

function SourceViewer({ source, loading, error }: SourceViewerProps) {
  if (loading) {
    return (
      <div className="source-viewer-loading">
        <p>Loading source code...</p>
      </div>
    );
  }

  if (error) {
    const isExternal = error.includes('External') || error.includes('external');
    
    return (
      <div className="source-viewer-error">
        <div className={`error-box ${isExternal ? 'error-box-warning' : 'error-box-error'}`}>
          <p className="error-title">
            {isExternal ? '⚠️ External Function' : '❌ Error'}
          </p>
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

  return (
    <div className="source-viewer">
      <div className="source-header">
        <h3>File: {source.file_name}</h3>
        <p className="source-lines">
          Lines {source.start_line} - {source.end_line}
        </p>
      </div>
      <pre className="source-code">
        <code>{source.code}</code>
      </pre>
    </div>
  );
}

export default memo(SourceViewer);
