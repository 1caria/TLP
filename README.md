# 《逻辑哲学论》地图

这是爱荷华大学图书馆 [Tractatus Map](https://tractatus.lib.uiowa.edu/map/) 的中文本地化版本。地图用地铁线路展示《逻辑哲学论》的命题结构，同时保留原站全部交互：打开命题或线路、折叠和排序面板、切换译本、缩放和平移地图、使用 URL 深链接，以及筛选《原型逻辑哲学论》的页码并查看文本差异。

本仓库基于 Matthew Butler 的 MIT 许可项目 [`aqhali/TLP`](https://github.com/aqhali/TLP)。原项目代码许可见 `LICENSE`。

## 在线访问

启用 GitHub Pages 后，本项目会通过 GitHub Actions 自动发布到：

<https://1caria.github.io/TLP/>

每次向 `master` 分支推送代码时，GitHub Actions 都会重新构建 `dist/` 并发布网站。

首次启用需要在 GitHub 仓库的 `Settings → Pages` 中将 `Build and deployment` 的来源设为 `GitHub Actions`。启用后，可以在 `Actions` 页面重新运行最近一次“部署 GitHub Pages”任务。

## 本地运行

```powershell
npm ci
npm test
npm run build
npm start
```

开发服务器启动后，按终端输出的地址打开页面。也可以只发布构建目录：

```powershell
npm run build
python -m http.server 8000 --directory dist
```

然后访问 <http://127.0.0.1:8000/>。建议通过 HTTP 服务打开，不要直接双击 `dist/index.html`，因为页面还需要加载版本选择器等相对路径资源。

## 中文译文

仓库中的 `src/data/hanLinhe.json` 和 `src/data/heShaojia.json` 分别是韩林合、贺绍甲译本的 525 条有正文命题。数据由项目目录中的 PDF/EPUB 源文件生成；源文件受版权约束，不纳入 Git。重新生成译文数据：

```powershell
node scripts/generate-translations.js
```

生成器会按 `src/data/sections.json` 的有效命题编号校验完整性，并保留 `6.021` 这类原站无德文正文的空节点。

中文公式使用可选择的 HTML 文字、上下标、CSS 上划线及表格排版。第 6.1203 条的逻辑图由文字节点与 CSS 连线组成；公式和逻辑图不使用图片、SVG 或 Canvas。原译本的几何插图继续保留。

选中文字后使用 `Ctrl+C` 复制。完整公式的纯文本复制结果为 `$LaTeX$`，保留上划线和上下标；富文本复制附带公式排版。逻辑图的纯文本复制包含变量、真值与连线关系。拖动命题框需从编号标题栏开始，正文可以选择文字。

公式转写与校订依据见 [公式校订记录](docs/text-formula-corrections.md) 和 [逻辑图来源记录](docs/logical-diagram-sources.md)。运行 `npm run translation:audit` 会逐条检查两译本的中文汉字顺序、中文段落边界、公式复制结构和媒体引用，生成 [逐条自动审计报告](docs/translation-audit.md)。自动检查的范围和限制在报告中列明，不能替代逐句人工审读。

独立来源核对范围见 [公式来源复核](docs/formula-source-review.md)。如需重跑浏览器复制检查，执行 `node scripts/check-formula-copy.js`，在项目根目录启动 HTTP 服务后打开 `/tmp/formula-copy-check.html`；该临时页检查完整和局部选区的纯文本及富文本，不修改系统剪贴板，也不发布到网站。

如需从其他合法文本导入韩林合译文，可使用导入器。输入文件应整理成以下任一 JSON 格式：

```json
{
    "source": "授权文本来源说明",
    "sections": {
        "1": "对应译文",
        "1.1": "对应译文"
    }
}
```

或：

```json
{
    "source": "授权文本来源说明",
    "sections": [
        { "label": "1", "text": "对应译文" },
        { "label": "1.1", "text": "对应译文" }
    ]
}
```

导入器会拒绝缺失、空白、重复或未知编号，避免把不完整数据标成“韩林合译本”。

```powershell
npm run translation:check -- D:\资料\han-linhe.json
npm run translation:import -- D:\资料\han-linhe.json
```

导入成功后，译文写入 `src/data/hanLinhe.json`。韩林合译本是《逻辑哲学论》模式的默认版本；贺绍甲译本可在版本选择器中切换。《原型逻辑哲学论》仍保留原站提供的德文与皮尔斯/麦吉尼斯版本。

构建结果位于 `dist/`。段落深链格式与原站一致，例如 `?tlp=4.23` 或 `?pt=3.201`。
