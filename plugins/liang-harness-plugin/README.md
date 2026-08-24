# Liang Harness Plugin

一个面向 DeepSeek Harness Web profile 的非官方人物交互插件。它直接使用 Harness 的 Cordis 客户端服务，不读取或改写页面 DOM。

## 功能

- 在 Harness 内显示可拖动的透明人物
- 点击人物打开或关闭独立输入框
- 直接向当前 Harness 会话发送任务
- 同步当前会话的最终输出、运行状态和公开思考摘要
- 小梁、牢梁、梁子、梁圣、梁神、梁祖六档人物与表达风格
- 标准、PTC、极简、创造四种任务模式
- 浏览器系统语音朗读
- 六档人物间 2.2 秒渐变切换

## 安装

完整步骤见 [中文说明书](MANUAL.zh-CN.md)。下载 Release 中的 `liang-harness-plugin-*.tgz` 后执行：

```bash
npx @deepseek-ai/dsh plugin --profile web add /绝对路径/liang-harness-plugin-0.1.0.tgz
npx @deepseek-ai/dsh web
```

市场收录信息、权限边界和可重复验证步骤见 [Marketplace and review notes](MARKETPLACE.md)。

## 开发

```bash
npm ci --legacy-peer-deps
npm test
npm pack --dry-run
```

`npm test` 会重新构建客户端并校验 manifest、Cordis patch、导出文件和六张人物素材；`npm pack` 会在打包前再次构建 `lib/client.js`。

## 边界

插件运行在 Harness 页面内，不创建原生透明桌面窗口。需要独立桌宠窗口时，请使用仓库根目录的 Electron 桌面版。

代码使用 MIT License。人物素材不属于 MIT 授权，详见 [ASSETS_LICENSE.md](ASSETS_LICENSE.md)。
