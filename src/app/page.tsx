import App from "@/components/App";

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const { view } = await searchParams;
  return <App initialTab={view === "summary" ? "summary" : "communities"} />;
}
