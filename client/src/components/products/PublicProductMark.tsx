"use client";

import Image from "next/image";
import { Boxes } from "lucide-react";
import { useState } from "react";
import type { PublicProduct } from "@/lib/products/catalogue";

export function PublicProductMark({
  product,
  large = false,
  cover = false,
}: {
  product: PublicProduct;
  large?: boolean;
  cover?: boolean;
}) {
  const [failedThumbnailId, setFailedThumbnailId] = useState<string | null>(null);
  const containerClass = cover
    ? "absolute inset-0 flex items-center justify-center overflow-hidden text-white/75"
    : `relative flex shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-(--brand-border) bg-(--brand-red-pale) text-(--brand-red) ${large ? "size-24" : "size-14"}`;

  return (
    <span className={containerClass}>
      <Boxes size={cover ? 56 : large ? 36 : 24} aria-hidden="true" className="absolute" />
      {product.thumbnail && failedThumbnailId !== product.id ? (
        <Image
          src={product.thumbnail}
          alt=""
          fill
          unoptimized
          sizes={cover ? "100vw" : large ? "96px" : "56px"}
          onError={() => setFailedThumbnailId(product.id)}
          className={`z-10 ${cover ? "object-cover" : "object-contain p-2"}`}
        />
      ) : null}
    </span>
  );
}
