const http = require("http");
const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

function postJson(pathname, body) {
  const port = Number(process.env.PORT || 3000);
  const payload = JSON.stringify(body);

  const options = {
    hostname: "localhost",
    port,
    path: pathname,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data || "{}");
          if (res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(json)}`));
          }
          resolve(json);
        } catch (e) {
          reject(new Error(`Respuesta no-JSON: ${data}`));
        }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function login(email, password) {
  return postJson("/auth/login", { email, password });
}

(async () => {
  const adminEmail = process.env.TEST_ADMIN_EMAIL;
  const adminPassword = process.env.TEST_ADMIN_PASSWORD;
  const hostEmail = process.env.TEST_HOST_EMAIL;
  const hostPassword = process.env.TEST_HOST_PASSWORD;
  const playerEmail = process.env.TEST_PLAYER_EMAIL;
  const playerPassword = process.env.TEST_PLAYER_PASSWORD;

  if (!adminEmail || !adminPassword || !hostEmail || !hostPassword || !playerEmail || !playerPassword) {
    throw new Error("Faltan TEST_* en backend/.env");
  }

  const admin = await login(adminEmail, adminPassword);
  const host = await login(hostEmail, hostPassword);
  const player = await login(playerEmail, playerPassword);

  const out =
    "@echo off\r\n" +
    `set \"TEST_ADMIN_TOKEN=${admin.token}\"\r\n` +
    `set \"TEST_HOST_TOKEN=${host.token}\"\r\n` +
    `set \"TEST_PLAYER_TOKEN=${player.token}\"\r\n` +
    "echo ✅ Tokens cargados en variables de entorno:\r\n" +
    "echo   TEST_ADMIN_TOKEN\r\n" +
    "echo   TEST_HOST_TOKEN\r\n" +
    "echo   TEST_PLAYER_TOKEN\r\n";

  const outPath = path.resolve(__dirname, "tokens.cmd");
  fs.writeFileSync(outPath, out, "utf8");

  console.log("✅ Listo. Ahora ejecuta:");
  console.log("   call dev\\tokens.cmd");
})().catch((err) => {
  console.error("❌ get-tokens failed:", err.message);
  process.exit(1);
});
