const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function patchExecMethod(name) {
  const original = childProcess[name];

  childProcess[name] = function patchedExec(command, ...rest) {
    if (typeof command === "string" && command.trim().toLowerCase() === "net use") {
      const callback = rest.find((value) => typeof value === "function");
      if (callback) {
        const error = new Error("net use is unavailable in this environment");
        error.code = "EPERM";
        process.nextTick(() => callback(error));
      }

      return {
        kill() {
          return false;
        }
      };
    }

    return original.call(this, command, ...rest);
  };
}

patchExecMethod("exec");
patchExecMethod("execFile");

function toJsxMode(value) {
  switch (value) {
    case "preserve":
      return ts.JsxEmit.Preserve;
    case "react":
      return ts.JsxEmit.React;
    case "react-jsx":
      return ts.JsxEmit.ReactJSX;
    case "react-jsxdev":
      return ts.JsxEmit.ReactJSXDev;
    default:
      return ts.JsxEmit.Preserve;
  }
}

function ensureEsbuildShim() {
  const esbuildMainPath = path.join(process.cwd(), "node_modules", "esbuild", "lib", "main.js");
  const marker = "SkillMux Vitest preload shim";

  if (!fs.existsSync(esbuildMainPath)) {
    return;
  }

  const shim = String.raw`'use strict';
// SkillMux Vitest preload shim
const ts = require('typescript');

exports.version = '0.27.7';

function toJsxMode(value) {
  switch (value) {
    case 'preserve':
      return ts.JsxEmit.Preserve;
    case 'react':
      return ts.JsxEmit.React;
    case 'react-jsx':
      return ts.JsxEmit.ReactJSX;
    case 'react-jsxdev':
      return ts.JsxEmit.ReactJSXDev;
    default:
      return ts.JsxEmit.Preserve;
  }
}

function transpile(code, options = {}) {
  const result = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: toJsxMode(options.jsx),
      sourceMap: options.sourcemap === true,
      inlineSources: options.sourcemap === true
    },
    fileName: options.sourcefile ?? 'input.ts'
  });

  return {
    code: result.outputText,
    map:
      result.sourceMapText ??
      JSON.stringify({ version: 3, sources: [], names: [], mappings: "" }),
    warnings: [],
    legalComments: 'none'
  };
}

async function transform(code, options) {
  return transpile(code, options);
}

function transformSync(code, options) {
  return transpile(code, options);
}

function build() {
  throw new Error('esbuild build is unavailable in the SkillMux Vitest shim');
}

function buildSync() {
  throw new Error('esbuild build is unavailable in the SkillMux Vitest shim');
}

async function formatMessages() {
  return [];
}

async function analyzeMetafile() {
  return {};
}

function stop() {}

exports.transform = transform;
exports.transformSync = transformSync;
exports.build = build;
exports.buildSync = buildSync;
exports.formatMessages = formatMessages;
exports.analyzeMetafile = analyzeMetafile;
exports.stop = stop;
exports.default = {
  version: exports.version,
  transform,
  transformSync,
  build,
  buildSync,
  formatMessages,
  analyzeMetafile,
  stop
};
`;

  fs.writeFileSync(esbuildMainPath, shim, "utf8");
}

ensureEsbuildShim();
