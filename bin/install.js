#!/usr/bin/env node

/**
 * Installs the MoonForge skill files following the "Agent Skills"
 * (SKILL.md) open standard shared by Claude Code, Codex CLI, Cursor,
 * GitHub Copilot, and Windsurf.
 *
 * Usage: npx @moonforge/skill [agent]
 *   agent: claude | codex | cursor | copilot | windsurf
 *
 * With a recognized agent, installs straight into that agent's global
 * skills directory. With no argument, or an agent we don't know the
 * directory convention for, downloads the skill files into the current
 * directory instead — for a tool outside the five above, there's no folder
 * we can safely write into on the user's behalf, so this hands them the
 * files to place themselves (see README's "Other AI Tools" section).
 *
 * Uses only Node built-ins (fs/os/path) so the same command works
 * identically on macOS, Linux, and Windows — no shell-specific scripting.
 */

import { existsSync, mkdirSync, cpSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Path segments relative to the user's home directory. Windsurf lives under
// .codeium (Codeium's own namespace), not .windsurf — verified against
// Windsurf's own docs, not just following the .<agent> pattern the others
// use.
const AGENT_SKILLS_PATH = {
  claude: ['.claude', 'skills'],
  codex: ['.codex', 'skills'],
  cursor: ['.cursor', 'skills'],
  copilot: ['.copilot', 'skills'],
  windsurf: ['.codeium', 'windsurf', 'skills'],
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

const agent = process.argv[2];
const pathSegments = agent ? AGENT_SKILLS_PATH[agent] : undefined;
const skillsSrc = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');

if (!existsSync(skillsSrc)) {
  fail(
    'Could not find the bundled skill files — the @moonforge/skill package may be corrupted. Try running the command again.',
  );
}

if (pathSegments) {
  // Known agent: install straight into its global skills directory.
  const destDir = join(homedir(), ...pathSegments);
  try {
    mkdirSync(destDir, { recursive: true });
    cpSync(skillsSrc, destDir, { recursive: true });
  } catch (err) {
    fail(`Failed to install the MoonForge skill: ${err instanceof Error ? err.message : String(err)}`);
  }
  console.log(
    'MoonForge skill installed successfully. Please return to MoonForge to continue onboarding and implement events.',
  );
} else {
  // No agent, or one we don't know the directory convention for: download
  // only, into the current directory. We don't know where an unlisted
  // tool's skills/commands folder lives, so there's nowhere safe to write
  // on the user's behalf — hand them the files instead.
  const destDir = join(process.cwd(), 'moonforge-skill');
  try {
    mkdirSync(destDir, { recursive: true });
    cpSync(skillsSrc, join(destDir, 'skills'), { recursive: true });
  } catch (err) {
    fail(`Failed to download the MoonForge skill: ${err instanceof Error ? err.message : String(err)}`);
  }
  console.log(
    `MoonForge skill downloaded to ./moonforge-skill/skills — it wasn't moved into any coding agent's folder automatically since none was specified (or the one given isn't one of: ${Object.keys(AGENT_SKILLS_PATH).join(', ')}).\n\nCopy the skill folder(s) you need into your tool's own skills/commands directory — see this package's README ("Other AI Tools" section) for the general steps.`,
  );
}
