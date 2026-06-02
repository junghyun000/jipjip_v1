import { deleteListing, readJsonBody, sendJson, upsertListing } from "../_db.js";

export default async function handler(req, res) {
  const id = decodeURIComponent(req.query?.id || getIdFromUrl(req.url));
  if (!id) {
    sendJson(res, 400, { error: "Listing id is required" });
    return;
  }

  try {
    if (req.method === "PUT") {
      const body = await readJsonBody(req);
      const ok = await upsertListing(id, body);
      if (!ok) {
        sendJson(res, 503, { error: "DATABASE_URL is not configured" });
        return;
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "DELETE") {
      const ok = await deleteListing(id);
      if (!ok) {
        sendJson(res, 503, { error: "DATABASE_URL is not configured" });
        return;
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

function getIdFromUrl(url) {
  return String(url || "").split("?")[0].split("/").pop() || "";
}
