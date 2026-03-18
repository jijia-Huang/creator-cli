# CreatorCLI 使用手冊（API 參考）

本文檔以 **CreatorCLI** 指令列工具為主，說明如何執行、埠號設定、各子命令用法、參數約定與錯誤碼。CreatorCLI 透過 TCP 與編輯器內 Bridge 通訊，無需手動組 JSON。

---

## 1. 執行方式與埠號

### 1.1 如何執行 CreatorCLI

任選一種方式執行（無需每次指定 port）：

- **`node bin/creator-cli.js <子命令> [args...]`**
- **`npm run cli -- <子命令> [args...]`**（例如 `npm run cli -- ping`）
- **`npx creator-cli <子命令> [args...]`**（若 package 的 `bin` 有被註冊）

**若 `bin` 被忽略（例如在 Cocos 擴充內）：**

- 使用 `npm run cli --` 或 `node bin/creator-cli.js`
- 或設定 shell 別名：`alias creator-cli='node /絕對路徑/extensions/creator-cli/bin/creator-cli.js'`

### 1.2 埠號優先順序（由高到低）

1. 指令列 **`--port 6868`**（或 6870、6872）
2. 環境變數 **`CREATOR_CLI_PORT`**
3. **設定檔** `~/.creator-cli.json`（由 `creator-cli init <port>` 寫入）
4. 預設 **6868**

埠號白名單：僅 **6868**、**6870**、**6872** 有效。

### 1.3 設定預設埠號（init）

執行一次後，之後所有指令預設使用該埠，不需再打 port：

```bash
creator-cli init 6870
```

會將 `6870` 寫入 **`~/.creator-cli.json`**。仍可用 `--port` 或 `CREATOR_CLI_PORT` 覆蓋。

### 1.4 說明指令

- **`creator-cli --help`** 或 **`creator-cli`**（無參數）：印出簡短說明與子命令列表
- **`creator-cli <子命令> --help`**：印出該子命令用法

---

## 2. 子命令一覽

| 子命令 | 說明 |
|--------|------|
| **init** | 設定預設埠號並寫入 ~/.creator-cli.json |
| **ping** | 檢查 Bridge 是否存活 |
| **resolve-node** | 依節點路徑解析為 uuid |
| **resolve-component** | 依節點與組件類名解析出組件 uuid（供 remove-component / set-property 用） |
| **prefab.query-node** | 查詢單一節點 dump |
| **prefab.query-node-tree** | 查詢節點樹（tree / markdown / flat） |
| **prefab.restore** | 還原節點為 prefab 狀態 |
| **prefab.create** | 從節點建立 prefab |
| **scene.open** | 開啟場景/prefab |
| **scene.query-current** | 查詢當前場景狀態 |
| **scene.create** | 建立新場景資源 |
| **create-component** | 在節點上建立組件 |
| **remove-component** | 依組件 UUID 移除組件 |
| **create-node** | 建立節點 |
| **remove-node** | 移除節點 |
| **set-property** | 寫入屬性 |
| **reset-property** | 重置屬性 |
| **editor.refresh** | 觸發編輯器編譯並等待完成 |

---

## 3. 各子命令用法（CLI）

以下為 **CLI 指令格式**與參數說明；成功時印出 `result`（物件時為 JSON），失敗時印出錯誤碼與訊息並以非 0 結束。

### 3.1 init

```bash
creator-cli init <port>
```

- **port**：`6868`、`6870` 或 `6872`。寫入 `~/.creator-cli.json`，之後預設使用此埠。

---

### 3.2 ping

```bash
creator-cli ping
```

- 無參數。回傳 `{ "pong": true }` 表示 Bridge 存活。

---

### 3.3 resolve-node

```bash
creator-cli resolve-node <path>
```

- **path**：節點路徑，如 `Root/Canvas/Sprite`（與節點樹的 path 一致）。
- 回傳 `{ "uuid": "...", "path": "..." }`。

亦可使用 `--parent <parentPath> --name <name>` 指定父路徑與節點名稱。

---

### 3.3.5 resolve-component

```bash
creator-cli resolve-component <nodeUuid|nodePath> <component>
```

- 第一參數：節點 **uuid** 或 **nodePath**（如 `Root/Canvas/Sprite`）。
- **component**：組件類名，如 `cc.Sprite`、`PlayerController`（腳本 ccclass 名稱）。
- 回傳 `{ "uuid": "<組件 uuid>" }`。可用於 **remove-component** 的 componentUuid，或需組件 uuid 的腳本／set-property 情境。

範例：先解析節點上 `cc.Sprite` 的組件 uuid，再移除該組件：
```bash
COMP_UUID=$(creator-cli resolve-component Root/Canvas/Sprite cc.Sprite | node -e "const d=require('fs').readFileSync(0,'utf8'); console.log(JSON.parse(d).result.uuid)")
creator-cli remove-component "$COMP_UUID"
```

---

### 3.4 prefab.query-node

```bash
creator-cli prefab.query-node <uuid>
```

- **uuid**：節點 UUID（32 位 hex）。回傳節點完整 dump。

---

### 3.5 prefab.query-node-tree

```bash
creator-cli prefab.query-node-tree [format] [uuid]
```

- **format**（選填）：`tree` | `markdown` | `flat`；或 `limit <maxDepth> [maxChildren]`。
- **uuid**（選填）：根節點 UUID；省略則為當前場景根。
- 回傳正規化節點樹（tree / markdown / flat）。

---

### 3.6 prefab.restore

```bash
creator-cli prefab.restore <uuid>
```

- **uuid**：要還原的節點 UUID。成功後 Bridge 會自動儲存。

---

### 3.7 prefab.create

```bash
creator-cli prefab.create <nodeUuid|nodePath> <assetPath>
```

- 第一參數：節點 **uuid** 或 **nodePath**（作為 prefab 根）。
- **assetPath**：新 prefab 路徑，可為 `db:assets/prefabs/MyPrefab` 或專案相對路徑。
- 回傳 `{ "uuid": "<新 prefab 資源 uuid>" }`。成功後自動儲存。

---

### 3.8 scene.open

```bash
creator-cli scene.open <uuid|assetPath>
```

- **uuid** 或 **assetPath**：場景/prefab 資源；assetPath 可為 `db:assets/scenes/main` 等。
- 開啟該場景或 prefab 於編輯器。

---

### 3.9 scene.query-current

```bash
creator-cli scene.query-current
```

- 無參數。回傳 `{ "uuid": ... | null, "dirty": ... }`（uuid 依 Editor 是否暴露；dirty 來自 query-dirty）。

---

### 3.10 scene.create

```bash
creator-cli scene.create <assetPath> [--open]
```

- **assetPath**：新場景路徑（可 `db:` 或專案相對）。
- **--open**（選填）：建立後是否開啟。回傳 `{ "uuid": "..." }`。

---

### 3.11 create-component

```bash
creator-cli create-component <nodeUuid|nodePath> <component>
```

- 第一參數：節點 **uuid** 或 **nodePath**。
- **component**：組件類名，如 `cc.Sprite`、`PlayerController`（腳本 ccclass 名稱）。
- 成功後自動儲存。

---

### 3.12 remove-component

```bash
creator-cli remove-component <componentUuid>
```

- **componentUuid**：組件的 UUID（非節點）。成功後自動儲存。

---

### 3.13 create-node

```bash
creator-cli create-node [parentUuid|parentPath] [name]
```

- **parentUuid** 或 **parentPath**（選填）：父節點；省略則為根節點。
- **name**（選填）：新節點名稱。
- 回傳 `{ "uuid": "<新節點 uuid>" }`。成功後自動儲存。

---

### 3.14 remove-node

```bash
creator-cli remove-node <uuid|nodePath> [uuid2 ...]
```

- 第一參數：單一節點 **uuid** 或 **nodePath**；可再接多個 uuid 一次移除多顆。成功後自動儲存。

---

### 3.15 set-property

```bash
creator-cli set-property <nodePath|uuid> <path> [value]
```

- 第一參數：節點 **uuid** 或 **nodePath**（如 `Root/Canvas/Sprite`）。
- **path**：屬性路徑。可寫型別 path，如 **`cc.Sprite.spriteFrame`**，Bridge 會解析為 `__comps__.N.spriteFrame`；或直接 `__comps__.0.spriteFrame`、`name` 等。
- **value**（選填）：要寫入的值。可為字串、數字、或 **資源路徑**（`db:assets/textures/icon.png`），Bridge 會解析為 `{ __uuid__ }`；或 JSON 物件（如 `{"__uuid__":"..."}`）。
- 成功後自動儲存。

---

### 3.16 reset-property

```bash
creator-cli reset-property <nodePath|uuid> <path>
```

- 第一參數：節點 **uuid** 或 **nodePath**。
- **path**：同 set-property，支援型別 path（如 `cc.Sprite.spriteFrame`）。成功後自動儲存。

---

### 3.17 editor.refresh

```bash
creator-cli editor.refresh
```

- 無參數。觸發編輯器資源庫刷新（含腳本編譯），等待完成。回傳 `{ "success": true }` 或 `{ "success": false, "errors": [...] }`。

---

## 4. 路徑與值約定（CLI 參數）

### 4.1 節點尋址（nodePath | uuid）

- **nodePath**：場景內階層路徑，如 `Root/Canvas/Sprite`，**不要**加 `db:`。
- **uuid**：32 位 hex 或 Editor 的 base64 風格 id。
- 支援 nodePath 的子命令中，第一個「節點」參數可傳 path 或 uuid，二選一。

### 4.2 資源路徑（db:）

- 以 **`db:`** 或 **`db://`** 開頭、或專案相對路徑（如 **`assets/...`**）表示**資源**，Bridge 會解析為 uuid。
- 用於：`scene.open`、`prefab.create`、`scene.create` 的 assetPath；`set-property` 的 value（貼圖、Prefab 引用等）。

### 4.3 組件 path（型別 path）

- **path** 可寫 **`cc.Sprite.spriteFrame`** 等形式，Bridge 會依節點 `__comps__` 解析為 `__comps__.N.spriteFrame`。
- 亦可直接寫 `__comps__.0.spriteFrame`、`name` 等。

### 4.4 編輯後自動儲存

- 會改動場景/prefab 的子命令（set-property、reset-property、create-node、remove-node、create-component、remove-component、prefab.restore、prefab.create、scene.create）**成功後**，Bridge 會自動呼叫儲存，CLI 不需再發 save。

---

## 5. 錯誤碼（CLI 輸出）

執行失敗時，CreatorCLI 會印出 `code: message` 並以 exit code **1**（連線錯誤為 **2**）。常見錯誤碼：

| 錯誤碼 | 說明 |
|--------|------|
| `INVALID_JSON` | 請求不是合法 JSON（通常為 Bridge 端問題） |
| `INVALID_PARAMS` | 參數缺失或格式錯誤（檢查子命令用法） |
| `INVALID_METHOD` | 子命令名稱錯誤 |
| `ASSET_NOT_FOUND` | 找不到節點、資源或組件（path/uuid/assetPath 解析失敗） |
| `SCENE_ERROR` | 場景/Editor 操作失敗 |
| `INTERNAL_ERROR` | Bridge 內部異常 |

---

## 6. CLI 範例

```bash
# 設定預設埠號（之後不用再指定）
creator-cli init 6870

# 檢查連線
creator-cli ping

# 依路徑解析節點 uuid
creator-cli resolve-node Root/Canvas/Sprite

# 查節點樹（markdown）
creator-cli prefab.query-node-tree markdown

# 設定 Sprite 的 spriteFrame（nodePath + 型別 path + 資源路徑）
creator-cli set-property Root/Canvas/Sprite cc.Sprite.spriteFrame db:assets/textures/icon.png

# 開啟場景
creator-cli scene.open db:assets/scenes/main

# 觸發編譯
creator-cli editor.refresh
```

---

## 7. 進階：協定與直接送 JSON

CreatorCLI 底層為 **TCP**、**一行一筆 JSON**：連線 `127.0.0.1:<port>`，發送一行 JSON 請求、接收一行 JSON 回應。

- **請求**：`{ "method": "<子命令對應的 method>", "params": { ... }, "id": 可選 }`
- **成功回應**：`{ "ok": true, "result": ... }`
- **失敗回應**：`{ "ok": false, "error": { "code": "...", "message": "..." } }`

子命令與 Bridge method 對應關係：`ping` → `ping`、`resolve-node` → `resolve-node`、`set-property` → `set-property` 等，名稱一致。腳本或其它程式若需直接送 JSON，可參考上述格式與 §3 各子命令的 params 形狀。

---

*文件以 CreatorCLI（bin/creator-cli.js）為準，與 Bridge 實作一致。*
