import QRCode from "qrcode";
import { NextRequest } from "next/server";
import { requireUser } from "../../../lib/server/auth";
import { errorResponse } from "../../../lib/server/http";

const MAX_QR_DATA_LENGTH = 2048;

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);

    const data = request.nextUrl.searchParams.get("data");
    if (!data) return new Response("Missing data", { status: 400 });
    if (data.length > MAX_QR_DATA_LENGTH) {
      return new Response("QR data is too long", { status: 413 });
    }

    const svg = await QRCode.toString(data, {
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
