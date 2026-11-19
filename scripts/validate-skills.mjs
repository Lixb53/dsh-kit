#!/usr/bin/env node
/**
 * dsh-kit 校验器（零依赖）。
 *
 * 目录约定：skills/<group>/<name>/SKILL.md
 *   - <group> 是显式分组目录（product / design / frontend / backend / ...）
 *   - <name>  是技能名，必须与 frontmatter 的 name 一致
 *   - 预设通过技能名引用，渲染器据此只挂载相关分组，实现预设间技能隔离
 *
 * 检查项：
 *  1. skills/<group>/<name>/SKILL.md 存在，且以 --- 开头的 YAML frontmatter
 *  2. frontmatter 含 name、description；name 与目录名一致且为 lowercase kebab-case
 *  3. description 长度 1–1024
 *  4. 顶层 skills/<name>/SKILL.md 属于错误布局（必须归入分组）
 *  5. presets/*.yaml 的 id 与文件名一致，skills: 引用的技能全部存在
 *  6. CHANGELOG.md 含 "## [Unreleased]"
 *  7. version.txt 与 .release-please-manifest.json 的版本一致
 *
 * 用法：node scripts/validate-skills.mjs [repoRoot]
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const root = process.argv[2] ? process.argv[2] : process.cwd();
const errors = [];
const warnings = [];

const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function readText(path) {
  return readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
}

function isDir(p) {
  return existsSync(p) && statSync(p).isDirectory();
}

function listDirs(p) {
  if (!isDir(p)) return [];
  return readdirSync(p)
    .filter((n) => !n.startsWith('.') && isDir(join(p, n)))
    .sort();
}

/** 解析 SKILL.md 的 frontmatter，只取单行 key: value。 */
function parseFrontmatter(text, where) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) {
    err(`${where}: 缺少以 --- 开头的 YAML frontmatter`);
    return { data: {}, body: text };
  }
  const data = {};
  for (const rawLine of m[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, body: text.slice(m[0].length) };
}

/** 从 YAML 文本里取某个顶层 key 的列表项。 */
function parseYamlList(text, key) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^${key}:\\s*$`).test(l));
  if (start === -1) return null;
  const items = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\S/.test(line)) break; // 回到顶层 key
    const m = line.match(/^\s*-\s+(.+?)\s*$/);
    if (m) items.push(m[1].replace(/^["']|["']$/g, ''));
  }
  return items;
}

function parseYamlScalar(text, key) {
  const m = text.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

// ---------------------------------------------------------------------------
// 1–4. 技能（分组布局）
// ---------------------------------------------------------------------------

const skillsRoot = join(root, 'skills');
const skillNames = new Set();
const skillGroups = new Map(); // name -> group

if (!isDir(skillsRoot)) {
  err('缺少 skills/ 目录');
} else {
  const groups = listDirs(skillsRoot);

  if (groups.length === 0) err('skills/ 下没有任何分组目录');

  for (const groupName of groups) {
    const groupPath = join(skillsRoot, groupName);

    // 顶层若直接是 SKILL.md，说明把技能放在了 skills/ 根下，布局错误
    if (existsSync(join(groupPath, 'SKILL.md'))) {
      err(
        `skills/${groupName}/SKILL.md: 技能必须放在分组目录下，正确路径是 skills/<group>/${groupName}/SKILL.md`,
      );
      continue;
    }

    if (!KEBAB.test(groupName)) {
      err(`skills/${groupName}: 分组名不是 lowercase kebab-case`);
    }

    const skillDirs = listDirs(groupPath);
    if (skillDirs.length === 0) {
      warn(`skills/${groupName}: 分组为空`);
      continue;
    }

    for (const dirName of skillDirs) {
      const where = `skills/${groupName}/${dirName}/SKILL.md`;
      const skillPath = join(groupPath, dirName, 'SKILL.md');

      if (!existsSync(skillPath)) {
        err(`${where}: 缺少 SKILL.md`);
        continue;
      }

      const text = readText(skillPath);
      const { data, body } = parseFrontmatter(text, where);

      if (!data.name) err(`${where}: frontmatter 缺少 name`);
      if (!data.description) err(`${where}: frontmatter 缺少 description`);

      if (data.name) {
        if (!KEBAB.test(data.name)) {
          err(`${where}: name "${data.name}" 不是 lowercase kebab-case`);
        }
        if (data.name !== dirName) {
          err(`${where}: name "${data.name}" 与目录名 "${dirName}" 不一致`);
        }
        if (skillNames.has(data.name)) {
          err(`${where}: 技能名 "${data.name}" 重复（已存在于分组 ${skillGroups.get(data.name)}）`);
        }
        skillNames.add(data.name);
        skillGroups.set(data.name, groupName);
      }

      if (data.description) {
        const len = [...data.description].length;
        if (len < 1 || len > 1024) {
          err(`${where}: description 长度 ${len}，应在 1–1024 字符之间`);
        }
      }

      if (body.trim().length === 0) {
        err(`${where}: 正文为空`);
      } else if (body.length > 20000) {
        warn(`${where}: 正文 ${body.length} 字符，建议拆分或把细节移入 references/`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 5. 预设
// ---------------------------------------------------------------------------

const presetsDir = join(root, 'presets');
if (!isDir(presetsDir)) {
  err('缺少 presets/ 目录');
} else {
  const presets = readdirSync(presetsDir).filter((n) => n.endsWith('.yaml') || n.endsWith('.yml'));

  if (presets.length === 0) err('presets/ 下没有任何预设');

  for (const file of presets.sort()) {
    const where = `presets/${file}`;
    const text = readText(join(presetsDir, file));
    const id = parseYamlScalar(text, 'id');
    const expected = basename(file).replace(/\.(ya?ml)$/, '');

    if (!id) err(`${where}: 缺少 id`);
    else if (id !== expected) err(`${where}: id "${id}" 与文件名 "${expected}" 不一致`);

    if (!parseYamlScalar(text, 'name')) err(`${where}: 缺少 name`);
    if (!parseYamlScalar(text, 'persona')) err(`${where}: 缺少 persona`);

    const refs = parseYamlList(text, 'skills');
    if (refs === null) {
      err(`${where}: 缺少 skills: 列表`);
    } else {
      if (refs.length === 0) err(`${where}: skills: 为空`);
      for (const ref of new Set(refs)) {
        if (!skillNames.has(ref)) {
          err(`${where}: skills 引用了不存在的技能 "${ref}"`);
        }
      }
    }

    const deliverables = parseYamlList(text, 'deliverables');
    if (!deliverables || deliverables.length === 0) {
      err(`${where}: 缺少 deliverables: 列表`);
    }
  }
}

// ---------------------------------------------------------------------------
// 6. CHANGELOG
// ---------------------------------------------------------------------------

const changelogPath = join(root, 'CHANGELOG.md');
if (!existsSync(changelogPath)) {
  err('缺少 CHANGELOG.md');
} else if (!/^## \[Unreleased\]/m.test(readText(changelogPath))) {
  err('CHANGELOG.md: 缺少 "## [Unreleased]" 段落');
}

// ---------------------------------------------------------------------------
// 7. 版本一致性
// ---------------------------------------------------------------------------
//
// 版本号只有一个真源：version.txt（由 Release Please 维护）。
// .release-please-manifest.json 和 package.json 必须与它一致；
// presets/*.yaml 不写 version，由渲染器从 version.txt 注入。

const versionPath = join(root, 'version.txt');
const manifestPath = join(root, '.release-please-manifest.json');
const packagePath = join(root, 'package.json');

let repoVersion = null;
if (!existsSync(versionPath)) {
  err('缺少 version.txt');
} else {
  repoVersion = readText(versionPath).trim();
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(repoVersion)) {
    err(`version.txt 不是合法 SemVer：${repoVersion}`);
  }
}

if (repoVersion) {
  if (!existsSync(manifestPath)) {
    err('缺少 .release-please-manifest.json');
  } else {
    try {
      const manifest = JSON.parse(readText(manifestPath));
      if (manifest['.'] !== repoVersion) {
        err(
          `.release-please-manifest.json (${manifest['.']}) 与 version.txt (${repoVersion}) 不一致`,
        );
      }
    } catch (e) {
      err(`.release-please-manifest.json 解析失败: ${e.message}`);
    }
  }

  if (!existsSync(packagePath)) {
    err('缺少 package.json');
  } else {
    try {
      const pkg = JSON.parse(readText(packagePath));
      if (pkg.version !== repoVersion) {
        err(`package.json version (${pkg.version}) 与 version.txt (${repoVersion}) 不一致`);
      }
    } catch (e) {
      err(`package.json 解析失败: ${e.message}`);
    }
  }
}

// 预设不得自带 version，避免与仓库版本漂移
if (isDir(presetsDir)) {
  for (const file of readdirSync(presetsDir).filter((n) => /\.ya?ml$/.test(n))) {
    const text = readText(join(presetsDir, file));
    if (/^version:/m.test(text)) {
      err(`presets/${file}: 不要写 version 字段，渲染时会从 version.txt 注入`);
    }
  }
}

// ---------------------------------------------------------------------------
// 输出
// ---------------------------------------------------------------------------

const groupCount = isDir(skillsRoot) ? listDirs(skillsRoot).length : 0;
const presetCount = isDir(presetsDir)
  ? readdirSync(presetsDir).filter((n) => /\.ya?ml$/.test(n)).length
  : 0;

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);

if (errors.length > 0) {
  console.error(`\n✗ 校验失败：${errors.length} 个错误，${warnings.length} 个警告`);
  process.exit(1);
}

console.log(
  `✓ 校验通过：${skillNames.size} 个技能（${groupCount} 个分组），${presetCount} 个预设，${warnings.length} 个警告`,
);
