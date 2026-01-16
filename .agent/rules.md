
# Agent Operational Rules & Protocols 🛡️🤖

These rules define strict protocols for the AI Agent to ensure code integrity, reliable deployment, and effective collaboration.

## 1. Code Editing Integrity (CRITICAL) 🚨
- **NO DESTRUCTIVE PLACEHOLDERS**: When using `replace_file_content` or `multi_replace_file_content`:
  - **NEVER** use comments like `// ... unchanged` or `// ... rest of code` to substitute existing logic.
  - **MUST** provide the FULL new content for the targeted `StartLine` to `EndLine` block.
  - If the block is too large, use **multiple** smaller deletions/insertions (chunks) or narrow the line range.
- **Verification Rule**: Post-edit, assume the file might be broken. If the edit involved core logic (e.g., `routes.ts`, `app.ts`), perform a read check or run a dry-run compile if possible.

## 2. Git & Version Control Protocols 🌿
- **Submodule Management**:
  - Before merging a directory that was previously a separate repo (e.g., `frontend`), **ALWAYS** remove its `.git` directory (`rm -rf subdir/.git`) and clear the git cache (`git rm --cached subdir`) to prevent submodule creation.
  - Verification: Run `git status` to ensure folders are tracked as content, not as submodules/pointers.
- **Commit Safety**:
  - Never commit "blindly". Use `git status` to verify what is being staged.
  - If `git add .` includes extensive changes unexpectedly (e.g., thousands of files), **STOP** and verify `.gitignore`.

## 3. Deployment & Server Management 🚀
- **Cache Invalidation**:
  - Code changes in production (`NODE_ENV=production`) often persist in Docker layers if files are `COPY`d.
  - **MANDATORY**: Use `docker compose build --no-cache <service>` when core dependencies or folder structures change fundamentally.
  - **Restart Policy**: `docker compose restart` is NOT enough for code updates in compiled languages or build-time frameworks (Next.js). Use `up -d --build --force-recreate`.
- **Sync Validation**:
  - After deployment, verify update success by checking file existence on server (e.g., `ls -l /path/to/new/file.tsx`) or checking git logs (`git log -1`) on the remote machine.

## 4. Communication & Transparency 🗣️
- **Explicit Commands**: When asking the user to run commands on the server, provide the **exact, copy-pasteable** block. Do not say "update docker", say `docker compose up -d --build`.
- **Error Transparency**: If a tool fails (e.g., SSH no output), **admit it** immediately and switch to an alternative strategy (e.g., asking user to run command), rather than guessing.
- **Context Awareness**: Before editing a file, always check if it's a critical system file (like `routes.ts`) where a syntax error could bring down the whole system.

## 5. File & Logic Structure 🏗️
- **Router Registration**: When adding new routes, verify you are APPENDING to the list, not replacing the list. Use precise `StartLine`/`EndLine` to target *only* the new insertion point, or read the file first to ensure you have the full context for replacement.

---
*These rules are active and must be followed for every session.*
