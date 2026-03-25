const adapterWorkerTemplatePath = new URL(
  "../../node_modules/@sveltejs/adapter-cloudflare/files/worker.js",
  import.meta.url,
);
const generatedWorkerPath = new URL("../../.svelte-kit/cloudflare/app-worker.js", import.meta.url);
const rootWorkerPath = new URL("../../worker.js", import.meta.url);

const generatedWorkerFile = Bun.file(adapterWorkerTemplatePath);

if (!(await generatedWorkerFile.exists())) {
  throw new Error("Expected adapter worker template to exist after vite build");
}

const generatedWorkerSource = (await generatedWorkerFile.text())
  .replaceAll(
    '"SERVER"',
    '"../output/server/index.js"',
  )
  .replaceAll(
    '"MANIFEST"',
    '"../cloudflare-tmp/manifest.js"',
  );

await Bun.write(generatedWorkerPath, generatedWorkerSource);

await Bun.write(
  rootWorkerPath,
  [
    "import app from './.svelte-kit/cloudflare/app-worker.js';",
    "import { proxyToSandbox } from '@cloudflare/sandbox';",
    "",
    "export { Sandbox } from '@cloudflare/sandbox';",
    "export { TerminalSession } from './src/lib/server/terminal/durable-object.ts';",
    "",
    "export default {",
    "  async fetch(request, env, ctx) {",
    "    const proxyResponse = await proxyToSandbox(request, env);",
    "    if (proxyResponse) return proxyResponse;",
    "    return app.fetch(request, env, ctx);",
    "  },",
    "};",
    "",
  ].join("\n"),
);
