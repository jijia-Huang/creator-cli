# Creator CLI — 安裝與初始化指南

## 前置需求

- **Cocos Creator 3.x**（建議 3.8+）
- **Node.js 14+**（`node -v` 確認）

---

## Step 1：安裝擴充到 Cocos Creator

1. 開啟 Cocos Creator。
2. 選單 **擴展 → 擴展管理器**。
3. 點 **「從本地擴展」**，選取目錄 `extensions/creator-cli`。
4. 確認擴充狀態顯示為**已啟用**。

> 擴充目錄通常位於專案根的 `extensions/creator-cli`（即本 repo 路徑）。

---

## Step 2：安裝擴充的 npm 依賴（可選，僅開發者需要）

若需要重新編譯 TypeScript 原始碼：

```bash
cd extensions/creator-cli
npm install
npm run build
```

一般使用者直接用 `dist/` 中的預編譯檔，**不需要執行此步驟**。

---

## Step 3：啟動 Bridge（每次開啟 Creator 都需要）

1. 在 Cocos Creator 中：選單 **Panel → creator-cli → Default Panel**。
2. 面板中選擇 **埠號**（預設 6868；可選 6868 / 6870 / 6872）。
3. 點 **「啟動 Bridge」**。
4. 狀態列顯示「**監聽中**」即表示成功。

> Bridge 在 Creator 關閉後自動停止，下次開 Creator 要重新啟動。

---

## Step 4：選擇 CLI 執行方式

### 方式 A — 在擴充目錄內執行（最快，無需安裝）

```bash
cd extensions/creator-cli

# 用 npm script
npm run cli -- ping

# 或直接用 node
node bin/creator-cli.js ping
```

### 方式 B — 安裝全域 CLI（推薦，任意目錄可用）

```bash
cd extensions/creator-cli/creator-cli-global
npm install -g .
```

之後在任意路徑執行：

```bash
creator-cli ping
creator-cli resolve-node Root/Canvas/Sprite
```

**更新全域 CLI**（當 `bin/creator-cli.js` 有變動時）：

```bash
# 在 extensions/creator-cli 目錄
npm run sync-cli-global
cd creator-cli-global
npm install -g .
```

### 方式 C — Shell 別名（不想全域安裝）

**macOS / Linux (bash/zsh)**：
```bash
echo "alias creator-cli='node /絕對路徑/extensions/creator-cli/bin/creator-cli.js'" >> ~/.zshrc
source ~/.zshrc
```

**Windows PowerShell**：
```powershell
# 加入 $PROFILE（請將 <專案路徑> 替換成你電腦上 creator-cli 的實際路徑）
function creator-cli { node "<專案路徑>\extensions\creator-cli\bin\creator-cli.js" @args }
```

---

## Step 5：設定預設埠號（可選）

若 Bridge 使用非預設埠 6868：

```bash
creator-cli init 6870
```

寫入 `~/.creator-cli.json`，之後所有指令預設使用 6870。

---

## Step 6：驗證連線

```bash
creator-cli ping
```

若已安裝全域 CLI（方式 B），可在任意目錄執行；否則請在 `extensions/creator-cli` 目錄下執行 `node bin/creator-cli.js ping`。

預期輸出：
```json
{ "pong": true }
```

若連線失敗，見下方排錯。

---

## 連線排錯

| 症狀 | 解法 |
|------|------|
| `ECONNREFUSED` | Bridge 未啟動，回到 Step 3 |
| `pong` 回傳但指令失敗 | 確認擴充已啟用、Creator 開啟中 |
| 埠號錯誤 | `creator-cli init <port>` 對齊 Panel 的埠號 |
| 仍無法連線 | 執行 `node scripts/smoke-bridge.js`（需在 `extensions/creator-cli/` 目錄）|

**smoke test 輸出：**
- `PASS: ping -> ...` → 連線正常
- `SKIP: connection failed ...` → Bridge 未啟動或埠號不符

---

## 埠號優先順序（由高到低）

1. 指令列 `--port 6870`
2. 環境變數 `CREATOR_CLI_PORT`
3. 設定檔 `~/.creator-cli.json`（由 `init` 寫入）
4. 預設 **6868**

---

## 完成後可做的事

```bash
# 查詢所有子命令
creator-cli --help

# 查詢節點樹
creator-cli prefab.query-node-tree markdown

# 開啟場景
creator-cli scene.open db:assets/scenes/main
```

詳細指令參數請見 [API-REFERENCE.md](API-REFERENCE.md)。
