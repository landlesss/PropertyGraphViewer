// API Response Types

export type FunctionRow = {
  id: number;
  name: string;
};

export type GraphNode = {
  data: {
    id: string;
    label: string;
  };
};

export type GraphEdge = {
  data: {
    id: string;
    source: string;
    target: string;
  };
};

export type GraphResponse = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type SourceResponse = {
  file_name: string;
  start_line: number;
  end_line: number;
  code: string;
};
