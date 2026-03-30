# creator-cli 改善規格書

**版本**：v1.0  
**日期**：2026-03-30  
**狀態**：討論稿

---

## 1. 背景與問題陳述

### 1.1 核心問題

AI Agent 使用 creator-cli 時，頻繁出現**繞過工具直接修改 `.prefab` / `.scene` 檔案**的行為。

根本原因分析：

| 原因 | 說明 |
|------|------|
| **直接讀檔摩擦更低** | 用 Cursor Read 工具讀 `.prefab` JSON，一次取得節點階層 + 組件資訊（即 C 類查詢），無需 Bridge 連線 |
| **Discovery 工具不完整** | `prefab.query-node-tree markdown` 沒有組件資訊；要同時看結構 + 組件，只能逐節點呼叫 `prefab.query-node`（N 次呼叫） |
| **UUID 鏈增加操作步驟** | `remove-component` 必須先 `resolve-component` 取得組件 UUID 才能操作，需 2 次呼叫 |
| **缺乏負面約束** | SKILL 沒有明確禁止直接改檔案，Agent 不知道繞過工具的後果 |

### 1.2 Agent 的三類查詢需求

| 類型 | 需求 | 現況 |
|------|------|------|
| **A**：知道目標路徑，直接操作 | 已知 `Root/Canvas/Sprite`，要設屬性 | set-property 已支援 nodePath，OK |
| **B**：找特定名稱或組件的節點 | 找所有有 `sp.Skeleton` 的節點 | 需爬全樹自行過濾，工具不提供 |
| **C**：從零理解整體結構 | 初次接觸場景，需要看階層 + 每個節點有哪些組件 | 工具提供的 markdown 無組件資訊；唯一完整方案是讀 `.prefab` 原始檔 |

C 類是最常見的起點，也是 Agent 最容易直接讀檔的情境。

---

## 2. 改善方案總覽

```
優先級 P0  ─  SKILL 文件修補（零程式碼改動，立即可做）
優先級 P1  ─  消除 UUID 鏈（Bridge + CLI 小幅修改）
優先級 P2  ─  Discovery 改進（讓 Agent 不需要讀原始檔）
```

---

## 3. P0：SKILL 文件修補

> 零程式碼改動，可立即執行，能緩解部分繞過工具的行為。

### 3.1 加入強制禁止直接改檔案的聲明

在 `SKILL.md` 最頂部（執行約定之後）加入：

```markdown
## ⚠️ 嚴禁直接修改資源檔案

**絕對不要** 直接編輯 `.prefab`、`.scene`、`.anim` 等 Cocos Creator 資源檔案。

理由：
1. 編輯器有記憶體快取，直接改磁碟檔不會同步到開啟中的 Editor 狀態
2. 繞過編輯器的序列化邏輯，可能導致 UUID 斷鏈、資源引用損毀
3. 下次 Creator 開啟時可能 import 失敗或資源錯位

所有修改必須透過 creator-cli 工具進行。若工具無法完成某操作，請先告知使用者，不要自行修改檔案。
```

### 3.2 說明 `flat` 格式已包含組件資訊

目前 SKILL 沒有提到 `flat` 格式的 `components` 欄位。需補充說明，並建議 Agent 優先使用 `flat` 做 C 類查詢：

在 `SKILL.md` 的指令速查區補充：

```markdown
# 查詢節點樹（含組件資訊）——C 類查詢首選
creator-cli prefab.query-node-tree flat
# 回傳：每個節點含 { uuid, name, path, depth, components: [{cid, name, uuid}] }
# 比 markdown 格式多出 components 欄位，可直接查詢哪個節點有哪些組件

# 效能建議：
# - 需要「整體結構 + 組件資訊」→ flat
# - 需要「人類可讀的層級預覽」→ markdown（無組件資訊）
# - 需要「找特定路徑的節點 uuid」→ resolve-node（不需要先爬樹）
```

### 3.3 明確說明哪些指令不需要先 `resolve-node`

目前 Agent 容易養成「先 resolve-node 再操作」的習慣，但 set-property、create-node、create-component、remove-node 早就支援 nodePath。需在 SKILL 加一條明確說明：

```markdown
## 常見誤區：不需要先 resolve-node

以下指令直接接受 nodePath，**不需要先呼叫 resolve-node 取 UUID**：
- set-property Root/Canvas/Sprite cc.Sprite.spriteFrame db:assets/...
- create-node Root/Canvas NewNode
- create-component Root/Canvas/Node cc.Sprite
- remove-node Root/Canvas/OldNode

只有以下情況才需要 resolve-node：
- 需要把 UUID 傳給其他工具（如 prefab.restore）
- 需要確認某路徑是否存在
```

### 3.4 加入 PowerShell 實用範例

目前範例多為 Unix bash pipe，Windows 使用者缺乏對應說明。補充：

```powershell
# Windows PowerShell：取得節點 UUID 後使用
$result = creator-cli resolve-node Root/Canvas/Sprite | ConvertFrom-Json
$uuid = $result.result.uuid
creator-cli prefab.query-node $uuid
```

---

## 4. P1：消除 UUID 鏈

### 4.1 `remove-component` 支援 nodePath + componentName

**現況（2 步）**

```bash
creator-cli resolve-component Root/Canvas/Sprite cc.Sprite   # → 取 componentUuid
creator-cli remove-component <componentUuid>
```

**目標（1 步）**

```bash
creator-cli remove-component Root/Canvas/Sprite cc.Sprite
```

**改動範圍**

| 檔案 | 改動 |
|------|------|
| `source/bridge/validate.ts` | `requireRemoveComponentParams` 新增 nodePath + component 路徑；原 uuid-only 路徑保留（向下相容） |
| `source/bridge/scene-handlers.ts` | `handleRemoveComponent` 若收到 nodePath+component，內部呼叫 `resolveNodeUuid` + `getComponentUuid` |
| `bin/creator-cli.js` | `remove-component` 的 `buildParams` 新增解析「2 個 positional args = nodePath + component」邏輯 |

**新的 validate 邏輯（虛擬碼）**

```typescript
// 接受三種形式：
// 1. { uuid: componentUuid }              ← 原有，向下相容
// 2. { nodePath, component }              ← 新增
// 3. { uuid: nodeUuid, component }        ← 新增（uuid 為節點 uuid）
export function requireRemoveComponentParams(params) {
  const hasComponent = typeof params.component === 'string' && params.component.trim() !== '';
  if (hasComponent) {
    // 新路徑：需要節點識別 + 組件名
    return { ...requireNodePathOrUuid(params), component: params.component.trim() };
  }
  // 原有路徑：單一組件 UUID
  return { uuid: requireCreatorId(params, 'uuid') };
}
```

**新的 CLI buildParams（虛擬碼）**

```javascript
'remove-component': {
  buildParams: (argv) => {
    // 舊用法：單一 componentUuid
    if (argv.length === 1 && isUuid(argv[0])) return { uuid: argv[0] };
    // 新用法：nodePath/nodeUuid + componentName
    if (argv.length >= 2 && isNodeRef(argv[0]) && argv[1]) {
      const ref = isUuid(argv[0]) ? { uuid: argv[0] } : { nodePath: argv[0] };
      return { ...ref, component: argv[1] };
    }
    return null;
  }
}
```

---

### 4.2 `prefab.query-node` 支援 nodePath

**現況（2 步）**

```bash
creator-cli resolve-node Root/Canvas/Sprite   # → 取 uuid
creator-cli prefab.query-node <uuid>
```

**目標（1 步）**

```bash
creator-cli prefab.query-node Root/Canvas/Sprite
```

**改動範圍**

| 檔案 | 改動 |
|------|------|
| `source/bridge/prefab-handlers.ts` | `handleQueryNode` 改用 `requireNodePathOrUuid`；若為 nodePath 先呼叫 `nodePathToUuid` |
| `bin/creator-cli.js` | `prefab.query-node` 的 `buildParams` 新增 nodePath 路徑（非 uuid 格式的字串視為 nodePath） |

---

### 4.3 `prefab.restore` 支援 nodePath

**現況（2 步）**

```bash
creator-cli resolve-node Root/Canvas/MyPrefabNode   # → 取 uuid
creator-cli prefab.restore <uuid>
```

**目標（1 步）**

```bash
creator-cli prefab.restore Root/Canvas/MyPrefabNode
```

**改動範圍**

| 檔案 | 改動 |
|------|------|
| `source/bridge/validate.ts` | `requireRestoreUuids` 新增 nodePath 支援；單一 nodePath 回傳標記，由 handler 解析 |
| `source/bridge/prefab-handlers.ts` | `handleRestore` 若收到 nodePath，先呼叫 `nodePathToUuid` 再 restore |
| `bin/creator-cli.js` | `prefab.restore` 的 `buildParams` 新增 nodePath 路徑 |

---

### 4.4 `set-property` 支援 `@node:` 節點引用語法

這是 UUID 鏈中最難的一條，用於設定腳本上的 `@property` 節點引用。

**現況（2 步）**

```bash
creator-cli resolve-node Root/Canvas/Player/Skeleton   # → 取 targetUuid
creator-cli set-property Root/Canvas/Player MyScript.skeleton '{"__uuid__":"<targetUuid>"}'
```

**目標（1 步）**

```bash
creator-cli set-property Root/Canvas/Player MyScript.skeleton @node:Root/Canvas/Player/Skeleton
```

**設計原則**

與現有 `db:` 資源路徑語法完全對稱：

| 語法 | 含義 | 解析位置 |
|------|------|----------|
| `db:assets/textures/icon.png` | 資源路徑 → `{ __uuid__ }` | Bridge `normalizePropertyValue` |
| `@node:Root/Canvas/Spine` | 節點路徑 → `{ __uuid__ }` | Bridge `normalizePropertyValue`（新增） |

**改動範圍**

| 檔案 | 改動 |
|------|------|
| `source/bridge/scene-handlers.ts` | `normalizePropertyValue` 新增 `@node:` prefix 判斷，呼叫 `nodePathToUuid` 後包成 `{ __uuid__ }` |
| `bin/creator-cli.js` | `parseValue` 新增：若字串以 `@node:` 開頭，直接回傳原字串（不做數字/JSON 解析），讓 Bridge 處理 |

**`normalizePropertyValue` 新邏輯（虛擬碼）**

```typescript
async function normalizePropertyValue(value: unknown): Promise<unknown> {
  // 既有：已是 { __uuid__ } 物件
  if (isUuidRef(value)) return value;
  // 既有：db: 資源路徑
  if (isAssetPathValue(value)) {
    return { __uuid__: await resolveAssetPath(value) };
  }
  // 新增：@node: 節點路徑引用
  if (typeof value === 'string' && value.startsWith('@node:')) {
    const nodePath = value.slice(6); // 去掉 "@node:"
    const uuid = await nodePathToUuid(undefined, nodePath);
    return { __uuid__: uuid };
  }
  return value;
}
```

---

## 5. P2：Discovery 改進

### 5.1 修正 `treeToMarkdown` 顯示組件資訊

**現況**

```
- Canvas (Root/Canvas)
  - SpineNode (Root/Canvas/SpineNode)
  - BtnStart (Root/Canvas/BtnStart)
```

**目標**

```
- Canvas [cc.Canvas, cc.UITransform] (Root/Canvas)
  - SpineNode [sp.Skeleton, cc.UITransform] (Root/Canvas/SpineNode)
  - BtnStart [cc.Button, cc.UITransform] (Root/Canvas/BtnStart)
```

**改動範圍**

| 檔案 | 改動 |
|------|------|
| `source/bridge/node-tree-normalize.ts` | `treeToMarkdown` 若節點有 `components`，在 name 後方加 `[cid1, cid2, ...]`；優先顯示 `cid`，無則用 `name` |

這讓 `prefab.query-node-tree markdown` 一次滿足 C 類查詢，Agent 不再需要讀原始 `.prefab` 檔。

**`treeToMarkdown` 修改（虛擬碼）**

```typescript
export function treeToMarkdown(node: NormalizedNode, indent = ''): string {
  const compStr = node.components && node.components.length > 0
    ? ` [${node.components.map(c => c.cid ?? c.name ?? '?').join(', ')}]`
    : '';
  const self = `${indent}- ${node.name}${compStr} (${node.path})`;
  // ... 其餘不變
}
```

---

### 5.2 新增 `node.find` 搜尋指令

**用途**：B 類查詢——不爬全樹，直接找到目標節點。

**CLI 語法**

```bash
# 依名稱（部分符合，大小寫不敏感）
creator-cli node.find --name Spine

# 依組件類型
creator-cli node.find --component sp.Skeleton

# 兩者同時（AND）
creator-cli node.find --name Btn --component cc.Button

# 萬用字元（* 符合任意字元）
creator-cli node.find --name "*Btn*"
```

**回傳格式**

```json
[
  {
    "uuid": "...",
    "path": "Root/Canvas/SpineNode",
    "name": "SpineNode",
    "depth": 2,
    "components": [
      { "cid": "sp.Skeleton", "uuid": "..." },
      { "cid": "cc.UITransform", "uuid": "..." }
    ]
  }
]
```

**改動範圍**

| 檔案 | 改動 |
|------|------|
| `source/bridge/server.ts` | 方法白名單加入 `node.find` |
| `source/bridge/prefab-handlers.ts` 或新檔 `source/bridge/find-handlers.ts` | `handleNodeFind(params)` 實作：呼叫 query-node-tree 取全樹，normalize 後對 flat 陣列過濾 |
| `bin/creator-cli.js` | 新增 `node.find` 指令定義 |

**`handleNodeFind` 邏輯（虛擬碼）**

```typescript
export async function handleNodeFind(params) {
  const namePattern = params.name as string | undefined;   // 支援 * 萬用字元
  const component = params.component as string | undefined;

  const raw = await Message.request('scene', 'query-node-tree');
  const { flat } = normalizeTree(raw, {});

  return flat.filter(node => {
    const nameMatch = !namePattern || matchesPattern(node.name, namePattern);
    const compMatch = !component || (node.components ?? []).some(
      c => c.cid === component || c.name === component
    );
    return nameMatch && compMatch;
  });
}

function matchesPattern(str: string, pattern: string): boolean {
  if (!pattern.includes('*')) return str.toLowerCase().includes(pattern.toLowerCase());
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
  return regex.test(str);
}
```

---

## 6. P3：複製操作（新功能）

### 6.1 需求說明

複製操作有兩個獨立子需求：

| 需求 | 說明 | 典型使用情境 |
|------|------|-------------|
| **node.duplicate** | 在當前場景/prefab 內複製一個節點，產生獨立副本 | 複製 UI 元件到相同容器；從現有節點建立相似節點 |
| **prefab.copy** | 複製一個 prefab 資源檔案到新路徑 | 將公用 prefab 複製到本地作為客製化基底；跨目錄備份 |

### 6.2 UUID 鏈設計原則（此功能特有）

複製操作的 UUID 問題比一般操作多一個維度：**輸入端** 和 **輸出端** 都可能產生鏈。

```
輸入端 UUID 鏈：
  resolve-node <path> → uuid  →  node.duplicate <uuid>      ← 需消除

輸出端 UUID 鏈：
  node.duplicate → { uuid: newNodeUuid }
  set-property <newNodeUuid> ...                             ← 如果只回傳 uuid，後續操作仍需 uuid
```

**設計對策**：
- **輸入端**：同 P1，所有參數支援 nodePath / assetPath，不強迫先解析 UUID
- **輸出端**：回傳值**同時帶 uuid 和 path**，讓後續操作可以用 path 而非 uuid

```json
// 理想的回傳格式
{ "uuid": "abc123...", "path": "Root/Canvas/SpineNode_copy", "name": "SpineNode_copy" }
```

---

### 6.3 `node.duplicate`：複製節點

**CLI 語法**

```bash
# 最簡：複製到同一個父節點下（名稱自動加 _copy 或編號）
creator-cli node.duplicate Root/Canvas/SpineNode

# 指定新父節點（nodePath 或 uuid）
creator-cli node.duplicate Root/Canvas/SpineNode Root/Canvas/OtherContainer

# 指定新名稱
creator-cli node.duplicate Root/Canvas/SpineNode --name SpineNode_v2

# 指定父節點 + 新名稱
creator-cli node.duplicate Root/Canvas/SpineNode Root/Canvas/OtherContainer --name SpineNode_v2
```

**回傳格式**

```json
{
  "uuid": "<新節點的 uuid>",
  "path": "Root/Canvas/SpineNode_copy",
  "name": "SpineNode_copy"
}
```

後續操作可以直接用 `path`，不需要用 `uuid`：

```bash
# 複製後直接用 path 操作，不需要取出 uuid
creator-cli node.duplicate Root/Canvas/SpineNode --name NewSpine
creator-cli set-property Root/Canvas/NewSpine cc.Sprite.spriteFrame db:assets/...
```

**行為規格**

| 情境 | 行為 |
|------|------|
| source 是 prefab 實例 | 產生新的 prefab 實例（保留 prefab 連結），等同再次 instantiate |
| source 是一般節點 | 產生完整深複製，子節點一併複製，所有 UUID 重新產生 |
| 未指定 parent | 複製到與 source 相同的父節點下 |
| 名稱衝突 | 自動在名稱後附加 `_copy` 或序號（`_2`、`_3`...） |
| 自動儲存 | 成功後自動儲存（與其他修改操作一致） |

**實作方向**

Cocos Creator 3.x Editor 提供 clipboard 機制：

```typescript
// 方案 A（優先）：copy-node + paste-node（Editor clipboard 機制）
await Message.request('scene', 'copy-node', { uuid: sourceUuid });
const newUuid = await Message.request('scene', 'paste-node', { parent: parentUuid });

// 方案 B（fallback）：若 clipboard 機制在自動化環境不穩定
// 需向 Cocos 確認是否有 duplicate-node 或類似 API
```

> ⚠️ **實作前確認**：`copy-node` / `paste-node` 是否支援非互動式呼叫需在 Editor 環境驗證。若不支援，需改用其他策略（如 query-node dump → create-node + 重建組件，但這對複雜節點成本高）。

**改動範圍**

| 檔案 | 改動 |
|------|------|
| `source/bridge/server.ts` | 方法白名單加入 `node.duplicate` |
| `source/bridge/scene-handlers.ts` 或新檔 `source/bridge/duplicate-handlers.ts` | `handleNodeDuplicate(params)` |
| `source/bridge/validate.ts` | `requireNodeDuplicateParams` |
| `bin/creator-cli.js` | 新增 `node.duplicate` 指令定義 |

---

### 6.4 `prefab.copy`：複製 prefab 資源

**CLI 語法**

```bash
# 以 assetPath 指定來源（推薦，不需要先查 uuid）
creator-cli prefab.copy db:assets/prefabs/Enemy db:assets/prefabs/EnemyV2

# 以 uuid 指定來源
creator-cli prefab.copy <prefabUuid> db:assets/prefabs/EnemyV2

# 目標路徑支援不帶副檔名（Bridge 自動補 .prefab）
creator-cli prefab.copy db:assets/prefabs/Enemy db:assets/prefabs/local/Enemy
```

**回傳格式**

```json
{
  "uuid": "<新 prefab 資源的 uuid>",
  "assetPath": "db:assets/prefabs/EnemyV2.prefab"
}
```

後續可以直接用 `assetPath` 操作，不需要用 `uuid`：

```bash
# 複製後直接用 assetPath instantiate，不需要取出 uuid
creator-cli prefab.copy db:assets/prefabs/Enemy db:assets/prefabs/local/Enemy
creator-cli prefab.instantiate db:assets/prefabs/local/Enemy Root/Canvas
```

**行為規格**

| 情境 | 行為 |
|------|------|
| 目標路徑已存在 | 回傳 `ASSET_NOT_FOUND` 變體錯誤（`ASSET_ALREADY_EXISTS`）或由 Editor asset-db 決定 |
| 目標目錄不存在 | 回傳 `ASSET_NOT_FOUND` 並提示目錄不存在 |
| 目標路徑無副檔名 | 自動補 `.prefab` |
| 複製後是否開啟 | 預設不開啟；可加 `--open` 選項 |
| 自動儲存 | 新資源建立後不需要 save（asset-db 操作本身是持久的） |

**實作方向**

```typescript
// 使用 asset-db copy-asset（需確認 CC3 是否提供此 Message）
const result = await Message.request('asset-db', 'copy-asset', srcUrl, destUrl);

// 若 copy-asset 不存在，fallback：
// 1. asset-db query-asset → 取得原始內容
// 2. asset-db create-asset(destUrl, content) → 建立副本
// 注意：fallback 方案可能不完整複製 meta 或 subAssets
```

> ⚠️ **實作前確認**：`asset-db copy-asset` 是否存在於 CC3.8+ 需驗證。建議先以 smoke test 確認再寫完整邏輯。

**改動範圍**

| 檔案 | 改動 |
|------|------|
| `source/bridge/server.ts` | 方法白名單加入 `prefab.copy` |
| `source/bridge/prefab-handlers.ts` | `handlePrefabCopy(params)` |
| `source/bridge/validate.ts` | `requirePrefabCopyParams`（src 為 uuid 或 assetPath；dest 為 assetPath 必填） |
| `source/bridge/resolve-asset.ts` | 確認 `assetPathToPrefabUrl` 可處理目標路徑 |
| `bin/creator-cli.js` | 新增 `prefab.copy` 指令定義 |

---

### 6.5 複製操作的 UUID 鏈場景對比

**沒有本規格設計前（UUID 鏈滿載）**

```bash
# 想複製一個節點並修改副本屬性：共 4 步，3 個 UUID 在飛
creator-cli resolve-node Root/Canvas/Spine                        # → sourceUuid
creator-cli resolve-node Root/Canvas/Container                    # → parentUuid
# （某種複製操作，假設需要 uuid）
creator-cli <copy> <sourceUuid> <parentUuid>                      # → newNodeUuid
creator-cli set-property <newNodeUuid> cc.Sprite.spriteFrame db:assets/...
```

**本規格設計後（零 UUID 依賴）**

```bash
# 同樣的操作：2 步，0 個 UUID 需要手動傳遞
creator-cli node.duplicate Root/Canvas/Spine Root/Canvas/Container --name SpineCopy
creator-cli set-property Root/Canvas/Container/SpineCopy cc.Sprite.spriteFrame db:assets/...
```

---

## 7. 各方案影響評估

| 方案 | 解決的問題 | 改動量 | 優先級 |
|------|-----------|--------|--------|
| P0.1 禁止直接改檔案聲明 | Agent 繞過工具 | 極低（改 SKILL.md） | **立即** |
| P0.2 說明 flat 含 components | C 類查詢工具化 | 極低（改 SKILL.md） | **立即** |
| P0.3 說明不需先 resolve-node | 不必要的多步驟 | 極低（改 SKILL.md） | **立即** |
| P0.4 PowerShell 範例 | Windows 可用性 | 極低（改 SKILL.md） | **立即** |
| P1.1 remove-component nodePath | UUID 鏈 chain-1 | 低（3 檔案） | 高 |
| P1.2 prefab.query-node nodePath | UUID 鏈 chain-2 | 低（2 檔案） | 高 |
| P1.3 prefab.restore nodePath | UUID 鏈 chain-3 | 低（3 檔案） | 中 |
| P1.4 @node: 語法 | UUID 鏈 chain-4（節點引用） | 中（2 檔案） | 高 |
| P2.1 markdown 加組件資訊 | C 類查詢完整性 | 低（1 檔案） | 高 |
| P2.2 node.find 新指令 | B 類查詢效率 | 中（新功能） | 中 |
| P3.1 node.duplicate | 節點複製（新功能） | 中（新功能，需驗證 Editor API） | 中 |
| P3.2 prefab.copy | Prefab 資源複製（新功能） | 中（新功能，需驗證 Editor API） | 中 |

---

## 8. 建議執行順序

```
第一波（立即，改文件）
  → P0.1 + P0.2 + P0.3 + P0.4

第二波（一個 sprint，改程式）
  → P2.1 markdown 加組件（改動小，影響大）
  → P1.1 remove-component nodePath
  → P1.4 @node: 語法

第三波（後續）
  → P1.2 prefab.query-node nodePath
  → P1.3 prefab.restore nodePath
  → P2.2 node.find 新指令
  → P3.1 node.duplicate（需先驗證 Editor API copy-node/paste-node）
  → P3.2 prefab.copy（需先驗證 asset-db copy-asset）
```

---

## 9. 向下相容性說明

所有 P1 的改動均為**新增參數路徑**，原有 UUID 用法完整保留：

- `remove-component <componentUuid>`  ← 仍有效
- `remove-component <nodePath> <componentName>`  ← 新增
- `prefab.query-node <uuid>`  ← 仍有效
- `prefab.query-node <nodePath>`  ← 新增
- `set-property ... value`  ← 仍有效
- `set-property ... @node:<path>`  ← 新增

SKILL.md 的舊範例無需修改，新語法為額外選項。

---

## 10. SKILL 更新計畫

每個階段的程式改動**必須同步更新 SKILL**，兩者要一起交付。

### 10.1 SKILL 檔案位置

| 檔案 | 用途 |
|------|------|
| `C:\Users\jijiahuang\.cursor\skills\creator-cli\SKILL.md` | Cursor Agent 載入的實際 SKILL（主要更新目標） |
| `extensions/creator-cli/skills/creator-cli/SKILL.md` | 專案內的來源版本（與上方保持同步） |
| `extensions/creator-cli/skills/creator-cli/API-REFERENCE.md` | 完整指令參數文件 |
| `extensions/creator-cli/skills/creator-cli/INSTALL.md` | 安裝說明（本規格無需修改） |

> 每次 SKILL.md 有變動，兩個路徑都要更新。

---

### 10.2 第一波 SKILL 更新（對應 P0，立即執行，零程式碼）

**SKILL.md 新增內容**

**① 最頂部加入「嚴禁直接修改資源檔案」區塊**（放在「執行約定」之後）

```markdown
## ⚠️ 嚴禁直接修改資源檔案

**絕對不要** 直接編輯 `.prefab`、`.scene`、`.anim` 等 Cocos Creator 資源檔案。

理由：
1. 編輯器有記憶體快取，直接改磁碟檔不會同步到開啟中的 Editor 狀態
2. 繞過編輯器的序列化邏輯，可能導致 UUID 斷鏈、資源引用損毀
3. 下次 Creator 開啟時可能 import 失敗或資源錯位

所有修改必須透過 creator-cli 工具進行。若工具無法完成某操作，請先告知使用者，不要自行修改檔案。
```

**② 指令速查區補充 `flat` 格式說明**

```markdown
# 查詢節點樹（含組件資訊）——初次理解場景結構的首選
creator-cli prefab.query-node-tree flat
# 回傳：每個節點含 { uuid, name, path, depth, components: [{cid, name, uuid}] }
# 已包含組件資訊，可直接找「哪個節點有哪些組件」

# 格式選擇建議：
# flat     → 需要「結構 + 組件資訊」，程式化處理（Agent 首選）
# markdown → 需要「人類可讀的層級預覽」（組件資訊在 P2.1 後才加入）
# tree     → 需要巢狀 JSON 結構做進一步處理
```

**③ 新增「常見誤區」區塊**

```markdown
## 常見誤區：不需要先 resolve-node

以下指令直接接受 nodePath，不需要先呼叫 resolve-node：
- set-property <nodePath> <path> <value>
- create-node <parentPath> <name>
- create-component <nodePath> <component>
- remove-node <nodePath>
- prefab.instantiate <assetPath> <parentPath>

只有在以下情況才需要 resolve-node：
- 需要確認某路徑是否實際存在再操作
- 需要把 uuid 傳給不支援 nodePath 的舊用法（如 prefab.restore，P1.3 改善後可省略）
```

**④ API-REFERENCE.md：補充 PowerShell 範例**

在「常用工作流程範例」末尾加入：

```markdown
### Windows PowerShell 取得節點 UUID

\`\`\`powershell
# 取得節點 uuid
$result = creator-cli resolve-node Root/Canvas/HpBar | ConvertFrom-Json
$uuid = $result.result.uuid
creator-cli prefab.query-node $uuid

# 取得組件 uuid
$result = creator-cli resolve-component Root/Canvas/Sprite cc.Sprite | ConvertFrom-Json
$compUuid = $result.result.uuid
creator-cli remove-component $compUuid
\`\`\`
```

---

### 10.3 第二波 SKILL 更新（對應 P1 + P2.1，程式改動後同步）

**SKILL.md 指令速查區更新**

```markdown
# 移除組件（P1.1 後支援 nodePath + componentName，不需要先 resolve-component）
creator-cli remove-component Root/Canvas/Sprite cc.Sprite      ← 新語法
creator-cli remove-component <componentUuid>                    ← 舊語法仍有效

# 查詢單一節點 dump（P1.2 後支援 nodePath）
creator-cli prefab.query-node Root/Canvas/Sprite               ← 新語法
creator-cli prefab.query-node <uuid>                           ← 舊語法仍有效

# 還原節點為 Prefab 狀態（P1.3 後支援 nodePath）
creator-cli prefab.restore Root/Canvas/MyPrefabNode            ← 新語法
creator-cli prefab.restore <uuid>                              ← 舊語法仍有效

# 設定節點引用屬性（P1.4 後支援 @node: 語法）
creator-cli set-property Root/Canvas/Player MyScript.skeleton @node:Root/Canvas/Player/Spine  ← 新語法
creator-cli set-property Root/Canvas/Player MyScript.skeleton '{"__uuid__":"<uuid>"}'         ← 舊語法仍有效
```

**SKILL.md 更新「組件引用綁定劇本」**

現有劇本需更新為新語法（一步完成）：

```markdown
## 組件引用綁定劇本（更新版）

綁定組件引用（如 @property(sp.Skeleton) 到子節點），P1.4 後只需一步：

\`\`\`bash
creator-cli set-property Root/Canvas/Player MyScript.skeleton @node:Root/Canvas/Player/Spine
\`\`\`

@node: 語法說明：
- 以 @node: 開頭，後接節點 nodePath
- Bridge 自動解析為 { "__uuid__": "<目標節點 uuid>" }
- 與 db: 資源路徑語法完全對稱
\`\`\`
```

**API-REFERENCE.md 各指令更新**

| 指令 | 更新內容 |
|------|---------|
| `remove-component` | 新增 `nodePath + componentName` 用法說明與範例 |
| `prefab.query-node` | 新增 nodePath 用法 |
| `prefab.restore` | 新增 nodePath 用法 |
| `set-property` | 新增 `@node:` 語法說明，更新 value 欄位描述 |

**SKILL.md 連線排錯：補充 markdown 組件資訊說明（P2.1 後）**

```markdown
# P2.1 後，markdown 格式已包含組件資訊：
creator-cli prefab.query-node-tree markdown
# 輸出範例：
# - Canvas [cc.Canvas, cc.UITransform] (Root/Canvas)
#   - SpineNode [sp.Skeleton, cc.UITransform] (Root/Canvas/SpineNode)
```

---

### 10.4 第三波 SKILL 更新（對應 P2.2 + P3）

**SKILL.md 指令速查區新增**

```markdown
# 搜尋節點（P2.2 後新增）
creator-cli node.find --name Spine
creator-cli node.find --component sp.Skeleton
creator-cli node.find --name "*Btn*" --component cc.Button
# 回傳：[{ path, uuid, depth, components }]，只回傳匹配節點

# 複製節點（P3.1 後新增）
creator-cli node.duplicate Root/Canvas/SpineNode --name SpineCopy
creator-cli node.duplicate Root/Canvas/SpineNode Root/Canvas/OtherContainer --name SpineCopy
# 回傳：{ uuid, path, name }（回傳 path 讓後續操作無需用 uuid）

# 複製 Prefab 資源（P3.2 後新增）
creator-cli prefab.copy db:assets/prefabs/Enemy db:assets/prefabs/local/Enemy
# 回傳：{ uuid, assetPath }（回傳 assetPath 讓後續操作無需用 uuid）
```

**API-REFERENCE.md 新增指令完整說明**

| 新指令 | 新增內容 |
|--------|---------|
| `node.find` | 完整參數說明（--name、--component）、萬用字元規則、回傳格式 |
| `node.duplicate` | 完整參數說明（source、parent、--name）、行為規格（prefab 實例 vs 一般節點）、回傳格式 |
| `prefab.copy` | 完整參數說明（src、dest、--open）、副檔名自動補全規則、回傳格式 |

**SKILL.md 「對 Agent 的補充」區塊新增**

```markdown
- **需要找特定組件的節點**：用 `node.find --component <type>` 取代爬全樹後手動過濾
- **複製節點後繼續操作**：`node.duplicate` 回傳 path，直接用 path 做後續操作，不需要用 uuid
- **複製 prefab 後 instantiate**：`prefab.copy` 回傳 assetPath，直接傳給 `prefab.instantiate`，不需要用 uuid
```

---

### 10.5 SKILL 更新 Checklist（各波交付確認）

```
第一波 SKILL 更新 checklist（P0）
  [ ] SKILL.md 加入「嚴禁直接修改資源檔案」區塊（最頂部顯眼位置）
  [ ] SKILL.md 指令速查補充 flat 格式說明與格式選擇建議
  [ ] SKILL.md 新增「常見誤區：不需要先 resolve-node」區塊
  [ ] API-REFERENCE.md 加入 PowerShell 範例
  [ ] 同步更新 Cursor skills 路徑與專案 skills 路徑

第二波 SKILL 更新 checklist（P1 + P2.1）
  [ ] SKILL.md 指令速查更新 remove-component 新語法
  [ ] SKILL.md 指令速查更新 prefab.query-node 新語法
  [ ] SKILL.md 指令速查更新 prefab.restore 新語法
  [ ] SKILL.md 指令速查新增 @node: 語法範例
  [ ] SKILL.md 組件引用綁定劇本更新為一步版本
  [ ] SKILL.md 說明 markdown 格式現在包含組件資訊
  [ ] API-REFERENCE.md 各指令更新（remove-component、prefab.query-node、prefab.restore、set-property）
  [ ] 同步更新 Cursor skills 路徑與專案 skills 路徑

第三波 SKILL 更新 checklist（P2.2 + P3）
  [ ] SKILL.md 指令速查新增 node.find
  [ ] SKILL.md 指令速查新增 node.duplicate
  [ ] SKILL.md 指令速查新增 prefab.copy
  [ ] SKILL.md「對 Agent 的補充」區塊更新
  [ ] API-REFERENCE.md 新增三個指令的完整說明
  [ ] 同步更新 Cursor skills 路徑與專案 skills 路徑
```

---

## 11. 不在本規格範圍內的項目

- **命名空間統一**（`create-node` → `scene.create-node` 等）：屬於 breaking change，影響大，另案討論
- **MCP Server 包裝**：架構層改動，需獨立評估
- **prefab.query-node summary 模式**（回傳精簡版 dump）：影響較小，可在 P2 後評估需求

---

*本規格書以討論與共識為目的，實作前請確認各改動的 API 形狀與向下相容性。*
