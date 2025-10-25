import { NextRequest } from "next/server";
import { initializeMcpClients, callMcpTool } from "../../../lib/mcpClient";

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    const ens = String(name || '').trim();
    if (!ens || !ens.includes('.')) {
      return new Response(JSON.stringify({ error: 'invalid_name' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    await initializeMcpClients();
    try {
      const res: any = await callMcpTool("get_address_by_ens_name", { name: ens });
      // Try common result shapes
      const addr = res?.address || res?.data?.address || res?.result?.address || res?.content?.[0]?.text || null;
      const m = typeof addr === 'string' ? addr.match(/0x[a-fA-F0-9]{40}/) : null;
      if (m?.[0]) {
        return new Response(JSON.stringify({ address: m[0] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    } catch (e) {
      // fallthrough to 404
    }

    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}


