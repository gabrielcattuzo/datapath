// Gera dist/app.js, dist/index.html (arquivo único, abre direto no navegador)
// e dist/artifact.html (mesma página sem <html>/<head>/<body>).
// Com --test, compila só test/check.ts para dist/test.js.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });

if (process.argv.includes("--test")) {
  await build({ entryPoints: ["test/check.ts"], bundle: true, platform: "node", format: "esm", outfile: "dist/test.js", logLevel: "warning" });
  process.exit(0);
}

const r = await build({ entryPoints: ["src/main.ts"], bundle: true, format: "iife", target: "es2020", minify: true, write: false, logLevel: "warning" });
const js = r.outputFiles[0].text;
writeFileSync("dist/app.js", js);

const css = ["base", "board", "panels"].map(n => readFileSync(`css/${n}.css`, "utf8")).join("\n");
const page = readFileSync("src/page.html", "utf8");
const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Semi+Condensed:wght@400;500;600;700;800&family=Share+Tech+Mono&display=swap">`;
const safeJs = js.replace(/<\/script/gi, "<\\/script");
const miolo = `<title>Datapath DE2-115</title>\n${fonts}\n<style>\n${css}\n</style>\n${page}\n<script>\n${safeJs}\n</script>\n`;

writeFileSync("dist/artifact.html", miolo);
writeFileSync("dist/index.html", `<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${miolo.replace(page, "").replace(`<script>\n${safeJs}\n</script>\n`, "")}</head>\n<body>\n${page}\n<script>\n${safeJs}\n</script>\n</body>\n</html>\n`);
// Versão para o CodePen: cole cada arquivo no painel correspondente
mkdirSync("dist/codepen", { recursive: true });
writeFileSync("dist/codepen/index.html", fonts + "\n" + page);
writeFileSync("dist/codepen/style.css", css);
writeFileSync("dist/codepen/script.js", js);
console.log(`dist/index.html  ${(readFileSync("dist/index.html").length / 1024).toFixed(1)} KB`);
