# Marketplace and review notes

This document records the install source, capability boundaries and reproducible checks for marketplace reviewers. The canonical proposed `awesome-dsh-plugin` entry is kept in [`marketplace/awesome-dsh-plugin.yml`](marketplace/awesome-dsh-plugin.yml).

## Install source

- Repository: `https://github.com/Flycat43/liang-desktop-pet`
- Plugin subdirectory: `plugins/liang-harness-plugin`
- Package name: `liang-harness-plugin`
- Profile: `web`
- Prebuilt package: GitHub Release `.tgz`

The repository is a monorepo. Review and installation should target this plugin subdirectory rather than the Electron application at the repository root.

## Capability and data flow

| Surface | Access | Purpose |
| --- | --- | --- |
| Harness session list and current session | Read | Follow the conversation selected by the user |
| Current conversation | Write | Send the text submitted in the plugin input |
| Public assistant text and reasoning blocks | Read | Render the answer and public reasoning summary |
| Browser `localStorage` | Read/write | Remember panel state, position, level, mode and speech preference |
| Browser `speechSynthesis` | Optional write | Read the final answer with an operating-system voice |
| Filesystem and shell | None directly | The plugin registers no filesystem or command tool |
| Additional network endpoints | None | Model traffic continues through the user's Harness configuration |

The personality and mode instructions are prepended to the user's submitted text and remain visible in the Harness conversation. The plugin does not modify the system prompt and does not attempt to expose hidden chain-of-thought.

## Reproducible verification

From `plugins/liang-harness-plugin`:

```bash
npm ci --legacy-peer-deps
npm test
npm pack --dry-run
```

`npm test` rebuilds the browser client and verifies the package manifest, Cordis patch, exported files, local-path hygiene and all six embedded character images. The same checks run in `.github/workflows/plugin-check.yml` on pushes and pull requests.

## Compatibility

- Node.js 22 or newer
- DeepSeek Harness web profile
- `@deepseek-ai/dsh-client-runtime` and `@deepseek-ai/dsh-client-ui-conversation` compatible with `0.1.1-rc.2`
- macOS, Windows and Linux browsers supported by Harness

## Assets and identity

The source code is MIT licensed. The portrait assets, likeness and related personality or publicity rights are not granted by that license. The project is unofficial and is not affiliated with DeepSeek or the depicted person. See [`ASSETS_LICENSE.md`](ASSETS_LICENSE.md) before redistributing or using the package commercially.
