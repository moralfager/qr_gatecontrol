import { NextRequest } from "next/server";
import { getCurrentUser } from "../../../lib/server/auth";
import { errorResponse, json } from "../../../lib/server/http";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    return json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
