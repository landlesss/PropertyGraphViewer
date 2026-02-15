import { useEffect, useRef, memo, useCallback } from 'react';
import cytoscape from 'cytoscape';
import type { GraphResponse } from './types';
import { logger } from './utils/logger';
import { MAX_GRAPH_NODES, LAYOUT_TIMEOUT } from './constants';
import './Graph.css';

interface GraphProps {
  graphData: GraphResponse | null;
  onNodeClick: (nodeId: string) => void;
}

const LAYOUT_CONFIG = {
  name: 'cose',
  idealEdgeLength: 100,
  nodeOverlap: 20,
  refresh: 20,
  fit: true,
  padding: 30,
  randomize: false,
  componentSpacing: 100,
  nodeRepulsion: 4000000,
  edgeElasticity: 100,
  nestingFactor: 5,
  gravity: 80,
  numIter: 1000,
  initialTemp: 200,
  coolingFactor: 0.95,
  minTemp: 1.0,
} as const;

function Graph({ graphData, onNodeClick }: GraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<ReturnType<typeof cytoscape> | null>(null);
  const layoutRef = useRef<ReturnType<ReturnType<typeof cytoscape>['layout']> | null>(null);

  const handleNodeClick = useCallback((nodeId: string) => {
    onNodeClick(nodeId);
  }, [onNodeClick]);

  useEffect(() => {
    if (!containerRef.current || cyRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#666',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#fff',
            'font-size': '12px',
            'width': '60px',
            'height': '60px',
            'shape': 'ellipse',
            'border-width': 2,
            'border-color': '#fff',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#ccc',
            'target-arrow-color': '#ccc',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
          },
        },
        {
          selector: 'node[id^="ext::"]',
          style: {
            'background-color': '#ff8800',
            'border-color': '#ff6600',
            'opacity': 0.7,
          },
        },
      ],
      minZoom: 0.1,
      maxZoom: 4,
      headless: false,
    });

    cy.on('tap', 'node', (evt) => {
      try {
        if (!cyRef.current) return;
        const nodeId = evt.target.id();
        if (nodeId) {
          handleNodeClick(nodeId);
        }
      } catch (error) {
        logger.error('Error handling node click:', error);
      }
    });

    cy.userPanningEnabled(true);
    cy.userZoomingEnabled(true);
    
    cyRef.current = cy;

    return () => {
      if (cyRef.current) {
        try {
          cyRef.current.off('tap');
          cyRef.current.destroy();
        } catch (error) {
          logger.error('Error destroying cytoscape:', error);
        }
        cyRef.current = null;
      }
    };
  }, [handleNodeClick]);

  useEffect(() => {
    if (!graphData || !cyRef.current) {
      if (layoutRef.current) {
        try {
          layoutRef.current.stop();
        } catch (e) {
          // Ignore
        }
        layoutRef.current = null;
      }
      return;
    }

    const cy = cyRef.current;
    if (!cy) return;

    if (layoutRef.current) {
      try {
        layoutRef.current.stop();
      } catch (e) {
        // Ignore
      }
      layoutRef.current = null;
    }

    const timeoutId = setTimeout(() => {
      if (!cyRef.current) return;

      try {
        const limitedNodes = graphData.nodes.slice(0, MAX_GRAPH_NODES);
        const nodeIds = new Set(limitedNodes.map(n => n.data.id));
        const limitedEdges = graphData.edges.filter(
          e => nodeIds.has(e.data.source) && nodeIds.has(e.data.target)
        );

        cy.startBatch();
        cy.elements().remove();

        if (limitedNodes.length > 0) {
          cy.add({
            nodes: limitedNodes,
            edges: limitedEdges,
          });
        }

        cy.endBatch();

        if (limitedNodes.length > 0) {
          const layout = cy.layout(LAYOUT_CONFIG);
          layoutRef.current = layout;

          const handleLayoutStop = () => {
            if (cyRef.current && layoutRef.current === layout) {
              try {
                cyRef.current.fit(undefined, 50);
              } catch (e) {
                logger.error('Error fitting graph:', e);
              }
            }
            if (layoutRef.current === layout) {
              layoutRef.current = null;
            }
          };

          layout.one('layoutstop', handleLayoutStop);
          layout.run();
        }
      } catch (error) {
        logger.error('Error updating graph data:', error);
        layoutRef.current = null;
      }
    }, LAYOUT_TIMEOUT);

    return () => {
      clearTimeout(timeoutId);
      if (layoutRef.current) {
        try {
          layoutRef.current.stop();
        } catch (e) {
          // Ignore
        }
        layoutRef.current = null;
      }
    };
  }, [graphData]);

  useEffect(() => {
    return () => {
      if (layoutRef.current) {
        try {
          layoutRef.current.stop();
        } catch (e) {
          // Ignore
        }
        layoutRef.current = null;
      }

      if (cyRef.current) {
        try {
          cyRef.current.off('tap');
          cyRef.current.destroy();
        } catch (error) {
          logger.error('Error destroying cytoscape:', error);
        } finally {
          cyRef.current = null;
        }
      }
    };
  }, []);

  return <div ref={containerRef} className="graph-container" />;
}

export default memo(Graph);
