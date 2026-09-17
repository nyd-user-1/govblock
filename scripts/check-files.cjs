// Bounded typecheck: the app's tsconfig, only the named files as roots.
const ts = require("typescript")
const path = require("path")
const web = process.cwd()
const configPath = path.join(web, "tsconfig.json")
const parsed = ts.parseJsonConfigFileContent(ts.readConfigFile(configPath, ts.sys.readFile).config, ts.sys, web)
const roots = process.argv.slice(2).map((f) => path.resolve(web, f))
const program = ts.createProgram(roots, { ...parsed.options, noEmit: true, incremental: false })
let errors = 0
for (const file of roots) {
  const sf = program.getSourceFile(file)
  if (!sf) {
    console.log("missing", file)
    continue
  }
  for (const d of [...program.getSyntacticDiagnostics(sf), ...program.getSemanticDiagnostics(sf)]) {
    const { line, character } = d.file ? d.file.getLineAndCharacterOfPosition(d.start) : { line: 0, character: 0 }
    console.log(`${path.relative(web, d.file?.fileName ?? file)}:${line + 1}:${character + 1} ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`)
    errors++
  }
}
console.log(`${roots.length} files, ${program.getSourceFiles().length} in program, ${errors} errors`)
