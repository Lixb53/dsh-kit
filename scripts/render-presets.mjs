#!/usr/bin/env node
/**
 * 把 presets/*.yaml 渲染成 DSH 可用的 cordis.patch.yml 片段（零依赖）。
 *
 * 只支持预设文件用到的 YAML 子集：
 *   key: 标量
 *   key: |
 *     多行文本
 *   key:
 *     - 列表项
 *   key:
 *     child: 标量
 *     childList: [a, b] / ["a", "b"]
 *     childList:
 *       - 项
 *
 * 可移植性：本脚本不写入任何机器专属的常量路径。customSkillDirs 由调用时的
 * root 推导（默认=本仓库根目录，从脚本位置计算，与 cwd / 操作系统无关）。
 * 换机器或换 OS 时在目标机器上重新运行 install-presets.mjs 即可。
 *
 * 用法：
 *   node scripts/render-presets.mjs                     # 打印到 stdout
 *   node scripts/render-presets.mjs --out cordis.patch.yml
 *   node scripts/render-presets.mjs --skills-dir /abs/path/to/skills
 *   node scripts/render-presets.mjs --only product-design,ui-design
 *
 * 也可作为模块导入（check-render.mjs / install-presets.mjs 这样做，避免子进程 EPERM）：
 *   import { renderPresets, REPO_ROOT } from './render-presets.mjs';
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
/** 仓库根目录：从脚本位置推导，不依赖 process.cwd()，跨平台一致。 */
export const REPO_ROOT = resolve(SCRIPT_DIR, '..');

const argv = process.argv.slice(2);
function arg(flag, fallback = null) {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
}

// ---------------------------------------------------------------------------
// YAML 子集解析（纯函数）
// ---------------------------------------------------------------------------

function indentOf(line) {
  return line.match(/^ */)[0].length;
}

function stripComment(line) {
  // 只在引号外、且 # 前有空白时视为注释
  let inS = false;
  let inD = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS) inD = !inD;
    else if (c === '#' && !inS && !inD && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function unquote(v) {
  const s = v.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function splitInlineList(v) {
  const inner = v.trim().replace(/^\[/, '').replace(/\]$/, '').trim();
  if (inner === '') return [];
  return inner.split(',').map((s) => unquote(s)).filter((s) => s !== '');
}

function parseYaml(text) {
  const rawLines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const lines = [];
  for (const raw of rawLines) {
    const noComment = stripComment(raw);
    if (noComment.trim() === '') continue;
    lines.push(noComment);
  }

  let i = 0;
  function parseBlock(baseIndent) {
    const result = { obj: {}, list: [] };
    let mode = null;

    while (i < lines.length) {
      const line = lines[i];
      const indent = indentOf(line);
      if (indent < baseIndent) break;
      const content = line.slice(indent);

      if (content.startsWith('- ')) {
        if (mode === null) mode = 'list';
        if (mode !== 'list') break;
        result.list.push(unquote(content.slice(2)));
        i += 1;
        continue;
      }

      if (mode === null) mode = 'obj';
      if (mode !== 'obj') break;

      const idx = content.indexOf(':');
      if (idx === -1) {
        i += 1;
        continue;
      }
      const key = content.slice(0, idx).trim();
      const rest = content.slice(idx + 1).trim();
      i += 1;

      if (rest === '|' || rest === '|-' || rest === '>') {
        const chunk = [];
        while (i < lines.length && indentOf(lines[i]) > indent) {
          chunk.push(lines[i].slice(Math.min(indentOf(lines[i]), indent + 2)));
          i += 1;
        }
        result.obj[key] = chunk.join('\n').replace(/\s+$/, '');
        continue;
      }

      if (rest !== '') {
        if (rest.startsWith('[')) result.obj[key] = splitInlineList(rest);
        else result.obj[key] = unquote(rest);
        continue;
      }

      const next = lines[i];
      if (!next || indentOf(next) <= indent) {
        result.obj[key] = null;
        continue;
      }
      const child = parseBlock(indentOf(next));
      result.obj[key] =
        Object.keys(child.obj).length > 0 && child.list.length === 0 ? child.obj : child.list;
    }

    return result;
  }

  const parsed = parseBlock(0);
  return Object.keys(parsed.obj).length > 0 ? parsed.obj : parsed.list;
}

// ---------------------------------------------------------------------------
// 渲染辅助（纯函数）
// ---------------------------------------------------------------------------

function q(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

function indentBlock(text, spaces) {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((l) => (l.trim() === '' ? '' : pad + l))
    .join('\n');
}

function renderSkillDirs(dirs) {
  return dirs.map((d) => `                - ${q(d)}`).join('\n');
}

/**
 * 扫描 skills/<group>/<name>/SKILL.md，返回 name -> { group, path }。
 */
function scanSkills(baseDir) {
  const index = new Map();
  if (!existsSync(baseDir)) return index;

  const children = readdirSync(baseDir).sort();
  const looksLikeGroup = children.some(
    (n) => existsSync(join(baseDir, n, 'SKILL.md')) && statSync(join(baseDir, n)).isDirectory(),
  );

  const groupDirs = looksLikeGroup
    ? [{ group: basename(baseDir), path: baseDir }]
    : children
        .filter((n) => !n.startsWith('.') && statSync(join(baseDir, n)).isDirectory())
        .filter((n) => !existsSync(join(baseDir, n, 'SKILL.md')))
        .map((n) => ({ group: n, path: join(baseDir, n) }));

  for (const { group, path } of groupDirs) {
    for (const skillName of readdirSync(path).sort()) {
      const skillDir = join(path, skillName);
      if (skillName.startsWith('.')) continue;
      if (!statSync(skillDir).isDirectory()) continue;
      if (!existsSync(join(skillDir, 'SKILL.md'))) continue;
      index.set(skillName, { group, path });
    }
  }
  return index;
}

function loadExternalMounts(externalConfigPath) {
  if (!existsSync(externalConfigPath)) return {};
  try {
    const parsed = parseYaml(readFileSync(externalConfigPath, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    console.error(`warn  外部技能挂载配置 ${externalConfigPath} 顶层应为「预设 id: 目录列表」`);
  } catch (e) {
    console.error(`warn  外部技能挂载配置 ${externalConfigPath} 解析失败：${e.message}`);
  }
  return {};
}

function skillDirsForPreset(preset, skillIndex, fallbackDir, externalMounts) {
  const refs = Array.isArray(preset.skills) ? preset.skills : [];
  const dirs = [];
  for (const ref of refs) {
    const hit = skillIndex.get(ref);
    if (!hit) continue;
    if (!dirs.includes(hit.path)) dirs.push(hit.path);
  }
  if (dirs.length === 0) dirs.push(fallbackDir);

  const external = externalMounts[preset.id];
  if (Array.isArray(external)) {
    for (const raw of external) {
      const d = typeof raw === 'string' ? raw.trim() : '';
      if (d && !dirs.includes(d)) dirs.push(d);
    }
  }
  return dirs;
}

function summarizeDescription(preset) {
  if (typeof preset.description === 'string' && preset.description.trim()) {
    return preset.description.trim();
  }
  const flat = String(preset.persona ?? '').replace(/\s+/g, ' ').trim();
  if (!flat) return preset.name;
  return flat.length > 80 ? `${flat.slice(0, 80)}…` : flat;
}

function renderPreset(preset, opts) {
  const { skillsDirs, criticPresetId, version } = opts;
  const lines = [];

  lines.push(`    - id: preset-${preset.id}`);
  lines.push(`      name: '@deepseek-ai/dsh-agent-preset'`);
  lines.push(`      config:`);
  lines.push(`        id: ${preset.id}`);
  lines.push(`        name: ${q(preset.name)}`);
  lines.push(`        description: ${q(summarizeDescription(preset))}`);
  if (version) lines.push(`        version: ${q(version)}`);
  lines.push(`        plugins:`);

  // persona 可选：薄预设不写 persona，行为全部由挂载的技能提供。
  const persona = typeof preset.persona === 'string' ? preset.persona.trim() : '';
  if (persona) {
    lines.push(`          - id: persona`);
    lines.push(`            name: '@deepseek-ai/dsh-persona'`);
    lines.push(`            config:`);
    lines.push(`              prefix: |`);
    lines.push(indentBlock(persona, 16));
  }

  lines.push(`          - id: skill-filesystem`);
  lines.push(`            name: '@deepseek-ai/dsh-skill-filesystem'`);
  lines.push(`            config:`);
  lines.push(`              includeDefaultRoots: false`);
  lines.push(`              customSkillDirs:`);
  lines.push(renderSkillDirs(skillsDirs));
  lines.push(`          - id: tool-skill`);
  lines.push(`            name: '@deepseek-ai/dsh-tool-skill'`);

  const tools = Array.isArray(preset.tools) ? preset.tools : [];
  const toolMap = {
    fs: [`          - id: tool-fs`, `            name: '@deepseek-ai/dsh-tool-fs'`],
    pwsh: [`          - id: tool-pwsh`, `            name: '@deepseek-ai/dsh-tool-pwsh'`],
    web: [
      `          - id: tool-web`,
      `            name: '@deepseek-ai/dsh-tool-web'`,
      `            config:`,
      `              fetch: true`,
    ],
    jobs: [`          - id: tool-jobs`, `            name: '@deepseek-ai/dsh-tool-jobs'`],
    // allowParallelInProgress 是本版本 tool-todo 的必填项（无默认值），缺失会让整棵 preset 挂载失败。
    todo: [
      `          - id: tool-todo`,
      `            name: '@deepseek-ai/dsh-tool-todo'`,
      `            config:`,
      `              allowParallelInProgress: true`,
    ],
    present: [`          - id: present`, `            name: '@deepseek-ai/dsh-tool-present'`],
    // 由 profile 安装的 dsh-plugin-codegraph bundle 提供，不是 DSH 自带包；
    // 服务（codegraph / sqlite / tree-sitter）留在 Host 层，仅把模型可见的
    // codegraph 工具挂到本预设，因此在别的预设里看不到该工具。
    codegraph: [
      `          - id: tool-codegraph`,
      `            name: 'dsh-plugin-codegraph-tool'`,
    ],
    askUser: [
      `          - id: tool-ask-user`,
      `            name: '@deepseek-ai/dsh-tool-ask-user'`,
    ],
  };
  for (const t of tools) {
    if (toolMap[t]) lines.push(...toolMap[t]);
  }

  if (withCriticGlobal && preset.critic && preset.critic.enabled && criticPresetId) {
    lines.push(`          - id: critic`);
    lines.push(`            name: '@deepseek-ai/dsh-tool-subagent'`);
    lines.push(`            config:`);
    lines.push(`              provider: spawn`);
    lines.push(`              toolName: critic`);
    lines.push(`              agentPreset: ${criticPresetId(preset.id)}`);
  }

  return lines.join('\n');
}

let withCriticGlobal = true;

function renderCritic(preset, opts) {
  const { skillsDirs } = opts;
  const name = preset.name;

  return [
    `    - id: preset-${preset.id}-critic`,
    `      name: '@deepseek-ai/dsh-agent-preset'`,
    `      config:`,
    `        id: ${preset.id}-critic`,
    `        name: ${q(`${name} · 独立评审（只读）`)}`,
    `        description: ${q(`只读评审子代理，仅用于 ${preset.id} 的门禁`)}`,
    `        plugins:`,
    `          - id: skill-filesystem`,
    `            name: '@deepseek-ai/dsh-skill-filesystem'`,
    `            config:`,
    `              includeDefaultRoots: false`,
    `              customSkillDirs:`,
    renderSkillDirs(skillsDirs),
    `          - id: tool-skill`,
    `            name: '@deepseek-ai/dsh-tool-skill'`,
    `          - id: tool-fs`,
    `            name: '@deepseek-ai/dsh-tool-fs'`,
    `            config:`,
    `              read: true`,
    `              write: false`,
    `              edit: false`,
    `              applyPatch: false`,
    `          - id: tool-fs-search`,
    `            name: '@deepseek-ai/dsh-tool-fs-search'`,
    `            config:`,
    // sampleOverCapGlobResults 是本版本 tool-fs-search 的必填项（无默认值），缺失会让 critic preset 挂载失败。
    `              sampleOverCapGlobResults: false`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// 可复用入口
// ---------------------------------------------------------------------------

/**
 * @returns {string} 渲染出的 cordis.patch.yml 文本（路径按本机 root 推导）
 */
export function renderPresets({
  root = REPO_ROOT,
  skillsDir = join(root, 'skills'),
  presetsDir = join(root, 'presets'),
  externalConfigPath = join(root, 'external-skills.local.yaml'),
  only = [],
  withCritic = true,
} = {}) {
  withCriticGlobal = withCritic;

  if (!existsSync(presetsDir)) {
    throw new Error(`找不到 presets/：${presetsDir}`);
  }

  const versionPath = join(root, 'version.txt');
  let repoVersion = null;
  if (existsSync(versionPath)) {
    const version = readFileSync(versionPath, 'utf8').trim();
    if (/^\d+\.\d+\.\d+/.test(version)) repoVersion = version;
  }
  if (!repoVersion) throw new Error(`无法从 ${versionPath} 读取版本号`);

  const externalMounts = loadExternalMounts(externalConfigPath);
  const skillIndex = scanSkills(skillsDir);
  if (skillIndex.size === 0) {
    throw new Error(`${skillsDir} 下没有找到 skills/<group>/<name>/SKILL.md`);
  }

  const criticPresetId = (id) => `${id}-critic`;

  const files = readdirSync(presetsDir)
    .filter((n) => /\.ya?ml$/.test(n))
    .filter((n) => (only.length ? only.includes(basename(n).replace(/\.(ya?ml)$/, '')) : true))
    .sort();

  if (files.length === 0) {
    throw new Error(`没有匹配的预设文件（--only ${only.join(',') || '—'}）`);
  }

  const blocks = [];
  for (const file of files) {
    const preset = parseYaml(readFileSync(join(presetsDir, file), 'utf8'));
    if (!preset.id) {
      console.error(`warn  ${file}: 缺少 id，已跳过`);
      continue;
    }

    const skillsDirs = skillDirsForPreset(preset, skillIndex, skillsDir, externalMounts);
    const missing = (Array.isArray(preset.skills) ? preset.skills : []).filter(
      (s) => !skillIndex.has(s),
    );
    for (const m of missing) {
      console.error(`warn  ${file}: 技能 "${m}" 未在 ${skillsDir} 下找到，未挂载`);
    }

    const externalRefs = Array.isArray(preset.external_skills) ? preset.external_skills : [];
    if (externalRefs.length > 0 && !Array.isArray(externalMounts[preset.id])) {
      console.error(
        `warn  ${file}: 声明了 ${externalRefs.length} 个 external_skills，但 ${externalConfigPath} 未为其配置本地安装目录；这些技能本次不会挂载（方案 C：清单与安装分离）`,
      );
    }

    const opts = { skillsDirs, criticPresetId, version: repoVersion };
    const parts = [renderPreset(preset, opts)];
    if (withCritic && preset.critic && preset.critic.enabled) {
      parts.push(renderCritic(preset, opts));
    }
    blocks.push(parts.join('\n'));
  }

  const header = [
    `# 由 scripts/render-presets.mjs 生成；改动请改 presets/*.yaml 后重新生成。`,
    `# 挂载方式：把本文件内容并入 profile 的 cordis.patch.yml，或作为 --patch 覆盖层。`,
    `# 生成参数：version=${repoVersion}  skills=${skillsDir}${withCritic ? '' : '  critic=off'}`,
    `# 每个预设只挂载它引用的技能所在的分组目录，预设之间不共享技能。`,
    ``,
    `- insert:`,
  ].join('\n');

  return `${header}\n${blocks.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const root = arg('--root') ?? REPO_ROOT;
  const outPath = arg('--out');
  const only = (arg('--only') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const withCritic = !argv.includes('--no-critic');
  const skillsDir = arg('--skills-dir') ?? join(root, 'skills');

  const output = renderPresets({ root, skillsDir, only, withCritic });

  if (outPath) {
    writeFileSync(outPath, output, 'utf8');
    console.log(`✓ 已生成 ${outPath}（${only.length || '全部'} 个预设过滤）`);
  } else {
    process.stdout.write(output);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
