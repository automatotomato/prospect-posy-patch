// Ambient declaration for MCP tool files that execute in the Deno edge runtime.
// The bundled function has process.env available via Deno's Node.js compatibility.
declare const process: { env: Record<string, string | undefined> };
