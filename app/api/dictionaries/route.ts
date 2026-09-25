import { getDictionaries } from "../../../lib/server/domain";
import { errorResponse, json } from "../../../lib/server/http";

export async function GET() {
  try {
    return json(await getDictionaries());
  } catch (error) {
    return errorResponse(error);
  }
}
