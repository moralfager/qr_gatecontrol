import QRCode from "qrcode";
import { NextRequest } from "next/server";
import { requireUser } from "../../../../../lib/server/auth";
import { query } from "../../../../../lib/server/db";
import { errorResponse } from "../../../../../lib/server/http";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request);
    const { id } = await context.params;
    const result = await query("SELECT qr_payload FROM passes WHERE id = $1", [Number(id)]);
    if (!result.rows[0]) return new Response("Not found", { status: 404 });
    const svg = await QRCode.toString(result.rows[0].qr_payload, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 220,
    });
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
