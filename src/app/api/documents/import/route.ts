import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { requireActiveOrg, assertCommitteeAccess, asPermissionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReadDocuments, canManageTor } from "@/lib/types";
import type { LibraryDocumentTag } from "@/lib/documents";
import {
  createDocumentMembers,
  resolveDefaultApproverIds,
} from "@/lib/document-access";
import { logActivity } from "@/lib/activity";
import {
  buildR2Key,
  isR2Configured,
  putR2Object,
  sanitizeStorageFileName,
} from "@/lib/r2";

export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const perm = asPermissionUser(auth.user);
  if (perm.role === "ORG_TECH") {
    return NextResponse.json({ error: "System admins cannot manage documents" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const titleInput = (formData.get("title") as string | null)?.trim();
    const tagInput = (formData.get("tag") as string | null) as LibraryDocumentTag | null;
    const committeeId = (formData.get("committeeId") as string | null) || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 25 MB)" },
        { status: 400 },
      );
    }

    if (committeeId) {
      const access = assertCommitteeAccess(auth.user, committeeId);
      if (access) return access;
      if (!canReadDocuments(perm, committeeId)) {
        return NextResponse.json({ error: "Not authorized for this committee" }, { status: 403 });
      }
    }

    const title = titleInput || file.name.replace(/\.[^/.]+$/, "");
    const tag: LibraryDocumentTag = tagInput || "OTHER";

    if (tag === "TOR") {
      if (!committeeId) {
        return NextResponse.json(
          { error: "TOR must belong to a committee" },
          { status: 400 },
        );
      }
      if (!canManageTor(perm, committeeId)) {
        return NextResponse.json(
          { error: "Only the committee chair can add a TOR" },
          { status: 403 },
        );
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = file.name.toLowerCase();

    let kind: "DOCUMENT" | "SPREADSHEET" | "PRESENTATION" = "DOCUMENT";
    let bodyText = "";
    let contentJson: Record<string, unknown> = {};

    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".csv")) {
      kind = "SPREADSHEET";
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetsData: Record<string, unknown[]> = {};
      const textSummary: string[] = [];

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { header: 1 });
        sheetsData[sheetName] = jsonRows;

        textSummary.push(`--- Sheet: ${sheetName} ---`);
        for (const row of jsonRows) {
          if (Array.isArray(row) && row.length > 0) {
            textSummary.push(row.filter(Boolean).join(" | "));
          }
        }
      }

      bodyText = textSummary.join("\n");
      contentJson = {
        type: "SPREADSHEET",
        sheetNames: workbook.SheetNames,
        sheets: sheetsData,
      };
    } else if (fileName.endsWith(".docx")) {
      kind = "DOCUMENT";
      const htmlResult = await mammoth.convertToHtml({ buffer });
      const textResult = await mammoth.extractRawText({ buffer });

      bodyText = textResult.value || "";
      contentJson = {
        type: "DOCUMENT",
        html: htmlResult.value,
        text: textResult.value,
      };
    } else if (fileName.endsWith(".pdf")) {
      kind = "DOCUMENT";
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require("pdf-parse");
        const pdfData = await pdfParse(buffer);
        bodyText = pdfData.text || "";
        contentJson = {
          type: "DOCUMENT",
          text: pdfData.text,
          info: pdfData.info,
        };
      } catch {
        bodyText = buffer.toString("utf8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
        contentJson = {
          type: "DOCUMENT",
          text: bodyText,
        };
      }
    } else {
      // Plain text or fallback file import
      bodyText = buffer.toString("utf8");
      contentJson = {
        type: "DOCUMENT",
        text: bodyText,
      };
    }

    const doc = await prisma.libraryDocument.create({
      data: {
        organizationId: auth.org.organizationId,
        title,
        tag,
        source: "CREATED",
        kind,
        status: "DRAFT",
        body: bodyText,
        contentJson: contentJson as unknown as Prisma.InputJsonValue,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        committeeId,
        uploadedById: auth.user.id,
      },
    });

    if (isR2Configured()) {
      try {
        const storageKey = buildR2Key(
          "orgs",
          auth.org.organizationId,
          "library",
          doc.id,
          sanitizeStorageFileName(file.name),
        );
        await putR2Object({
          key: storageKey,
          body: buffer,
          contentType: file.type || "application/octet-stream",
        });
        await prisma.libraryDocument.update({
          where: { id: doc.id },
          data: { storageKey },
        });
      } catch (storageErr) {
        console.error("R2 store on import failed:", storageErr);
      }
    }

    const approvers = await resolveDefaultApproverIds({
      organizationId: auth.org.organizationId,
      committeeId,
      tag,
    });
    await createDocumentMembers({
      documentId: doc.id,
      ownerId: auth.user.id,
      approvers,
    });

    await logActivity({
      entityType: "LIBRARY_DOCUMENT",
      entityId: doc.id,
      action: "DOCUMENT_IMPORTED",
      actorId: auth.user.id,
      metadata: { title, kind, tag },
    });

    const full = await prisma.libraryDocument.findUnique({
      where: { id: doc.id },
      include: {
        committee: { select: { id: true, name: true, charterLetter: true } },
        uploadedBy: { select: { id: true, name: true } },
        members: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    return NextResponse.json(full, { status: 201 });
  } catch (err: unknown) {
    console.error("Document import error:", err);
    const message = err instanceof Error ? err.message : "Failed to extract and import document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
