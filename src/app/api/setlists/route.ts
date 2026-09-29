import { NextResponse, type NextRequest } from "next/server";

import { createSetlist, listSetlists } from "@/lib/setlists";
import { formatZodError, setlistWriteSchema } from "@/lib/validation";

import { errorResponse, readJson } from "./respond";

export const dynamic = "force-dynamic";

/** GET /api/setlists — 保存済みセットの一覧（更新日の新しい順） */
export async function GET() {
  try {
    const setlists = await listSetlists();
    return NextResponse.json({ count: setlists.length, setlists });
  } catch (error) {
    return errorResponse(error, "[GET /api/setlists]");
  }
}

/** POST /api/setlists — body: { name, notes?, trackIds } */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (body === null) {
    return NextResponse.json({ error: "リクエストボディが不正な JSON です" }, { status: 400 });
  }

  const parsed = setlistWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力内容を確認してください", issues: formatZodError(parsed.error) },
      { status: 422 },
    );
  }

  try {
    const setlist = await createSetlist(parsed.data);
    return NextResponse.json({ setlist }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "[POST /api/setlists]");
  }
}
