#!/usr/bin/env node

/**
 * Installs the MoonForge skill files into the right directory for a given
 * coding agent, following the "Agent Skills" (SKILL.md) open standard
 * shared by Claude Code, Codex CLI, Cursor, GitHub Copilot, and Windsurf.
 *
 * Usage: npx @moonforge/skill <agent>
 *   agent: claude | codex | cursor | copilot | windsurf
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
const supportedAgents = Object.keys(AGENT_SKILLS_PATH).join(', ');

if (!agent) {
  fail(`Usage: npx @moonforge/skill <agent>\n\nSupported agents: ${supportedAgents}`);
}

const pathSegments = AGENT_SKILLS_PATH[agent];

if (!pathSegments) {
  fail(`Unknown agent "${agent}".\n\nSupported agents: ${supportedAgents}`);
}

const destDir = join(homedir(), ...pathSegments);
const skillsSrc = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');

if (!existsSync(skillsSrc)) {
  fail(
    'Could not find the bundled skill files — the @moonforge/skill package may be corrupted. Try running the command again.',
  );
}

try {
  mkdirSync(destDir, { recursive: true });
  cpSync(skillsSrc, destDir, { recursive: true });
} catch (err) {
  fail(`Failed to install the MoonForge skill: ${err instanceof Error ? err.message : String(err)}`);
}

console.log(
  'MoonForge skill installed successfully. Please return to MoonForge to continue onboarding and implement events.',
);
