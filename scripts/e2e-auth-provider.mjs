import http from "node:http";
import {URL} from "node:url";

const port = Number(process.env.E2E_AUTH_PORT ?? 4010);
const users = new Map();
const tokens = new Map();

function json(res, status, body) {
  res.writeHead(status, {"content-type": "application/json"});
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

  if (req.method === "GET" && url.pathname === "/health") return json(res, 200, {ok: true});

  if (req.method === "POST" && url.pathname === "/auth/v1/signup") {
    const body = await readBody(req);
    const email = body.email;
    const id = `e2e-${Buffer.from(email).toString("hex").slice(0, 24)}`;
    const token = `e2e-confirm-${Buffer.from(email).toString("hex")}`;
    users.set(email, {id, email, confirmed: false, password: body.password});
    tokens.set(token, email);
    return json(res, 200, {
      user: {id, email},
      session: null,
    });
  }

  if (req.method === "POST" && url.pathname === "/auth/v1/verify") {
    const body = await readBody(req);
    if (!tokens.has(body.token_hash) || !["signup", "recovery"].includes(body.type)) {
      return json(res, 403, {message: "Email link is invalid or has expired"});
    }
    const email = tokens.get(body.token_hash);
    const user = users.get(email);
    user.confirmed = true;
    return json(res, 200, {
      access_token: `e2e-access-${user.id}`,
      refresh_token: `e2e-refresh-${user.id}`,
      expires_in: 3600,
      user: {id: user.id, email: user.email},
    });
  }

  if (req.method === "POST" && url.pathname === "/auth/v1/recover") {
    const body = await readBody(req);
    const user = users.get(body.email);
    if (user) {
      const token = `e2e-recovery-${Buffer.from(body.email).toString("hex")}`;
      tokens.set(token, body.email);
    }
    return json(res, 200, {message: "Password reset email sent"});
  }

  if (req.method === "GET" && url.pathname === "/auth/v1/user") {
    const token = req.headers.authorization?.replace(/^Bearer /, "");
    const user = [...users.values()].find((item) => `e2e-access-${item.id}` === token && item.confirmed);
    if (!user) return json(res, 401, {message: "Invalid token"});
    return json(res, 200, {id: user.id, email: user.email});
  }

  if (req.method === "POST" && url.pathname === "/auth/v1/token") {
    return json(res, 401, {message: "Password login is not part of the E2E provider"});
  }

  if (req.method === "GET" && url.pathname === "/test/recovery") {
    const email = url.searchParams.get("email");
    const token = [...tokens.entries()].find(([key, value]) => value === email && key.startsWith("e2e-recovery-"))?.[0];
    if (!token) return json(res, 404, {error: "No recovery token"});
    return json(res, 200, {
      url: `http://localhost:3000/auth/recover?token_hash=${encodeURIComponent(token)}&type=recovery`,
    });
  }

  if (req.method === "GET" && url.pathname === "/test/confirmation") {
    const email = url.searchParams.get("email");
    const token = [...tokens.entries()].find(([, value]) => value === email)?.[0];
    if (!token) return json(res, 404, {error: "No confirmation token"});
    return json(res, 200, {
      url: `http://localhost:3000/auth/confirm?token_hash=${encodeURIComponent(token)}&type=signup`,
    });
  }

  return json(res, 404, {error: "Not found"});
});

server.listen(port, "127.0.0.1", () => {
  console.log(`E2E auth provider listening on ${port}`);
});
