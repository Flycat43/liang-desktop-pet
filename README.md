# Liang Desktop Pet

一个非官方的 DeepSeek Harness 桌面交互外壳。人物可拖动，点击后打开对话框，并支持会话管理、四种 Harness 模式、六档人物语气、思考摘要和在线神经语音。

![应用截图](docs/screenshot.png)

> [!IMPORTANT]
> 本项目不是 DeepSeek 官方产品，也不代表图中人物本人。代码与人物素材采用不同授权，公开再分发前请阅读 [ASSETS_LICENSE.md](ASSETS_LICENSE.md)。

## 下载

前往 [GitHub Releases](https://github.com/Flycat43/liang-desktop-pet/releases) 下载对应系统的安装包。首次打开未签名版本时，系统可能提示来源未知。

## 功能

- 透明无边框桌面窗口，不强制置顶
- 左下角按钮可在人物桌宠与 Harness 完整界面之间双向切换
- Harness 完整界面支持顶部拖动及关闭、最小化、放大或还原
- 点击人物开关对话框，拖动人物移动窗口
- 多会话创建、切换、删除和清空
- 标准、PTC、极简、创造四种处理模式
- 小梁至梁祖六档人物、措辞和男声音色
- 可展开的公开思考摘要
- 自动朗读、上下文开关和上下文条数设置
- 在设置中选择 Harness 工作区

## 环境

- Node.js 22.12 或更高版本
- 可用的 DeepSeek API Key
- macOS、Windows 或 Linux

项目依赖中已包含 DeepSeek Harness。首次使用前，建议先在终端运行一次官方配置界面：

```bash
npx @deepseek-ai/dsh web
```

在 Harness 中完成模型与 API Key 配置后关闭网页，再启动桌面应用。不要把 API Key 写进源码或提交到 GitHub。

## 本地运行

```bash
git clone https://github.com/Flycat43/liang-desktop-pet.git
cd liang-desktop-pet
npm ci
npm start
```

打开人物对话框，进入“设置”，选择允许 Harness 读取和修改的工作目录。

## 打包

```bash
# macOS: DMG + ZIP
npm run dist:mac

# Windows: NSIS 安装器 + 便携版 EXE
npm run dist:win

# Linux: AppImage
npm run dist:linux
```

产物位于 `dist/`。建议在对应操作系统上构建对应安装包。

## 自动发布

仓库包含 GitHub Actions。推送版本标签后会在三个系统上构建，并把安装包上传到 GitHub Releases：

```bash
git tag v0.1.4
git push origin v0.1.4
```

默认构建未配置商业代码签名。macOS Gatekeeper 和 Windows SmartScreen 可能提示来源未知；正式分发时应配置 Apple Developer ID、公证和 Windows 代码签名证书。

## 安全与隐私

- Harness 可以执行命令并修改所选工作区。请优先使用有 Git 版本控制的目录。
- 对话最终文本在开启朗读时会发送至在线 Microsoft Edge Read Aloud 服务生成语音。
- 会话记录保存在 Electron 本地存储中，不会提交到仓库。

## 授权

源代码使用 [MIT License](LICENSE)。人物 PNG 不属于 MIT 授权，详见 [ASSETS_LICENSE.md](ASSETS_LICENSE.md)。第三方依赖见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
