import type { Metadata } from "next";
import type { ImportMap } from "payload";
import configPromise from "../../../payload-config";
import { RootPage, generatePageMetadata } from "@payloadcms/next/views";

import { importMap } from "../../../payload-importmap";

type PageProps = {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  return RootPage({
    config: configPromise,
    importMap: importMap as ImportMap,
    params: Promise.resolve({ segments: resolvedParams.segments ?? [] }),
    searchParams: Promise.resolve(resolvedSearchParams ?? {}),
  });
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  return generatePageMetadata({
    config: configPromise,
    params: Promise.resolve({ segments: resolvedParams.segments ?? [] }),
    searchParams: Promise.resolve(resolvedSearchParams ?? {}),
  });
}
