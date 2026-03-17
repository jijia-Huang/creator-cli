# Creator CLI Bridge V3 實作計畫

單一資訊來源：SquadMCP session `1b26fb7743dc`（plan_v1、blueprint_v1）。  
工作區：`D:\H5\H5_CLIENT_StormOfSeth\extensions\creator-cli`。Bridge 協定：TCP 一行 JSON。

---

## 1. 具體實作任務清單（P0 → P1）

### P0：路徑尋址與型別／資源路徑

| 任務 ID | 內容 | 對應檔案 | 產出摘要 |
|--------|------|----------|----------|
| **T1** | **nodePath 解析與 resolve-node** | 新增 `source/bridge/resolve-node.ts`；`server.ts`；`validate.ts` | 新增 `resolve-node` method；內部函式 `nodePathToUuid(sceneContext?, nodePath): Promise<string>`（無 `db:` 為節點路徑，依當前場景樹解析）；`validate.ts` 新增 `requireNodePathOrUuid()`；`METHOD_WHITELIST` 與 dispatch 新增 `resolve-node`。 |
| **T2** | **各 method 支援 nodePath 或 uuid 二選一** | `scene-handlers.ts`；`prefab-handlers.ts`；`validate.ts` | `set-property`、`reset-property`、`create-component`、`remove-component`、`create-node`、`remove-node` 之 params 支援 `nodePath` 或 `uuid`（二選一）；內部先透過 T1 解析為 uuid 再呼叫既有 Editor.Message。validate 擴充各 requireXxxParams 接受 nodePath。 |
| **T3** | **組件 path 用型別（cc.Sprite.spriteFrame）** | `source/bridge/component-path.ts`（新）；`scene-handlers.ts`；`validate.ts` | 新增 `resolveComponentPath(nodeDump, typePath): string`（例：`cc.Sprite.spriteFrame` → `__comps__.0.spriteFrame`）；set-property / reset-property 之 `path` 若為型別 path 則先解析再送 Editor；必要時擴充 validate path 規則。 |
| **T4** | **資源路徑 value（db:）** | `source/bridge/resolve-asset.ts`（新）；`scene-handlers.ts`；`validate.ts` | `db:` 前綴為資源路徑；set-property 之 `value` 若為字串且以 `db:` 開頭，先呼叫 asset-db 解析為 uuid，再轉成 `{ __uuid__: uuid }` 寫入；新增 `resolveAssetPath(assetPath: string): Promise<string>`（內部 Editor.Message `asset-db`）。 |

### P1：resolve-node 已含在 T1、其餘為新 method 與自動儲存

| 任務 ID | 內容 | 對應檔案 | 產出摘要 |
|--------|------|----------|----------|
| **T5** | **scene.open** | `scene-handlers.ts`；`server.ts`；`validate.ts` | method `scene.open`，params `uuid?` 或 `assetPath?`（assetPath 可為 `db:`）；開啟場景/prefab；白名單與 dispatch 新增。 |
| **T6** | **scene.query-current** | `scene-handlers.ts`；`server.ts` | method `scene.query-current`，無 params；回傳 `{ uuid, type: 'scene'\|'prefab', dirty? }`；白名單與 dispatch 新增。 |
| **T7** | **prefab.create** | `prefab-handlers.ts`；`server.ts`；`validate.ts` | method `prefab.create`，params `nodePath?` / `nodeUuid?` 二選一 + `assetPath`（必填）；建立 prefab 並可選開啟；白名單與 dispatch 新增。 |
| **T8** | **scene.create** | `scene-handlers.ts`；`server.ts`；`validate.ts` | method `scene.create`，params `assetPath`、可選 `open?: boolean`；建立場景；白名單與 dispatch 新增。 |
| **T9** | **編輯後自動儲存** | `scene-handlers.ts`；`prefab-handlers.ts`；可選 `source/bridge/auto-save.ts` | 凡會改動場景/prefab 的 method 成功後自動呼叫 `scene/save-scene`（或對應 Editor API）；涵蓋：set-property、reset-property、create-component、remove-component、create-node、remove-node、prefab.restore、prefab.create、scene.create 等；可抽成共用 `saveSceneAfterEdit()`。 |

---

## 2. 建議實作順序與依賴

```
T1 (resolve-node + nodePath→uuid)
 │
 ├─→ T2 (nodePath|uuid 於 set/reset/create/remove)
 │     ├─→ T3 (組件型別 path)
 │     ├─→ T4 (value db: 資源路徑)
 │     └─→ T9 (編輯後自動儲存)
 │
 ├─→ T5 (scene.open)
 ├─→ T6 (scene.query-current)
 ├─→ T7 (prefab.create)
 └─→ T8 (scene.create)
```

- **先做**：T1（nodePath 解析與 resolve-node）。
- **接著**：T2（各 method 接受 nodePath 或 uuid），之後 T3、T4、T9 可依賴 T2；T5～T8 僅依賴 T1 或無依賴（T6、T8 可與 T1 並行）。
- **然後**：T3（組件型別 path）、T4（資源路徑 value）、T5～T8 並行或依序。
- **最後**：T9（編輯後自動儲存），依賴所有會改動場景/prefab 的 method 已就緒。

---

## 3. 路徑前綴與契約約定

- **無 `db:`**（例：`Root/Canvas/Sprite`）→ 場景節點路徑，以當前場景樹解析為節點 uuid。
- **`db:` / `db://`** → 資源路徑，由 Bridge 透過 asset-db 解析為資源 uuid。
- 編輯後自動儲存：會改動場景/prefab 的 method 成功後自動呼叫 `scene/save-scene`（Batch 時整批完成後存一次）。

---

## 4. 檔案變更對照（簡表）

| 檔案 | 變更類型 | 說明 |
|------|----------|------|
| `source/bridge/resolve-node.ts` | 新增 | nodePath→uuid、resolve-node 邏輯 |
| `source/bridge/component-path.ts` | 新增 | cc.Sprite.spriteFrame → __comps__.N.xxx |
| `source/bridge/resolve-asset.ts` | 新增 | db: → asset-db → uuid |
| `source/bridge/auto-save.ts` | 可選新增 | 編輯後 save-scene 共用 |
| `source/bridge/scene-handlers.ts` | 修改 | nodePath|uuid、component path、db: value、scene.open/query-current/create、自動儲存 |
| `source/bridge/prefab-handlers.ts` | 修改 | resolve-node 可放此或 scene；prefab.create；自動儲存 |
| `source/bridge/validate.ts` | 修改 | requireNodePathOrUuid、path 型別、assetPath |
| `source/bridge/server.ts` | 修改 | METHOD_WHITELIST、dispatch 新增方法 |
| `source/bridge/types.ts` | 視需要 | 新增 result 型別（如 query-current） |

此文件供 developer 子代理依任務 ID（T1～T9）與依賴順序直接實作。
