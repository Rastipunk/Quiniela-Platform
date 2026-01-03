const http = require("http");
const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const PORT = Number(process.env.PORT || 3000);
const baseHeaders = { "Content-Type": "application/json" };

function requestJson(method, pathname, token, body) {
  const payload = body ? JSON.stringify(body) : null;

  const options = {
    hostname: "localhost",
    port: PORT,
    path: pathname,
    method,
    headers: {
      ...baseHeaders,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
    },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        let json;
        try {
          json = JSON.parse(data || "{}");
        } catch {
          return reject(new Error(`Respuesta no JSON (${res.statusCode}): ${data}`));
        }
        if (res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode} ${pathname}: ${JSON.stringify(json)}`));
        }
        resolve(json);
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function login(email, password) {
  return requestJson("POST", "/auth/login", null, { email, password });
}

(async () => {
  const adminEmail = process.env.TEST_ADMIN_EMAIL;
  const adminPassword = process.env.TEST_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) throw new Error("Faltan TEST_ADMIN_EMAIL/TEST_ADMIN_PASSWORD en .env");

  // 1) Login admin para obtener token fresco
  const adminLogin = await login(adminEmail, adminPassword);
  const token = adminLogin.token;

  // 2) Buscar o crear Template
  const demoKey = "demo_cup_2030";
  const templates = await requestJson("GET", "/admin/templates", token);
  let tpl = templates.find((t) => t.key === demoKey);

  if (!tpl) {
    tpl = await requestJson("POST", "/admin/templates", token, {
      key: demoKey,
      name: "Demo Cup 2030",
      description: "Template mínimo para desarrollo (Sprint 1).",
    });
    console.log("✅ Template creado:", tpl.id);
  } else {
    console.log("ℹ️ Template ya existe:", tpl.id);
  }

  // 3) Asegurar que haya una versión publicada
  // Si ya hay currentPublishedVersion, la usamos.
  let publishedVersionId = tpl.currentPublishedVersionId || (tpl.currentPublishedVersion && tpl.currentPublishedVersion.id);

  if (!publishedVersionId) {
    const dataJson = {
      meta: { name: "Demo Cup 2030", competition: "Demo Cup", seasonYear: 2030, sport: "football" },
      teams: [
        { id: "t1", name: "Tigres FC", shortName: "Tigres", code: "TIG", groupId: "A" },
        { id: "t2", name: "Leones FC", shortName: "Leones", code: "LEO", groupId: "A" },
      ],
      phases: [
        { id: "group_stage", name: "Fase de grupos", type: "GROUP", order: 1, config: { groupsCount: 1, teamsPerGroup: 2 } },
      ],
      matches: [
        {
          id: "m1",
          phaseId: "group_stage",
          kickoffUtc: "2030-01-01T20:00:00Z",
          homeTeamId: "t1",
          awayTeamId: "t2",
          matchNumber: 1,
          roundLabel: "Grupo A - J1",
          venue: "Estadio Demo",
          groupId: "A",
        },
      ],
      note: "Snapshot mínimo para dev.",
    };

    const createdVersion = await requestJson("POST", `/admin/templates/${tpl.id}/versions`, token, { dataJson });
    console.log("✅ Version DRAFT creada:", createdVersion.id);

    const published = await requestJson("POST", `/admin/templates/${tpl.id}/versions/${createdVersion.id}/publish`, token);
    publishedVersionId = published.publishedVersion.id;
    console.log("✅ Version publicada:", publishedVersionId);

    // refrescar tpl para tener currentPublishedVersionId
    const templates2 = await requestJson("GET", "/admin/templates", token);
    tpl = templates2.find((t) => t.key === demoKey);
  } else {
    console.log("ℹ️ Ya hay versión publicada:", publishedVersionId);
  }

  // 4) Buscar o crear Instance
  const instanceName = "Demo Cup 2030 (Instance)";
  const instances = await requestJson("GET", "/admin/instances", token);

  let inst = instances.find((i) => i.name === instanceName && i.templateId === tpl.id);

  if (!inst) {
    inst = await requestJson("POST", `/admin/templates/${tpl.id}/instances`, token, { name: instanceName });
    console.log("✅ Instance creada (DRAFT):", inst.id);
  } else {
    console.log("ℹ️ Instance ya existe:", inst.id, "status=", inst.status);
  }

  // 5) Activar si no está ACTIVE
  if (inst.status !== "ACTIVE") {
    const activated = await requestJson("POST", `/admin/instances/${inst.id}/activate`, token);
    inst = activated.instance || activated; // depende del shape
    console.log("✅ Instance activada:", inst.id);
  } else {
    console.log("ℹ️ Instance ya estaba ACTIVE");
  }

  // 6) Guardar variables en CMD para reutilizar
  const out =
    "@echo off\r\n" +
    `set \"DEMO_TEMPLATE_ID=${tpl.id}\"\r\n` +
    `set \"DEMO_PUBLISHED_VERSION_ID=${publishedVersionId}\"\r\n` +
    `set \"DEMO_INSTANCE_ID=${inst.id}\"\r\n` +
    "echo ✅ Demo tournament listo. Variables:\r\n" +
    "echo   DEMO_TEMPLATE_ID\r\n" +
    "echo   DEMO_PUBLISHED_VERSION_ID\r\n" +
    "echo   DEMO_INSTANCE_ID\r\n";

  fs.writeFileSync(path.resolve(__dirname, "demo-vars.cmd"), out, "utf8");
  console.log("✅ Listo. Ahora ejecuta:");
  console.log("   call dev\\demo-vars.cmd");
})().catch((err) => {
  console.error("❌ setup-demo-tournament failed:", err.message);
  process.exit(1);
});
