GitHub Copilot Migration Agent (simple wrapper)

Purpose
- Provide a small CLI that wraps the existing Java->Playwright converter and the test runner.

Quick usage
From `playwrite/` folder:

```powershell
# Run the converter
node githubcopilot-agent/index.js convert

# List converted files
node githubcopilot-agent/index.js list

# Run all converted tests
node githubcopilot-agent/index.js run-tests
```

Notes
- This agent is a lightweight wrapper that calls the converter located at `tools/javaToPlaywright.cjs`.
- The agent is intentionally simple so it is safe to extend with additional checks, pre-processing, or post-processing steps in future.

Extending
- Add flags to `index.js` to enable incremental conversion or to pass custom paths.
- Add authentication/credential sync code to pull config values from `src/main/java/.../config.properties` and populate `.env` for tests.
