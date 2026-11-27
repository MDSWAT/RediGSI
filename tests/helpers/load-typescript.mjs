import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
export function sourceLoader(globals = {}) {
  const cache = new Map();
  return function load(file) {
    const filename = file instanceof URL ? fileURLToPath(file) : file;
    const resolved = path.resolve(filename);
    if (cache.has(resolved)) return cache.get(resolved);
    const exports = {};
    cache.set(resolved, exports);
    const compiled = ts.transpileModule(readFileSync(resolved, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    vm.runInNewContext(compiled, {
      exports,
      TextEncoder,
      File,
      ...globals,
      require: (id) => {
        if (!id.startsWith(".") && !id.startsWith("@/")) return require(id);
        const target = id.startsWith("@/")
          ? path.resolve(
              fileURLToPath(new URL("../../src/", import.meta.url)),
              id.slice(2),
            )
          : path.resolve(path.dirname(resolved), id);
        return load(
          existsSync(target + ".ts") ? target + ".ts" : target + ".tsx",
        );
      },
    });
    return exports;
  };
}
