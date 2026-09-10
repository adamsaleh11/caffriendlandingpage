#!/usr/bin/env node
// PreToolUse guard for caffriend-backend.
//
// Deterministic pattern matching only: no model judgement is involved. Reads the
// PreToolUse payload on stdin and emits a permissionDecision. Anything that does
// not match a rule is allowed silently, so ordinary editing, tests, builds and
// feature-branch commits are unaffected.
//
// Decisions:
//   deny  irreversible, destructive, secret-leaking or check-bypassing actions
//   ask   actions that are legitimate but need a human to confirm intent
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const PROTECTED_BRANCHES = (process.env.AI_PROTECTED_BRANCHES || 'main').split(/\s+/).filter(Boolean);

const GENERATED_KNOWLEDGE = new Set([
  '.ai/system/repository-map.md',
  '.ai/system/repository-map.json',
  '.ai/system/public-contracts.md',
  '.ai/system/public-contracts.json',
  '.ai/system/verification-map.md',
  '.ai/system/verification-map.json',
]);

const CURATED_KNOWLEDGE = new Set([
  '.ai/system/knowledge-inputs.json',
  '.ai/system/architecture-decisions.md',
]);

const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key block'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key id'],
  [/\bsk_live_[0-9a-zA-Z]{10,}/, 'a live Stripe secret key'],
  [/\bwhsec_[0-9a-zA-Z]{10,}/, 'a Stripe webhook secret'],
  [/\bSK[0-9a-fA-F]{32}\b/, 'a Twilio API key'],
  [/\bghp_[0-9A-Za-z]{20,}/, 'a GitHub token'],
  [/"private_key"\s*:\s*"-----BEGIN/, 'a service-account private key'],
  [/postgres(ql)?:\/\/[^\s"']*:[^\s"'@]+@/, 'a database URL containing a password'],
];

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function decide(decision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    }) + '\n',
  );
  process.exit(0);
}

const allow = () => process.exit(0);
const deny = (reason) => decide('deny', 'Blocked by .claude/hooks/guard.cjs: ' + reason);
const ask = (reason) => decide('ask', 'Needs your approval (.claude/hooks/guard.cjs): ' + reason);

function git(args) {
  try {
    return execFileSync('git', ['-C', PROJECT_DIR].concat(args), {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

function currentBranch() {
  return git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
}

function repoRelative(p) {
  if (!p) return '';
  const abs = path.isAbsolute(p) ? p : path.resolve(PROJECT_DIR, p);
  const r = path.relative(PROJECT_DIR, abs);
  return r.split(path.sep).join('/');
}

// ---------------------------------------------------------------------------
// Bash rules
// ---------------------------------------------------------------------------

// Resolves which branch a `git push` invocation would update: the explicit
// refspec destinations when present, otherwise the checked-out branch.
function pushTargetsProtectedBranch(command) {
  const segment = command.split(/[;&|]+/).find((s) => /\bgit\s+push\b/.test(s));
  if (!segment) return false;
  const tokens = segment.trim().split(/\s+/);
  const pushIndex = tokens.findIndex((t) => t === 'push');
  const args = tokens.slice(pushIndex + 1).filter((t) => !t.startsWith('-'));
  const refspecs = args.slice(1); // args[0] is the remote
  if (refspecs.length === 0) {
    return PROTECTED_BRANCHES.includes(currentBranch());
  }
  return refspecs.some((spec) => {
    const dst = spec.includes(':') ? spec.slice(spec.indexOf(':') + 1) : spec;
    const name = dst.replace(/^refs\/heads\//, '').replace(/^\+/, '');
    return PROTECTED_BRANCHES.includes(name);
  });
}

// A heredoc body is data being written, not a command being run. Matching
// invocation rules against it blocks documentation that merely names a banned
// command. Secret detection still runs against the full, unstripped text.
function stripHeredocs(command) {
  const lines = String(command || '').split('\n');
  const out = [];
  let terminator = null;
  for (const line of lines) {
    if (terminator === null) {
      out.push(line);
      const m = line.match(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/);
      if (m) terminator = m[2];
    } else if (line.trim() === terminator) {
      terminator = null;
    }
  }
  return out.join('\n');
}

function checkBash(command) {
  const full = String(command || '');
  const c = stripHeredocs(full).replace(/\s+/g, ' ').trim();
  if (!full.trim()) allow();

  for (const [re, label] of SECRET_PATTERNS) {
    if (re.test(full)) {
      deny('this command contains what looks like ' + label + '. Credential material must not pass through a shell command.');
    }
  }

  // .git internals
  if (/(^|[;&|]\s*)(rm|mv|cp|chmod|chown|truncate|sed\s+-i|tee|dd)\b[^;&|]*(^|[\s'"=/])\.git\//.test(c) ||
      /(^|[\s'"])>\s*\.git\//.test(c) ||
      /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f?\s+[^;&|]*\.git(\s|$|\/)/.test(c)) {
    deny('this writes to or deletes git internals under .git/. Repository metadata must not be edited directly.');
  }

  // Repository or home deletion
  if (/\brm\s+-[a-zA-Z]*[rf][a-zA-Z]*\s+(\/|~|\$HOME|\.\.?)(\s|$)/.test(c) ||
      /\brm\s+-[a-zA-Z]*[rf][a-zA-Z]*\s+[^;&|]*\*\s*$/.test(c)) {
    deny('this recursively deletes the repository, the home directory or a wildcard root. Delete specific paths instead.');
  }
  if (new RegExp('\\brm\\s+-[a-zA-Z]*[rf][a-zA-Z]*\\s+' + PROJECT_DIR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$').test(c)) {
    deny('this deletes the repository checkout.');
  }

  // Force push
  if (/\bgit\s+push\b/.test(c)) {
    if (/--force-with-lease\b/.test(c)) {
      ask('git push --force-with-lease rewrites remote history.');
    }
    if (/(--force\b|\s-f(\s|$))/.test(c)) {
      deny('git push --force rewrites remote history and can destroy other people\'s commits. Use --force-with-lease and get explicit approval.');
    }
    if (/--no-verify\b/.test(c)) {
      deny('git push --no-verify skips required pre-push checks.');
    }
    if (pushTargetsProtectedBranch(c)) {
      deny(
        'this pushes to the protected base branch (' + PROTECTED_BRANCHES.join(', ') +
        '). Backend work must go to a ticket branch and through review.',
      );
    }
  }

  // Dangerous history and working-tree resets
  if (/\bgit\s+reset\s+[^;&|]*(--hard|--merge)\b/.test(c)) {
    ask('git reset --hard/--merge discards uncommitted work and can drop commits.');
  }
  if (/\bgit\s+(clean\s+-[a-zA-Z]*f|checkout\s+(-f|--force)\b|restore\s+[^;&|]*--worktree\b)/.test(c)) {
    ask('this discards uncommitted changes in the working tree.');
  }
  if (/\bgit\s+(rebase|filter-branch|reflog\s+expire|gc\s+--prune=now)\b/.test(c) && /--force|--hard|--all/.test(c)) {
    ask('this rewrites or prunes git history.');
  }
  if (/\bgit\s+update-ref\s+-d\b|\bgit\s+branch\s+-D\b/.test(c)) {
    ask('this deletes a git ref.');
  }

  // Bypassing required checks
  if (/\bgit\s+commit\b[^;&|]*(--no-verify|\s-n(\s|$))/.test(c)) {
    deny('git commit --no-verify skips required commit checks.');
  }
  if (/\bgit\s+config\b[^;&|]*core\.hooksPath/.test(c)) {
    deny('changing core.hooksPath disables the repository\'s git hooks.');
  }
  if (/\bHUSKY=0\b|\bSKIP_HOOKS\b|\bNO_VERIFY=1\b/.test(c)) {
    deny('this disables commit or push hooks through an environment variable.');
  }
  if (/--passWithNoTests\b/.test(c)) {
    deny('--passWithNoTests makes a run succeed without executing tests. Fix the tests instead.');
  }
  if (/\bjest\b[^;&|]*--testPathIgnorePatterns\b|\bnpm\s+test\b[^;&|]*--testPathIgnorePatterns\b/.test(c)) {
    ask('this excludes test paths from the run, which can hide a failure.');
  }

  // Committing likely secrets
  if (/\bgit\s+(add|commit)\b/.test(c)) {
    if (/\bgit\s+add\b[^;&|]*(\.env|firebase-admin\.json|\.pem\b|\.p12\b|id_rsa)/.test(c)) {
      deny('this stages a credential file. Credential material must never be committed.');
    }
    const staged = git(['diff', '--cached', '--unified=0']);
    for (const [re, label] of SECRET_PATTERNS) {
      if (re.test(staged)) {
        deny('the staged diff contains what looks like ' + label + '. Remove the credential before committing.');
      }
    }
  }

  // Database and migration commands. .ai/system/verification-map.md records that
  // database provenance and isolation are UNKNOWN, so none of these may run here.
  if (/\bprisma\s+migrate\s+(reset|deploy|dev)\b/.test(c) || /\bprisma\s+db\s+push\b/.test(c)) {
    deny(
      'this applies or resets database migrations. .ai/system/verification-map.md records that the local database\'s ' +
      'provenance and isolation are UNKNOWN, so migrations must be applied deliberately by a human against a known target.',
    );
  }
  if (/--accept-data-loss\b|--force-reset\b/.test(c)) {
    deny('this accepts destructive schema changes.');
  }
  if (/\bnpm\s+run\s+db:seed\b|\bts-node\s+prisma\/seed\.ts\b/.test(c)) {
    deny('seeding mutates a database whose provenance is UNKNOWN (.ai/system/verification-map.md).');
  }
  if (/\b(DROP\s+(DATABASE|SCHEMA|TABLE)|TRUNCATE\s+TABLE|TRUNCATE\s+[a-z_"]+)\b/i.test(c) ||
      /\bDELETE\s+FROM\b(?![^;]*\bWHERE\b)/i.test(c) ||
      /\bdropdb\b/.test(c)) {
    deny('this is a destructive SQL statement against a live database.');
  }
  if (/\bnpm\s+run\s+test:e2e\b/.test(c)) {
    deny(
      'test:e2e boots the real AppModule and can initialise real database and vendor clients ' +
      '(.ai/system/verification-map.md). Run it only in a deliberately isolated environment.',
    );
  }

  // Deployment and publishing
  if (/\b(fly\s+deploy|eb\s+deploy|railway\s+up|serverless\s+deploy|vercel\s+(deploy|--prod)|netlify\s+deploy)\b/.test(c) ||
      /\bkubectl\s+(apply|delete|rollout|scale)\b/.test(c) ||
      /\baws\s+(ecs|elasticbeanstalk|lambda|apprunner)\b/.test(c) ||
      /\bdocker\s+push\b/.test(c) ||
      /\bterraform\s+(apply|destroy)\b/.test(c) ||
      /\bnpm\s+publish\b/.test(c) ||
      /\bgh\s+(workflow\s+run|release\s+create)\b/.test(c)) {
    deny('this deploys or publishes. Releases are a human decision; this repository has no verified release pipeline.');
  }
  if (/\baws\s+s3\s+(rm|rb)\b/.test(c)) {
    deny('this deletes S3 objects or buckets that hold production media.');
  }

  // Dependency changes
  if (/\bnpm\s+(install|i|add|uninstall|remove|update)\b/.test(c) && !/\bnpm\s+ci\b/.test(c)) {
    ask('this changes installed dependencies and can rewrite package-lock.json. npm ci is the reproducible install.');
  }
  if (/\bnpm\s+audit\s+fix\b/.test(c)) {
    ask('npm audit fix rewrites dependency versions.');
  }
  if (/\bchmod\s+(-R\s+)?777\b/.test(c)) {
    ask('this makes files world-writable.');
  }

  allow();
}

// ---------------------------------------------------------------------------
// File write rules
// ---------------------------------------------------------------------------

function addedText(toolInput) {
  const parts = [];
  if (typeof toolInput.content === 'string') parts.push(toolInput.content);
  if (typeof toolInput.new_string === 'string') parts.push(toolInput.new_string);
  if (Array.isArray(toolInput.edits)) {
    for (const e of toolInput.edits) if (typeof e.new_string === 'string') parts.push(e.new_string);
  }
  return parts.join('\n');
}

function removedText(toolInput) {
  const parts = [];
  if (typeof toolInput.old_string === 'string') parts.push(toolInput.old_string);
  if (Array.isArray(toolInput.edits)) {
    for (const e of toolInput.edits) if (typeof e.old_string === 'string') parts.push(e.old_string);
  }
  return parts.join('\n');
}

function checkWrite(toolInput) {
  const rawPath = toolInput.file_path || toolInput.notebook_path || '';
  const rel = repoRelative(rawPath);
  const added = addedText(toolInput);
  const removed = removedText(toolInput);

  if (rel.startsWith('..') || (path.isAbsolute(rawPath) && rel.startsWith('..'))) {
    ask('this writes outside the caffriend-backend checkout: ' + rawPath);
  }
  if (/^\.git\//.test(rel)) {
    deny('this edits git internals under .git/.');
  }
  if (/(^|\/)\.env(\.|$)/.test(rel) || /firebase-admin\.json$/.test(rel) || /\.(pem|p12|key)$/.test(rel) || /id_rsa/.test(rel)) {
    deny('this writes to a credential file (' + rel + '). Credential material is handled outside the repository.');
  }
  if (GENERATED_KNOWLEDGE.has(rel)) {
    deny(
      rel + ' is generated by scripts/backend-knowledge.cjs. Edit .ai/system/knowledge-inputs.json and regenerate ' +
      'with --write; hand-editing breaks the evidence attestations.',
    );
  }
  if (CURATED_KNOWLEDGE.has(rel)) {
    ask(rel + ' is curated governance knowledge. Confirm the change is a reviewed decision, not an assumption.');
  }
  if (/^prisma\/migrations\/.+\/migration\.sql$/.test(rel) && fs.existsSync(path.resolve(PROJECT_DIR, rel))) {
    deny(
      'this edits an existing migration (' + rel + '). Applied migrations are immutable; add a new migration instead.',
    );
  }
  if (rel === 'prisma/migrations/migration_lock.toml') {
    deny('migration_lock.toml records the migration provider and must not be edited by hand.');
  }

  for (const [re, label] of SECRET_PATTERNS) {
    if (re.test(added)) {
      deny('the new content contains what looks like ' + label + '.');
    }
  }

  // Prose that quotes a dangerous pattern is documentation, not behaviour.
  // Secret detection above still applies to every file type.
  const isProse = /\.(md|markdown|txt)$/i.test(rel);
  if (isProse) allow();

  if (/rejectUnauthorized\s*:\s*false/.test(added) && !/rejectUnauthorized\s*:\s*false/.test(removed)) {
    deny('this disables TLS certificate verification.');
  }
  if (/NODE_TLS_REJECT_UNAUTHORIZED/.test(added)) {
    deny('this disables TLS certificate verification process-wide.');
  }
  if (/algorithms\s*:\s*\[\s*['"]none['"]/.test(added) || /ignoreExpiration\s*:\s*true/.test(added)) {
    deny('this weakens JWT verification.');
  }

  const disablesTest = /(describe|it|test)\.skip\s*\(|(^|\s)x(it|describe)\s*\(|\.only\s*\(/;
  if (disablesTest.test(added) && !disablesTest.test(removed)) {
    ask('this skips or narrows tests. A failing test is a finding to fix, not to disable.');
  }
  const suppresses = /eslint-disable|@ts-(ignore|nocheck)/;
  if (suppresses.test(added) && !suppresses.test(removed)) {
    ask('this suppresses a lint or type-check rule. Confirm it is not hiding a real failure.');
  }
  if (rel === 'eslint.config.mjs' || rel === '.prettierrc' || /^tsconfig(\..+)?\.json$/.test(rel)) {
    ask('this changes static-analysis configuration. Confirm it is not weakening a rule to make a check pass.');
  }
  if (rel === 'package.json' && /"(test|lint|build|prebuild)"\s*:/.test(added)) {
    ask('this changes a verification script in package.json.');
  }

  allow();
}

// ---------------------------------------------------------------------------

const payload = readStdin();
const tool = payload.tool_name || '';
const input = payload.tool_input || {};

if (tool === 'Bash') {
  checkBash(input.command);
} else if (tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit' || tool === 'NotebookEdit') {
  checkWrite(input);
}
allow();
