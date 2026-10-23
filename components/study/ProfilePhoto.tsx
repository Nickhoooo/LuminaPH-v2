"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageIcon } from "lucide-react";

export default function ProfilePhoto({
  src,
  name,
  cover = false,
  className = "",
}: {
  src?: string;
  name: string;
  cover?: boolean;
  className?: string;
}) {
  const [failedSource, setFailedSource] = useState<string>();
  return (
    <div
      className={`relative grid shrink-0 place-items-center overflow-hidden bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 ${cover ? "h-36 w-full sm:h-52" : "size-20 rounded-2xl text-3xl font-semibold"} ${className}`}
    >
      {src && failedSource !== src ? (
        <Image
          src={src}
          alt={cover ? `${name} cover` : `${name} profile photo`}
          fill
          unoptimized
          sizes={cover ? "100vw" : "96px"}
          className="object-cover"
          onError={() => setFailedSource(src)}
        />
      ) : cover ? (
        <ImageIcon
          size={40}
          strokeWidth={1}
          aria-hidden="true"
          className="opacity-30"
        />
      ) : (
        Array.from(name.trim())[0]?.toLocaleUpperCase() || "?"
      )}
    </div>
  );
}
