# 《逻辑哲学论》地铁图（中文版）

这是爱荷华大学图书馆 [Tractatus Map](https://tractatus.lib.uiowa.edu/map/) 的中文本地化版本。项目保留原站的地图结构和全部交互，包括段落/线路打开、面板折叠与排序、版本切换、缩放平移、URL 深链，以及《原型逻辑哲学论》的页码筛选和差异显示。

本仓库基于 Matthew Butler 的 MIT 许可项目 [`aqhali/TLP`](https://github.com/aqhali/TLP)。原项目代码许可见 `LICENSE`。

## 韩林合译文

韩林合译文受其权利人的许可约束，因此仓库只提供数据接口，不附带未经授权复制的全文。获得合法文本后，将 525 个有正文的命题整理成以下任一 JSON 格式：

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

导入成功后，译文写入 `src/data/hanLinhe.json`，并自动成为《逻辑哲学论》模式的默认版本。《原型逻辑哲学论》仍保留原站提供的德文与皮尔斯/麦吉尼斯版本。

## 开发

```powershell
npm ci
npm test
npm run build
npm start
```

构建结果位于 `dist/`。段落深链格式与原站一致，例如 `?tlp=4.23` 或 `?pt=3.201`。
