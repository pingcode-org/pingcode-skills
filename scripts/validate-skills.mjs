#!/usr/bin/env node
/**
 * 校验 skills/ 下的所有 SKILL.md：
 * - frontmatter 存在且可解析
 * - name / description 必填，类型与长度合法
 * - name 为小写 kebab-case，且与所在目录名一致
 * - name 不重复
 * - 仓库根目录不允许出现 SKILL.md（会导致其它 skill 被 Skills CLI 忽略）
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = join(ROOT, "skills");
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_DEPTH = 5;

const errors = [];
const warnings = [];

function fail(file, message) {
  errors.push(`${relative(ROOT, file)}: ${message}`);
}

function warn(file, message) {
  warnings.push(`${relative(ROOT, file)}: ${message}`);
}

/** 极简 YAML frontmatter 解析：只支持本仓库需要的顶层 key、引号和块标量。 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;

  const data = {};
  const lines = match[1].split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;

    const [, key, rawValue] = kv;
    let value = rawValue.trim();

    if (/^[|>][+-]?$/.test(value)) {
      const folded = value.startsWith(">");
      const block = [];
      while (i + 1 < lines.length && (/^\s+/.test(lines[i + 1]) || !lines[i + 1].trim())) {
        block.push(lines[i + 1].trim());
        i += 1;
      }
      value = block.join(folded ? " " : "\n").trim();
    } else if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    data[key] = value;
  }

  return data;
}

async function collectSkillFiles(dir, depth = 0, files = []) {
  if (depth > MAX_DEPTH) return files;

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectSkillFiles(fullPath, depth + 1, files);
    } else if (entry.isFile() && entry.name === "SKILL.md") {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  try {
    const rootSkill = await stat(join(ROOT, "SKILL.md"));
    if (rootSkill.isFile()) {
      fail(join(ROOT, "SKILL.md"), "仓库根目录不允许存在 SKILL.md，请将其移动到 skills/<skill-name>/ 下");
    }
  } catch {
    // 不存在是预期情况
  }

  const skillFiles = await collectSkillFiles(SKILLS_DIR);
  if (skillFiles.length === 0) {
    fail(SKILLS_DIR, "未找到任何 skills/**/SKILL.md");
  }

  const seenNames = new Map();

  for (const file of skillFiles) {
    const content = await readFile(file, "utf8");
    const data = parseFrontmatter(content);

    if (!data) {
      fail(file, "缺少合法的 YAML frontmatter（--- ... ---）");
      continue;
    }

    const name = typeof data.name === "string" ? data.name.trim() : "";
    const description = typeof data.description === "string" ? data.description.trim() : "";

    if (!name) {
      fail(file, "frontmatter 缺少必填字段 name");
    } else {
      if (!NAME_PATTERN.test(name)) {
        fail(file, `name "${name}" 必须为小写 kebab-case（如 my-skill）`);
      }
      if (name.length > MAX_NAME_LENGTH) {
        fail(file, `name 长度不能超过 ${MAX_NAME_LENGTH} 个字符`);
      }
      const dirName = basename(dirname(file));
      if (name !== dirName) {
        fail(file, `name "${name}" 必须与目录名 "${dirName}" 一致`);
      }
      if (seenNames.has(name)) {
        fail(file, `name "${name}" 与 ${relative(ROOT, seenNames.get(name))} 重复`);
      } else {
        seenNames.set(name, file);
      }
    }

    if (!description) {
      fail(file, "frontmatter 缺少必填字段 description");
    } else if (description.length > MAX_DESCRIPTION_LENGTH) {
      fail(file, `description 长度不能超过 ${MAX_DESCRIPTION_LENGTH} 个字符`);
    }

    const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "").trim();
    if (!body) {
      fail(file, "SKILL.md 正文为空");
    }

    if (body.length > 0 && body.length < 50) {
      warn(file, "正文较短，确认是否遗漏了执行步骤");
    }
  }

  for (const message of warnings) {
    console.warn(`⚠ ${message}`);
  }

  if (errors.length > 0) {
    for (const message of errors) {
      console.error(`✖ ${message}`);
    }
    console.error(`\n校验失败：${errors.length} 个错误，${skillFiles.length} 个 skill。`);
    process.exit(1);
  }

  console.log(`✔ 校验通过：${skillFiles.length} 个 skill（${[...seenNames.keys()].join(", ")}）。`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
