"use client";

import { useEffect, useState } from "react";

/**
 * 閲覧者のタイムゾーンで日時を表示する。
 * サーバー（コンテナは UTC）で整形すると hydration の差分になるため、
 * マウント後にブラウザ側で整形する。
 */
export function LocalDateTime({ iso, className = "" }: { iso: string; className?: string }) {
  const [text, setText] = useState("");

  useEffect(() => {
    setText(
      new Date(iso).toLocaleString("ja-JP", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }, [iso]);

  return (
    <time dateTime={iso} className={className}>
      {text}
    </time>
  );
}
