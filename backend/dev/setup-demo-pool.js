const http = require("http");
const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const PORT = Number(process.env.PORT || 3000);

function requestJson(method, pathname, token, body) {
  const payload = body ? JSON.stringify(body) : null;

  const options = {
    hostname: "localhost",
    port: PORT,
    path: pathname,
    method,
    headers: {
      "Content-Type": "application/json",
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
  const instanceId = process.env.DEMO_INSTANCE_ID;
  if (!instanceId) throw new Error("Falta DEMO_INSTANCE_ID. Ejecuta primero: call dev\\demo-vars.cmd");

  const hostEmail = process.env.TEST_HOST_EMAIL;
  const hostPassword = process.env.TEST_HOST_PASSWORD;
  const playerEmail = process.env.TEST_PLAYER_EMAIL;
  const playerPassword = process.env.TEST_PLAYER_PASSWORD;
  if (!hostEmail || !hostPassword || !playerEmail || !playerPassword) throw new Error("Faltan TEST_HOST/TEST_PLAYER en .env");

  // Token host y player
  const hostLogin = await login(hostEmail, hostPassword);
  const playerLogin = await login(playerEmail, playerPassword);

  const hostToken = hostLogin.token;
  const playerToken = playerLogin.token;

  // 1) Crear pool (si ya existe una con el mismo nombre, NO la reusamos por ahora; creamos nueva)
  const poolName = "Demo Pool (Sprint 1)";
  const createdPool = await requestJson("POST", "/pools", hostToken, {
    tournamentInstanceId: instanceId,
    name: poolName,
    description: "Pool demo para pruebas de Sprint 1",
    timeZone: "America/Bogota",
    deadlineMinutesBeforeKickoff: 10,
  });

  const poolId = createdPool.id;
  console.log("✅ Pool creada:", poolId);

  // 2) Crear invitación
  const invite = await requestJson("POST", `/pools/${poolId}/invites`, hostToken, {});
  console.log("✅ Invite creado. Code:", invite.code);

  // 3) Player se une con el código
  await requestJson("POST", "/pools/join", playerToken, { code: invite.code });
  console.log("✅ Player unido al pool");

  // 4) Guardar vars para CMD
  const out =
    "@echo off\r\n" +
    `set \"DEMO_POOL_ID=${poolId}\"\r\n` +
    `set \"DEMO_INVITE_CODE=${invite.code}\"\r\n` +
    "echo ✅ Demo pool listo. Variables:\r\n" +
    "echo   DEMO_POOL_ID\r\n" +
    "echo   DEMO_INVITE_CODE\r\n";

  fs.writeFileSync(path.resolve(__dirname, "pool-vars.cmd"), out, "utf8");
  console.log("✅ Listo. Ahora ejecuta:");
  console.log("   call dev\\pool-vars.cmd");
})().catch((err) => {
  console.error("❌ setup-demo-pool failed:", err.message);
  process.exit(1);
});
