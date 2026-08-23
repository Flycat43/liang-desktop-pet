import smallLiangSkin from "../assets/level-0-xiaoliang.webp";
import cautiousLiangSkin from "../assets/level-1-laoliang.webp";
import cleverLiangSkin from "../assets/level-2-liangzi.webp";
import sageLiangSkin from "../assets/level-3-liangsheng.webp";
import sternLiangSkin from "../assets/level-4-liangshen.webp";
import ancestorLiangSkin from "../assets/level-5-liangzu.webp";

export const inject = ["sessions", "conversation"];

const ROOT_ID = "liang-harness-plugin-root";
const STORAGE_PREFIX = "liang-harness-plugin";

const profiles = [
  {
    name: "小梁",
    style: "怂怂试探",
    skin: smallLiangSkin,
    instruction: "语气胆小、试探、略显鬼祟和讨好，多用短句；先提醒风险，再给最稳妥的办法。",
    rate: 0.84,
    pitch: 0.86
  },
  {
    name: "牢梁",
    style: "谨慎低语",
    skin: cautiousLiangSkin,
    instruction: "语气谨慎、压低姿态，先观察边界再开口；重点说明风险、边界和退路。",
    rate: 0.87,
    pitch: 0.8
  },
  {
    name: "梁子",
    style: "油滑机灵",
    skin: cleverLiangSkin,
    instruction: "语气油滑、机灵、带一点得意的喜剧感；先抛一句俏皮话，再快速给出可执行方案。",
    rate: 0.96,
    pitch: 0.75
  },
  {
    name: "梁圣",
    style: "老练戏谑",
    skin: sageLiangSkin,
    instruction: "语气老练、沉着、略带戏谑，表达有条理，关键结论干脆，不堆砌口头禅。",
    rate: 0.91,
    pitch: 0.7
  },
  {
    name: "梁神",
    style: "阴沉强势",
    skin: sternLiangSkin,
    instruction: "语气低沉、冷峻、强势，句子更短；先下判断，再列步骤和验收标准。",
    rate: 0.86,
    pitch: 0.64
  },
  {
    name: "梁祖",
    style: "威严敕令",
    skin: ancestorLiangSkin,
    instruction: "语气威严、深沉，可少量使用古雅措辞；先给结论，再给不可含糊的执行次序。",
    rate: 0.8,
    pitch: 0.58
  }
];

const modes = {
  standard: {
    label: "标准",
    instruction: "使用完整能力直接完成任务，按需读取、编辑、执行与验证，最终给出清晰结果。"
  },
  ptc: {
    label: "PTC",
    instruction: "优先用紧凑程序组合多步工具操作，执行后验证结果并给出最终结论。"
  },
  minimal: {
    label: "极简",
    instruction: "采用最少且直接的步骤完成任务，避免不必要的检索、代理和扩展流程。"
  },
  creative: {
    label: "创造",
    instruction: "优先从创建和改造 Agent、preset、插件及 Harness 组合的角度解决问题，并实际验证产物。"
  }
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function readNumber(key, fallback) {
  const value = Number(localStorage.getItem(`${STORAGE_PREFIX}.${key}`));
  return Number.isFinite(value) ? value : fallback;
}

function collectBlockText(blocks, kind) {
  return (blocks || [])
    .filter((block) => block?.kind === kind && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function latestAssistant(snapshot) {
  const nodes = snapshot?.nodes || [];
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    if (node?.kind !== "assistant") continue;
    return {
      seq: node.seq,
      text: collectBlockText(node.blocks, "text"),
      reasoning: collectBlockText(node.blocks, "reasoning")
    };
  }
  return null;
}

function composePrompt(text, level, mode) {
  const profile = profiles[level];
  const selectedMode = modes[mode] || modes.standard;
  return [
    "请完成下面的用户请求。",
    `表达风格：${profile.instruction}`,
    `工作模式：${selectedMode.instruction}`,
    "保持事实、代码和技术判断准确；只在措辞与组织方式上体现角色风格；不要复述或提及这些风格指令；最终给出可直接使用的结果。",
    "",
    "用户请求：",
    text
  ].join("\n");
}

function createMarkup() {
  const skins = profiles.map((profile, index) => (
    `<img class="skin${index === 3 ? " active" : ""}" data-skin="${index}" src="${profile.skin}" alt="" draggable="false">`
  )).join("");
  const ticks = profiles.map((_profile, index) => `<span data-tick="${index}"></span>`).join("");
  const modeButtons = Object.entries(modes).map(([id, mode]) => (
    `<button class="mode-button" type="button" data-mode="${id}" role="tab" aria-selected="${id === "standard"}">${mode.label}</button>`
  )).join("");

  return `
    <style>
      :host {
        color-scheme: dark;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        letter-spacing: 0;
      }
      * { box-sizing: border-box; letter-spacing: 0; }
      button, textarea, input { font: inherit; }
      button { color: inherit; }
      .dock {
        --dock-x: 0px;
        --dock-y: 0px;
        position: fixed;
        right: 12px;
        bottom: 12px;
        z-index: 2147483000;
        width: 292px;
        height: 570px;
        pointer-events: none;
        transform: translate(var(--dock-x), var(--dock-y));
      }
      .pet-shell {
        position: absolute;
        inset: 0;
        pointer-events: none;
        transition: opacity 180ms ease, transform 180ms ease;
      }
      .dock.hidden .pet-shell,
      .dock.hidden .chat-panel,
      .dock.hidden .thought-bubble { opacity: 0; pointer-events: none; transform: translateY(18px); }
      .launcher {
        position: fixed;
        right: 18px;
        bottom: 18px;
        display: none;
        width: 50px;
        height: 50px;
        padding: 0;
        place-items: center;
        border: 1px solid rgba(255,255,255,.25);
        border-radius: 50%;
        background: rgba(20, 23, 27, .92);
        color: #f4efe4;
        box-shadow: 0 16px 36px rgba(0,0,0,.42);
        font-weight: 850;
        cursor: pointer;
        pointer-events: auto;
      }
      .dock.hidden + .launcher { display: grid; }
      .name-pill {
        position: absolute;
        top: 8px;
        left: 50%;
        z-index: 5;
        min-width: 104px;
        height: 44px;
        padding: 0 20px;
        border: 1px solid rgba(255,255,255,.22);
        border-radius: 22px;
        background: rgba(19, 22, 27, .92);
        color: #f8f5ed;
        box-shadow: 0 12px 28px rgba(0,0,0,.3);
        font-size: 23px;
        font-weight: 850;
        line-height: 42px;
        text-align: center;
        transform: translateX(-50%);
        pointer-events: auto;
        cursor: grab;
        user-select: none;
        touch-action: none;
      }
      .name-pill:active { cursor: grabbing; }
      .hide-button {
        position: absolute;
        top: 10px;
        right: 14px;
        z-index: 6;
        display: grid;
        width: 38px;
        height: 38px;
        padding: 0;
        place-items: center;
        border: 1px solid rgba(255,255,255,.2);
        border-radius: 50%;
        background: rgba(22, 26, 31, .88);
        color: #f8f5ed;
        font-size: 22px;
        font-weight: 700;
        cursor: pointer;
        pointer-events: auto;
      }
      .skin-stage {
        position: absolute;
        top: 42px;
        left: 0;
        width: 292px;
        height: 454px;
        border: 0;
        outline: 0;
        background: transparent;
        cursor: pointer;
        pointer-events: auto;
      }
      .skin-stage:focus-visible { outline: 3px solid rgba(96,165,250,.85); outline-offset: -8px; border-radius: 8px; }
      .skin {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        object-position: center bottom;
        opacity: 0;
        filter: drop-shadow(0 20px 22px rgba(0,0,0,.42));
        transform: translateY(8px) scale(.985);
        transition: opacity 2200ms ease, transform 2200ms ease, filter 240ms ease;
        user-select: none;
      }
      .skin.active { opacity: 1; transform: translateY(0) scale(1); }
      .skin-stage.speaking .skin.active { animation: speaking 520ms ease-in-out infinite alternate; }
      @keyframes speaking {
        from { transform: translateY(0) scale(1); filter: drop-shadow(0 20px 22px rgba(0,0,0,.42)); }
        to { transform: translateY(-3px) scale(1.006); filter: drop-shadow(0 22px 28px rgba(121,88,224,.4)); }
      }
      .status-chip {
        position: absolute;
        right: 34px;
        bottom: 72px;
        left: 34px;
        z-index: 5;
        min-height: 34px;
        padding: 7px 12px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,.2);
        border-radius: 17px;
        background: rgba(16, 19, 23, .88);
        color: rgba(255,255,255,.86);
        font-size: 13px;
        line-height: 18px;
        text-align: center;
        text-overflow: ellipsis;
        white-space: nowrap;
        backdrop-filter: blur(14px);
        pointer-events: none;
      }
      .level-control {
        position: absolute;
        right: 0;
        bottom: 8px;
        left: 0;
        z-index: 5;
        height: 58px;
        padding: 13px 18px 9px;
        border: 1px solid rgba(255,255,255,.2);
        border-radius: 8px;
        background: rgba(15, 18, 22, .92);
        box-shadow: 0 16px 34px rgba(0,0,0,.34);
        pointer-events: auto;
        backdrop-filter: blur(16px);
      }
      .level-slider {
        width: 100%;
        height: 18px;
        margin: 0;
        appearance: none;
        background: transparent;
        cursor: pointer;
      }
      .level-slider::-webkit-slider-runnable-track {
        height: 7px;
        border-radius: 4px;
        background: linear-gradient(90deg, #62a7ff 0%, #a58af8 42%, #efb5c1 68%, #f2a71c 100%);
      }
      .level-slider::-webkit-slider-thumb {
        width: 22px;
        height: 22px;
        margin-top: -7.5px;
        appearance: none;
        border: 4px solid #20242a;
        border-radius: 50%;
        background: #f7f2e7;
        box-shadow: 0 2px 8px rgba(0,0,0,.5);
      }
      .level-slider:focus-visible { outline: 2px solid #60a5fa; outline-offset: 4px; }
      .ticks { display: flex; justify-content: space-between; padding: 3px 5px 0; }
      .ticks span { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.34); }
      .ticks span.active { background: #f7f2e7; }
      .chat-panel {
        position: absolute;
        right: 310px;
        bottom: 8px;
        display: grid;
        grid-template-rows: auto auto minmax(120px, 1fr) auto auto;
        width: min(430px, calc(100vw - 350px));
        height: 500px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,.2);
        border-radius: 8px;
        background: rgba(17, 21, 26, .94);
        box-shadow: 0 24px 60px rgba(0,0,0,.46);
        opacity: 0;
        transform: translateX(18px);
        transition: opacity 180ms ease, transform 180ms ease;
        pointer-events: none;
        backdrop-filter: blur(20px);
      }
      .dock.open .chat-panel { opacity: 1; transform: translateX(0); pointer-events: auto; }
      .dock.left-side .chat-panel { right: auto; left: 310px; transform: translateX(-18px); }
      .dock.open.left-side .chat-panel { transform: translateX(0); }
      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 58px;
        padding: 10px 14px 8px;
        border-bottom: 1px solid rgba(255,255,255,.1);
      }
      .panel-title small { display: block; color: #9b8bf4; font-size: 11px; font-weight: 750; }
      .panel-title strong { display: block; margin-top: 2px; color: #f7f5ef; font-size: 16px; }
      .icon-actions { display: flex; gap: 7px; }
      .icon-button {
        display: grid;
        width: 34px;
        height: 34px;
        padding: 0;
        place-items: center;
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 6px;
        background: rgba(255,255,255,.06);
        color: rgba(255,255,255,.82);
        font-weight: 800;
        cursor: pointer;
      }
      .icon-button.active { border-color: #60a5fa; background: rgba(59,130,246,.18); color: #dbeafe; }
      .icon-button:focus-visible, .mode-button:focus-visible, .send-button:focus-visible, .hide-button:focus-visible, .launcher:focus-visible {
        outline: 2px solid #60a5fa;
        outline-offset: 2px;
      }
      .settings-popover {
        position: absolute;
        top: 54px;
        right: 12px;
        z-index: 8;
        display: grid;
        width: 210px;
        gap: 9px;
        padding: 12px;
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 7px;
        background: #171b21;
        box-shadow: 0 18px 38px rgba(0,0,0,.44);
      }
      .settings-popover[hidden] { display: none; }
      .settings-row {
        display: flex;
        min-height: 34px;
        align-items: center;
        justify-content: space-between;
        color: rgba(255,255,255,.82);
        font-size: 13px;
        font-weight: 680;
      }
      .settings-row input { width: 18px; height: 18px; accent-color: #6da8f7; }
      .settings-command {
        height: 34px;
        border: 1px solid rgba(255,255,255,.16);
        border-radius: 5px;
        background: rgba(255,255,255,.07);
        color: rgba(255,255,255,.86);
        cursor: pointer;
      }
      .mode-tabs {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 3px;
        margin: 10px 12px 7px;
        padding: 3px;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 6px;
        background: rgba(0,0,0,.2);
      }
      .mode-button {
        min-width: 0;
        height: 31px;
        padding: 0 7px;
        overflow: hidden;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: rgba(255,255,255,.58);
        font-size: 12px;
        font-weight: 720;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
      }
      .mode-button[aria-selected="true"] { background: #3f74c9; color: #fff; }
      .output {
        margin: 4px 12px 8px;
        padding: 14px;
        overflow: auto;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 6px;
        background: rgba(255,255,255,.045);
        color: rgba(255,255,255,.88);
        font-size: 14px;
        line-height: 1.65;
        white-space: pre-wrap;
        scrollbar-width: thin;
      }
      .output.empty { color: rgba(255,255,255,.46); }
      .prompt-form {
        display: grid;
        grid-template-columns: 1fr 42px;
        gap: 8px;
        margin: 0 12px;
        padding: 10px;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 8px;
        background: rgba(255,255,255,.055);
      }
      .prompt {
        width: 100%;
        min-height: 58px;
        max-height: 130px;
        resize: vertical;
        border: 0;
        outline: 0;
        background: transparent;
        color: #f7f5ef;
        line-height: 1.5;
      }
      .prompt::placeholder { color: rgba(255,255,255,.36); }
      .send-button {
        align-self: end;
        display: grid;
        width: 42px;
        height: 42px;
        padding: 0;
        place-items: center;
        border: 0;
        border-radius: 50%;
        background: #8f72ed;
        color: #16141d;
        font-size: 24px;
        font-weight: 800;
        cursor: pointer;
      }
      .send-button:disabled { opacity: .45; cursor: wait; }
      .panel-status {
        min-height: 28px;
        padding: 7px 14px 9px;
        overflow: hidden;
        color: rgba(255,255,255,.48);
        font-size: 11px;
        line-height: 1.2;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .thought-bubble {
        position: absolute;
        right: 310px;
        bottom: 518px;
        width: min(330px, calc(100vw - 350px));
        max-height: 170px;
        padding: 13px 15px;
        overflow: auto;
        border: 1px solid rgba(159,132,246,.38);
        border-radius: 8px;
        background: rgba(21, 26, 33, .94);
        color: rgba(255,255,255,.76);
        box-shadow: 0 18px 42px rgba(0,0,0,.35);
        font-size: 12px;
        line-height: 1.55;
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 180ms ease, transform 180ms ease;
        pointer-events: none;
        white-space: pre-wrap;
        backdrop-filter: blur(18px);
        appearance: none;
        text-align: left;
        cursor: pointer;
      }
      .thought-bubble.visible { opacity: 1; transform: translateY(0); pointer-events: auto; }
      .thought-bubble.expanded { max-height: 360px; }
      .dock.left-side .thought-bubble { right: auto; left: 310px; }
      .thought-label { display: block; margin-bottom: 5px; color: #aa95fb; font-size: 11px; font-weight: 800; }
      @media (max-width: 860px) {
        .dock {
          right: 8px;
          bottom: 8px;
          width: 220px;
          height: 450px;
          transform: none;
        }
        .skin-stage { width: 220px; height: 348px; }
        .level-control { right: 4px; left: 4px; }
        .status-chip { right: 22px; bottom: 72px; left: 22px; }
        .dock.open .pet-shell { opacity: 0; pointer-events: none; transform: translateY(12px); }
        .chat-panel,
        .dock.left-side .chat-panel {
          position: fixed;
          right: 12px;
          bottom: 12px;
          left: 12px;
          width: auto;
          height: min(600px, calc(100vh - 24px));
          transform: translateY(12px);
        }
        .dock.open .chat-panel,
        .dock.open.left-side .chat-panel { transform: translateY(0); }
        .thought-bubble,
        .dock.left-side .thought-bubble { display: none; }
      }
      @media (max-height: 700px) and (min-width: 861px) {
        .dock { height: 480px; }
        .skin-stage { height: 365px; }
        .chat-panel { height: 430px; }
        .thought-bubble { bottom: 448px; }
      }
    </style>
    <div class="dock" id="dock">
      <button class="thought-bubble" id="thoughtBubble" type="button" aria-live="polite" aria-expanded="false" title="展开或收起公开思考摘要">
        <span class="thought-label">公开思考摘要</span>
        <span id="thoughtText"></span>
      </button>
      <section class="chat-panel" id="chatPanel" aria-label="梁圣插件对话框" aria-hidden="true">
        <header class="panel-header">
          <div class="panel-title"><small>LIANG HARNESS</small><strong id="panelTitle">梁圣 · 老练戏谑</strong></div>
          <div class="icon-actions">
            <button class="icon-button" id="soundButton" type="button" aria-label="开启朗读" title="开启或关闭朗读">声</button>
            <button class="icon-button" id="clearButton" type="button" aria-label="清空插件输出" title="清空插件输出">⌫</button>
            <button class="icon-button" id="settingsButton" type="button" aria-label="打开设置" aria-expanded="false" title="设置">⚙</button>
            <button class="icon-button" id="panelCloseButton" type="button" aria-label="关闭对话框" title="关闭对话框">×</button>
          </div>
        </header>
        <div class="settings-popover" id="settingsPopover" hidden>
          <label class="settings-row" for="soundToggle"><span>自动朗读</span><input id="soundToggle" type="checkbox"></label>
          <button class="settings-command" id="resetPositionButton" type="button">重置人物位置</button>
        </div>
        <div class="mode-tabs" role="tablist" aria-label="处理模式">${modeButtons}</div>
        <div class="output empty" id="output" aria-live="polite">等待当前会话输出。</div>
        <form class="prompt-form" id="promptForm">
          <textarea class="prompt" id="prompt" rows="2" placeholder="输入任务" aria-label="输入任务"></textarea>
          <button class="send-button" id="sendButton" type="submit" aria-label="发送" title="发送">↑</button>
        </form>
        <div class="panel-status" id="panelStatus">未连接会话</div>
      </section>
      <section class="pet-shell" aria-label="梁圣人物插件">
        <div class="name-pill" id="dragHandle" title="拖动人物；双击复位">梁圣</div>
        <button class="hide-button" id="hideButton" type="button" aria-label="收起人物插件" title="收起">×</button>
        <button class="skin-stage" id="skinStage" type="button" aria-label="打开或关闭对话框">${skins}</button>
        <div class="status-chip" id="statusChip">梁圣已上线</div>
        <div class="level-control">
          <input class="level-slider" id="levelSlider" type="range" min="0" max="5" step="1" value="3" aria-label="人物档位" aria-valuetext="梁圣">
          <div class="ticks" aria-hidden="true">${ticks}</div>
        </div>
      </section>
    </div>
    <button class="launcher" id="launcher" type="button" aria-label="显示梁圣人物插件" title="显示人物插件">梁</button>
  `;
}

export function apply(ctx) {
  ctx.effect(() => {
    document.getElementById(ROOT_ID)?.remove();
    const host = document.createElement("div");
    host.id = ROOT_ID;
    host.style.cssText = "position:fixed;inset:0;z-index:2147483000;pointer-events:none;";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = createMarkup();
    (document.body || document.documentElement).appendChild(host);

    const byId = (id) => root.querySelector(`#${id}`);
    const elements = {
      dock: byId("dock"),
      launcher: byId("launcher"),
      hideButton: byId("hideButton"),
      dragHandle: byId("dragHandle"),
      skinStage: byId("skinStage"),
      levelSlider: byId("levelSlider"),
      panelTitle: byId("panelTitle"),
      statusChip: byId("statusChip"),
      chatPanel: byId("chatPanel"),
      output: byId("output"),
      thoughtBubble: byId("thoughtBubble"),
      thoughtText: byId("thoughtText"),
      promptForm: byId("promptForm"),
      prompt: byId("prompt"),
      sendButton: byId("sendButton"),
      panelStatus: byId("panelStatus"),
      soundButton: byId("soundButton"),
      clearButton: byId("clearButton"),
      settingsButton: byId("settingsButton"),
      panelCloseButton: byId("panelCloseButton"),
      settingsPopover: byId("settingsPopover"),
      soundToggle: byId("soundToggle"),
      resetPositionButton: byId("resetPositionButton")
    };

    let level = clamp(Math.round(readNumber("level", 3)), 0, 5);
    let mode = localStorage.getItem(`${STORAGE_PREFIX}.mode`) || "standard";
    if (!modes[mode]) mode = "standard";
    let soundEnabled = localStorage.getItem(`${STORAGE_PREFIX}.sound`) === "true";
    let dockX = readNumber("dockX", 0);
    let dockY = readNumber("dockY", 0);
    let sessionUnsubscribe = null;
    let boundSessionId = null;
    let initialSnapshot = true;
    let lastSpokenSeq = null;
    let clearedAssistantSeq = null;
    let disposed = false;

    function setPanelStatus(text) {
      elements.panelStatus.textContent = text;
    }

    function setOutput(text, empty = false) {
      elements.output.textContent = text;
      elements.output.classList.toggle("empty", empty);
      elements.output.scrollTop = elements.output.scrollHeight;
    }

    function setReasoning(text) {
      const summary = text.trim().slice(-1800);
      elements.thoughtText.textContent = summary;
      elements.thoughtBubble.classList.toggle("visible", Boolean(summary) && elements.dock.classList.contains("open"));
      if (!summary) {
        elements.thoughtBubble.classList.remove("expanded");
        elements.thoughtBubble.setAttribute("aria-expanded", "false");
      }
    }

    function applyDockPosition(persist = false) {
      const minX = Math.min(0, -(window.innerWidth - 310));
      const minY = Math.min(0, -(window.innerHeight - 230));
      dockX = clamp(dockX, minX, 0);
      dockY = clamp(dockY, minY, 0);
      elements.dock.style.setProperty("--dock-x", `${dockX}px`);
      elements.dock.style.setProperty("--dock-y", `${dockY}px`);
      elements.dock.classList.toggle("left-side", dockX < -(window.innerWidth * 0.52));
      if (persist) {
        localStorage.setItem(`${STORAGE_PREFIX}.dockX`, String(dockX));
        localStorage.setItem(`${STORAGE_PREFIX}.dockY`, String(dockY));
      }
    }

    function setOpen(open) {
      elements.dock.classList.toggle("open", open);
      elements.chatPanel.setAttribute("aria-hidden", String(!open));
      elements.thoughtBubble.classList.toggle("visible", open && Boolean(elements.thoughtText.textContent));
      if (!open) {
        elements.settingsPopover.hidden = true;
        elements.settingsButton.setAttribute("aria-expanded", "false");
      }
      localStorage.setItem(`${STORAGE_PREFIX}.open`, String(open));
      if (open) setTimeout(() => elements.prompt.focus(), 80);
    }

    function setHidden(hidden) {
      elements.dock.classList.toggle("hidden", hidden);
      localStorage.setItem(`${STORAGE_PREFIX}.hidden`, String(hidden));
      if (hidden && "speechSynthesis" in window) window.speechSynthesis.cancel();
    }

    function updateLevel(nextLevel, announce = true) {
      level = clamp(Math.round(nextLevel), 0, profiles.length - 1);
      const profile = profiles[level];
      elements.levelSlider.value = String(level);
      elements.levelSlider.setAttribute("aria-valuetext", profile.name);
      elements.dragHandle.textContent = profile.name;
      elements.panelTitle.textContent = `${profile.name} · ${profile.style}`;
      root.querySelectorAll("[data-skin]").forEach((skin) => skin.classList.toggle("active", Number(skin.dataset.skin) === level));
      root.querySelectorAll("[data-tick]").forEach((tick) => tick.classList.toggle("active", Number(tick.dataset.tick) === level));
      localStorage.setItem(`${STORAGE_PREFIX}.level`, String(level));
      if (announce) elements.statusChip.textContent = `${profile.name}档已就位`;
    }

    function updateMode(nextMode) {
      if (!modes[nextMode]) return;
      mode = nextMode;
      root.querySelectorAll("[data-mode]").forEach((button) => {
        button.setAttribute("aria-selected", String(button.dataset.mode === mode));
      });
      localStorage.setItem(`${STORAGE_PREFIX}.mode`, mode);
      setPanelStatus(`${modes[mode].label}模式 · ${profiles[level].name}`);
    }

    function selectVoice() {
      if (!("speechSynthesis" in window)) return null;
      const voices = window.speechSynthesis.getVoices();
      const chineseVoices = voices.filter((voice) => /^zh([-_]|$)/i.test(voice.lang));
      return chineseVoices.find((voice) => /yunxi|yunyang|yunjian|male|男/i.test(voice.name))
        || chineseVoices[0]
        || voices[0]
        || null;
    }

    function speak(text) {
      if (!soundEnabled || !("speechSynthesis" in window) || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 5000));
      const profile = profiles[level];
      utterance.lang = "zh-CN";
      utterance.rate = profile.rate;
      utterance.pitch = profile.pitch;
      utterance.volume = level < 2 ? 0.82 : 0.95;
      const voice = selectVoice();
      if (voice) utterance.voice = voice;
      utterance.onstart = () => elements.skinStage.classList.add("speaking");
      utterance.onend = () => elements.skinStage.classList.remove("speaking");
      utterance.onerror = () => elements.skinStage.classList.remove("speaking");
      window.speechSynthesis.speak(utterance);
    }

    function renderSession(snapshot) {
      if (!snapshot) return;
      const partialText = collectBlockText(snapshot.partial?.blocks, "text");
      const partialReasoning = collectBlockText(snapshot.partial?.blocks, "reasoning");
      const latest = latestAssistant(snapshot);

      if (snapshot.partial) {
        clearedAssistantSeq = null;
        if (partialText) setOutput(partialText);
        else if (snapshot.running) setOutput("正在调用 Harness 工具。", true);
        setReasoning(partialReasoning || latest?.reasoning || "");
        elements.statusChip.textContent = `${profiles[level].name}正在处理`;
        setPanelStatus(snapshot.runningCalls?.length ? `工具运行中 · ${snapshot.runningCalls.length} 项` : "正在生成");
      } else if (latest?.text) {
        if (latest.seq === clearedAssistantSeq) {
          setReasoning("");
          elements.statusChip.textContent = `${profiles[level].name}输出已清空`;
          setPanelStatus(`${modes[mode].label}模式 · 等待新回答`);
          initialSnapshot = false;
          return;
        }
        clearedAssistantSeq = null;
        setOutput(latest.text);
        setReasoning(latest.reasoning || "");
        elements.statusChip.textContent = snapshot.running ? `${profiles[level].name}正在处理` : `${profiles[level].name}已完成`;
        setPanelStatus(snapshot.running ? "正在处理后续步骤" : `${modes[mode].label}模式 · 已完成`);
        if (initialSnapshot) {
          lastSpokenSeq = latest.seq;
        } else if (!snapshot.running && latest.seq !== lastSpokenSeq) {
          lastSpokenSeq = latest.seq;
          speak(latest.text);
        }
      } else {
        setReasoning(partialReasoning || "");
        setPanelStatus(snapshot.openState === "open" ? `${modes[mode].label}模式 · 会话已连接` : "正在打开会话");
      }

      initialSnapshot = false;
    }

    function bindCurrentSession() {
      const currentId = ctx.sessions.list.getSnapshot().current;
      if (currentId === boundSessionId) return;
      sessionUnsubscribe?.();
      sessionUnsubscribe = null;
      boundSessionId = currentId || null;
      initialSnapshot = true;
      lastSpokenSeq = null;
      clearedAssistantSeq = null;

      if (!currentId) {
        setPanelStatus("请先创建或选择 Harness 会话");
        elements.statusChip.textContent = "等待会话";
        return;
      }

      const binding = ctx.sessions.binding(currentId);
      if (!binding) {
        setPanelStatus("会话尚未就绪");
        return;
      }

      const update = () => renderSession(binding.session.getSnapshot());
      update();
      sessionUnsubscribe = binding.session.subscribe(update);
      setPanelStatus(`${modes[mode].label}模式 · 会话已连接`);
    }

    async function sendPrompt(text) {
      const currentId = ctx.sessions.list.getSnapshot().current;
      const binding = currentId ? ctx.sessions.binding(currentId) : null;
      if (!binding) {
        setPanelStatus("请先创建或选择 Harness 会话");
        elements.statusChip.textContent = "等待会话";
        return false;
      }

      elements.sendButton.disabled = true;
      elements.statusChip.textContent = `${profiles[level].name}已接单`;
      setPanelStatus(`${modes[mode].label}模式 · 正在发送`);
      try {
        const prompt = composePrompt(text, level, mode);
        const scoped = ctx.sessions.scope(currentId) || binding.ctx;
        const conversation = scoped?.get?.("conversation");
        if (conversation?.send) {
          await conversation.send(prompt);
        } else {
          const result = await binding.session.prompt([{ type: "text", text: prompt }], "queue");
          if (result && result.ok === false) throw new Error(result.error?.message || "Harness 拒绝了请求");
        }
        return true;
      } catch (error) {
        setPanelStatus(error?.message || "发送失败");
        elements.statusChip.textContent = "发送失败";
        return false;
      } finally {
        elements.sendButton.disabled = false;
      }
    }

    updateLevel(level, false);
    updateMode(mode);
    applyDockPosition();
    setOpen(localStorage.getItem(`${STORAGE_PREFIX}.open`) === "true");
    setHidden(localStorage.getItem(`${STORAGE_PREFIX}.hidden`) === "true");
    elements.soundButton.classList.toggle("active", soundEnabled);
    elements.soundButton.setAttribute("aria-label", soundEnabled ? "关闭朗读" : "开启朗读");
    elements.soundToggle.checked = soundEnabled;

    elements.skinStage.addEventListener("click", () => setOpen(!elements.dock.classList.contains("open")));
    elements.panelCloseButton.addEventListener("click", () => setOpen(false));
    elements.hideButton.addEventListener("click", () => setHidden(true));
    elements.launcher.addEventListener("click", () => setHidden(false));
    elements.levelSlider.addEventListener("input", (event) => updateLevel(Number(event.currentTarget.value)));
    root.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => updateMode(button.dataset.mode)));
    elements.soundButton.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      localStorage.setItem(`${STORAGE_PREFIX}.sound`, String(soundEnabled));
      elements.soundButton.classList.toggle("active", soundEnabled);
      elements.soundButton.setAttribute("aria-label", soundEnabled ? "关闭朗读" : "开启朗读");
      elements.soundToggle.checked = soundEnabled;
      if (!soundEnabled && "speechSynthesis" in window) window.speechSynthesis.cancel();
      elements.statusChip.textContent = soundEnabled ? "朗读已开启" : "朗读已关闭";
    });
    elements.clearButton.addEventListener("click", () => {
      const currentId = ctx.sessions.list.getSnapshot().current;
      const snapshot = currentId ? ctx.sessions.binding(currentId)?.session.getSnapshot() : null;
      clearedAssistantSeq = latestAssistant(snapshot)?.seq ?? null;
      setOutput("等待当前会话输出。", true);
      setReasoning("");
      setPanelStatus(`${modes[mode].label}模式 · 插件输出已清空`);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    });
    elements.settingsButton.addEventListener("click", () => {
      elements.settingsPopover.hidden = !elements.settingsPopover.hidden;
      elements.settingsButton.setAttribute("aria-expanded", String(!elements.settingsPopover.hidden));
    });
    elements.soundToggle.addEventListener("change", () => {
      soundEnabled = elements.soundToggle.checked;
      localStorage.setItem(`${STORAGE_PREFIX}.sound`, String(soundEnabled));
      elements.soundButton.classList.toggle("active", soundEnabled);
      elements.soundButton.setAttribute("aria-label", soundEnabled ? "关闭朗读" : "开启朗读");
      if (!soundEnabled && "speechSynthesis" in window) window.speechSynthesis.cancel();
      elements.statusChip.textContent = soundEnabled ? "朗读已开启" : "朗读已关闭";
    });
    elements.resetPositionButton.addEventListener("click", () => {
      dockX = 0;
      dockY = 0;
      applyDockPosition(true);
      elements.settingsPopover.hidden = true;
      elements.settingsButton.setAttribute("aria-expanded", "false");
      elements.statusChip.textContent = "人物位置已复位";
    });
    elements.thoughtBubble.addEventListener("click", () => {
      const expanded = !elements.thoughtBubble.classList.contains("expanded");
      elements.thoughtBubble.classList.toggle("expanded", expanded);
      elements.thoughtBubble.setAttribute("aria-expanded", String(expanded));
    });
    elements.promptForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = elements.prompt.value.trim();
      if (!text) return;
      const accepted = await sendPrompt(text);
      if (accepted) elements.prompt.value = "";
    });
    elements.prompt.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        elements.promptForm.requestSubmit();
      }
    });

    let drag = null;
    elements.dragHandle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, dockX, dockY };
      try { elements.dragHandle.setPointerCapture(event.pointerId); } catch {}
      event.preventDefault();
    });
    elements.dragHandle.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      dockX = drag.dockX + event.clientX - drag.x;
      dockY = drag.dockY + event.clientY - drag.y;
      applyDockPosition();
    });
    const finishDrag = (event) => {
      if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
      drag = null;
      applyDockPosition(true);
    };
    elements.dragHandle.addEventListener("pointerup", finishDrag);
    elements.dragHandle.addEventListener("pointercancel", finishDrag);
    elements.dragHandle.addEventListener("lostpointercapture", finishDrag);
    elements.dragHandle.addEventListener("dblclick", () => {
      dockX = 0;
      dockY = 0;
      applyDockPosition(true);
    });

    const listUnsubscribe = ctx.sessions.list.subscribe(bindCurrentSession);
    bindCurrentSession();
    const handleResize = () => applyDockPosition(true);
    window.addEventListener("resize", handleResize);

    return () => {
      if (disposed) return;
      disposed = true;
      listUnsubscribe();
      sessionUnsubscribe?.();
      window.removeEventListener("resize", handleResize);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      host.remove();
    };
  }, "liang-harness-plugin: mount companion UI");
}
