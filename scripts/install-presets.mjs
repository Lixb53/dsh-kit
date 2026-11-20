#!/usr/bin/env node
/**
 * 把 presets/*.yaml 渲染成本地 DSH bundle（跨平台、可迁移、可卸载）。
 *
 * 设计目标：仓库里不放任何机器专属的常量路径。本脚本在**目标机器**上运行，
 * 生成物（含按本机推导的 customSkillDirs）写到 gitignore 的 .generated/ 目录；
 * 换机器 / 换 OS 后只需重新 clone + 安装依赖 + 运行本脚本 + 重新安装 bundle。
 *
 * 默认每个预设一个**独立 bundle**，可以单独安装 / 卸载 / 升级某一个角色，
 * 不会牵动其他预设。critic 评审预设与它的主预设在同一个 bundle 里
 * （agentPreset 引用不能跨 bundle）。
 *
 * 产出（默认 out=.generated/dsh-role-presets/）：
 *   ├── product-design/   package.json（@local/dsh-preset-product-design）+ cordis.patch.yml
 *   ├── ui-design/        …
 *   ├── frontend-dev/     …
 *   └── backend-dev/      …
 * --combined 时退回单包：out/ 直接放 package.json（@local/dsh-role-presets）+ cordis.patch.yml。
 *
 * 用法:
 *   node scripts/install-presets.mjs
 *   node scripts/install-presets.mjs --only product-design,ui-design
 *   node scripts/install-presets.mjs --combined
 *   node scripts/install-presets.mjs --out "<dir>"     # 自定义 bundle 输出根目录
 *
 * 安装：把需要的 bundle 目录交给 dsh 的 plugin_manager install_bundle，或在 GUI 的
 * 插件管理里安装该目录。卸载后换机器只需重新生成本目录再安装。
 */

import { mkdirSync, writeFileSync, readdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { renderPresets, REPO_ROOT } from './render-presets.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
function arg(flag, fallback = null) {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
}

const root = arg('--root') ?? REPO_ROOT;
const outDir = resolve(root, arg('--out') ?? join('.generated', 'dsh-role-presets'));
const combined = argv.includes('--combined');
const only = (arg('--only') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const presetsDir = join(root, 'presets');
const all = readdirSync(presetsDir)
  .filter((n) => /\.ya?ml$/.test(n))
  .map((n) => basename(n).replace(/\.(ya?ml)$/, ''))
  .sort();

if (only.length > 0) {
  const unknown = only.filter((id) => !all.includes(id));
  if (unknown.length > 0) {
    console.error(`✗ --only 中的预设不存在：${unknown.join(', ')}（可用：${all.join(', ')}）`);
    process.exit(1);
  }
}
const targets = only.length > 0 ? all.filter((id) => only.includes(id)) : all;

const version = readFileSync(join(root, 'version.txt'), 'utf8').trim();

function bundlePackageJson(name) {
  return {
    name,
    version,
    private: true,
    type: 'module',
    dsh: { bundle: { patch: './cordis.patch.yml' } },
  };
}

// 只重建本次目标 bundle；--only 时其他预设的目录保持不动。
// combined 模式整体重建输出根，旧布局（每预设一个子目录）不残留。
if (combined) {
  rmSync(outDir, { recursive: true, force: true });
} else {
  for (const id of targets) rmSync(join(outDir, id), { recursive: true, force: true });
  // 退回逐包模式时清掉 --combined 留下的根级文件，避免一个目录两种布局。
  for (const f of ['package.json', 'cordis.patch.yml']) {
    const p = join(outDir, f);
    if (existsSync(p)) rmSync(p, { force: true });
  }
}

const bundles = [];

if (combined) {
  const patch = renderPresets({ root, only });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'package.json'), `${JSON.stringify(bundlePackageJson('@local/dsh-role-presets'), null, 2)}\n`, 'utf8');
  writeFileSync(join(outDir, 'cordis.patch.yml'), patch, 'utf8');
  bundles.push({ dir: outDir, label: `合并包（${targets.length} 个预设）` });
} else {
  for (const id of targets) {
    const dir = join(outDir, id);
    const patch = renderPresets({ root, only: [id] });
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), `${JSON.stringify(bundlePackageJson(`@local/dsh-preset-${id}`), null, 2)}\n`, 'utf8');
    writeFileSync(join(dir, 'cordis.patch.yml'), patch, 'utf8');
    bundles.push({ dir, label: id });
  }
}

console.log(`✓ bundle 已生成：${outDir}`);
for (const b of bundles) console.log(`    ${b.label.padEnd(20)} ${b.dir}`);
console.log('  下一步：把需要的 bundle 目录用 plugin_manager install_bundle 安装，或在 GUI 插件管理里安装。');
console.log('  独立升级某个预设：只重装对应目录的 bundle；改完 presets/*.yaml 后重跑本脚本。');
console.log('  换机器 / 换 OS：重新 clone 仓库 → npm ci → node scripts/install-presets.mjs → 重新安装。');

// 生成后用本机 DSH 的真实 schema 校验一遍：上游把某个字段改成必填时，
// 只有这里能提前发现——否则失败会推迟到挂载阶段，表现为「预设装了却看不到」。
// 拿不到 DSH 安装目录时该脚本自行跳过并返回 0，不影响生成流程。
if (process.env.DSH_INSTALL_DIR) {
  const { spawnSync } = await import('node:child_process');
  const electron = process.env.DSH_NODE_EXECUTABLE;
  const runAsElectron = process.env.DSH_INSTALL_DIR.includes('.asar') && electron;
  const result = runAsElectron
    ? spawnSync(electron, [join(root, 'scripts', 'check-plugin-config.mjs')], {
        stdio: 'inherit',
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        cwd: root,
      })
    : spawnSync(process.execPath, [join(root, 'scripts', 'check-plugin-config.mjs')], {
        stdio: 'inherit',
        cwd: root,
      });
  if (result.status !== 0) {
    console.error('\n✗ 插件配置校验未通过：上面的 bundle 在本机挂载时会失败，请先修复再安装。');
    process.exit(result.status ?? 1);
  }
}
