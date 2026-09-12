# 《逻辑哲学论》地铁图（中文版）

这是爱荷华大学图书馆 [Tractatus Map](https://tractatus.lib.uiowa.edu/map/) 的中文本地化版本。项目保留原站的地图结构和全部交互，包括段落/线路打开、面板折叠与排序、版本切换、缩放平移、URL 深链，以及《原型逻辑哲学论》的页码筛选和差异显示。

本仓库基于 Matthew Butler 的 MIT 许可项目 [`aqhali/TLP`](https://github.com/aqhali/TLP)。原项目代码许可见 `LICENSE`。

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

## 开发

```powershell
npm ci
npm test
npm run build
npm start
```

构建结果位于 `dist/`。段落深链格式与原站一致，例如 `?tlp=4.23` 或 `?pt=3.201`。
