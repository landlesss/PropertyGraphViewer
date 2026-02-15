import Fastify from "fastify";
import * as Database from "better-sqlite3";
import cors from "@fastify/cors";

// Constants for input validation
const MAX_QUERY_LENGTH = 200;
const MAX_ID_LENGTH = 500;
const MAX_NODES_IN_GRAPH = 1000;
const MIN_QUERY_LENGTH = 1;

// Validation helpers
function validateFunctionId(id: string): { valid: boolean; error?: string } {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: "Function ID is required" };
  }
  
  const trimmed = id.trim();
  if (trimmed === '') {
    return { valid: false, error: "Function ID cannot be empty" };
  }
  
  if (trimmed.length > MAX_ID_LENGTH) {
    return { valid: false, error: `Function ID too long (max ${MAX_ID_LENGTH} characters)` };
  }
  
  // Allow: alphanumeric, colons, slashes, dots, @, hyphens, underscores
  // This matches Go function ID format: package::function@file:line:col
  if (!/^[a-zA-Z0-9:_/@.\-]+$/.test(trimmed)) {
    return { valid: false, error: "Function ID contains invalid characters" };
  }
  
  return { valid: true };
}

function validateSearchQuery(query: string): { valid: boolean; sanitized: string; error?: string } {
  if (typeof query !== 'string') {
    return { valid: false, sanitized: '', error: "Query must be a string" };
  }
  
  // Trim whitespace
  let sanitized = query.trim();
  
  // Check minimum length (but allow empty for "show all")
  if (sanitized.length > 0 && sanitized.length < MIN_QUERY_LENGTH) {
    return { valid: false, sanitized: '', error: `Query too short (min ${MIN_QUERY_LENGTH} character)` };
  }
  
  // Limit maximum length
  if (sanitized.length > MAX_QUERY_LENGTH) {
    sanitized = sanitized.substring(0, MAX_QUERY_LENGTH);
  }
  
  // Remove null bytes and control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  // Escape special LIKE characters to prevent injection
  // In SQL LIKE, % and _ are wildcards, so we escape them
  sanitized = sanitized.replace(/[%_]/g, '\\$&');
  
  return { valid: true, sanitized };
}

function sanitizeNodeId(nodeId: string): { valid: boolean; sanitized: string; error?: string } {
  if (!nodeId || typeof nodeId !== 'string') {
    return { valid: false, sanitized: '', error: "Node ID is required" };
  }
  
  let sanitized: string;
  try {
    // Decode URL encoding
    sanitized = decodeURIComponent(nodeId);
  } catch (e) {
    // If decoding fails, use as-is but log warning
    sanitized = nodeId;
  }
  
  sanitized = sanitized.trim();
  
  if (sanitized === '') {
    return { valid: false, sanitized: '', error: "Node ID cannot be empty" };
  }
  
  if (sanitized.length > MAX_ID_LENGTH) {
    return { valid: false, sanitized: '', error: `Node ID too long (max ${MAX_ID_LENGTH} characters)` };
  }
  
  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  // Validate format: allow alphanumeric, colons, slashes, dots, @, hyphens, underscores
  if (!/^[a-zA-Z0-9:_/@.\-]+$/.test(sanitized)) {
    return { valid: false, sanitized: '', error: "Node ID contains invalid characters" };
  }
  
  return { valid: true, sanitized };
}

// Type definitions
interface FunctionRow {
  id: string;
  name: string;
}

interface GraphNode {
  data: {
    id: string;
    label: string;
  };
}

interface GraphEdge {
  data: {
    id: string;
    source: string;
    target: string;
  };
}

interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface SourceRow {
  file_name: string;
  start_line: number;
  end_line: number;
  code: string;
}

async function main() {
  const app = Fastify({ logger: true });

  // Register CORS support
  await app.register(cors, {
    origin: true
  });

  // Connect to SQLite database in read-only mode
  // In Docker, the path will be /app/cpg.db, locally it's ../../cpg.db
  const dbPath = process.env.DB_PATH || "../../cpg.db";
  let db: Database.Database;
  
  try {
    db = new Database(dbPath, { readonly: true });
    app.log.info(`Connected to database: ${dbPath}`);
  } catch (error) {
    app.log.error(`Failed to connect to database: ${error}`);
    process.exit(1);
  }

  // Health check endpoint (after database connection)
  app.get("/health", async (request, reply) => {
    try {
      // Check database connection
      db.prepare("SELECT 1").get();
      return reply.send({ 
        status: "ok", 
        database: "connected",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      app.log.error(error, "Health check failed");
      return reply.code(503).send({ 
        status: "error", 
        database: "disconnected",
        timestamp: new Date().toISOString()
      });
    }
  });

  // GET /functions?q=<query>
  app.get<{ Querystring: { q?: string } }>("/functions", async (request, reply) => {
    try {
      const rawQuery = request.query.q || "";
      
      // Validate and sanitize input
      const validation = validateSearchQuery(rawQuery);
      if (!validation.valid) {
        return reply.code(400).send({ error: validation.error || "Invalid query" });
      }
      
      const sanitizedQuery = validation.sanitized;
      
      // If query is empty after sanitization, return empty results
      if (sanitizedQuery === '') {
        return reply.send([]);
      }
      
      const stmt = db.prepare(`
        SELECT id, name 
        FROM nodes 
        WHERE kind = 'function' AND name LIKE ?
        LIMIT 50
      `);
      
      // Use parameterized query - safe from SQL injection
      const rows = stmt.all(`%${sanitizedQuery}%`) as FunctionRow[];
      return reply.send(rows);
    } catch (error) {
      app.log.error(error, "Error in /functions endpoint");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // GET /function/graph?id=... - use query parameter to avoid issues with slashes in ID
  app.get<{ Querystring: { id: string } }>("/function/graph", async (request, reply) => {
    try {
      const rawFunctionId = request.query.id || '';
      
      // Validate and sanitize input
      const validation = sanitizeNodeId(rawFunctionId);
      if (!validation.valid) {
        return reply.code(400).send({ error: validation.error || "Invalid function ID" });
      }
      
      const functionId = validation.sanitized;

      // Use the function_neighborhood query from the queries table
      // This query returns callers and callees of the function
      const neighborhoodStmt = db.prepare(`
        SELECT 'caller' AS direction, n.id, n.name, n.package, n.file, n.line
        FROM edges e JOIN nodes n ON n.id = e.source
        WHERE e.target = ? AND e.kind = 'call' AND n.kind = 'function'
        UNION ALL
        SELECT 'callee' AS direction, n.id, n.name, n.package, n.file, n.line
        FROM edges e JOIN nodes n ON n.id = e.target
        WHERE e.source = ? AND e.kind = 'call' AND n.kind = 'function'
        ORDER BY direction, name
      `);
      
      const neighborhoodRows = neighborhoodStmt.all(functionId, functionId) as Array<{
        direction: string;
        id: string;
        name: string;
        package: string | null;
        file: string | null;
        line: number | null;
      }>;
      
      // Get the function itself (ID is TEXT in the database)
      app.log.info(`Looking for function with ID: ${functionId}`);
      const functionStmt = db.prepare(`SELECT id, name FROM nodes WHERE id = ? AND kind = 'function'`);
      const functionRow = functionStmt.get(functionId) as { id: string; name: string } | undefined;
      
      if (!functionRow) {
        app.log.warn(`Function not found: ${functionId}`);
        // Try without kind check in case the node exists but kind is different
        const anyNodeStmt = db.prepare(`SELECT id, name, kind FROM nodes WHERE id = ?`);
        const anyNode = anyNodeStmt.get(functionId) as { id: string; name: string; kind: string } | undefined;
        if (anyNode) {
          app.log.warn(`Node exists but kind is '${anyNode.kind}', not 'function'`);
          return reply.code(400).send({ error: `Node exists but is not a function (kind: ${anyNode.kind})` });
        }
        return reply.code(404).send({ error: `Function not found: ${functionId}` });
      }
      
      app.log.info(`Found function: ${functionRow.name} (${functionRow.id})`);
      
      // Collect all unique node IDs (function + callers + callees)
      const nodeIds = new Set<string>();
      if (functionRow) {
        nodeIds.add(functionRow.id);
      }
      neighborhoodRows.forEach(row => nodeIds.add(row.id));
      
      // Format nodes for Cytoscape
      const nodes: GraphNode[] = [];
      if (functionRow) {
        nodes.push({
          data: {
            id: functionRow.id,
            label: functionRow.name || functionRow.id
          }
        });
      }
      neighborhoodRows.forEach(row => {
        nodes.push({
          data: {
            id: row.id,
            label: row.name || row.id
          }
        });
      });
      
      // Get edges between these nodes
      const nodeIdArray = Array.from(nodeIds);
      
      // Safety check: if no nodes, return empty edges
      if (nodeIdArray.length === 0) {
        const response: GraphResponse = {
          nodes,
          edges: []
        };
        return reply.send(response);
      }
      
      // Safety check: limit maximum number of nodes to prevent DoS
      if (nodeIdArray.length > MAX_NODES_IN_GRAPH) {
        app.log.warn(`Too many nodes requested: ${nodeIdArray.length}, limiting to ${MAX_NODES_IN_GRAPH}`);
        nodeIdArray.splice(MAX_NODES_IN_GRAPH);
      }
      
      // Use safe parameterized query with proper placeholders
      // better-sqlite3 handles array binding safely, but we'll use explicit placeholders
      const placeholders = nodeIdArray.map(() => '?').join(',');
      const edgesStmt = db.prepare(`
        SELECT e.source, e.target
        FROM edges e
        WHERE e.kind = 'call'
          AND e.source IN (${placeholders})
          AND e.target IN (${placeholders})
      `);
      
      // Bind parameters safely - spread array twice for source and target
      const edgeRows = edgesStmt.all(...nodeIdArray, ...nodeIdArray) as Array<{
        source: string;
        target: string;
      }>;
      
      // Format edges for Cytoscape
      const edges: GraphEdge[] = edgeRows.map((edge, index) => ({
        data: {
          id: `edge-${index}`,
          source: String(edge.source),
          target: String(edge.target)
        }
      }));
      
      const response: GraphResponse = {
        nodes,
        edges
      };
      
      return reply.send(response);
    } catch (error) {
      app.log.error(error, "Error in /function/:id/graph endpoint");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // GET /source?id=... - use query parameter to avoid issues with slashes in ID
  app.get<{ Querystring: { id: string } }>("/source", async (request, reply) => {
    try {
      const rawNodeId = request.query.id || '';
      
      // Validate and sanitize input
      const validation = sanitizeNodeId(rawNodeId);
      if (!validation.valid) {
        return reply.code(400).send({ error: validation.error || "Invalid node ID" });
      }
      
      const nodeId = validation.sanitized;

      // Check if this is an external node (starts with "ext::")
      if (nodeId.startsWith('ext::')) {
        // Get node info for external functions
        const extNodeStmt = db.prepare(`SELECT name, package, type_info FROM nodes WHERE id = ?`);
        const extNode = extNodeStmt.get(nodeId) as { name: string | null; package: string | null; type_info: string | null } | undefined;
        
        if (extNode) {
          return reply.code(404).send({ 
            error: "External function - source code not available",
            message: `This is an external function from ${extNode.package || 'standard library'}. Source code is not available in the database.`,
            node_info: {
              name: extNode.name,
              package: extNode.package,
              type_info: extNode.type_info
            }
          });
        }
        return reply.code(404).send({ error: "External node - source code not available" });
      }

      // Get node info first to find the file
      const nodeStmt = db.prepare(`SELECT file, line, end_line, name, package FROM nodes WHERE id = ?`);
      const node = nodeStmt.get(nodeId) as { 
        file: string | null; 
        line: number | null; 
        end_line: number | null;
        name: string | null;
        package: string | null;
      } | undefined;
      
      if (!node) {
        return reply.code(404).send({ error: "Node not found" });
      }
      
      if (!node.file) {
        // Node exists but has no file information
        return reply.code(404).send({ 
          error: "Source code not available",
          message: `Node "${node.name || nodeId}" exists but has no file information. This might be a generated or external node.`,
          node_info: {
            name: node.name,
            package: node.package
          }
        });
      }
      
      // Get source file content
      const sourceStmt = db.prepare(`SELECT content FROM sources WHERE file = ?`);
      const source = sourceStmt.get(node.file) as { content: string } | undefined;
      
      if (!source) {
        return reply.code(404).send({ 
          error: "Source file not found",
          message: `File "${node.file}" not found in sources table.`,
          file: node.file
        });
      }
      
      // Extract code lines
      const lines = source.content.split('\n');
      const startLine = (node.line || 1) - 1; // Convert to 0-based index
      const endLine = (node.end_line || node.line || lines.length) - 1;
      const code = lines.slice(startLine, endLine + 1).join('\n');
      
      const response: SourceRow = {
        file_name: node.file,
        start_line: node.line || 1,
        end_line: node.end_line || node.line || lines.length,
        code: code
      };
      
      return reply.send(response);
    } catch (error) {
      app.log.error(error, "Error in /source/:nodeId endpoint");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // Start server
  try {
    await app.listen({ port: 3001, host: "0.0.0.0" });
  console.log("API listening on http://localhost:3001");
  } catch (error) {
    app.log.error(error, "Failed to start server");
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
