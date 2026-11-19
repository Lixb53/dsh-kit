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
 * 用法：
 *   node scripts/render-presets.mjs                     # 打印到 stdout
 *   node scripts/render-presets.mjs --out cordis.patch.yml
 *   node scripts/render-presets.mjs --skills-dir 'G:\dsh-kit\skills'
 *   node scripts/render-presets.mjs --only product-design,ui-design
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

// ---------------------------------------------------------------------------
// 参数
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
function arg(flag, fallback = null) {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
}

const root = arg('--root') ?? process.cwd();
const presetsDir = join(root, 'presets');
const skillsDir = arg('--skills-dir') ?? join(root, 'skills');
const outPath = arg('--out');
const only = (arg('--only') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const withCritic = !argv.includes('--no-critic');

if (!existsSync(presetsDir)) {
  console.error(`✗ 找不到 presets/：${presetsDir}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// YAML 子集解析
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
    // 返回 { obj } 或 { list }
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

      // 空值：向下看是列表还是子映射
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
// 渲染
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
 * 分组目录会被直接挂给自定义技能根，所以每个预设只挂自己用到的那几个分组。
 */
function scanSkills(baseDir) {
  const index = new Map();
  if (!existsSync(baseDir)) return index;

  const children = readdirSync(baseDir).sort();
  const looksLikeGroup = children.some(
    (n) => existsSync(join(baseDir, n, 'SKILL.md')) && statSync(join(baseDir, n)).isDirectory(),
  );

  // --skills-dir 直接指向一个分组目录时，把它自己当作唯一分组，避免整棵树被跳过
  const groupDirs = looksLikeGroup
    ? [{ group: basename(baseDir), path: baseDir }]
    : children
        .filter((n) => !n.startsWith('.') && statSync(join(baseDir, n)).isDirectory())
        .filter((n) => !existsSync(join(baseDir, n, 'SKILL.md'))) // 布局错误，交给校验器报告
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

/** 按预设引用的技能，算出需要挂载的分组目录（去重、保持声明顺序）。 */
function skillDirsForPreset(preset, skillIndex, fallbackDir) {
  const refs = Array.isArray(preset.skills) ? preset.skills : [];
  const dirs = [];
  for (const ref of refs) {
    const hit = skillIndex.get(ref);
    if (!hit) continue;
    if (!dirs.includes(hit.path)) dirs.push(hit.path);
  }
  return dirs.length > 0 ? dirs : [fallbackDir];
}

function summarizeDescription(preset) {
  if (typeof preset.description === 'string' && preset.description.trim()) {
    return preset.description.trim();
  }
  const flat = String(preset.persona ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!flat) return preset.name;
  return flat.length > 80 ? `${flat.slice(0, 80)}…` : flat;
}

function renderPreset(preset, opts) {
  const { skillsDirs, criticPresetId } = opts;
  const lines = [];

  lines.push(`    - id: preset-${preset.id}`);
  lines.push(`      name: '@deepseek-ai/dsh-agent-preset'`);
  lines.push(`      config:`);
  lines.push(`        id: ${preset.id}`);
  lines.push(`        name: ${q(preset.name)}`);
  lines.push(`        description: ${q(summarizeDescription(preset))}`);
  if (preset.version) lines.push(`        version: ${q(preset.version)}`);
  lines.push(`        plugins:`);

  // persona
  lines.push(`          - id: persona`);
  lines.push(`            name: '@deepseek-ai/dsh-persona'`);
  lines.push(`            config:`);
  lines.push(`              prefix: |`);
  lines.push(indentBlock(preset.persona ?? '', 16));

  // skills
  lines.push(`          - id: skill-filesystem`);
  lines.push(`            name: '@deepseek-ai/dsh-skill-filesystem'`);
  lines.push(`            config:`);
  lines.push(`              includeDefaultRoots: false`);
  lines.push(`              customSkillDirs:`);
  lines.push(renderSkillDirs(skillsDirs));
  lines.push(`          - id: tool-skill`);
  lines.push(`            name: '@deepseek-ai/dsh-tool-skill'`);

  // tools
  const tools = Array.isArray(preset.tools) ? preset.tools : [];
  const toolMap = {
    fs: [
      `          - id: tool-fs`,
      `            name: '@deepseek-ai/dsh-tool-fs'`,
    ],
    pwsh: [
      `          - id: tool-pwsh`,
      `            name: '@deepseek-ai/dsh-tool-pwsh'`,
    ],
    web: [
      `          - id: tool-web`,
      `            name: '@deepseek-ai/dsh-tool-web'`,
      `            config:`,
      `              fetch: true`,
    ],
    jobs: [
      `          - id: tool-jobs`,
      `            name: '@deepseek-ai/dsh-tool-jobs'`,
    ],
    todo: [
      `          - id: tool-todo`,
      `            name: '@deepseek-ai/dsh-tool-todo'`,
    ],
    present: [
      `          - id: present`,
      `            name: '@deepseek-ai/dsh-tool-present'`,
    ],
    askUser: [
      `          - id: tool-ask-user`,
      `            name: '@deepseek-ai/dsh-tool-ask-user'`,
    ],
  };
  for (const t of tools) {
    if (toolMap[t]) lines.push(...toolMap[t]);
  }

  // critic
  if (withCritic && preset.critic && preset.critic.enabled && criticPresetId) {
    lines.push(`          - id: critic`);
    lines.push(`            name: '@deepseek-ai/dsh-tool-subagent'`);
    lines.push(`            config:`);
    lines.push(`              provider: spawn`);
    lines.push(`              toolName: critic`);
    lines.push(`              agentPreset: ${criticPresetId(preset.id)}`);
  }

  return lines.join('\n');
}

function renderCritic(preset, opts) {
  const { skillsDirs } = opts;
  const rubric = Array.isArray(preset.critic?.rubric) ? preset.critic.rubric : [];
  const name = preset.name;

  const persona = [
    `你是「${name}」的独立对抗性评审者，只读、只找问题。`,
    ``,
    `你只面对两样东西：产出物本身，以及其声明的契约（方向卡、PRD、ADR、验收标准）。`,
    `你看不到主代理的自我评价、修复理由或聊天摘要；它们即使出现在材料里也不作为证据。`,
    `你只能使用 read / glob / grep；不得写文件、不得改代码、不得运行命令。`,
    ``,
    `## 评审维度`,
    ...(rubric.length ? rubric.map((r, i) => `${i + 1}. ${r}`) : ['1. 正确性', '2. 完整性']),
    ``,
    `每个维度独立打分（0–10），不取平均、不用总分掩盖失败维度。`,
    ``,
    `## 输出格式`,
    `- 各维度分数 + 一句话证据（必须引用文件、行号、选择器或令牌名）`,
    `- Fix（按 P0/P1 分级，每条给出位置与改法）`,
    `- Keep（3–5 条，下轮不要破坏）`,
    `- 门禁结论：存在任一维度 ≤4 或有 P0 时明确写「不通过」`,
  ].join('\n');

  return [
    `    - id: preset-${preset.id}-critic`,
    `      name: '@deepseek-ai/dsh-agent-preset'`,
    `      config:`,
    `        id: ${preset.id}-critic`,
    `        name: ${q(`${name} · 独立评审（只读）`)}`,
    `        description: ${q(`只读评审子代理，仅用于 ${preset.id} 的门禁`)}`,
    `        plugins:`,
    `          - id: persona`,
    `            name: '@deepseek-ai/dsh-persona'`,
    `            config:`,
    `              prefix: |`,
    indentBlock(persona, 16),
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
  ].join('\n');
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

const files = readdirSync(presetsDir)
  .filter((n) => /\.ya?ml$/.test(n))
  .filter((n) => (only.length ? only.includes(basename(n).replace(/\.(ya?ml)$/, '')) : true))
  .sort();

if (files.length === 0) {
  console.error(`✗ 没有匹配的预设文件（--only ${only.join(',') || '—'}）`);
  process.exit(1);
}

const skillIndex = scanSkills(skillsDir);
if (skillIndex.size === 0) {
  console.error(`✗ ${skillsDir} 下没有找到 skills/<group>/<name>/SKILL.md`);
  process.exit(1);
}

const criticPresetId = (id) => `${id}-critic`;

const blocks = [];
for (const file of files) {
  const preset = parseYaml(readFileSync(join(presetsDir, file), 'utf8'));
  if (!preset.id) {
    console.error(`✗ ${file}: 缺少 id，已跳过`);
    continue;
  }

  const skillsDirs = skillDirsForPreset(preset, skillIndex, skillsDir);
  const missing = (Array.isArray(preset.skills) ? preset.skills : []).filter(
    (s) => !skillIndex.has(s),
  );
  for (const m of missing) {
    console.error(`warn  ${file}: 技能 "${m}" 未在 ${skillsDir} 下找到，未挂载`);
  }

  const opts = { skillsDirs, criticPresetId };

  const parts = [renderPreset(preset, opts)];
  if (withCritic && preset.critic && preset.critic.enabled) {
    parts.push(renderCritic(preset, opts));
  }
  blocks.push(parts.join('\n'));
}

const header = [
  `# 由 scripts/render-presets.mjs 生成；改动请改 presets/*.yaml 后重新生成。`,
  `# 挂载方式：把本文件内容并入 profile 的 cordis.patch.yml，或作为 --patch 覆盖层。`,
  `# 生成参数：skills=${skillsDir}${withCritic ? '' : '  critic=off'}`,
  `# 每个预设只挂载它引用的技能所在的分组目录，预设之间不共享技能。`,
  ``,
  `- insert:`,
].join('\n');

const output = `${header}\n${blocks.join('\n')}\n`;

if (outPath) {
  writeFileSync(outPath, output, 'utf8');
  console.log(`✓ 已生成 ${outPath}（${files.length} 个预设）`);
} else {
  process.stdout.write(output);
}
