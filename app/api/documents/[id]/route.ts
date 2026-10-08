import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { requireUser } from "../../../../lib/server/auth";
import { query } from "../../../../lib/server/db";
import { errorResponse } from "../../../../lib/server/http";

type DocumentRow = {
  id: number;
  original_name: string;
  stored_path: string;
  mime_type: string;
  application_id: number;
};

function contentDisposition(name: string, download: boolean) {
  const fallback = name.replace(/[^\x20-\x7E]+/g, "_").replace(/"/g, "'");
  return `${download ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request, ["admin", "approver", "contractor"]);
    const { id } = await context.params;
    const params: unknown[] = [Number(id)];
    let scope = "true";
    if (user.role === "contractor") {
      params.push(user.id, user.organization_id);
      scope = "(a.created_by = $2 OR a.organization_id = $3)";
    }

    const result = await query<DocumentRow>(
      `SELECT d.id, d.original_name, d.stored_path, d.mime_type, d.application_id
       FROM documents d
       JOIN applications a ON a.id = d.application_id
       WHERE d.id = $1 AND ${scope}
       LIMIT 1`,
      params,
    );
    const document = result.rows[0];
    if (!document) return new Response("Not found", { status: 404 });

    const absolutePath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), document.stored_path);
    const workspaceRoot = path.resolve(/*turbopackIgnore: true*/ process.cwd());
    if (!absolutePath.startsWith(workspaceRoot)) {
      return new Response("Invalid path", { status: 400 });
    }

    const file = await readFile(absolutePath);
    const download = request.nextUrl.searchParams.get("download") === "1";
    return new Response(file, {
      headers: {
        "Content-Type": document.mime_type || "application/octet-stream",
        "Content-Disposition": contentDisposition(document.original_name, download),
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
