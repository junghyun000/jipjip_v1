import { listListings, sendJson } from "./_db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const listings = await listListings();
    if (!listings) {
      sendJson(res, 503, { error: "DATABASE_URL is not configured" });
      return;
    }
    sendJson(res, 200, listings);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}
