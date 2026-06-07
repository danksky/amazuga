import { buildOgImageBuffer } from "@/lib/server/og-image";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();

  const photoFiles = (["photo1", "photo2", "photo3"] as const)
    .map((k) => form.get(k))
    .filter((v): v is File => v instanceof File);

  if (photoFiles.length === 0) {
    return new Response("No photos", { status: 400 });
  }

  const price = parseFloat(String(form.get("price") ?? ""));
  const listingType = (form.get("listingType") ?? "sale") as "sale" | "rent";
  const propertyType = String(form.get("propertyType") ?? "House");
  const beds = parseFloat(String(form.get("beds") ?? "")) || null;
  const baths = parseFloat(String(form.get("baths") ?? "")) || null;
  const area = parseFloat(String(form.get("area") ?? "")) || null;

  if (!isFinite(price) || price <= 0) {
    return new Response("Invalid price", { status: 400 });
  }

  const photoBuffers = await Promise.all(
    photoFiles.map(async (f) => Buffer.from(await f.arrayBuffer())),
  );

  const png = await buildOgImageBuffer({
    photoBuffers,
    priceRwf: price * 1_000_000,
    marketingType: listingType,
    propertyType,
    beds,
    baths,
    areaSqm: area,
  });

  return new Response(png.buffer as ArrayBuffer, {
    headers: { "Content-Type": "image/png" },
  });
}
