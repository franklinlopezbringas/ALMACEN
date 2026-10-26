import { ModulePage } from "@/features/module-page";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  return <ModulePage role="MEMBER" section={(await params).section} />;
}
