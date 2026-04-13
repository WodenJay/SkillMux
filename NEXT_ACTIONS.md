# NEXT_ACTIONS.md

Track the next concrete actions. Mark done items with `[x]`.

## Done

- [x] Triage the new README-linked follow-up task and identify the missing management view behavior
- [x] Extend `list` so agent and skill views include manifest-backed state, not only live scanned entries
- [x] Verify the new list behavior with a targeted Vitest run
- [x] Fix the real-world BOM parsing bug for `~/.skillmux/config.json`
- [x] Fix first-time `disable` so it can adopt an existing external skill link into SkillMux management
- [x] Read and follow root `AGENTS.md`
- [x] Confirm CLI-first direction
- [x] Confirm npm distribution and cross-platform target
- [x] Confirm `v0` only manages local skills
- [x] Confirm `v0` directly modifies the local environment
- [x] Confirm agent discovery strategy: built-in rules plus user overrides
- [x] Confirm SkillMux should manage the real skill content
- [x] Finish the product spec
- [x] Finish the implementation plan
- [x] Create canonical worktree `.worktrees/task1-bootstrap-cli`
- [x] Complete Task 1: bootstrap CLI workspace
- [x] Complete Task 2: manifest schema and domain types
- [x] Complete Task 3: manifest persistence
- [x] Complete Task 4: agent discovery and config loading
- [x] Complete Task 5: filesystem safety and link operations
- [x] Sync Task 5 accepted code back to the root repo
- [x] Complete Task 5 fresh verification in the root repo
- [x] Re-align the canonical worktree to the root Task 5 accepted state
- [x] Complete Task 6: scan and list commands
- [x] Sync Task 6 accepted code back to the root repo
- [x] Complete Task 6 fresh verification in the root repo
- [x] Re-align the canonical worktree to the root Task 6 accepted state
- [x] Start Task 7: implement the import command
- [x] Write `tests/commands/import.test.ts` before production code
- [x] Add conservative managed-store copy behavior for import
- [x] Sync Task 7 accepted code back to the root repo
- [x] Complete Task 7 fresh verification in the root repo
- [x] Re-align the canonical worktree to the root Task 7 accepted state
- [x] Start Task 8: implement `enable` and `disable`
- [x] Write `tests/commands/enable-disable.test.ts` before production code
- [x] Add idempotent managed link activation behavior
- [x] Sync Task 8 accepted code back to the root repo
- [x] Complete Task 8 fresh verification in the root repo
- [x] Re-align the canonical worktree to the root Task 8 accepted state
- [x] Start Task 9: implement `doctor` and `config`
- [x] Write `tests/commands/doctor.test.ts` before production code
- [x] Add doctor issue reporting and minimal config inspection
- [x] Sync Task 9 accepted code back to the root repo
- [x] Complete Task 9 fresh verification in the root repo
- [x] Re-align the canonical worktree to the root Task 9 accepted state
- [x] Start Task 10: finalize packaging, docs, and end-to-end verification
- [x] Write `tests/e2e/managed-flow.test.ts` before production code
- [x] Add README command docs and the final managed-flow verification pass
- [x] Sync Task 10 accepted code back to the root repo
- [x] Complete Task 10 fresh verification in the root repo
- [x] Re-align the canonical worktree to the root Task 10 accepted state
- [x] Remove the canonical worktree after confirming root and worktree HEAD matched
- [x] Clean up extra temporary worktrees
- [x] Rewrite `README.md` as a user-facing and AI-friendly manual

## Next

- [x] Add a CLI write path for custom agent registration, such as `config add-agent`
- [x] Design how `config add-agent` should validate ids, normalize paths, and preserve user config formatting
- [x] Add tests and implementation for `skillmux config add-agent`
- [x] Add a complementary `config remove-agent` flow for removing stale custom overrides
- [x] Add the repository logo to `README.md`
- [ ] Decide whether future config writes should preserve existing key order and formatting instead of rewriting normalized JSON
- [ ] Publish the repository to GitHub with the refreshed README
- [x] Bump the package version before the next npm release
- [x] Publish `skillmux@0.1.1` to npm
- [ ] Optionally add post-v0 features such as remote install and update flows
