#!/usr/bin/env node
/**
 * 用「本机正在运行的 DSH 安装」里每个插件真实的 Config schema 校验渲染结果。
 *
 * 为什么需要这个检查：DSH 的预设是声明式的，`@deepseek-ai/dsh-agent-preset` 只负责
 * 注册声明，真正挂载子插件树发生在 registry 的 `mountPreset()`。任何一行插件激活失败
 * （包括 schema 校验失败）都会让**整棵预设**挂载被拒绝，registry 把该预设标记为
 * `broken`；而 Web 端新任务选择器只渲染 `broken === undefined` 的预设，于是失败表现为
 * 「bundle 装好了、也启用了，但选择器里看不到」，没有任何可见报错。
 *
 * 这类失败最常见的来源是**上游把某个配置字段改成 `.required()` 且不给默认值**：
 * 我们渲染时只写了 `name`，本机一升级 DSH 就静默失效。`check-render.mjs` 只能校验
 * 我们自己的渲染结构，看不到上游 schema，所以需要这个脚本补位。
 *
 * 检查方式：把渲染结果里每一行插件的 `config` 交给该插件自己导出的
 * `Config['~standard'].validate()`（schemastery 的标准 schema 协议），与 Cordis
 * 启动时 `resolveConfig()` 走的是同一条路径。
 *
 * 前提：必须能读到 DSH 安装目录里的包。Desktop 版安装在 `app.asar` 内，普通 node
 * 读不了，需要
 *   ELECTRON_RUN_AS_NODE=1 "<DSH_NODE_EXECUTABLE>" scripts/check-plugin-config.mjs
 * 预设引用的 profile 插件会再从 `$DSH_PROFILE_DIR` 解析，并按需动态 import()。
 * 本脚本在找不到安装目录、或普通 node 面对 .asar 时会**跳过并返回 0**，这样 CI
 * （没有 DSH 安装）和 `npm test` 不会被卡住；跳过原因会打印出来。
 *
 * 用法:
 *   node scripts/check-plugin-config.mjs                    # 读 $DSH_INSTALL_DIR
 *   node scripts/check-plugin-config.mjs --dsh-install <dir>
 *   node scripts/check-plugin-config.mjs --quiet            # 只报失败行
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { renderPresets } from './render-presets.mjs';

const argv = process.argv.slice(2);
function arg(flag, fallback = null) {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
}
const quiet = argv.includes('--quiet');
const say = (line) => {
  if (!quiet) console.log(line);
};

const root = arg('--root') ?? process.cwd();

// ---------------------------------------------------------------------------
// 1. 定位 DSH 安装锚点
// ---------------------------------------------------------------------------

const anchor = arg('--dsh-install') ?? process.env.DSH_INSTALL_DIR ?? null;

function skip(reason) {
  console.log(`- 插件配置校验已跳过：${reason}`);
  console.log('  （这不是失败；能读到 DSH 安装目录时会自动执行。）');
  process.exit(0);
}

if (!anchor) {
  skip('未找到 DSH 安装目录（可用 --dsh-install 指定，或设置 $DSH_INSTALL_DIR）');
}

// .asar 必须先判断：普通 node 对 asar 内的路径 existsSync 恒为 false，
// 先查存在性会把「需要换 Electron 运行」误报成「安装目录无效」。
if (anchor.includes('.asar') && !process.versions.electron) {
  skip('安装目录在 app.asar 内，普通 node 无法读取；请改用 ELECTRON_RUN_AS_NODE=1 "<DSH 可执行文件>" 运行本脚本');
}

const anchorManifest = join(anchor, 'package.json');
if (!existsSync(anchorManifest)) {
  skip(`DSH 安装目录无效：${anchorManifest} 不存在`);
}

const anchorRequire = createRequire(anchorManifest);

// 预设可以挂载 profile 安装的插件（例如 dsh-plugin-codegraph-tool），这类包不在
// DSH 安装目录的依赖树里，只从 profile 的 package.json 才能解析。
const profileDir = process.env.DSH_PROFILE_DIR ?? null;
const profileRequire =
  profileDir !== null && existsSync(join(profileDir, 'package.json'))
    ? createRequire(join(profileDir, 'package.json'))
    : null;
let dshVersion = '未知';
try {
  dshVersion = JSON.parse(readFileSync(anchorManifest, 'utf8')).version ?? '未知';
} catch {
  // 版本只用于报告，读不到不影响校验。
}

// ---------------------------------------------------------------------------
// 2. 渲染预设（与 check-render.mjs / install-presets.mjs 完全同源）
// ---------------------------------------------------------------------------

const flagIdx = argv.indexOf('--external-config');
const externalConfigPath =
  flagIdx !== -1 && argv[flagIdx + 1]
    ? argv[flagIdx + 1]
    : join(root, 'external-skills.local.yaml');

let rendered;
try {
  rendered = renderPresets({ root, externalConfigPath });
} catch (error) {
  console.error(`x 渲染失败：${error.message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 3. 解析一个插件包：目录 + 导出模块
// ---------------------------------------------------------------------------

/** 从某个 require 视点把 "@scope/name" 解析成 { dir, pkg, require }；失败返回 null。 */
function resolveFrom(req, specifier) {
  let manifestPath = null;
  try {
    manifestPath = req.resolve(`${specifier}/package.json`);
  } catch {
    // 包的 exports 可能不导出 ./package.json，改用入口反推。
    try {
      const entry = req.resolve(specifier);
      let dir = dirname(entry);
      for (let depth = 0; depth < 8; depth += 1) {
        const candidate = join(dir, 'package.json');
        if (existsSync(candidate)) {
          manifestPath = candidate;
          break;
        }
        const parent = dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    } catch {
      return null;
    }
  }
  if (manifestPath === null) return null;
  const dir = dirname(manifestPath);
  let pkg = null;
  try {
    pkg = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
  return { dir, pkg, require: req };
}

/** 先按 DSH 安装目录解析，再按 profile 解析（预设引用 profile 插件时用得上）。 */
function resolvePackage(specifier) {
  for (const req of [anchorRequire, profileRequire]) {
    if (req === null) continue;
    const found = resolveFrom(req, specifier);
    if (found !== null) return { ...found, fromProfile: req === profileRequire };
  }
  return null;
}

/**
 * 取一个插件的 Config schema。
 * 先按 CJS 加载；ESM-only 包（如 profile 插件）回退到动态 import()。
 * @returns {object|null} schemastery schema，或 null（该插件没有 Config）
 */
async function loadConfigSchema(specifier) {
  const found = resolvePackage(specifier);
  if (found === null) return { error: '无法从 DSH 安装目录或 profile 解析该包（可能已改名或未安装）' };

  const main = found.pkg.main ?? 'index.js';
  let mod = null;
  try {
    // 直接 require 包目录：CJS 会读 package.json 的 main。
    mod = found.require(found.dir);
  } catch {
    try {
      mod = found.require(join(found.dir, main));
    } catch {
      try {
        mod = await import(pathToFileURL(join(found.dir, main)).href);
      } catch (error) {
        // profile 插件的 peer 依赖（@deepseek-ai/dsh-tools 等）只在 DSH 安装目录里，
        // 从 profile 视点 import 时解析不到；这类行没有 config 可校验，跳过而不是误报失败。
        if (found.fromProfile) {
          return { skipped: `profile 插件无法在此视点加载（缺少 Host peer 依赖），跳过 schema 校验` };
        }
        return { error: `加载模块失败：${String(error.message).split('\n')[0]}` };
      }
    }
  }

  const schema = mod?.Config ?? mod?.default?.Config ?? null;
  return { schema };
}

// ---------------------------------------------------------------------------
// 4. 逐行校验
// ---------------------------------------------------------------------------

/**
 * 简易 YAML 解析：只取渲染结果里 `- id:` / `name:` / `config:` 结构，
 * 复用 js-yaml 更稳妥（与 check-render.mjs 一致）。
 */
const requireFromHere = createRequire(import.meta.url);
let yaml;
try {
  yaml = requireFromHere('js-yaml');
} catch {
  console.error('x 缺少 js-yaml：请先运行 npm install');
  process.exit(1);
}

let doc;
try {
  doc = yaml.load(rendered);
} catch (error) {
  console.error(`x 渲染输出不是合法 YAML：${error.message}`);
  process.exit(1);
}

const failures = [];
let checked = 0;
let skippedEntries = 0;
const schemaCache = new Map();

for (const layer of Array.isArray(doc) ? doc : []) {
  for (const entry of layer?.insert ?? []) {
    const presetId = entry?.config?.id ?? entry?.id ?? '(未命名)';
    const rows = entry?.config?.plugins;
    if (!Array.isArray(rows)) continue;
    say(`  preset ${presetId}（${rows.length} 行）`);

    for (const row of rows) {
      const name = row?.name;
      const rowId = row?.id ?? '(无 id)';

      // 内置分组/宏（cordis:group 等）不是 npm 包，跳过。
      if (typeof name !== 'string' || name.startsWith('cordis:')) {
        skippedEntries += 1;
        continue;
      }
      // 分组本身没有 Config。
      if (row.group === true) {
        skippedEntries += 1;
        continue;
      }

      if (!schemaCache.has(name)) schemaCache.set(name, loadConfigSchema(name));
      const loaded = await schemaCache.get(name);

      if (loaded.skipped !== undefined) {
        skippedEntries += 1;
        say(`    .  ${rowId}（${loaded.skipped}）`);
        continue;
      }
      if (loaded.error !== undefined) {
        failures.push(`${presetId} / ${rowId}（${name}）：${loaded.error}`);
        say(`    x  ${rowId}  ${name}`);
        continue;
      }
      if (loaded.schema === null || loaded.schema === undefined) {
        skippedEntries += 1;
        say(`    .  ${rowId}（无 Config，跳过）`);
        continue;
      }

      const standard = loaded.schema['~standard'];
      if (standard === undefined || typeof standard.validate !== 'function') {
        skippedEntries += 1;
        say(`    .  ${rowId}（Config 不是标准 schema，跳过）`);
        continue;
      }

      let result;
      try {
        result = standard.validate(row.config ?? {});
      } catch (error) {
        failures.push(`${presetId} / ${rowId}（${name}）：校验抛错 ${String(error.message)}`);
        say(`    x  ${rowId}  ${name}`);
        continue;
      }

      if (result?.issues) {
        checked += 1;
        const messages = result.issues.map((issue) => issue.message).join('; ');
        failures.push(`${presetId} / ${rowId}（${name}）：${messages}`);
        say(`    x  ${rowId}  ${name}`);
        for (const issue of result.issues) say(`         ${issue.message}`);
      } else {
        checked += 1;
        say(`    ok ${rowId}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 5. 报告
// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\nx 插件配置校验失败：${failures.length} 行（DSH ${dshVersion} @ ${anchor}）`);
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(
    '\n  这些行在本机启动时会因 schema 校验失败，导致整棵预设挂载失败并被标记 broken；\n' +
      '  Web 端新任务选择器不渲染 broken 预设，所以症状是「预设装了却看不到」。\n' +
      '  修 scripts/render-presets.mjs 里对应的 toolMap 渲染分支，再重跑 install:presets。',
  );
  process.exit(1);
}

console.log(
  `\n✓ 插件配置校验通过：${checked} 行匹配 DSH ${dshVersion} 的真实 schema` +
    (skippedEntries > 0 ? `，${skippedEntries} 行无需校验` : '') +
    `（${anchor}）`,
);
