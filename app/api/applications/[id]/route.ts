import { NextRequest } from "next/server";
import { requireUser } from "../../../../lib/server/auth";
import { getApplicationDetails } from "../../../../lib/server/domain";
import { errorResponse, json } from "../../../../lib/server/http";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const details = await getApplicationDetails(Number(id), user);
    if (!details) return json({ error: "Заявка не найдена" }, 404);
    return json(details);
  } catch (error) {
    return errorResponse(error);
  }
}
