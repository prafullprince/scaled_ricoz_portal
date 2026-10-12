import { getPublicCatalogue } from "@/lib/products/catalogue.server";

export async function GET(request: Request) {
  const result = await getPublicCatalogue(new URL(request.url).searchParams.toString());
  return Response.json(result, {
    status: result.ok ? 200 : result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
