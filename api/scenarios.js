import { listScenarios, createScenario, validateScenario, readJsonBody, sendJson } from "./_db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const list = await listScenarios();
      if (!list) {
        sendJson(res, 503, { error: "DATABASE_URL is not configured" });
        return;
      }
      sendJson(res, 200, list);
      return;
    }
    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const errors = validateScenario(body);
      if (errors) {
        sendJson(res, 422, { errors });
        return;
      }
      const created = await createScenario(body);
      if (!created) {
        sendJson(res, 503, { error: "DATABASE_URL is not configured" });
        return;
      }
      sendJson(res, 201, created);
      return;
    }
    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}
