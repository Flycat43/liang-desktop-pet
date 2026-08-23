# 梁圣 Harness 插件中文说明书

## 1. 插件是什么

`liang-harness-plugin` 是 DeepSeek Harness Web profile 的 Cordis 插件。安装后，人物会直接出现在 Harness 页面中，并连接当前选中的 Harness 会话。

它与仓库中的 Electron 桌面版是两种独立用法：

- **插件版**：在 Harness 页面内运行，安装包小，跟随当前会话。
- **桌面版**：独立原生窗口，可做透明桌宠并切换完整 Harness 界面。

插件版不会在其他应用上方创建悬浮窗口。

## 2. 兼容环境

- Node.js 22.12 或更高版本
- DeepSeek Harness `0.1.1-rc.2`
- macOS、Windows 或 Linux
- 已在 Harness 中配置可用模型和 API Key

## 3. 安装插件

### 3.1 下载

从项目的 [GitHub Releases](https://github.com/Flycat43/liang-desktop-pet/releases) 下载：

```text
liang-harness-plugin-0.1.0.tgz
```

不要解压 `.tgz`。

### 3.2 安装到 Web profile

打开终端，把下面路径替换成文件的实际绝对路径：

```bash
npx @deepseek-ai/dsh plugin --profile web add /绝对路径/liang-harness-plugin-0.1.0.tgz
```

插件包声明了 `dsh.bundle.patch`。安装成功后，Harness 会自动把它加入 web profile 的 bundle 列表，无需手改配置文件。

### 3.3 启动

```bash
npx @deepseek-ai/dsh web
```

浏览器打开 Harness 后，右下角会显示人物。如果此前已有 Harness 进程，请先停止旧进程再重启。

## 4. 使用方法

- **打开或关闭对话框**：单击人物。
- **移动人物**：拖动人物头顶的名字标签。
- **恢复默认位置**：双击名字标签。
- **切换人物**：拖动底部六档滑杆；人物会用 2.2 秒渐变切换。
- **选择任务模式**：在对话框顶部选择“标准、PTC、极简、创造”。
- **发送任务**：输入内容后按 `Enter` 或单击发送按钮；`Shift + Enter` 换行。
- **开启朗读**：单击“声”按钮。使用系统浏览器提供的中文语音，实际音色因操作系统而异。
- **清空插件显示**：单击清空图标。小窗会保持为空，直到当前会话出现新的助手回答；Harness 会话记录不会被删除。
- **打开设置**：单击齿轮按钮，可切换自动朗读或重置人物位置。
- **展开思考摘要**：单击公开思考泡，在紧凑和展开高度之间切换。
- **关闭对话框**：单击对话框右上角关闭按钮；窄屏下关闭后会重新显示人物。
- **收起人物**：单击人物右上角关闭按钮；再单击页面右下角的“梁”按钮恢复。

## 5. 六档人物风格

| 档位 | 名称 | 输出风格 |
| --- | --- | --- |
| 1 | 小梁 | 胆小试探，先提醒风险，再给稳妥办法 |
| 2 | 牢梁 | 谨慎低语，强调边界、风险和退路 |
| 3 | 梁子 | 油滑机灵，先抛一句俏皮话，再给方案 |
| 4 | 梁圣 | 老练沉着，略带戏谑，条理清楚 |
| 5 | 梁神 | 低沉强势，先判断，再列步骤和验收标准 |
| 6 | 梁祖 | 威严深沉，结论明确，执行次序严格 |

人物档位会改变随任务发送的表达风格指令，但不会要求模型牺牲事实、代码或技术判断的准确性。

## 6. 四种任务模式

| 模式 | 行为 |
| --- | --- |
| 标准 | 按需读取、编辑、执行和验证，完整完成任务 |
| PTC | 优先用紧凑程序组合多步工具操作，并验证结果 |
| 极简 | 使用最少且直接的步骤，避免不必要的扩展流程 |
| 创造 | 优先从 Agent、preset、插件及 Harness 组合角度解决问题 |

插件会把当前人物风格和模式说明作为可见文本的一部分发送到会话。它不会暗中修改系统提示词。

## 7. 输出与思考摘要

插件订阅当前 Harness 会话：

- 对话框显示正在生成的文本和最终回答。
- 思考泡只显示 Harness 对外提供的公开 reasoning 摘要。
- 工具运行时显示工具数量和状态。

插件不会尝试提取或展示模型不可见的隐藏思维链。

## 8. 从源码安装

在仓库根目录执行：

```bash
cd plugins/liang-harness-plugin
npm ci --legacy-peer-deps
npm run build
npx @deepseek-ai/dsh plugin --profile web add .
npx @deepseek-ai/dsh web
```

修改源码后再次运行 `npm run build`，然后重启 Harness。

## 9. 更新插件

下载新版 `.tgz` 后执行：

```bash
npx @deepseek-ai/dsh plugin --profile web add /绝对路径/新版插件.tgz
```

完成后重启 Harness。

## 10. 卸载

```bash
npx @deepseek-ai/dsh plugin --profile web remove liang-harness-plugin
```

重启 Harness 后插件消失。插件保存在浏览器 `localStorage` 中的位置、档位和模式偏好可能继续存在，但不会运行。

## 11. 常见问题

### 安装后没有人物

1. 关闭仍在运行的旧 Harness 进程。
2. 再次运行 `npx @deepseek-ai/dsh web`。
3. 确认终端没有插件加载错误。
4. 执行 `npx @deepseek-ai/dsh plugin --profile web why liang-harness-plugin` 检查安装状态。

### 输入后提示“请先创建或选择 Harness 会话”

先在 Harness 左侧创建新会话，或选择已有会话。插件始终跟随 Harness 当前会话。

### 没有声音

确认已单击“声”按钮，并检查系统输出设备、浏览器站点静音和中文语音是否可用。插件使用浏览器 `speechSynthesis`，不同系统提供的声音不同。

### 人物跑到屏幕外

双击名字标签恢复默认位置。窗口尺寸改变时插件也会自动把人物限制在可见区域。

### 清空会删除会话吗

不会。它只清空插件小窗并屏蔽当前最新回答，直到新回答出现。需要删除历史记录时，请使用 Harness 自带的会话管理功能。

## 12. 隐私、安全与授权

- 插件不新增远程服务；任务与输出仍通过你配置的 Harness 模型提供方处理。
- 人物图片压缩后直接内嵌在插件 bundle 中，不从临时目录或第三方图片站加载。
- Harness 可能执行命令并修改工作区，请使用有版本控制的目录并检查授权范围。
- 源代码使用 MIT License；人物图像和人物相关权利不包含在 MIT 授权中，详见 `ASSETS_LICENSE.md`。
