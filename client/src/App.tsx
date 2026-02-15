import { useReducer, useCallback, useRef, useEffect, useMemo, memo } from 'react';
import axios from 'axios';
import './App.css';
import Graph from './Graph';
import SourceViewer from './SourceViewer';
import type { FunctionRow, GraphResponse, SourceResponse } from './types';
import { logger } from './utils/logger';
import { DEBOUNCE_DELAY, API_BASE_URL } from './constants';

type AppState = {
  searchQuery: string;
  functions: FunctionRow[];
  selectedFunctionId: string | null;
  graphData: GraphResponse | null;
  sourceData: SourceResponse | null;
  loading: {
    functions: boolean;
    graph: boolean;
    source: boolean;
  };
  errors: {
    functions: string | null;
    graph: string | null;
    source: string | null;
  };
};

type AppAction =
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_FUNCTIONS'; payload: FunctionRow[] }
  | { type: 'SET_SELECTED_FUNCTION'; payload: string | null }
  | { type: 'SET_GRAPH_DATA'; payload: GraphResponse | null }
  | { type: 'SET_SOURCE_DATA'; payload: SourceResponse | null }
  | { type: 'SET_LOADING'; payload: { key: keyof AppState['loading']; value: boolean } }
  | { type: 'SET_ERROR'; payload: { key: keyof AppState['errors']; value: string | null } }
  | { type: 'CLEAR_GRAPH' }
  | { type: 'CLEAR_SOURCE' };

const initialState: AppState = {
  searchQuery: '',
  functions: [],
  selectedFunctionId: null,
  graphData: null,
  sourceData: null,
  loading: {
    functions: false,
    graph: false,
    source: false,
  },
  errors: {
    functions: null,
    graph: null,
    source: null,
  },
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    case 'SET_FUNCTIONS':
      return { ...state, functions: action.payload };
    case 'SET_SELECTED_FUNCTION':
      return { ...state, selectedFunctionId: action.payload };
    case 'SET_GRAPH_DATA':
      return { ...state, graphData: action.payload };
    case 'SET_SOURCE_DATA':
      return { ...state, sourceData: action.payload };
    case 'SET_LOADING':
      return {
        ...state,
        loading: { ...state.loading, [action.payload.key]: action.payload.value },
      };
    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.payload.key]: action.payload.value },
      };
    case 'CLEAR_GRAPH':
      return { ...state, graphData: null, sourceData: null, errors: { ...state.errors, graph: null } };
    case 'CLEAR_SOURCE':
      return { ...state, sourceData: null, errors: { ...state.errors, source: null } };
    default:
      return state;
  }
}

function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const graphAbortControllerRef = useRef<AbortController | null>(null);
  const sourceAbortControllerRef = useRef<AbortController | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      dispatch({ type: 'SET_FUNCTIONS', payload: [] });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: { key: 'functions', value: true } });
    dispatch({ type: 'SET_ERROR', payload: { key: 'functions', value: null } });

    try {
      const response = await axios.get<FunctionRow[]>(`${API_BASE_URL}/functions`, {
        params: { q: query },
      });
      dispatch({ type: 'SET_FUNCTIONS', payload: response.data });
    } catch (error) {
      logger.error('Error fetching functions:', error);
      dispatch({ type: 'SET_ERROR', payload: { key: 'functions', value: 'Failed to fetch functions. Please try again.' } });
      dispatch({ type: 'SET_FUNCTIONS', payload: [] });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'functions', value: false } });
    }
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query });

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      handleSearch(query);
    }, DEBOUNCE_DELAY);
  }, [handleSearch]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleFunctionClick = useCallback(async (functionId: string) => {
    if (graphAbortControllerRef.current) {
      graphAbortControllerRef.current.abort();
    }

    dispatch({ type: 'SET_SELECTED_FUNCTION', payload: functionId });
    dispatch({ type: 'CLEAR_GRAPH' });
    dispatch({ type: 'SET_LOADING', payload: { key: 'graph', value: true } });

    graphAbortControllerRef.current = new AbortController();

    try {
      const response = await axios.get<GraphResponse>(`${API_BASE_URL}/function/graph`, {
        params: { id: functionId },
        signal: graphAbortControllerRef.current.signal,
      });
      dispatch({ type: 'SET_GRAPH_DATA', payload: response.data });
    } catch (error) {
      if (axios.isCancel(error) || (axios.isAxiosError(error) && error.name === 'AbortError')) {
        return;
      }
      logger.error('Error fetching graph:', error);
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.error || 'Failed to fetch graph. Please try again.'
        : 'Failed to fetch graph. Please try again.';
      dispatch({ type: 'SET_ERROR', payload: { key: 'graph', value: errorMessage } });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'graph', value: false } });
      graphAbortControllerRef.current = null;
    }
  }, []);

  const handleNodeClick = useCallback(async (nodeId: string) => {
    if (sourceAbortControllerRef.current) {
      sourceAbortControllerRef.current.abort();
    }

    dispatch({ type: 'CLEAR_SOURCE' });
    dispatch({ type: 'SET_LOADING', payload: { key: 'source', value: true } });

    sourceAbortControllerRef.current = new AbortController();

    try {
      const response = await axios.get<SourceResponse>(`${API_BASE_URL}/source`, {
        params: { id: nodeId },
        signal: sourceAbortControllerRef.current.signal,
      });
      dispatch({ type: 'SET_SOURCE_DATA', payload: response.data });
    } catch (error) {
      if (axios.isCancel(error) || (axios.isAxiosError(error) && error.name === 'AbortError')) {
        return;
      }
      logger.error('Error fetching source:', error);
      let errorMessage = 'Failed to fetch source code. Please try again.';
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        const errorData = error.response?.data;
        errorMessage = errorData?.message || errorData?.error || 'Source code not found for this node.';
      }
      dispatch({ type: 'SET_ERROR', payload: { key: 'source', value: errorMessage } });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'source', value: false } });
      sourceAbortControllerRef.current = null;
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, functionId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleFunctionClick(functionId);
    }
  }, [handleFunctionClick]);

  const memoizedGraph = useMemo(() => {
    if (!state.graphData) return null;
    return <Graph graphData={state.graphData} onNodeClick={handleNodeClick} />;
  }, [state.graphData, handleNodeClick]);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Code Property Graph Viewer</h1>
      </header>

      <div className="app-content">
        <div className="search-panel">
          <div className="search-section">
            <label htmlFor="function-search">Search Functions:</label>
            <input
              id="function-search"
              type="text"
              value={state.searchQuery}
              onChange={handleSearchChange}
              placeholder="Enter function name..."
              className="search-input"
              aria-label="Search functions"
              aria-describedby="search-help"
            />
            <span id="search-help" className="sr-only">
              Type to search for functions in the codebase
            </span>
            {state.loading.functions && (
              <div className="loading" role="status" aria-live="polite">
                Loading...
              </div>
            )}
            {state.errors.functions && (
              <div className="error" role="alert" aria-live="assertive">
                {state.errors.functions}
              </div>
            )}
          </div>

          {state.functions.length > 0 && (
            <div className="functions-list">
              <h3>Results ({state.functions.length}):</h3>
              <ul role="listbox" aria-label="Function search results">
                {state.functions.map((func) => (
                  <li key={func.id} role="option">
                    <button
                      onClick={() => handleFunctionClick(func.id)}
                      onKeyDown={(e) => handleKeyDown(e, func.id)}
                      className={`function-button ${state.selectedFunctionId === String(func.id) ? 'active' : ''}`}
                      aria-pressed={state.selectedFunctionId === String(func.id)}
                      aria-label={`Select function ${func.name}`}
                    >
                      {func.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="graph-panel">
          {state.loading.graph && (
            <div className="loading-overlay">
              <div className="loading" role="status" aria-live="polite">
                Loading graph...
              </div>
            </div>
          )}
          {state.errors.graph && (
            <div className="error-overlay">
              <div className="error" role="alert" aria-live="assertive">
                {state.errors.graph}
              </div>
            </div>
          )}
          {memoizedGraph}
          {!state.graphData && !state.loading.graph && !state.errors.graph && state.selectedFunctionId && (
            <div className="placeholder">Select a function to view its graph</div>
          )}
          {!state.selectedFunctionId && (
            <div className="placeholder">Search and select a function to view its graph</div>
          )}
        </div>

        <div className="source-panel">
          <h3>Source Code</h3>
          <SourceViewer
            source={state.sourceData}
            loading={state.loading.source}
            error={state.errors.source}
          />
          </div>
        </div>
    </div>
  );
}

export default memo(App);
