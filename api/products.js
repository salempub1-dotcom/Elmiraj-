// api/products.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function isAdmin(req) {
  const u = req.headers["x-admin-username"];
  const p = req.headers["x-admin-password"];
  return (
    u === process.env.ADMIN_USERNAME &&
    p === process.env.ADMIN_PASSWORD
  );
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ data });
    }

    if (req.method === "POST") {
      if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });

      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

      const payload = {
        name: body.name,
        price: Number(body.price),
        stock: Number(body.stock),
        category: body.category || null,
        badge: body.badge || null,
        description: body.description || null,
        benefits: body.benefits || null, // إذا عندك json/ نص
        image_url: body.image_url || null,
      };

      const { data, error } = await supabase
        .from("products")
        .insert(payload)
        .select("*")
        .single();

      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ data });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
}