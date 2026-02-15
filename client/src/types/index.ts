export type FunctionId = string;
export type NodeId = string;

export interface FunctionRow {
  id: FunctionId;
  name: string;
}

export interface GraphNode {
  data: {
    id: string;
    label: string;
  };
}

export interface GraphEdge {
  data: {
    id: string;
    source: string;
    target: string;
  };
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SourceResponse {
  file_name: string;
  start_line: number;
  end_line: number;
  code: string;
}
