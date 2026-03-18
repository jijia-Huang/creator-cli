# Creator CLI — API 完整參考

## 執行方式

**建議優先使用全域指令**（任意目錄可用）：

```bash
creator-cli <subcommand> [args...]
```

若未安裝全域 CLI，可在擴充目錄內使用：

```bash
node bin/creator-cli.js <subcommand> [args...]
npm run cli -- <subcommand> [args...]
```

---

## 路徑約定

### 節點尋址（nodePath | uuid）

- **nodePath**：場景階層路徑，如 `Root/Canvas/Sprite`（不加 `db:`）。
- **uuid**：32 位 hex 或 Editor base64 id。
- 支援 nodePath 的指令：第一個「節點」參數二選一。

### 資源路徑（db:）

以 `db:` / `db://` 開頭，或專案相對路徑（`assets/...`）→ 解析為 uuid。
用於：`scene.open`、`prefab.create`、`scene.create` 的 assetPath，以及 `set-property` 的 value（貼圖、Prefab 引用）。

### 組件屬性 path（型別 path）

`cc.Sprite.spriteFrame` → Bridge 自動解析為 `__comps__.N.spriteFrame`。
也可直接寫：`__comps__.0.spriteFrame`、`name`。

### 自動儲存

所有修改指令（set-property、reset-property、create-node、remove-node、create-component、remove-component、prefab.restore、prefab.create、prefab.instantiate、scene.create）成功後 Bridge **自動儲存**，無需額外指令。

---

## 子命令完整參考

### init
```bash
creator-cli init <port>
```
- port：`6868` | `6870` | `6872`
- 寫入 `~/.creator-cli.json`，之後預設使用此埠。

---

### ping
```bash
creator-cli ping
```
- 無參數。Bridge 存活回傳 `{ "pong": true }`。

---

### resolve-node
```bash
creator-cli resolve-node <path>
creator-cli resolve-node --parent <parentPath> --name <name>
```
- **path**：節點路徑，如 `Root/Canvas/Sprite`。
- 回傳 `{ "uuid": "...", "path": "..." }`。

---

### resolve-component
```bash
creator-cli resolve-component <nodeUuid|nodePath> <component>
```
- 第一參數：節點 **uuid** 或 **nodePath**（如 `Root/Canvas/Sprite`）。
- **component**：組件類名，如 `cc.Sprite`、`PlayerController`（腳本 ccclass 名稱）。比對的是節點 dump 內 `__comps__` 的 type / cid / name，須與編輯器序列化結果一致。
- 回傳 `{ "uuid": "<組件 uuid>" }`。用於 **remove-component** 或需組件 uuid 的腳本／set-property。

**若回傳 `ASSET_NOT_FOUND: Component "xxx" not found on node`**：表示該節點上沒有匹配的組件識別名。可先用 `resolve-node` 取節點 uuid，再 `prefab.query-node <uuid>` 看該節點的 `__comps__` 陣列，依其中 `value.type`、`cid` 或 `value.name` 傳入正確的 component 字串。

範例：解析組件 uuid 後移除該組件（Bash 類環境）：
```bash
COMP_UUID=$(creator-cli resolve-component Root/Canvas/Sprite cc.Sprite | node -e "const d=require('fs').readFileSync(0,'utf8'); console.log(JSON.parse(d).result.uuid)")
creator-cli remove-component "$COMP_UUID"
```

---

### prefab.query-node
```bash
creator-cli prefab.query-node <uuid>
```
- **uuid**：節點 UUID（32 位 hex）。
- 回傳節點完整 dump（含所有屬性與組件）。

---

### prefab.query-node-tree
```bash
creator-cli prefab.query-node-tree [format] [uuid]
creator-cli prefab.query-node-tree limit <maxDepth> [maxChildren]
```
- **format**（選填）：`tree` | `markdown` | `flat`；預設 `tree`。
- **uuid**（選填）：根節點 UUID；省略為當前場景根。
- `limit <maxDepth> [maxChildren]`：限制展開深度與每層子節點數。

---

### prefab.restore
```bash
creator-cli prefab.restore <uuid>
```
- **uuid**：要還原的節點 UUID。還原後自動儲存。

---

### prefab.create
```bash
creator-cli prefab.create <nodeUuid|nodePath> <assetPath>
```
- 第一參數：節點 uuid 或 nodePath（作為 prefab 根）。
- **assetPath**：新 prefab 路徑，如 `db:assets/prefabs/MyPrefab`。
- 回傳 `{ "uuid": "<新 prefab 資源 uuid>" }`。自動儲存。
- **副作用**：若從「別人 prefab 內的暫時節點」建立，母 prefab 會被改髒。建議建立完成後對暫時節點執行 `remove-node` 清理。

---

### prefab.instantiate
```bash
creator-cli prefab.instantiate <prefabUuid|prefabAssetPath> [parentUuid|parentPath]
```
- **第一參數**：prefab 資源 **uuid**（32 位 hex）或 **assetPath**（如 `db:assets/prefabs/MyPrefab`）。
- **第二參數**（選填）：父節點 **uuid** 或 **nodePath**；省略則掛在場景根節點下。
- 效果等同在編輯器把 prefab 從資源庫拖進場景，產生一個 prefab 實例。
- 回傳 `{ "uuid": "<新節點 uuid>" }`。自動儲存。

**範例：**
```bash
# 複製到場景根節點下
creator-cli prefab.instantiate db:assets/prefabs/Enemy

# 指定父節點（路徑）
creator-cli prefab.instantiate db:assets/prefabs/Item Root/Canvas/Content
```

---

### prefab.get-editing-root
```bash
creator-cli prefab.get-editing-root
```
- 無參數。回傳目前編輯中文件（場景或 prefab）的**根節點**資訊：`{ "uuid": "...", "path": "...", "name": "..." }`。
- 用於 `create-node` 等操作作為父節點，無需猜測階層。編輯 prefab 時根節點可能為包裝節點（如 `...-scene`），本指令回傳的即為該根節點。
- 若目前無有效根節點（空樹），回傳錯誤碼 `ASSET_NOT_FOUND`。

---

### scene.open
```bash
creator-cli scene.open <uuid|assetPath>
```
- **uuid** 或 **assetPath**：如 `db:assets/scenes/main`。
- 在編輯器中開啟該場景或 prefab。

---

### scene.query-current
```bash
creator-cli scene.query-current
```
- 無參數。回傳 `{ "uuid": ...|null, "dirty": bool }`。

---

### scene.create
```bash
creator-cli scene.create <assetPath> [--open]
```
- **assetPath**：新場景路徑，如 `db:assets/scenes/NewScene`。
- **--open**（選填）：建立後立即開啟。
- 回傳 `{ "uuid": "..." }`。自動儲存。

---

### create-component
```bash
creator-cli create-component <nodeUuid|nodePath> <component>
```
- **component**：組件類名，如 `cc.Sprite`、`PlayerController`（腳本 ccclass 名稱）。
- 成功後自動儲存。

---

### remove-component
```bash
creator-cli remove-component <componentUuid>
```
- **componentUuid**：組件的 UUID（非節點 UUID）。可從 `prefab.query-node` 的 dump 取得，或使用 **resolve-component** 依節點路徑＋組件類名取得。
- 成功後自動儲存。

---

### create-node
```bash
creator-cli create-node [parentUuid|parentPath] [name]
```
- **parentUuid** / **parentPath**（選填）：父節點；省略為根節點。
- **name**（選填）：新節點名稱。
- 回傳 `{ "uuid": "<新節點 uuid>" }`。自動儲存。

---

### remove-node
```bash
creator-cli remove-node <uuid|nodePath> [uuid2 uuid3 ...]
```
- 可一次傳多個 uuid 批次移除。
- 成功後自動儲存。

---

### set-property
```bash
creator-cli set-property <nodePath|uuid> <path> [value]
```
- **path**：屬性路徑；支援型別 path（`cc.Sprite.spriteFrame`）或直接路徑（`name`、`__comps__.0.spriteFrame`）。
- **value**（選填）：
  - 字串 / 數字：直接傳入
  - 資源引用：`db:assets/textures/icon.png` → Bridge 解析為 `{ "__uuid__": "..." }`
  - JSON 物件：`{"__uuid__":"..."}` 等
- 成功後自動儲存。

**範例：**
```bash
# 設定節點名稱
creator-cli set-property Root/Canvas/Node name "NewName"

# 設定 Sprite 貼圖
creator-cli set-property Root/Canvas/Sprite cc.Sprite.spriteFrame db:assets/textures/icon.png

# 設定位置 x
creator-cli set-property Root/Canvas/Node position.x 100
```

---

### reset-property
```bash
creator-cli reset-property <nodePath|uuid> <path>
```
- **path**：同 set-property，支援型別 path。
- 重置為 prefab / 預設值。自動儲存。

---

### editor.refresh
```bash
creator-cli editor.refresh
```
- 觸發編輯器資源庫刷新（含腳本編譯），同步等待完成。
- 回傳 `{ "success": true }` 或 `{ "success": false, "errors": [...] }`。

---

## 錯誤碼

| 錯誤碼 | 說明 | 排查方式 |
|--------|------|----------|
| `INVALID_JSON` | 請求非合法 JSON | Bridge 端問題，重啟 Bridge |
| `INVALID_PARAMS` | 參數缺失或格式錯誤 | 檢查子命令用法（加 `--help`）|
| `INVALID_METHOD` | 子命令名稱錯誤 | 確認拼字 |
| `ASSET_NOT_FOUND` | 節點/資源/組件找不到 | 節點：先用 `resolve-node` 或 `prefab.query-node-tree` 確認；資源/場景：檢查 `scene.open` 路徑與是否已開啟 |
| `SCENE_ERROR` | 場景/Editor 操作失敗 | 確認場景已開啟 |
| `INTERNAL_ERROR` | Bridge 內部異常 | 重啟 Bridge |

Exit code **1** = 指令錯誤；**2** = 連線錯誤。

---

## TCP 直接協定（進階）

連線 `127.0.0.1:<port>`，每次送一行 JSON，接收一行 JSON。

**請求格式：**（節點識別可用 `uuid` 或 `nodePath`）
```json
{ "method": "set-property", "params": { "uuid": "...", "path": "name", "value": "NewName" }, "id": "optional-req-id" }
```

**成功回應：**
```json
{ "ok": true, "result": { ... } }
```

**失敗回應：**
```json
{ "ok": false, "error": { "code": "ASSET_NOT_FOUND", "message": "..." } }
```

子命令名稱與 Bridge method 名稱一致（`ping` → `ping`，`set-property` → `set-property`，etc.）。

---

## 常用工作流程範例

### 初始化場景並查看結構
```bash
creator-cli scene.open db:assets/scenes/GameScene
creator-cli prefab.query-node-tree markdown
```

### 找到節點 uuid 後修改屬性（Bash / Unix）
```bash
UUID=$(creator-cli resolve-node Root/Canvas/HpBar | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d).result.uuid)")
creator-cli set-property $UUID name "HealthBar"
```
*Windows PowerShell 可改為：先執行 `creator-cli resolve-node Root/Canvas/HpBar` 取得輸出，再手動取 result.uuid 傳給 set-property。*

### 批次建立節點並加組件
```bash
creator-cli create-node Root/Canvas UIPanel
creator-cli create-component Root/Canvas/UIPanel cc.UITransform
creator-cli create-component Root/Canvas/UIPanel cc.Sprite
```

### 觸發編譯後開啟場景
```bash
creator-cli editor.refresh
creator-cli scene.open db:assets/scenes/main
```
