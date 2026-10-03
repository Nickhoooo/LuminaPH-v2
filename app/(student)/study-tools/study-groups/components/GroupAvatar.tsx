"use client";

import Image from "next/image";
import { useState } from "react";

export default function GroupAvatar({
  name,
  src,
}: {
  name: string;
  src?: string;
}) {
  const [failedSource, setFailedSource] = useState<string>();
  return (
    <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-2xl font-semibold text-emerald-900 dark:text-emerald-200">
      {src && failedSource !== src ? (
        <Image
          src={src}
          alt=""
          width={56}
          height={56}
          unoptimized
          className="size-full object-cover"
          onError={() => setFailedSource(src)}
        />
      ) : (
        Array.from(name.trim())[0]?.toLocaleUpperCase() || "?"
      )}
    </span>
  );
}
