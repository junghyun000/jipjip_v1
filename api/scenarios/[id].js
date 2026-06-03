import { getScenario, updateScenario, deleteScenario, validateScenario, readJsonBody, sendJson } from "../_db.js";

function resolveId(req) {
  if (req.query && req.query.id) return req.query.id;
  const path = (req.url || "").split("?")[0];
  return decodeURIComponent(path.split("/").pop() || "");
}

export default async function handler(req, res) {
  const id = resolveId(req);
  try {
    if (req.method === "GET") {
      const scenario = await getScenario(id);
      if (!scenario) {
        sendJson(res, 404, { error: "Not found" });
        return;
      }
      sendJson(res, 200, scenario);
      return;
    }
    if (req.method === "PUT") {
      const body = await readJsonBody(req);
      const errors = validateScenario(body);
      if (errors) {
        sendJson(res, 422, { errors });
        return;
      }
      const updated = await updateScenario(id, body);
      if (!updated) {
        sendJson(res, 404, { error: "Not found" });
        return;
      }
      sendJson(res, 200, updated);
      return;
    }
    if (req.method === "DELETE") {
      const result = await deleteScenario(id);
      if (!result) {
        sendJson(res, 503, { error: "DATABASE_URL is not configured" });
        return;
      }
      if (result.notFound) {
        sendJson(res, 404, { error: "Not found" });
        return;
      }
      if (result.forbidden) {
        sendJson(res, 400, { error: "기본 시나리오는 삭제할 수 없습니다." });
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
