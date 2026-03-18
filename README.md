# Creator CLI 使用說明

**Creator CLI** 是 Cocos Creator 的擴充，提供 **CLI–編輯器橋接（Bridge）**：讓你在終端機、腳本或 CI 裡用指令操作編輯器內的場景與 Prefab，無需手動在編輯器裡點選。

適合：自動化腳本、批次處理、整合到既有工具鏈的開發者或外部協作者。

---

## 一、你需要準備什麼

- **Cocos Creator 3.x**（建議 3.8 以上）
- 若要用指令列工具 **creator-cli**：本機需安裝 **Node.js**（建議 14+）

---

## 二、快速開始（3 步驟）

### 步驟 1：安裝並啟用擴充

1. 開啟 Cocos Creator，選單 **擴展 → 擴展管理器**。
2. 選擇 **「從本地擴展」**，選取本專案目錄（例如 `extensions/creator-cli`）。
3. 啟用該擴充。

### 步驟 2：在編輯器裡啟動 Bridge

1. 選單 **Panel → creator-cli → Default Panel** 開啟面板。
2. 在面板中選擇 **埠號**（預設 6868；可選 6868 / 6870 / 6872）。
3. 點 **「啟動 Bridge」**，看到狀態顯示「監聽中」即表示成功。

### 步驟 3：在終端機測試連線

在專案目錄下執行（任選一種）：

```bash
# 方式 A：用 npm 跑
npm run cli -- ping

# 方式 B：用 node 直接跑
node bin/creator-cli.js ping
```

若回傳包含 `"pong": true`，表示 CLI 已成功連到編輯器，可以開始使用其他指令。

---

## 三、如何使用 CreatorCLI 指令

### 3.1 執行指令的幾種方式

在 **creator-cli 擴充目錄** 下可以這樣執行（不需每次指定 port）：

| 方式 | 範例 |
|------|------|
| `npm run cli -- <子命令> [參數...]` | `npm run cli -- ping` |
| `node bin/creator-cli.js <子命令> [參數...]` | `node bin/creator-cli.js resolve-node Root/Canvas` |

若你希望**在任意目錄**都能打 `creator-cli`，可以安裝「全域 CLI」：

```bash
cd extensions/creator-cli/creator-cli-global
npm install -g .
```

之後在任意路徑即可使用：

```bash
creator-cli ping
creator-cli resolve-node Root/Canvas/Sprite
```

> 注意：全域安裝的只是 CLI 客戶端；編輯器內仍須啟用 **creator-cli 擴充** 並在 Panel 裡**啟動 Bridge**，指令才會連得上。

### 3.2 設定預設埠號（可選）

若你的 Bridge 不是用預設埠 6868，可先設定一次，之後就不用每次指定：

```bash
creator-cli init 6870
```

會把埠號寫入 `~/.creator-cli.json`。之後所有指令預設使用 6870（仍可用 `--port` 覆蓋）。

埠號僅允許：**6868**、**6870**、**6872**。

### 3.3 查詢說明

- **`creator-cli --help`** 或 **`creator-cli`**（無參數）：列出所有子命令。
- **`creator-cli <子命令> --help`**：查該子命令的用法與參數。

---

## 四、常用指令一覽

| 指令 | 說明 |
|------|------|
| **ping** | 檢查 Bridge 是否存活 |
| **init &lt;port&gt;** | 設定預設埠號（6868 / 6870 / 6872） |
| **resolve-node &lt;path&gt;** | 依節點路徑（如 `Root/Canvas/Sprite`）解析成 uuid |
| **prefab.query-node** | 查詢單一節點內容 |
| **prefab.query-node-tree** | 查詢節點樹（可指定 tree / markdown / flat 格式） |
| **prefab.restore** | 還原 Prefab |
| **scene.open** | 開啟場景或 Prefab |
| **scene.query-current** | 查詢目前場景狀態 |
| **create-node** / **remove-node** | 建立或移除節點 |
| **create-component** / **remove-component** | 在節點上新增或移除組件 |
| **set-property** / **reset-property** | 設定或重置屬性 |
| **editor.refresh** | 觸發編輯器編譯並等待完成 |

參數與進階用法（如 `nodePath`、`db:` 資源路徑等）請看 **[docs/API.md](docs/API.md)**。

### 簡單範例

```bash
# 檢查連線
creator-cli ping

# 依路徑解析節點 uuid
creator-cli resolve-node Root/Canvas/Sprite

# 查詢節點樹（markdown 格式）
creator-cli prefab.query-node-tree --format markdown
```

---

## 五、埠號與連線

- **預設埠**：6868（可在 Panel 改選 6870 或 6872）。
- **埠號優先順序**（由高到低）：  
  指令列 `--port` → 環境變數 `CREATOR_CLI_PORT` → 設定檔 `~/.creator-cli.json`（由 `init` 寫入）→ 預設 6868。
- 僅綁定 **127.0.0.1**，僅供本機使用。

若在 Windows PowerShell 想用 6870，可先設定環境變數再開編輯器：

```powershell
$env:CREATOR_CLI_PORT = "6870"
```

---

## 六、連線失敗時怎麼排查

1. **確認編輯器已開啟**，且已安裝並啟用 creator-cli 擴充。
2. **確認 Bridge 已啟動**：Panel → creator-cli → Default Panel，按「啟動 Bridge」，狀態為「監聽中」。
3. **確認埠號一致**：Panel 選的埠號要與 CLI 使用的埠號相同（可用 `creator-cli init <port>` 或 `--port` 指定）。
4. 若仍無法連線，可用專案內測試腳本檢查（需在擴充目錄執行）：
   ```bash
   node scripts/smoke-bridge.js
   ```
   成功會輸出 `PASS: ping -> ...`；連線失敗會輸出 `SKIP: connection failed ...`。

---

## 七、進階：直接以 TCP/JSON 呼叫 Bridge

若你不想透過 creator-cli 指令，也可以自行用 TCP 送 JSON：

- **位址**：`127.0.0.1`，埠號 6868（或你設定的埠）。
- **格式**：一行一筆 JSON 請求，回應也是一行 JSON。
- **請求**：`{ "method": "方法名", "params": { ... }, "id": "可選" }`
- **回應**：成功 `{ "ok": true, "result": ... }`；失敗 `{ "ok": false, "error": { "code", "message" } }`

支援的方法名稱與參數約定請見 **[docs/API.md](docs/API.md)**。

---

## 八、給擴充開發者（建置與開發）

若你要修改擴充原始碼或參與開發：

**快速一鍵（Windows）**：在 `extensions/creator-cli` 目錄下雙擊 **`setup-build-cli.bat`**，會依序安裝依賴 → 編譯 → 同步 CLI → 本機全域安裝 `creator-cli`。若全域安裝出現權限錯誤，請以系統管理員身分執行該 bat。

**手動步驟：**

```bash
# 安裝依賴
npm install
# 編譯 TypeScript
npm run build
```

- 建置產物在 `dist/`，編輯器載入的是編譯後的程式碼。
- 原始碼：`source/`，Bridge 邏輯在 `source/bridge/`。
- 更新 `bin/creator-cli.js` 後，若使用全域安裝的輕量版，可同步到 `creator-cli-global` 再重新安裝：
  ```bash
  npm run sync-cli-global
  cd creator-cli-global && npm install -g .
  ```

---

## 參考文件

- **[docs/API.md](docs/API.md)** — CreatorCLI 子命令與 Bridge API 完整參考（參數、錯誤碼、範例）。
