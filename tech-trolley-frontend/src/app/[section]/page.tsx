import { notFound } from "next/navigation";
import { pages } from "@tech-trolley/contracts";
import { Workspace } from "@/features/dashboard/workspace";
export function generateStaticParams() {
  return [...pages, "login"].map((section) => ({ section }));
}
export const dynamicParams = false;
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (![...pages, "login"].includes(section as any)) notFound();
  return <Workspace section={section === "login" ? "overview" : section} />;
}
