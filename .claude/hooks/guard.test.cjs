#!/usr/bin/env node
// Behavioural tests for .claude/hooks/guard.cjs.
// Run: node --test .claude/hooks/guard.test.cjs
// No network, no database, no application start.
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJECT_DIR = path.resolve(__dirname, '..', '..');
const GUARD = path.join(__dirname, 'guard.cjs');

function decisionFor(payload) {
  const out = execFileSync('node', [GUARD], {
    input: JSON.stringify(payload),
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: PROJECT_DIR }),
    encoding: 'utf8',
  });
  if (!out.trim()) return 'allow';
  return JSON.parse(out).hookSpecificOutput.permissionDecision;
}

const CASES = [
  {
    "name": "heredoc that only documents a banned command",
    "expect": "allow",
    "payload": {
      "tool_name": "Bash",
      "tool_input": {
        "command": "cat > doc.md <<'EOF'\nNever run prisma migrate reset in this repository.\nEOF\necho done"
      }
    }
  },
  {
    "name": "real migrate reset",
    "expect": "deny",
    "payload": {
      "tool_name": "Bash",
      "tool_input": {
        "command": "npx prisma migrate reset"
      }
    }
  },
  {
    "name": "migrate deploy chained after a safe command",
    "expect": "deny",
    "payload": {
      "tool_name": "Bash",
      "tool_input": {
        "command": "npm ci && npx prisma migrate deploy"
      }
    }
  },
  {
    "name": "secret written through a heredoc",
    "expect": "deny",
    "payload": {
      "tool_name": "Bash",
      "tool_input": {
        "command": "cat > f <<EOF\nAKIAIOSFODNN7EXAMPLE\nEOF"
      }
    }
  },
  {
    "name": "force push",
    "expect": "deny",
    "payload": {
      "tool_name": "Bash",
      "tool_input": {
        "command": "git push --force origin feature"
      }
    }
  },
  {
    "name": "push to protected base",
    "expect": "deny",
    "payload": {
      "tool_name": "Bash",
      "tool_input": {
        "command": "git push origin main"
      }
    }
  },
  {
    "name": "push a ticket branch",
    "expect": "allow",
    "payload": {
      "tool_name": "Bash",
      "tool_input": {
        "command": "git push -u origin SCRUM-12-fix"
      }
    }
  },
  {
    "name": "commit bypassing hooks",
    "expect": "deny",
    "payload": {
      "tool_name": "Bash",
      "tool_input": {
        "command": "git commit --no-verify -m wip"
      }
    }
  },
  {
    "name": "delete git internals",
    "expect": "deny",
    "payload": {
      "tool_name": "Bash",
      "tool_input": {
        "command": "rm -rf .git"
      }
    }
  },
  {
    "name": "hard reset",
    "expect": "ask",
    "payload": {
      "tool_name": "Bash",
      "tool_input": {
        "command": "git reset --hard HEAD~1"
      }
    }
  },
  {
    "name": "destructive SQL",
    "expect": "deny",
    "payload": {
      "tool_name": "Bash",
      "tool_input": {
        "command": "psql $DATABASE_URL -c \"DROP TABLE users\""
      }
    }
  },
  {
    "name": "production deployment",
    "expect": "deny",
    "payload": {
      "tool_name": "Bash",
      "tool_input": {
        "command": "kubectl apply -f k8s/"
      }
    }
  },
  {
    "name": "e2e suite against real AppModule",
    "expect": "deny",
    "payload": {
      "tool_name": "Bash",
      "tool_input": {
        "command": "npm run test:e2e"
      }
    }
  },
  {
    "name": "make a check pass without tests",
    "expect": "deny",
    "payload": {
      "tool_name": "Bash",
      "tool_input": {
        "command": "npx jest --passWithNoTests"
      }
    }
  },
  {
    "name": "unit tests",
    "expect": "allow",
    "payload": {
      "tool_name": "Bash",
      "tool_input": {
        "command": "npm test -- --runInBand"
      }
    }
  },
  {
    "name": "build",
    "expect": "allow",
    "payload": {
      "tool_name": "Bash",
      "tool_input": {
        "command": "npm run build"
      }
    }
  },
  {
    "name": "reproducible install",
    "expect": "allow",
    "payload": {
      "tool_name": "Bash",
      "tool_input": {
        "command": "npm ci"
      }
    }
  },
  {
    "name": "dependency change",
    "expect": "ask",
    "payload": {
      "tool_name": "Bash",
      "tool_input": {
        "command": "npm install lodash"
      }
    }
  },
  {
    "name": "write to .env",
    "expect": "deny",
    "payload": {
      "tool_name": "Write",
      "tool_input": {
        "file_path": ".env",
        "content": "X=1"
      }
    }
  },
  {
    "name": "hand-edit a generated knowledge map",
    "expect": "deny",
    "payload": {
      "tool_name": "Edit",
      "tool_input": {
        "file_path": ".ai/system/repository-map.md",
        "old_string": "a",
        "new_string": "b"
      }
    }
  },
  {
    "name": "edit curated knowledge inputs",
    "expect": "ask",
    "payload": {
      "tool_name": "Edit",
      "tool_input": {
        "file_path": ".ai/system/knowledge-inputs.json",
        "old_string": "a",
        "new_string": "b"
      }
    }
  },
  {
    "name": "edit an applied migration",
    "expect": "deny",
    "payload": {
      "tool_name": "Edit",
      "tool_input": {
        "file_path": "prisma/migrations/20250906150000_baseline/migration.sql",
        "old_string": "a",
        "new_string": "b"
      }
    }
  },
  {
    "name": "add a new migration",
    "expect": "allow",
    "payload": {
      "tool_name": "Write",
      "tool_input": {
        "file_path": "prisma/migrations/20260401000000_x/migration.sql",
        "content": "ALTER TABLE user_project ADD COLUMN note TEXT;"
      }
    }
  },
  {
    "name": "skip a failing test",
    "expect": "ask",
    "payload": {
      "tool_name": "Edit",
      "tool_input": {
        "file_path": "src/a.spec.ts",
        "old_string": "it(",
        "new_string": "it.skip("
      }
    }
  },
  {
    "name": "disable TLS verification",
    "expect": "deny",
    "payload": {
      "tool_name": "Edit",
      "tool_input": {
        "file_path": "prisma/prisma.service.ts",
        "old_string": "a",
        "new_string": "rejectUnauthorized: false"
      }
    }
  },
  {
    "name": "suppress a lint rule",
    "expect": "ask",
    "payload": {
      "tool_name": "Edit",
      "tool_input": {
        "file_path": "src/a.ts",
        "old_string": "x",
        "new_string": "// eslint-disable-next-line\nx"
      }
    }
  },
  {
    "name": "ordinary source edit",
    "expect": "allow",
    "payload": {
      "tool_name": "Edit",
      "tool_input": {
        "file_path": "src/modules/user/user.service.ts",
        "old_string": "const a = 1",
        "new_string": "const a = 2"
      }
    }
  },
  {
    "name": "read a file",
    "expect": "allow",
    "payload": {
      "tool_name": "Read",
      "tool_input": {
        "file_path": "src/main.ts"
      }
    }
  },
  {
    "name": "documentation quoting a dangerous code pattern",
    "expect": "allow",
    "payload": {
      "tool_name": "Write",
      "tool_input": {
        "file_path": "prisma/AGENTS.md",
        "content": "It sets rejectUnauthorized: false; that is a recorded finding."
      }
    }
  },
  {
    "name": "credential inside documentation",
    "expect": "deny",
    "payload": {
      "tool_name": "Write",
      "tool_input": {
        "file_path": "docs/notes.md",
        "content": "key AKIAIOSFODNN7EXAMPLE"
      }
    }
  }
];

for (const c of CASES) {
  test(c.name + ' -> ' + c.expect, () => {
    assert.strictEqual(decisionFor(c.payload), c.expect);
  });
}
