import { useEffect, useRef, memo, useCallback } from 'react';
import cytoscape from 'cytoscape';
import type { GraphResponse } from './types';
import { logger } from './utils/logger';
import { MAX_GRAPH_NODES, LAYOUT_TIMEOUT } from './constants';
import { graphStylesheet } from './graphStyles';
import './Graph.css';

interface GraphProps {
  graphData: GraphResponse | null;
  onNodeClick: (nodeId: string) => void;
  focusMode?: boolean;
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

function Graph({ graphData, onNodeClick, focusMode = false }: GraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const layoutRef = useRef<cytoscape.Layouts | null>(null);
  const selectedNodeRef = useRef<string | null>(null);
  const hoveredNodeRef = useRef<string | null>(null);

  const handleNodeClick = useCallback((nodeId: string) => {
    onNodeClick(nodeId);
    selectedNodeRef.current = nodeId;
  }, [onNodeClick]);

  const applyFocusMode = useCallback((nodeId: string | null) => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    
    if (!nodeId) {
      cy.elements().removeClass('fade');
      return;
    }

    const selectedNode = cy.getElementById(nodeId);
    if (selectedNode.length === 0) return;

    const connectedEdges = selectedNode.connectedEdges();
    const connectedNodes = connectedEdges.connectedNodes();
    const visibleNodes = selectedNode.union(connectedNodes);
    const visibleEdges = connectedEdges;

    cy.elements().addClass('fade');
    visibleNodes.removeClass('fade');
    visibleEdges.removeClass('fade');
  }, []);

  useEffect(() => {
    if (!containerRef.current || cyRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      style: graphStylesheet as any,
      minZoom: 0.1,
      maxZoom: 4,
      headless: false,
    });

    cy.on('tap', 'node', (evt) => {
      try {
        if (!cyRef.current) return;
        const node = evt.target;
        const nodeId = node.id();
        if (nodeId) {
          handleNodeClick(nodeId);
          if (focusMode) {
            applyFocusMode(nodeId);
          }
        }
      } catch (error) {
        logger.error('Error handling node click:', error);
      }
    });

    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      const nodeId = node.id();
      hoveredNodeRef.current = nodeId;
      
      const edges = node.connectedEdges();
      edges.addClass('highlight-edge');
      
      if (!focusMode) {
        cy.elements().forEach((el) => {
          if (el.isNode() && el.id() !== nodeId && !edges.connectedNodes().contains(el)) {
            el.addClass('fade');
          } else if (el.isEdge() && !edges.contains(el)) {
            el.addClass('fade');
          }
        });
      }
    });

    cy.on('mouseout', 'node', () => {
      hoveredNodeRef.current = null;
      const edges = cyRef.current?.elements('edge.highlight-edge');
      edges?.removeClass('highlight-edge');
      
      if (!focusMode) {
        cy.elements().removeClass('fade');
      }
    });

    cy.on('dbltap', 'node', (evt) => {
      const node = evt.target;
      cy.animate({
        center: { eles: node },
        zoom: 1.5,
      }, { duration: 400 });
    });

    cy.userPanningEnabled(true);
    cy.userZoomingEnabled(true);
    
    cyRef.current = cy;

    return () => {
      if (cyRef.current) {
        try {
          cyRef.current.off('tap');
          cyRef.current.off('mouseover');
          cyRef.current.off('mouseout');
          cyRef.current.off('dbltap');
          cyRef.current.destroy();
        } catch (error) {
          logger.error('Error destroying cytoscape:', error);
        }
        cyRef.current = null;
      }
    };
  }, [handleNodeClick, focusMode, applyFocusMode]);

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
        const existingElements = cy.elements();
        if (existingElements.length > 0) {
          existingElements.style('opacity', 0);
          existingElements.remove();
        }

        if (limitedNodes.length > 0) {
          const newElements = cy.add({
            nodes: limitedNodes.map(n => ({
              ...n,
              data: {
                ...n.data,
                type: n.data.id.startsWith('ext::') ? 'external' : 
                      n.data.label?.toLowerCase().includes('main') ? 'entry' : 'internal',
              },
            })),
            edges: limitedEdges.map(e => ({
              ...e,
              data: {
                ...e.data,
                type: 'secondary',
              },
            })),
          });

          newElements.style('opacity', 0);
          
          setTimeout(() => {
            newElements.nodes().forEach((node, index) => {
              setTimeout(() => {
                node.animate({
                  style: { 'opacity': 1 }
                }, { 
                  duration: 300, 
                  queue: false,
                  easing: 'ease-out',
                });
              }, index * 20);
            });
            
            setTimeout(() => {
              newElements.edges().forEach((edge, index) => {
                setTimeout(() => {
                  edge.animate({
                    style: { 'opacity': 1 }
                  }, { 
                    duration: 400, 
                    queue: false,
                    easing: 'ease-out',
                  });
                }, index * 15);
              });
            }, 200);
          }, 100);
        }

        cy.endBatch();

        if (limitedNodes.length > 0) {
          const layout = cy.layout(LAYOUT_CONFIG);
          layoutRef.current = layout;

          const handleLayoutStop = () => {
            if (cyRef.current && layoutRef.current === layout) {
              try {
                cyRef.current.fit(undefined, 50);
                if (selectedNodeRef.current && focusMode) {
                  applyFocusMode(selectedNodeRef.current);
                }
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
  }, [graphData, focusMode, applyFocusMode]);

  useEffect(() => {
    if (focusMode && selectedNodeRef.current && cyRef.current) {
      applyFocusMode(selectedNodeRef.current);
    } else if (!focusMode && cyRef.current) {
      cyRef.current.elements().removeClass('fade');
    }
  }, [focusMode, applyFocusMode]);

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
          cyRef.current.off('mouseover');
          cyRef.current.off('mouseout');
          cyRef.current.off('dbltap');
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
