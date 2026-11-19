#!/usr/bin/env node
/**
 * 把 presets/*.yaml 渲染成一个本地 DSH bundle（跨平台、可迁移、可卸载）。
 *
 * 设计目标：仓库里不放任何机器专属的绝对路径。本脚本在**目标机器**上运行，
 * 生成物（含按本机推导的 customSkillDirs）写到 gitignore 的 .generated/ 目录；
 * 换机器 / 换 OS 后只需重新 clone + 安装依赖 + 运行本脚本 + 重新安装 bundle。
 *
 * 产出：.generated/dsh-role-presets/
 *   ├── package.json          (@local/dsh-role-presets)
 *   └── cordis.patch.yml      (renderPresets() 的输出，路径由本机 root 推导)
 *
 * 用法:
 *   node scripts/install-presets.mjs
 *   node scripts/install-presets.mjs --only product-design,ui-design
 *   node scripts/install-presets.mjs --out "<dir>"     # 自定义 bundle 输出目录
 *
 * 安装：把打印的 bundle 路径交给 dsh 的 plugin_manager install_bundle，或在 GUI 的
 * 插件管理里安装该目录。卸载后换机器只需重新生成本目录再安装。
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
const only = (arg('--only') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const patch = renderPresets({ root, only });

mkdirSync(outDir, { recursive: true });

const packageJson = {
  name: '@local/dsh-role-presets',
  version: '1.0.0',
  private: true,
  type: 'module',
  dsh: { bundle: { patch: './cordis.patch.yml' } },
};

writeFileSync(join(outDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
writeFileSync(join(outDir, 'cordis.patch.yml'), patch, 'utf8');

console.log(`✓ bundle 已生成：${outDir}`);
console.log('  下一步：用 plugin_manager install_bundle 安装该目录，或在 GUI 插件管理里安装。');
console.log('  换机器 / 换 OS：重新 clone 仓库 → npm ci → node scripts/install-presets.mjs → 重新安装此目录。');
