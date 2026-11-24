import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");

// Exercise the real adapter with the Auth SDK as the network boundary.
function loadAdapter(createServerClient) {
  const file = new URL("../src/utils/supabase/middleware.ts", import.meta.url);
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const testModule = { exports: {} };
  runInNewContext(compiled, {
    module: testModule,
    exports: testModule.exports,
    require: (name) => {
      if (name === "@supabase/ssr") return { createServerClient };
      if (name === "./config") return { getSupabaseConfig: () => ({ url: "https://example.supabase.co", key: "test-publishable-key" }) };
      return require(name);
    },
  });
  return testModule.exports.updateSession;
}

test("anonymous requests still verify claims and can reach the public workspace", async () => {
  let checks = 0;
  const updateSession = loadAdapter(() => ({ auth: { getClaims: async () => { checks++; return { data: null }; } } }));
  const response = await updateSession(new NextRequest("https://example.test/"));
  assert.equal(checks, 1);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);
});

test("refresh passes cookies to the request and browser, preserving cache headers across writes", async () => {
  const request = new NextRequest("https://example.test/?view=summary", { headers: { cookie: "sb-test-auth-token=expired" } });
  const updateSession = loadAdapter((_url, _key, options) => ({
    auth: {
      getClaims: async () => {
        assert.equal(options.cookies.getAll().find((cookie) => cookie.name === "sb-test-auth-token").value, "expired");
        options.cookies.setAll([
          { name: "sb-test-auth-token", value: "refreshed", options: { path: "/", secure: true, sameSite: "lax" } },
        ], { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0", Expires: "0", Pragma: "no-cache" });
        options.cookies.setAll([
          { name: "sb-test-verifier", value: "", options: { path: "/", maxAge: 0 } },
        ], {});
        return { data: { claims: { sub: "test-user" } } };
      },
    },
  }));
  const response = await updateSession(request);
  assert.equal(request.cookies.get("sb-test-auth-token").value, "refreshed");
  assert.equal(response.cookies.get("sb-test-auth-token").value, "refreshed");
  assert.equal(response.cookies.get("sb-test-auth-token").secure, true);
  assert.equal(response.cookies.get("sb-test-verifier").value, "");
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  assert.equal(response.headers.get("expires"), "0");
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.match(response.headers.get("x-middleware-request-cookie"), /sb-test-auth-token=refreshed/);
});
