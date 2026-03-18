---
name: creator-cli
description: 操作與自動化 Cocos Creator 編輯器的 creator-cli CLI Bridge 工具。涵蓋安裝、Bridge 啟動、所有子命令（ping、resolve-node、prefab.instantiate、scene.open、set-property、create-node 等）、埠號設定與連線排錯。當使用者詢問如何安裝 creator-cli、對 Cocos Creator 編輯器執行 CLI 指令、取得組件 uuid、自動化場景或 Prefab 編輯、將 prefab 複製進場景，或詢問 creator-cli 用法時使用。
---

# Creator CLI

**creator-cli** 是 Cocos Creator 擴充，透過 TCP 提供 **CLI–編輯器橋接（Bridge）**。在終端機（或腳本、CI）下指令，編輯器對當前場景 / Prefab 執行操作。

## 執行約定（請務必遵守）

- **一律使用全域指令 `creator-cli`** 執行子命令（例如 `creator-cli ping`、`creator-cli resolve-node Root/Canvas/Sprite`）。
- **勿使用** `node bin/creator-cli.js` 或 `npm run cli --`，除非使用者明確在擴充目錄內開發或尚未安裝全域 CLI。

## 快速認識

- Bridge 在**編輯器內**以擴充形式運行；CLI 是**終端機端**的客戶端。
- 通訊方式：`127.0.0.1:<port>`，換行分隔的 JSON。
- 預設埠：**6868**（亦可用 6870、6872）。
- 所有修改指令（set-property、create-node 等）成功後會**自動儲存**，不需另下 save。

## 何時讀哪個文件

| 需求 | 參考 |
|------|------|
| 第一次安裝 / 初始化 | [INSTALL.md](INSTALL.md) |
| 完整指令語法與參數 | [API-REFERENCE.md](API-REFERENCE.md) |
| 快速查指令 | 下方§指令速查 |
| 連線失敗排查 | 下方§連線排錯 |
| 自動化 / Agent 流程 | 下方§對 Agent 的補充、§自動化前檢查清單 |

---

## 指令速查

```bash
# 確認連線
creator-cli ping

# 設定預設埠號（寫入 ~/.creator-cli.json，之後不用再指定）
creator-cli init 6870

# 節點路徑 → uuid
creator-cli resolve-node Root/Canvas/Sprite

# 節點 + 組件類名 → 組件 uuid（供 remove-component / set-property 用）
creator-cli resolve-component <nodePath|nodeUuid> <component>
# 例：creator-cli resolve-component Root/Canvas/Sprite cc.Sprite
# 回傳 { "uuid": "<組件 uuid>" }。若出現 "Component not found on node"，先用 prefab.query-node 查該節點 __comps__ 的實際 type/cid/name 再傳入。

# 查詢節點樹（格式：tree | markdown | flat）
creator-cli prefab.query-node-tree markdown

# 取得目前編輯中場景/prefab 的根節點（供 create-node 父節點用）
creator-cli prefab.get-editing-root

# 查詢單一節點 dump
creator-cli prefab.query-node <uuid>

# 開啟場景或 Prefab
creator-cli scene.open db:assets/scenes/main

# 查詢當前場景狀態
creator-cli scene.query-current

# 設定屬性（支援型別 path，如 cc.Sprite.spriteFrame）
creator-cli set-property Root/Canvas/Sprite cc.Sprite.spriteFrame db:assets/textures/icon.png

# 重置屬性
creator-cli reset-property Root/Canvas/Sprite cc.Sprite.spriteFrame

# 建立 / 移除節點
creator-cli create-node Root/Canvas MyNewNode
creator-cli remove-node Root/Canvas/MyNewNode

# 新增 / 移除組件
creator-cli create-component Root/Canvas/Node cc.Sprite
creator-cli remove-component <componentUuid>

# 從節點建立 Prefab
creator-cli prefab.create Root/Canvas/MyNode db:assets/prefabs/MyPrefab

# 將現有 Prefab 複製進當前場景（可選父節點）
creator-cli prefab.instantiate db:assets/prefabs/Enemy
creator-cli prefab.instantiate db:assets/prefabs/Item Root/Canvas/Content

# 還原節點為 Prefab 狀態
creator-cli prefab.restore <uuid>

# 建立新場景資源
creator-cli scene.create db:assets/scenes/NewScene --open

# 觸發編輯器編譯並等待完成
creator-cli editor.refresh
```

### 單次覆蓋埠號
```bash
creator-cli ping --port 6870
# 或透過環境變數（Windows PowerShell）
$env:CREATOR_CLI_PORT = "6870"
```

---

## 連線排錯

1. `ECONNREFUSED` / 無回應 → Bridge 未啟動。編輯器：**Panel → creator-cli → Default Panel → 啟動 Bridge**。
2. 埠號不符 → Panel 埠號與 CLI 埠號需一致，執行 `creator-cli init <port>` 對齊。
3. `ASSET_NOT_FOUND` → 節點路徑或 uuid 有誤時先用 `resolve-node` 確認；若為「Component "xxx" not found on node」表示組件類名與編輯器 dump 內 type/cid/name 不符，可用 `prefab.query-node <節點uuid>` 看該節點 `__comps__` 的實際識別名再傳給 `resolve-component`。
4. Smoke 測試：在 `extensions/creator-cli/` 目錄執行 `node scripts/smoke-bridge.js`。

---

## 錯誤碼

| 錯誤碼 | 說明 |
|--------|------|
| `INVALID_PARAMS` | 參數缺失或格式錯誤 |
| `INVALID_METHOD` | 未知子命令 |
| `ASSET_NOT_FOUND` | 節點 / 資源路徑找不到 |
| `SCENE_ERROR` | 編輯器場景操作失敗 |
| `INTERNAL_ERROR` | Bridge 內部異常 |

Exit code **1** = 指令錯誤；**2** = 連線錯誤。

---

## 對 Agent 的補充（Agent 自動化須知）

- **nodePath 支援 `/`**：CLI 已支援 nodePath 含 `/`（如 `Root/Canvas/Sprite`），可直接用路徑操作節點。
- **Prefab 編輯時**：先以 **`prefab.get-editing-root`** 或 **`prefab.query-node-tree`** 取得目前編輯中的 prefab 根節點與節點樹，再進行後續操作。
- 以下為路徑與錯誤、檢查清單、組件引用綁定、prefab.create 劇本之精簡版說明。

---

## 常見路徑寫法與 ASSET_NOT_FOUND 時檢查

**常見路徑寫法**

- `scene.open` 可用：`db:assets/scenes/main`、`db:assets/prefabs/My.prefab`；副檔名依專案約定；若專案有約定也可用 `assets/` 開頭之專案相對路徑。

**ASSET_NOT_FOUND 時**

- (1) 節點路徑或 uuid 錯誤 → 先用 **`resolve-node`** 或 **`prefab.query-node-tree`** 確認。
- (2) 資源路徑錯誤或未開啟 → 檢查 **`scene.open`** 路徑格式與是否已開啟對應場景/prefab。

---

## 自動化前檢查清單

1. **`creator-cli ping`** 確認 Bridge 存活。
2. **`creator-cli scene.query-current`** 確認當前場景/prefab。
3. 若要操作的資產與當前不符，先 **`creator-cli scene.open <路徑>`**。
4. 再執行後續指令。

---

## 組件引用綁定劇本

綁定組件引用（如 `@property(sp.Skeleton)` 到子節點）：

1. **`resolve-node`** 取得子節點 uuid（或直接用 path）。
2. **`resolve-component`** 取得該節點上要設定的組件 uuid。
3. **`set-property`** 設定屬性，value 使用 **`{"__uuid__":"<目標節點或資源的 uuid>"}`**（可先 **`prefab.query-node`** 查子節點 uuid）。

範例：

```bash
creator-cli resolve-component Root/Canvas/Player MyScript
creator-cli set-property Root/Canvas/Player MyScript.skeleton '{"__uuid__":"<子節點 Skeleton 的 uuid>"}'
```

---

## prefab.create 副作用與 remove-node 建議

從「別人 prefab 內的暫時節點」建立新 prefab 時，**母 prefab 會被改髒**。建議：建立完成後對該暫時節點執行 **`remove-node`** 清理；或改為先複製到場景再對場景內節點執行 **prefab.create**。

---

## 延伸資源

- 完整安裝與初始化步驟 → [INSTALL.md](INSTALL.md)
- 所有子命令完整參數、路徑約定、TCP 協定 → [API-REFERENCE.md](API-REFERENCE.md)
