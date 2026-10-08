import fs from "node:fs";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { NextRequest } from "next/server";
import { requireUser } from "../../../../../lib/server/auth";
import { query } from "../../../../../lib/server/db";
import { errorResponse } from "../../../../../lib/server/http";

export const runtime = "nodejs";

type PassPdfRow = {
  id: number;
  number: string;
  subject_type: "worker" | "vehicle";
  organization_name: string | null;
  full_name: string | null;
  position: string | null;
  iin: string | null;
  make: string | null;
  plate: string | null;
  trailer: string | null;
  valid_from: string;
  valid_to: string;
  zones: string | null;
  approved_by: string | null;
  qr_payload: string;
};

function date(value: string) {
  return new Date(value).toLocaleDateString("ru-RU");
}

function safeFileName(value: string) {
  return value.replace(/[^A-Za-zА-Яа-я0-9_.-]+/g, "_");
}

function contentDisposition(fileName: string, fallbackName: string) {
  const asciiFallback = fallbackName.replace(/[^A-Za-z0-9_.-]+/g, "_") || "pass.pdf";
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function fontPath() {
  const candidates = [
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/calibri.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function collectPdf(doc: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function addRow(doc: PDFKit.PDFDocument, label: string, value: string | null | undefined, y: number) {
  doc.fillColor("#6b7280").fontSize(9).text(label, 48, y);
  doc.fillColor("#111827").fontSize(12).text(value || "-", 48, y + 14, { width: 330 });
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

    const result = await query<PassPdfRow>(
      `SELECT p.*, a.number AS application_number, o.name AS organization_name,
              COALESCE(
                (
                  SELECT string_agg(ap.department || ': ' || COALESCE(u.name, ap.department) || COALESCE(', ' || to_char(ap.decided_at, 'DD.MM.YYYY, HH24:MI:SS'), ''), '; ' ORDER BY ap.decided_at, ap.id)
                  FROM approvals ap
                  LEFT JOIN users u ON u.id = ap.approver_user_id
                  WHERE ap.application_id = a.id AND ap.decision = 'approved' AND ap.cycle = a.approval_cycle
                ),
                p.approved_by
              ) AS approved_by,
              aw.full_name, aw.position, aw.iin,
              av.make, av.plate, av.trailer,
              string_agg(DISTINCT z.name, ', ' ORDER BY z.name) AS zones
       FROM passes p
       JOIN applications a ON a.id = p.application_id
       LEFT JOIN organizations o ON o.id = a.organization_id
       LEFT JOIN application_workers aw ON p.subject_type = 'worker' AND aw.id = p.subject_id
       LEFT JOIN application_vehicles av ON p.subject_type = 'vehicle' AND av.id = p.subject_id
       LEFT JOIN pass_zones pz ON pz.pass_id = p.id
       LEFT JOIN zones z ON z.id = pz.zone_id
       WHERE p.id = $1 AND ${scope}
       GROUP BY p.id, a.id, o.name, aw.id, av.id`,
      params,
    );
    const pass = result.rows[0];
    if (!pass) return new Response("Not found", { status: 404 });

    const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: `Пропуск ${pass.number}` } });
    const cyrillicFont = fontPath();
    if (cyrillicFont) doc.font(cyrillicFont);

    doc.rect(32, 32, 531, 330).lineWidth(1).strokeColor("#d4d4d8").stroke();
    doc.rect(32, 32, 531, 56).fill("#032c4f");
    doc.fillColor("#ffffff").fontSize(22).text("КПП", 48, 49);
    doc.fontSize(14).text(`Пропуск № ${pass.number}`, 120, 52);

    const isWorker = pass.subject_type === "worker";
    doc.fillColor("#032c4f").fontSize(18).text(isWorker ? "Пропуск для работника" : "Пропуск для автотранспорта", 48, 110);
    doc.fillColor("#6b7280").fontSize(10).text("QR проверяется только через сервер системы", 48, 134);

    const qrPng = await QRCode.toBuffer(pass.qr_payload, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 180,
    });
    doc.image(qrPng, 360, 118, { width: 170, height: 170 });
    doc.fillColor("#111827").fontSize(9).text(pass.number, 360, 294, { width: 170, align: "center" });

    addRow(doc, "Наименование организации", pass.organization_name, 158);
    if (isWorker) {
      addRow(doc, "Ф.И.О. работника", pass.full_name, 204);
      addRow(doc, "Должность", pass.position, 250);
      addRow(doc, "ИИН", pass.iin, 296);
    } else {
      addRow(doc, "Марка автотранспорта", pass.make, 204);
      addRow(doc, "Гос. номер", pass.plate, 250);
      addRow(doc, "Номер прицепа", pass.trailer || "-", 296);
    }

    doc.moveTo(48, 382).lineTo(548, 382).strokeColor("#e4e4e7").stroke();
    addRow(doc, "Срок действия пропуска", `${date(pass.valid_from)} - ${date(pass.valid_to)}`, 402);
    addRow(doc, "Наименование объекта", pass.zones || "-", 448);
    addRow(doc, "Утвердил", pass.approved_by || "-", 494);

    if (isWorker) {
      doc.fillColor("#6b7280").fontSize(10).text("Пропуск действителен при предъявлении удостоверения личности.", 48, 560, { width: 500 });
    }

    doc.fillColor("#9ca3af").fontSize(8).text(`Сформировано системой: ${new Date().toLocaleString("ru-RU")}`, 48, 790);

    const pdf = await collectPdf(doc);
    const filename = `${safeFileName(pass.number)}.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(filename, `pass-${pass.id}.pdf`),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
