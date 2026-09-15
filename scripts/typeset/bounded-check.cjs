const ts = require("typescript"); const path = require("path");
const root = process.cwd();
const cfgPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, path.dirname(cfgPath));
const files = process.argv.slice(2).map(f => path.resolve(root, f));
const program = ts.createProgram(files, { ...parsed.options, noEmit: true });
const set = new Set(files);
let n = 0;
for (const sf of program.getSourceFiles()) {
  if (!set.has(sf.fileName)) continue;
  const diags = [...program.getSyntacticDiagnostics(sf), ...program.getSemanticDiagnostics(sf)];
  for (const d of diags) { n++; const { line, character } = d.file ? d.file.getLineAndCharacterOfPosition(d.start) : { line: 0, character: 0 }; console.log(`${path.relative(root, d.file ? d.file.fileName : "?")}:${line + 1}:${character + 1} ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`); }
}
console.log(`${n} diagnostics over ${files.length} roots, ${program.getSourceFiles().length} files in program`);
