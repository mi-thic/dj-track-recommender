import { NextResponse, type NextRequest } from "next/server";

import { deleteSetlist, getSetlist, updateSetlist } from "@/lib/setlists";
import { formatZodError, setlistUpdateSchema } from "@/lib/validation";

import { errorResponse, readJson } from "../respond";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const NOT_FOUND = { error: "セットリストが見つかりません" };

/** GET /api/setlists/:id — 曲順どおりの曲一覧つき */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const setlist = await getSetlist(id);
    if (!setlist) return NextResponse.json(NOT_FOUND, { status: 404 });
    return NextResponse.json({ setlist });
  } catch (error) {
    return errorResponse(error, "[GET /api/setlists/:id]");
  }
}

/** PATCH /api/setlists/:id — name / notes / trackIds のうち渡したものだけ更新 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const body = await readJson(request);
  if (body === null) {
    return NextResponse.json({ error: "リクエストボディが不正な JSON です" }, { status: 400 });
  }

  const parsed = setlistUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力内容を確認してください", issues: formatZodError(parsed.error) },
      { status: 422 },
    );
  }

  try {
    const setlist = await updateSetlist(id, parsed.data);
    if (!setlist) return NextResponse.json(NOT_FOUND, { status: 404 });
    return NextResponse.json({ setlist });
  } catch (error) {
    return errorResponse(error, "[PATCH /api/setlists/:id]");
  }
}

/** DELETE /api/setlists/:id — 曲そのものは消えない */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const deleted = await deleteSetlist(id);
    if (!deleted) return NextResponse.json(NOT_FOUND, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "[DELETE /api/setlists/:id]");
  }
}
