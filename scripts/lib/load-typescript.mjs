// Run the app's TypeScript modules from maintenance scripts and Node tests.
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

const sourceRoot = new URL("../../src/", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return nextResolve(specifier, { ...context, conditions: [...context.conditions, "react-server"] });
    }
    if (specifier === "next/cache") return nextResolve("next/cache.js", context);
    if (specifier.startsWith("@/")) return nextResolve(`${sourceRoot}${specifier.slice(2)}.ts`, context);
    if (context.parentURL?.startsWith(sourceRoot) && specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) {
      return nextResolve(new URL(`${specifier}.ts`, context.parentURL).href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.startsWith(sourceRoot) || !url.endsWith(".ts")) return nextLoad(url, context);
    const { outputText } = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      fileName: new URL(url).pathname,
    });
    return { format: "module", source: outputText, shortCircuit: true };
  },
});
