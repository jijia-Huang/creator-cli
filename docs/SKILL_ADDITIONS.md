# Creator-CLI Skill 補充內容（供 Skill 維護者合併）

本文件供維護 `.cursor/skills/creator-cli/SKILL.md` 的維護者使用，將以下區塊合併進既有 Skill 即可；**不要**對 Skill 做整體結構重組，僅新增下列內容。

---

## 對 Agent 的補充（Agent 自動化須知）

- **nodePath 支援 `/`**：CLI 已支援 nodePath 含 `/`（如 `Root/Canvas/Sprite`），可直接用路徑操作節點。
- **Prefab 編輯時**：先以 **`prefab.get-editing-root`** 或 **`prefab.query-node-tree`** 取得目前編輯中的 prefab 根節點與節點樹，再進行後續操作。
- 以下為路徑與錯誤、檢查清單、組件引用綁定、prefab.create 劇本之精簡版說明。

---

## D4：常見路徑寫法與 ASSET_NOT_FOUND 時檢查

**常見路徑寫法**

- `scene.open` 可用：`db:assets/scenes/main`、`db:assets/prefabs/My.prefab`；副檔名依專案約定；若專案有約定也可用 `assets/` 開頭之專案相對路徑。

**ASSET_NOT_FOUND 時**

- (1) 節點路徑或 uuid 錯誤 → 先用 **`resolve-node`** 或 **`prefab.query-node-tree`** 確認。
- (2) 資源路徑錯誤或未開啟 → 檢查 **`scene.open`** 路徑格式與是否已開啟對應場景/prefab。

---

## D5：自動化前檢查清單

1. **`creator-cli ping`** 確認 Bridge 存活。
2. **`creator-cli scene.query-current`** 確認當前場景/prefab。
3. 若要操作的資產與當前不符，先 **`creator-cli scene.open <路徑>`**。
4. 再執行後續指令。

---

## D6：組件引用綁定劇本

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

## D7：prefab.create 副作用與 remove-node 建議

從「別人 prefab 內的暫時節點」建立新 prefab 時，**母 prefab 會被改髒**。建議：建立完成後對該暫時節點執行 **`remove-node`** 清理；或改為先複製到場景再對場景內節點執行 **prefab.create**。

---

*以上內容與 `docs/API.md` 對應，僅為精簡版供 Skill 使用。*
