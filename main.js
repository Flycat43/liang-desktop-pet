const { app, BrowserWindow, dialog, ipcMain, screen } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

const DSH_BIN_RELATIVE_PATH = path.join("node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
const SETTINGS_FILE_NAME = "settings.json";
const TASK_TIMEOUT_MS = 10 * 60 * 1000;
const HARNESS_WEB_START_TIMEOUT_MS = 45 * 1000;
const HARNESS_WEB_URL = "http://127.0.0.1:3080";
const MAX_CAPTURE_LENGTH = 2_000_000;
const MAX_SPEECH_LENGTH = 8_000;
const HARNESS_MODES = Object.freeze({
  standard: {
    name: "标准模式",
    instruction: "使用完整能力直接完成任务；按需读取、检索、编辑、执行与验证，最终给出清晰结果。"
  },
  ptc: {
    name: "PTC 模式",
    instruction: "优先使用 Code Mode SDK，以一个紧凑的 TypeScript 程序组合多步工具操作；执行后验证结果并给出最终结论。"
  },
  minimal: {
    name: "极简模式",
    instruction: "采用最少且直接的步骤完成任务，优先使用持久 Shell 与直接文件编辑；避免网页检索、子代理和不必要的扩展流程。"
  },
  cordis: {
    name: "创造模式",
    instruction: "以创建和改造 Agent、preset、插件及 Harness 组合为优先视角；需要时检查运行时结构，并对产物进行实际验证。"
  }
});
const CHARACTER_PROFILES = Object.freeze([
  {
    name: "小梁",
    styleName: "怂怂试探",
    instruction: "语气胆小、试探、略显鬼祟和讨好，多用短句，可偶尔用“那个……”“要不咱……”；先提醒风险，再给最稳妥的办法。"
  },
  {
    name: "牢梁",
    styleName: "谨慎低语",
    instruction: "语气谨慎、压低姿态，像先观察四周再开口；可偶尔用“咳，先别声张”“稳一点”，重点说明风险、边界和退路。"
  },
  {
    name: "梁子",
    styleName: "油滑机灵",
    instruction: "语气油滑、机灵、带一点得意的喜剧感；可偶尔用“嘿，这事儿我门儿清”，先抛一句俏皮话，再快速给出可执行方案。"
  },
  {
    name: "梁圣",
    styleName: "老练戏谑",
    instruction: "语气老练、沉着、略带戏谑，像看透门道后慢慢点破；表达有条理，关键结论干脆，不堆砌口头禅。"
  },
  {
    name: "梁神",
    styleName: "阴沉强势",
    instruction: "语气低沉、冷峻、强势，偶尔带轻微不屑的幽默；句子更短，先下判断，再列步骤和验收标准。"
  },
  {
    name: "梁祖",
    styleName: "威严敕令",
    instruction: "语气威严、深沉、像祖师下定论；可少量使用“此事”“且听”等古雅措辞，先给结论，再给不可含糊的执行次序。"
  }
]);
const SPEECH_PROFILES = [
  { name: "小梁", tone: "成年男声 · 怂滑低语", voice: "zh-CN-YunxiNeural", rate: "-10%", pitch: "-4Hz", volume: "-8%", intro: "嘿嘿，那个，我悄悄跟你说啊。" },
  { name: "牢梁", tone: "成年男声 · 鬼祟慢声", voice: "zh-CN-YunxiNeural", rate: "-7%", pitch: "-8Hz", volume: "-7%", intro: "咳，先别声张，我慢慢给你捋。" },
  { name: "梁子", tone: "成年男声 · 油滑语气", voice: "zh-CN-YunxiNeural", rate: "+1%", pitch: "-11Hz", volume: "-4%", intro: "嘿，这事儿我门儿清，听我给你说。" },
  { name: "梁圣", tone: "成年男声 · 老练暗声", voice: "zh-CN-YunyangNeural", rate: "-4%", pitch: "-14Hz", volume: "-3%", intro: "呵，这点门道，听我慢慢讲。" },
  { name: "梁神", tone: "成年男声 · 阴沉强势", voice: "zh-CN-YunjianNeural", rate: "-8%", pitch: "-18Hz", volume: "-2%", intro: "嗯，既然问了，那就听好。" },
  { name: "梁祖", tone: "成年男声 · 低沉威压", voice: "zh-CN-YunjianNeural", rate: "-13%", pitch: "-24Hz", volume: "+0%", intro: "呵呵，此事已有定论，且听我说。" }
];

let petWindow;
let harnessTaskProcess;
let harnessWebProcess;
let harnessWebStartPromise;
let harnessWebUrl = "";
let speechClient;
let speechAudioDirectory;
let speechRequestSequence = 0;
let dragState = null;
let appSettings = { workspacePath: "" };
let currentInterface = "pet";
let petWindowBounds;
let harnessWindowBounds;

function createPetWindow() {
  petWindow = new BrowserWindow({
    width: 660,
    height: 700,
    minWidth: 460,
    minHeight: 520,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    title: "Liang Desktop Pet",
    backgroundColor: "#00000000",
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  petWindowBounds = petWindow.getBounds();
  petWindow.webContents.on("did-finish-load", () => {
    if (currentInterface === "harness") {
      injectHarnessInterfaceToggle();
      return;
    }

    try {
      findHarnessRuntime();
      petWindow.webContents.send("liang:status", `已连接 ${path.basename(getWorkspacePath())}，点人物开聊。`);
    } catch (error) {
      petWindow.webContents.send("liang:status", error.message);
    }
  });
  petWindow.loadFile(path.join(__dirname, "pet.html"));
}

async function isHarnessWebAvailable(url = HARNESS_WEB_URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return false;
    const html = await response.text();
    return /deepseek/i.test(html) && /harness/i.test(html);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function waitForHarnessWeb(child, getOutput) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      if (await isHarnessWebAvailable(HARNESS_WEB_URL)) {
        resolve(HARNESS_WEB_URL);
        return;
      }
      if (child.exitCode !== null || child.signalCode) {
        reject(new Error(getOutput() || `Harness 完整界面启动失败，退出码：${child.exitCode ?? "未知"}`));
        return;
      }
      if (Date.now() - startedAt >= HARNESS_WEB_START_TIMEOUT_MS) {
        reject(new Error("Harness 完整界面启动超时。"));
        return;
      }
      setTimeout(check, 300);
    };
    check();
  });
}

async function startHarnessWebServer() {
  if (harnessWebUrl && await isHarnessWebAvailable(harnessWebUrl)) return harnessWebUrl;
  if (await isHarnessWebAvailable(HARNESS_WEB_URL)) {
    harnessWebUrl = HARNESS_WEB_URL;
    return harnessWebUrl;
  }

  const runtime = findHarnessRuntime();
  const runtimeArguments = runtime.electronAsNode
    ? ["--expose-internals", runtime.dshBin, "web", "--no-open", "--port", "3080"]
    : [runtime.dshBin, "web", "--no-open", "--port", "3080"];
  const child = spawn(runtime.nodeBin, runtimeArguments, {
    cwd: getWorkspacePath(),
    env: createHarnessEnvironment(runtime),
    stdio: ["ignore", "pipe", "pipe"],
    shell: false
  });

  harnessWebProcess = child;
  let output = "";
  const capture = (chunk) => {
    output = (output + stripAnsi(chunk.toString())).slice(-4000);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  child.once("close", () => {
    if (harnessWebProcess === child) harnessWebProcess = null;
    if (harnessWebUrl === HARNESS_WEB_URL) harnessWebUrl = "";
  });

  try {
    harnessWebUrl = await waitForHarnessWeb(child, () => output.trim());
    return harnessWebUrl;
  } catch (error) {
    if (!child.killed && child.exitCode === null) child.kill("SIGTERM");
    throw error;
  }
}

function ensureHarnessWebServer() {
  if (!harnessWebStartPromise) {
    harnessWebStartPromise = startHarnessWebServer().finally(() => {
      harnessWebStartPromise = null;
    });
  }
  return harnessWebStartPromise;
}

function getDefaultHarnessBounds() {
  const workArea = screen.getDisplayMatching(petWindow.getBounds()).workArea;
  const width = Math.max(640, Math.min(1280, workArea.width - 48));
  const height = Math.max(520, Math.min(840, workArea.height - 48));
  return {
    width,
    height,
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2)
  };
}

async function showHarnessInterface(url) {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindowBounds = petWindow.getBounds();
  currentInterface = "harness";
  const bounds = harnessWindowBounds || getDefaultHarnessBounds();
  petWindow.setMinimumSize(Math.min(900, bounds.width), Math.min(620, bounds.height));
  petWindow.setBounds(bounds, true);
  petWindow.setTitle("DeepSeek Harness Desktop");
  petWindow.setHasShadow?.(true);
  try {
    await petWindow.loadURL(url);
    petWindow.show();
    petWindow.focus();
  } catch (error) {
    currentInterface = "pet";
    await showPetInterface();
    dialog.showErrorBox("Harness 完整界面启动失败", error.message);
  }
}

async function showPetInterface() {
  if (!petWindow || petWindow.isDestroyed()) return;
  if (currentInterface === "harness" && !petWindow.isMaximized() && !petWindow.isFullScreen()) {
    harnessWindowBounds = petWindow.getBounds();
  }
  currentInterface = "pet";
  if (petWindow.isFullScreen()) petWindow.setFullScreen(false);
  if (petWindow.isMaximized()) petWindow.unmaximize();
  petWindow.setMinimumSize(460, 520);
  if (petWindowBounds) petWindow.setBounds(petWindowBounds, true);
  petWindow.setTitle("Liang Desktop Pet");
  petWindow.setHasShadow?.(false);
  await petWindow.loadFile(path.join(__dirname, "pet.html"));
  petWindow.show();
  petWindow.focus();
}

function injectHarnessInterfaceToggle() {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.webContents.executeJavaScript(`(() => {
    if (!document.getElementById("liang-interface-toggle-host")) {
      const host = document.createElement("div");
      host.id = "liang-interface-toggle-host";
      host.style.cssText = "position:fixed;left:24px;bottom:72px;z-index:2147483647;width:48px;height:48px;";
      const root = host.attachShadow({ mode: "open" });
      root.innerHTML = \`
        <style>
          button {
            display: grid;
            width: 48px;
            height: 48px;
            padding: 0;
            place-items: center;
            border: 1px solid rgba(255, 255, 255, 0.24);
            border-radius: 50%;
            outline: 0;
            background: rgba(20, 23, 27, 0.88);
            color: #f7f2e7;
            box-shadow: 0 14px 30px rgba(0, 0, 0, 0.38);
            font: 800 26px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            cursor: pointer;
            backdrop-filter: blur(14px);
            transition: transform 140ms ease, background 140ms ease;
          }
          button:hover { background: rgba(59, 130, 246, 0.94); transform: translateY(-1px); }
          button:focus-visible { outline: 3px solid rgba(96, 165, 250, 0.72); outline-offset: 3px; }
          button:disabled { cursor: wait; opacity: 0.68; }
        </style>
        <button type="button" aria-label="返回梁圣桌宠" title="返回梁圣桌宠">↶</button>
      \`;
      root.querySelector("button").addEventListener("click", async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await window.liangPet?.toggleInterface();
        } catch (error) {
          button.disabled = false;
          button.title = error?.message || "无法返回桌宠界面";
        }
      });
      document.documentElement.appendChild(host);
    }

    if (!document.getElementById("liang-harness-window-chrome")) {
      const chromeHost = document.createElement("div");
      chromeHost.id = "liang-harness-window-chrome";
      chromeHost.style.cssText = "position:fixed;inset:0 0 auto 0;z-index:2147483647;height:36px;pointer-events:none;";
      const chromeRoot = chromeHost.attachShadow({ mode: "open" });
      chromeRoot.innerHTML = \`
        <style>
          :host { color-scheme: dark; }
          .controls {
            position: absolute;
            top: 10px;
            left: 13px;
            display: flex;
            gap: 8px;
            pointer-events: auto;
          }
          .window-button {
            display: grid;
            width: 15px;
            height: 15px;
            padding: 0;
            place-items: center;
            border: 1px solid rgba(0, 0, 0, 0.2);
            border-radius: 50%;
            color: rgba(28, 28, 30, 0.78);
            box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.22);
            font: 800 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            cursor: pointer;
          }
          .window-button.close { background: #ff5f57; }
          .window-button.minimize { background: #febc2e; }
          .window-button.maximize { background: #28c840; }
          .window-button span { opacity: 0; transform: translateY(-0.5px); }
          .controls:hover .window-button span,
          .window-button:focus-visible span { opacity: 1; }
          .window-button:focus-visible { outline: 2px solid rgba(96, 165, 250, 0.9); outline-offset: 2px; }
          .drag-region {
            position: absolute;
            top: 0;
            right: 230px;
            left: 86px;
            height: 34px;
            pointer-events: auto;
            cursor: grab;
            touch-action: none;
            user-select: none;
          }
          .drag-region:active { cursor: grabbing; }
          @media (max-width: 760px) {
            .drag-region { right: 86px; }
          }
        </style>
        <div class="controls" aria-label="窗口控制">
          <button class="window-button close" type="button" data-action="close" aria-label="关闭" title="关闭"><span>×</span></button>
          <button class="window-button minimize" type="button" data-action="minimize" aria-label="最小化" title="最小化"><span>−</span></button>
          <button class="window-button maximize" type="button" data-action="maximize" aria-label="放大或还原" title="放大或还原"><span>+</span></button>
        </div>
        <div class="drag-region" role="toolbar" aria-label="拖动窗口" title="拖动窗口；双击放大或还原"></div>
      \`;

      const actions = {
        close: () => window.liangPet?.closeApp(),
        minimize: () => window.liangPet?.minimizeWindow(),
        maximize: () => window.liangPet?.toggleMaximizeWindow()
      };
      chromeRoot.querySelectorAll("[data-action]").forEach((button) => {
        button.addEventListener("click", () => actions[button.dataset.action]?.());
      });

      const dragRegion = chromeRoot.querySelector(".drag-region");
      let activePointer = null;
      dragRegion.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        activePointer = event.pointerId;
        try { dragRegion.setPointerCapture(event.pointerId); } catch {}
        window.liangPet?.dragStart({ screenX: event.screenX, screenY: event.screenY });
        event.preventDefault();
      });
      dragRegion.addEventListener("pointermove", (event) => {
        if (event.pointerId !== activePointer) return;
        window.liangPet?.dragMove({ screenX: event.screenX, screenY: event.screenY });
      });
      const finishDrag = (event) => {
        if (activePointer === null || (event.pointerId !== undefined && event.pointerId !== activePointer)) return;
        activePointer = null;
        window.liangPet?.dragEnd();
      };
      dragRegion.addEventListener("pointerup", finishDrag);
      dragRegion.addEventListener("pointercancel", finishDrag);
      dragRegion.addEventListener("lostpointercapture", finishDrag);
      dragRegion.addEventListener("dblclick", () => window.liangPet?.toggleMaximizeWindow());
      document.documentElement.appendChild(chromeHost);
    }
  })()`, true).catch(() => {});
}

function getSettingsFilePath() {
  return path.join(app.getPath("userData"), SETTINGS_FILE_NAME);
}

function loadAppSettings() {
  try {
    const stored = JSON.parse(fs.readFileSync(getSettingsFilePath(), "utf8"));
    appSettings.workspacePath = typeof stored.workspacePath === "string" && fs.existsSync(stored.workspacePath)
      ? stored.workspacePath
      : "";
  } catch {
    appSettings = { workspacePath: "" };
  }
}

function saveAppSettings() {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(getSettingsFilePath(), JSON.stringify(appSettings, null, 2));
}

function getWorkspacePath() {
  const configured = process.env.DSH_WORKDIR || appSettings.workspacePath;
  if (configured && fs.existsSync(configured)) return configured;
  return app.getPath("documents");
}

function getPublicAppSettings() {
  return { workspacePath: getWorkspacePath() };
}

function executableName(name) {
  return process.platform === "win32" ? `${name}.exe` : name;
}

function findOnPath(name) {
  const executable = executableName(name);
  return String(process.env.PATH || "")
    .split(path.delimiter)
    .filter(Boolean)
    .map((entry) => path.join(entry, executable))
    .find((candidate) => fs.existsSync(candidate));
}

function getExternalNodeCandidates() {
  const candidates = [
    process.env.DSH_NODE_PATH,
    findOnPath("node"),
    path.join(os.homedir(), ".local", "bin", executableName("node"))
  ];

  if (process.platform === "darwin") {
    candidates.push("/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node");
  }
  if (process.platform === "win32") {
    candidates.push(
      path.join(process.env.ProgramFiles || "C:\\Program Files", "nodejs", "node.exe"),
      path.join(process.env.LOCALAPPDATA || "", "Programs", "nodejs", "node.exe")
    );
  }

  return [...new Set(candidates.filter(Boolean))];
}

function getNpxRoots() {
  const roots = [
    process.env.npm_config_cache,
    path.join(os.homedir(), ".npm")
  ];
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    roots.push(path.join(process.env.LOCALAPPDATA, "npm-cache"));
  }
  return [...new Set(roots.filter(Boolean).map((root) => path.join(root, "_npx")))];
}

function findHarnessRuntime() {
  try {
    const packageRoot = path.dirname(require.resolve("@deepseek-ai/dsh/package.json"));
    const bundledDshBin = path.join(packageRoot, "lib", "bin.js");
    if (fs.existsSync(bundledDshBin)) {
      return { nodeBin: process.execPath, dshBin: bundledDshBin, electronAsNode: true };
    }
  } catch {
    // Development installs may use an existing npx cache instead.
  }

  const nodeBin = getExternalNodeCandidates().find((candidate) => fs.existsSync(candidate));
  if (!nodeBin) throw new Error("没有找到 Node.js，请安装 Node.js 22 或设置 DSH_NODE_PATH。");

  const explicitDshBin = process.env.DSH_BIN_PATH;
  if (explicitDshBin && fs.existsSync(explicitDshBin)) {
    return { nodeBin, dshBin: explicitDshBin, electronAsNode: false };
  }

  const candidates = getNpxRoots()
    .filter((root) => fs.existsSync(root))
    .flatMap((root) => fs.readdirSync(root).map((entry) => path.join(root, entry, DSH_BIN_RELATIVE_PATH)))
    .filter((candidate) => fs.existsSync(candidate))
    .map((candidate) => ({ candidate, modifiedAt: fs.statSync(candidate).mtimeMs }))
    .sort((a, b) => b.modifiedAt - a.modifiedAt);

  if (!candidates.length) {
    throw new Error("没有找到 DeepSeek Harness，请先运行 npx @deepseek-ai/dsh web 完成安装。");
  }

  return { nodeBin, dshBin: candidates[0].candidate, electronAsNode: false };
}

function sendProgress(text) {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.webContents.send("liang:partial", text);
}

function stripAnsi(text) {
  return String(text || "").replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
}

function prepareSpeechText(value) {
  const cleaned = stripAnsi(value)
    .replace(/```[\s\S]*?```/g, " 代码内容请在对话框查看。 ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " 图片 ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "链接")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*+] |\d+[.)] )/gm, "")
    .replace(/[>*_~|]/g, "")
    .replace(/\[\[/g, "")
    .replace(/\]\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length <= MAX_SPEECH_LENGTH) return cleaned;
  return `${cleaned.slice(0, MAX_SPEECH_LENGTH)}。内容较长，其余部分请在对话框查看。`;
}

function escapeSpeechXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function sendSpeechStatus(text) {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.webContents.send("liang:status", text);
}

function cleanupSpeechDirectory(directory) {
  if (!directory || !path.basename(directory).startsWith("liang-pet-tts-")) return;
  fs.rm(directory, { recursive: true, force: true }, () => {});
}

function stopSpeaking() {
  speechRequestSequence += 1;
  if (speechClient) {
    speechClient.close();
    speechClient = null;
  }
  cleanupSpeechDirectory(speechAudioDirectory);
  speechAudioDirectory = null;
}

async function startSpeaking(payload = {}) {
  const level = Math.max(0, Math.min(SPEECH_PROFILES.length - 1, Math.round(Number(payload.level) || 0)));
  const profile = SPEECH_PROFILES[level];
  const text = prepareSpeechText(payload.text);
  if (!text) return { started: false, profile: profile.name };

  stopSpeaking();
  const requestId = speechRequestSequence;
  const directory = path.join(app.getPath("temp"), `liang-pet-tts-${process.pid}-${requestId}`);
  const client = new MsEdgeTTS();
  speechClient = client;
  speechAudioDirectory = directory;
  fs.mkdirSync(directory, { recursive: true });
  sendSpeechStatus(`正在生成${profile.name} · ${profile.tone}…`);

  try {
    await client.setMetadata(profile.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    if (requestId !== speechRequestSequence) {
      cleanupSpeechDirectory(directory);
      return { started: false, cancelled: true, profile: profile.name };
    }

    const spokenText = escapeSpeechXml(`${profile.intro} ${text}`);
    const { audioFilePath } = await client.toFile(directory, spokenText, {
      rate: profile.rate,
      pitch: profile.pitch,
      volume: profile.volume
    });
    client.close();
    if (speechClient === client) speechClient = null;
    if (requestId !== speechRequestSequence) {
      cleanupSpeechDirectory(directory);
      return { started: false, cancelled: true, profile: profile.name };
    }

    const audioDataUrl = `data:audio/mpeg;base64,${fs.readFileSync(audioFilePath).toString("base64")}`;
    cleanupSpeechDirectory(directory);
    if (speechAudioDirectory === directory) speechAudioDirectory = null;
    sendSpeechStatus(`${profile.name}正在用${profile.tone}朗读。`);
    return { started: true, profile: profile.name, tone: profile.tone, audioDataUrl };
  } catch (error) {
    client.close();
    if (speechClient === client) speechClient = null;
    cleanupSpeechDirectory(directory);
    if (speechAudioDirectory === directory) speechAudioDirectory = null;
    if (requestId !== speechRequestSequence) {
      return { started: false, cancelled: true, profile: profile.name };
    }
    const message = "神经配音连接失败，请检查网络后重试。";
    sendSpeechStatus(message);
    throw new Error(`${message} ${error.message}`);
  }
}

function resolveHarnessRequest(request) {
  const payload = request && typeof request === "object" ? request : { prompt: request };
  const prompt = String(payload.prompt || "").trim();
  if (!prompt) throw new Error("请输入任务内容。");
  const modeId = Object.hasOwn(HARNESS_MODES, payload.modeId) ? payload.modeId : "standard";
  const mode = HARNESS_MODES[modeId];
  const level = Math.max(0, Math.min(CHARACTER_PROFILES.length - 1, Math.round(Number(payload.level) || 0)));
  const character = CHARACTER_PROFILES[level];
  const task = [
    `你正在以“${mode.name}”处理本次任务。`,
    mode.instruction,
    `如果用户询问当前运行模式，必须准确回答“${mode.name}”。除非用户询问，否则最终答复不要复述模式说明。`,
    `当前人物档位是“${character.name}”，表达风格是“${character.styleName}”。`,
    character.instruction,
    `最终答复要明显体现“${character.name}”的表达风格，但不得改变事实、代码、命令、路径和技术结论；保持成年男性的油滑喜剧感，不使用露骨、骚扰、歧视或人身攻击内容。如果用户询问当前人物档位，必须准确回答“${character.name}”。`,
    "用户任务：",
    prompt
  ].join("\n\n");
  return { task, mode, modeId, level, character };
}

function createHarnessEnvironment(runtime) {
  const pathEntries = [
    path.dirname(runtime.nodeBin),
    path.join(os.homedir(), ".local", "bin"),
    process.platform === "darwin" ? "/opt/homebrew/bin" : "",
    process.platform === "darwin" ? "/usr/local/bin" : "",
    process.platform !== "win32" ? "/usr/bin" : "",
    process.platform !== "win32" ? "/bin" : "",
    process.env.PATH || ""
  ].filter(Boolean);
  const environment = {
    ...process.env,
    PATH: [...new Set(pathEntries)].join(path.delimiter)
  };
  if (runtime.electronAsNode) environment.ELECTRON_RUN_AS_NODE = "1";
  return environment;
}

function sendPromptToHarness(request) {
  const { task, mode, character } = resolveHarnessRequest(request);
  if (harnessTaskProcess) throw new Error("Harness 正在处理上一项任务，请稍候。");

  const runtime = findHarnessRuntime();
  const workspacePath = getWorkspacePath();
  sendProgress(`${character.name} · ${mode.name}已启用，正在读取 ${path.basename(workspacePath)}…`);

  return new Promise((resolve, reject) => {
    const runtimeArguments = runtime.electronAsNode
      ? ["--expose-internals", runtime.dshBin, "--profile", "headless", task]
      : [runtime.dshBin, "--profile", "headless", task];
    const child = spawn(runtime.nodeBin, runtimeArguments, {
      cwd: workspacePath,
      env: createHarnessEnvironment(runtime),
      stdio: ["ignore", "pipe", "pipe"],
      shell: false
    });

    harnessTaskProcess = child;
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let receivedOutput = false;
    const progressTimers = [
      setTimeout(() => sendProgress(`${character.name}正在分析任务与工作区上下文…`), 1800),
      setTimeout(() => sendProgress(`${character.name}正在执行所需步骤并收集结果…`), 5200),
      setTimeout(() => sendProgress(`${character.name}正在检查结果并整理最终输出…`), 11000)
    ];
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, TASK_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeout);
      progressTimers.forEach(clearTimeout);
      if (harnessTaskProcess === child) harnessTaskProcess = null;
    };

    child.stdout.on("data", (chunk) => {
      stdout = (stdout + chunk.toString()).slice(-MAX_CAPTURE_LENGTH);
      if (!receivedOutput) {
        receivedOutput = true;
        sendProgress("已收到回答，正在完成最终整理…");
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-MAX_CAPTURE_LENGTH);
    });

    child.once("error", (error) => {
      cleanup();
      reject(new Error(`无法启动 Harness：${error.message}`));
    });

    child.once("close", (code) => {
      cleanup();
      if (timedOut) {
        reject(new Error("Harness 处理超时，请缩小任务范围后重试。"));
        return;
      }

      const output = stripAnsi(stdout).trim();
      if (code === 0 && output) {
        resolve(output);
        return;
      }

      const detail = stripAnsi(stderr).trim().slice(-1200);
      reject(new Error(detail || `Harness 已退出，退出码：${code ?? "未知"}`));
    });
  });
}

ipcMain.handle("liang:send", async (_event, request) => {
  return sendPromptToHarness(request);
});

ipcMain.handle("liang:speak", async (_event, payload) => {
  return startSpeaking(payload);
});

ipcMain.handle("liang:get-app-settings", () => {
  return getPublicAppSettings();
});

ipcMain.handle("liang:choose-workspace", async () => {
  const result = await dialog.showOpenDialog(petWindow, {
    title: "选择 Harness 工作区",
    defaultPath: getWorkspacePath(),
    properties: ["openDirectory", "createDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) return getPublicAppSettings();
  appSettings.workspacePath = result.filePaths[0];
  saveAppSettings();
  sendSpeechStatus(`工作区已切换为 ${path.basename(appSettings.workspacePath)}。`);
  return getPublicAppSettings();
});

ipcMain.handle("liang:toggle-interface", async () => {
  if (currentInterface === "harness") {
    setTimeout(() => showPetInterface().catch((error) => {
      dialog.showErrorBox("桌宠界面恢复失败", error.message);
    }), 0);
    return { interface: "pet" };
  }

  const url = await ensureHarnessWebServer();
  setTimeout(() => showHarnessInterface(url), 0);
  return { interface: "harness" };
});

ipcMain.on("liang:stop-speaking", () => {
  stopSpeaking();
});

ipcMain.on("liang:drag-start", (_event, point) => {
  if (!petWindow || petWindow.isDestroyed()) return;
  const [windowX, windowY] = petWindow.getPosition();
  dragState = {
    pointerX: point.screenX,
    pointerY: point.screenY,
    windowX,
    windowY
  };
});

ipcMain.on("liang:drag-move", (_event, point) => {
  if (!petWindow || petWindow.isDestroyed() || !dragState) return;
  const nextX = Math.round(dragState.windowX + point.screenX - dragState.pointerX);
  const nextY = Math.round(dragState.windowY + point.screenY - dragState.pointerY);
  petWindow.setPosition(nextX, nextY);
});

ipcMain.on("liang:drag-end", () => {
  dragState = null;
});

ipcMain.on("liang:focus-window", () => {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.show();
  petWindow.focus();
});

ipcMain.on("liang:minimize-window", () => {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.minimize();
});

ipcMain.on("liang:toggle-maximize-window", () => {
  if (!petWindow || petWindow.isDestroyed()) return;
  if (petWindow.isMaximized()) petWindow.unmaximize();
  else petWindow.maximize();
});

ipcMain.on("liang:close-app", () => {
  app.quit();
});

app.whenReady().then(() => {
  app.setName("Liang Desktop Pet");
  loadAppSettings();
  createPetWindow();
});

app.on("before-quit", () => {
  if (harnessTaskProcess && !harnessTaskProcess.killed) {
    harnessTaskProcess.kill("SIGTERM");
  }
  if (harnessWebProcess && !harnessWebProcess.killed) {
    harnessWebProcess.kill("SIGTERM");
  }
  stopSpeaking();
});

app.on("window-all-closed", () => {
  app.quit();
});
