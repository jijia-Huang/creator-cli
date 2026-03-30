---
name: creator-cli
description: 操作與自動化 Cocos Creator 編輯器的 creator-cli CLI Bridge 工具。涵蓋安裝、Bridge 啟動、所有子命令（ping、resolve-node、prefab.instantiate、scene.open、set-property、create-node 等）、埠號設定與連線排錯。當使用者詢問如何安裝 creator-cli、對 Cocos Creator 編輯器執行 CLI 指令、取得組件 uuid、自動化場景或 Prefab 編輯、將 prefab 複製進場景，或詢問 creator-cli 用法時使用。
---

# Creator CLI（精簡版）

**creator-cli** 是 Cocos Creator 擴充，提供 **CLI ⇄ Editor Bridge**。常規用法一律以 **nodePath / assetPath** 操作；只有在對接舊流程時才需要 uuid。

## 必要規則（請務必遵守）

- **一律用全域指令 `creator-cli`**（例如 `creator-cli ping`）。除非你正在開發擴充本身，否則不要用 `node bin/creator-cli.js`。
- **嚴禁直接修改** `.prefab` / `.scene` 等資源檔；所有改動必須透過 creator-cli 讓 Editor 正確序列化與儲存。
- **nodePath 優先**：大多數指令直接吃 `Root/Canvas/Sprite`，不需要先 `resolve-node`。
- **節點引用屬性用 `@node:`**：例如 `@node:Root/Canvas/Player/Spine`。

## Quickstart

```bash
# 1) 連線測試
creator-cli ping

# 2) 開啟場景 / Prefab（assetPath）
creator-cli scene.open db:assets/scenes/main

# 3) 看節點結構（人類可讀）
creator-cli prefab.query-node-tree markdown

# 4) 用 nodePath 改屬性
creator-cli set-property Root/Canvas/Sprite cc.Sprite.spriteFrame db:assets/textures/icon.png

# 5) 組件引用綁定：@node:<nodePath>
creator-cli set-property Root/Canvas/Player MyScript.skeleton @node:Root/Canvas/Player/Spine
```

## 常用工作流程

### 查結構 → 找節點 → 修改

```bash
creator-cli prefab.query-node-tree markdown
creator-cli node.find --name Btn
creator-cli set-property Root/Canvas/BtnStart name "BtnStart"
```

### Prefab：取得 editing root → 建節點 / 加組件

```bash
creator-cli prefab.get-editing-root
creator-cli create-node Root/Canvas UIPanel
creator-cli create-component Root/Canvas/UIPanel cc.UITransform
creator-cli create-component Root/Canvas/UIPanel cc.Sprite
creator-cli remove-component Root/Canvas/UIPanel cc.Sprite
```

### Prefab：還原節點（nodePath）

```bash
creator-cli prefab.restore Root/Canvas/MyPrefabNode
```

### 把 Prefab 拖進場景（instantiate）

```bash
creator-cli prefab.instantiate db:assets/prefabs/Enemy
creator-cli prefab.instantiate db:assets/prefabs/Item Root/Canvas/Content
```

## 需要 UUID？（少用）

需要 node / component uuid、UUID fallback、`resolve-node` / `resolve-component`、以及舊版 `remove-component <componentUuid>` 的用法，請看 [API-REFERENCE.md](API-REFERENCE.md)。

## 簡要排錯（連線 / 路徑）

- `ECONNREFUSED`：Bridge 未啟動（Editor：Panel → creator-cli → Default Panel → 啟動 Bridge）。
- 埠號不符：用 `creator-cli init <port>` 對齊（預設 6868；也常用 6870/6872）。
- `ASSET_NOT_FOUND`：先用 `prefab.query-node-tree` / `node.find` 確認 nodePath；資源則檢查 `scene.open` 的 `db:` 路徑。

## 延伸資源

- 安裝 / 初始化 → [INSTALL.md](INSTALL.md)
- 完整指令參考（含 UUID fallback）→ [API-REFERENCE.md](API-REFERENCE.md)
