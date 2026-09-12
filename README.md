# 《逻辑哲学论》地铁图

这是爱荷华大学图书馆 [Tractatus Map](https://tractatus.lib.uiowa.edu/map/) 的中文本地化版本。地图用地铁线路展示《逻辑哲学论》的命题结构，同时保留原站全部交互：打开命题或线路、折叠和排序面板、切换译本、缩放和平移地图、使用 URL 深链接，以及筛选《原型逻辑哲学论》的页码并查看文本差异。

本仓库基于 Matthew Butler 的 MIT 许可项目 [`aqhali/TLP`](https://github.com/aqhali/TLP)。原项目代码许可见 `LICENSE`。

## 在线访问

本项目通过 GitHub Pages 自动发布：

<https://1caria.github.io/TLP/>

每次向 `master` 或 `feat/chinese-localization` 分支推送代码时，GitHub Actions 都会重新构建 `dist/` 并发布网站。

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
