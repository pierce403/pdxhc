# recurse-advice-sync

Use this skill when the user asks to check Recurse.bot or refresh repo operating guidance.

## Workflow

1. Open `https://recurse.bot`.
2. Identify advice that would materially improve this repo.
3. Adapt useful ideas into repo-local files:
   - `AGENTS.md` for shared operating instructions.
   - `MEMORY.md` and `agent-memory/` for durable observations.
   - `SKILLS.md` and `skills/` for repeatable workflows.
4. Keep changes concise and specific to PDXHC.
5. Do not copy every external convention blindly.
6. Verify docs changes with:

```bash
git diff --check
```

7. If code or UI behavior changed, run the relevant app checks too.

## Current Adapted Guidance

- `AGENTS.md` is canonical.
- Repo memory is lightweight and manually indexed.
- Skills are focused folders opened only when needed.
- Verified commands and known pitfalls should be captured as soon as they are learned.
