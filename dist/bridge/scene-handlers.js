"use strict";
/**
 * 場景節點操作：create-component、remove-component、create-node、remove-node、
 * set-property（value / dump）、reset-property。對應 Editor.Message.request('scene', ...)。
 * 對齊 blueprint API 契約與 @cocos/creator-types 之 CreateComponentOptions、SetPropertyOptions 等。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleResolveComponent = handleResolveComponent;
exports.handleCreateComponent = handleCreateComponent;
exports.handleRemoveComponent = handleRemoveComponent;
exports.handleCreateNode = handleCreateNode;
exports.handleRemoveNode = handleRemoveNode;
exports.handleNodeDuplicate = handleNodeDuplicate;
exports.handleSetProperty = handleSetProperty;
exports.handleResetProperty = handleResetProperty;
exports.handleSceneOpen = handleSceneOpen;
exports.handleSceneQueryCurrent = handleSceneQueryCurrent;
exports.handleSceneCreate = handleSceneCreate;
const auto_save_1 = require("./auto-save");
const component_path_1 = require("./component-path");
const node_tree_normalize_1 = require("./node-tree-normalize");
const resolve_asset_1 = require("./resolve-asset");
const resolve_node_1 = require("./resolve-node");
const validate_1 = require("./validate");
function getEditorMessage() {
    const E = globalThis.Editor;
    if (!E || !E.Message || typeof E.Message.request !== 'function') {
        const err = new Error('Editor.Message not available');
        err.code = 'SCENE_ERROR';
        throw err;
    }
    return E.Message;
}
/** 判斷 path 是否為型別 path（如 cc.Sprite.spriteFrame），需先解析成 __comps__.N.xxx */
function isTypePath(path) {
    const p = path.trim();
    return p.length > 0 && p.includes('cc.') && !(0, component_path_1.isResolvedComponentPath)(p);
}
/** 若 path 為型別 path 則用 nodeDump 解析為 __comps__.N.xxx，否則回傳原 path。解析失敗回傳 null。 */
function resolvePathIfTypePath(nodeDump, path) {
    if (!isTypePath(path))
        return path;
    return (0, component_path_1.resolveComponentPath)(nodeDump, path);
}
/** 將節點識別（uuid 或 nodePath）解析為 uuid；若已是 uuid 直接回傳。 */
async function resolveNodeUuid(ref, sceneContext) {
    if ('uuid' in ref)
        return ref.uuid;
    return (0, resolve_node_1.nodePathToUuid)(sceneContext, ref.nodePath);
}
/** 將 Editor 錯誤轉為契約錯誤碼 */
function toContractError(e) {
    if (e && typeof e === 'object' && 'code' in e && typeof e.code === 'string') {
        const code = e.code;
        if (code === 'INVALID_PARAMS')
            return { code: 'INVALID_PARAMS', message: 'Invalid or missing parameters' };
        if (code === 'ASSET_NOT_FOUND' ||
            code === 'ENOENT' ||
            (typeof e.message === 'string' && e.message.toLowerCase().includes('not found'))) {
            return { code: 'ASSET_NOT_FOUND', message: 'Asset or node not found' };
        }
    }
    return { code: 'SCENE_ERROR', message: 'Scene operation failed' };
}
/** 判斷 value 是否為資源路徑（db: / db:// / 專案相對路徑 assets/），需解析為 uuid。 */
function isAssetPathValue(value) {
    if (typeof value !== 'string' || value.trim() === '')
        return false;
    const s = value.trim();
    return s.startsWith('db:') || s.startsWith('db://') || s.startsWith('assets/');
}
/** 若 value 為物件且含 __uuid__，視為已是資源引用；否則若為資源路徑字串則解析為 { __uuid__ }；@node: 解析為節點引用。 */
async function normalizePropertyValue(value) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && '__uuid__' in value && typeof value.__uuid__ === 'string') {
        return value;
    }
    if (isAssetPathValue(value)) {
        const uuid = await (0, resolve_asset_1.resolveAssetPath)(value);
        return { __uuid__: uuid };
    }
    if (typeof value === 'string' && value.startsWith('@node:')) {
        const nodePath = value.slice(6).trim();
        if (nodePath === '') {
            const err = new Error('INVALID_PARAMS');
            err.code = 'INVALID_PARAMS';
            throw err;
        }
        const uuid = await (0, resolve_node_1.nodePathToUuid)(undefined, nodePath);
        return { __uuid__: uuid };
    }
    return value;
}
/**
 * 依 path（如 "name"、"__comps__.0.enabled"）取得 dump 內對應的巢狀物件。
 * 用於 set-property value 模式：取得 IProperty 後寫入 .value 再送 set-property。
 */
function getAtPath(obj, path) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length; i++) {
        if (current === null || current === undefined)
            return undefined;
        if (typeof current !== 'object' || Array.isArray(current))
            return undefined;
        const key = keys[i];
        const next = current[key];
        if (i === keys.length - 1) {
            return typeof next === 'object' && next !== null && !Array.isArray(next) ? next : undefined;
        }
        current = next;
    }
    return undefined;
}
/**
 * resolve-component：依節點與組件類名解析出組件 UUID。供 remove-component、set-property 等使用。
 * 先 query-node 取得節點 dump，再從 __comps__ 中依 type/cid/name 匹配取得組件 uuid。
 */
async function handleResolveComponent(params) {
    const parsed = (0, validate_1.requireResolveComponentParams)(params);
    const nodeUuid = await resolveNodeUuid(parsed);
    const Message = getEditorMessage();
    let nodeDump;
    try {
        nodeDump = (await Message.request('scene', 'query-node', nodeUuid));
    }
    catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message);
        err.code = code;
        throw err;
    }
    if (!nodeDump || typeof nodeDump !== 'object') {
        const err = new Error('Node not found');
        err.code = 'ASSET_NOT_FOUND';
        throw err;
    }
    const componentUuid = (0, component_path_1.getComponentUuid)(nodeDump, parsed.component);
    if (componentUuid == null) {
        const err = new Error(`Component "${parsed.component}" not found on node`);
        err.code = 'ASSET_NOT_FOUND';
        throw err;
    }
    return { uuid: componentUuid };
}
/**
 * create-component：在節點上建立組件。params 支援 uuid 或 nodePath 二選一（節點）。
 * Editor: Editor.Message.request('scene', 'create-component', { uuid, component })
 */
async function handleCreateComponent(params) {
    const parsed = (0, validate_1.requireCreateComponentParams)(params);
    const uuid = await resolveNodeUuid(parsed);
    const Message = getEditorMessage();
    try {
        await Message.request('scene', 'create-component', { uuid, component: parsed.component });
        (0, auto_save_1.saveSceneAfterEdit)();
        return {};
    }
    catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message);
        err.code = code;
        throw err;
    }
}
/**
 * remove-component：依組件 UUID，或 nodePath|節點 uuid + 組件類名移除組件。
 * Editor: Editor.Message.request('scene', 'remove-component', { uuid })
 */
async function handleRemoveComponent(params) {
    const parsed = (0, validate_1.requireRemoveComponentParams)(params);
    const Message = getEditorMessage();
    let componentUuid;
    if ('component' in parsed) {
        const nodeRef = parsed;
        const nodeUuid = await resolveNodeUuid(nodeRef);
        let nodeDump;
        try {
            nodeDump = (await Message.request('scene', 'query-node', nodeUuid));
        }
        catch (e) {
            const { code, message } = toContractError(e);
            const err = new Error(message);
            err.code = code;
            throw err;
        }
        if (!nodeDump || typeof nodeDump !== 'object') {
            const err = new Error('Node not found');
            err.code = 'ASSET_NOT_FOUND';
            throw err;
        }
        const cu = (0, component_path_1.getComponentUuid)(nodeDump, nodeRef.component);
        if (cu == null) {
            const err = new Error(`Component "${nodeRef.component}" not found on node`);
            err.code = 'ASSET_NOT_FOUND';
            throw err;
        }
        componentUuid = cu;
    }
    else {
        componentUuid = parsed.uuid;
    }
    try {
        await Message.request('scene', 'remove-component', { uuid: componentUuid });
        (0, auto_save_1.saveSceneAfterEdit)();
        return {};
    }
    catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message);
        err.code = code;
        throw err;
    }
}
/**
 * create-node：建立節點，回傳新節點 uuid。params 可含 uuid 或 nodePath（parent）二選一。
 * Editor: Editor.Message.request('scene', 'create-node', options) → string
 */
async function handleCreateNode(params) {
    const parsed = (0, validate_1.requireCreateNodeParams)(params);
    const options = Object.assign({}, parsed);
    if ('nodePath' in parsed && parsed.nodePath !== undefined) {
        options.parent = await (0, resolve_node_1.nodePathToUuid)(undefined, parsed.nodePath);
        delete options.nodePath;
        delete options.uuid;
    }
    else if ('uuid' in parsed && parsed.uuid !== undefined) {
        options.parent = parsed.uuid;
        delete options.uuid;
    }
    const Message = getEditorMessage();
    try {
        const uuid = await Message.request('scene', 'create-node', options);
        (0, auto_save_1.saveSceneAfterEdit)();
        return { uuid: typeof uuid === 'string' ? uuid : String(uuid) };
    }
    catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message);
        err.code = code;
        throw err;
    }
}
/**
 * remove-node：移除節點（單一或陣列）。params 支援 uuid（單一或陣列）或 nodePath 二選一。
 * Editor: Editor.Message.request('scene', 'remove-node', { uuid, keepWorldTransform? })
 */
async function handleRemoveNode(params) {
    const parsed = (0, validate_1.requireRemoveNodeParams)(params);
    const Message = getEditorMessage();
    let uuid;
    if ('nodePath' in parsed) {
        uuid = await (0, resolve_node_1.nodePathToUuid)(undefined, parsed.nodePath);
    }
    else {
        uuid = parsed.uuid;
    }
    const keepWorldTransform = parsed.keepWorldTransform;
    try {
        await Message.request('scene', 'remove-node', Object.assign({ uuid }, (typeof keepWorldTransform === 'boolean' ? { keepWorldTransform } : {})));
        (0, auto_save_1.saveSceneAfterEdit)();
        return {};
    }
    catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message);
        err.code = code;
        throw err;
    }
}
function normalizePathSeg(p) {
    return p.replace(/\\/g, '/').replace(/\/+/g, '/').trim().replace(/^\//, '') || 'Root';
}
function parentPathFromNodePath(nodePath) {
    const n = normalizePathSeg(nodePath);
    const i = n.lastIndexOf('/');
    if (i <= 0)
        return null;
    return n.slice(0, i);
}
async function resolveParentUuidForDuplicate(Message, sourceUuid) {
    const rawTree = await Message.request('scene', 'query-node-tree');
    const { flat } = (0, node_tree_normalize_1.normalizeTree)(rawTree, {});
    const item = flat.find((n) => n.uuid === sourceUuid);
    if (!item) {
        return undefined;
    }
    const pp = parentPathFromNodePath(item.path);
    if (pp == null) {
        return undefined;
    }
    const p = flat.find((n) => normalizePathSeg(n.path) === normalizePathSeg(pp));
    return p === null || p === void 0 ? void 0 : p.uuid;
}
/**
 * node.duplicate：copy-node + paste-node。若 Editor 未暴露對應 API 則拋出明確 SCENE_ERROR。
 */
async function handleNodeDuplicate(params) {
    var _a;
    const parsed = (0, validate_1.requireNodeDuplicateParams)(params);
    const Message = getEditorMessage();
    const sourceUuid = await resolveNodeUuid(parsed.source);
    let parentUuid;
    if (parsed.parent) {
        parentUuid = await resolveNodeUuid(parsed.parent);
    }
    else {
        parentUuid = await resolveParentUuidForDuplicate(Message, sourceUuid);
    }
    try {
        await Message.request('scene', 'copy-node', { uuid: sourceUuid });
    }
    catch (e) {
        const hint = e instanceof Error ? e.message : String(e);
        const err = new Error(`node.duplicate requires Editor scene.copy-node API. If this fails, your Creator version may not support non-interactive copy/paste: ${hint}`);
        err.code = 'SCENE_ERROR';
        throw err;
    }
    const pasteOpts = {};
    if (parentUuid !== undefined) {
        pasteOpts.parent = parentUuid;
    }
    if (parsed.name !== undefined) {
        pasteOpts.name = parsed.name;
    }
    let newUuid;
    try {
        newUuid = await Message.request('scene', 'paste-node', pasteOpts);
    }
    catch (e) {
        const hint = e instanceof Error ? e.message : String(e);
        const err = new Error(`node.duplicate paste-node failed: ${hint}`);
        err.code = 'SCENE_ERROR';
        throw err;
    }
    const newId = typeof newUuid === 'string' ? newUuid : String(newUuid);
    const rawAfter = await Message.request('scene', 'query-node-tree');
    const { flat } = (0, node_tree_normalize_1.normalizeTree)(rawAfter, {});
    const newItem = flat.find((n) => n.uuid === newId);
    (0, auto_save_1.saveSceneAfterEdit)();
    if (!newItem) {
        return { uuid: newId, path: '', name: (_a = parsed.name) !== null && _a !== void 0 ? _a : '' };
    }
    return { uuid: newId, path: newItem.path, name: newItem.name };
}
/**
 * set-property：寫入屬性。params 支援 uuid 或 nodePath 二選一。dump 模式直接轉交；value 模式先 query-node 取 dump，於 path 處設 .value 再送 set-property。
 * Editor: Editor.Message.request('scene', 'set-property', { uuid, path, dump, record? })
 */
async function handleSetProperty(params) {
    const parsed = (0, validate_1.requireSetPropertyParams)(params);
    const uuid = await resolveNodeUuid(parsed);
    const { path, dump, value, record } = parsed;
    const Message = getEditorMessage();
    const needNodeDumpForPath = isTypePath(path);
    const needNodeDumpForValue = dump === undefined;
    let nodeDump = null;
    if (needNodeDumpForPath || needNodeDumpForValue) {
        const raw = await Message.request('scene', 'query-node', uuid);
        if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
            const err = new Error('Node not found or invalid dump');
            err.code = 'ASSET_NOT_FOUND';
            throw err;
        }
        nodeDump = raw;
    }
    let pathToUse = path;
    if (needNodeDumpForPath && nodeDump) {
        const resolved = resolvePathIfTypePath(nodeDump, path);
        if (resolved === null) {
            const err = new Error('Component not found for type path: ' + path);
            err.code = 'ASSET_NOT_FOUND';
            throw err;
        }
        pathToUse = resolved;
    }
    let finalDump;
    if (dump !== undefined) {
        finalDump = dump;
    }
    else {
        // value 模式：若 value 為資源路徑（db: / db:// / assets/）先解析為 { __uuid__ }；若已是 { __uuid__ } 保持不變
        const resolvedValue = await normalizePropertyValue(value);
        const prop = getAtPath(nodeDump, pathToUse);
        finalDump = prop ? Object.assign(Object.assign({}, prop), { value: resolvedValue }) : { value: resolvedValue };
    }
    try {
        const result = await Message.request('scene', 'set-property', Object.assign({ uuid, path: pathToUse, dump: finalDump }, (typeof record === 'boolean' ? { record } : {})));
        (0, auto_save_1.saveSceneAfterEdit)();
        return { success: result === true };
    }
    catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message);
        err.code = code;
        throw err;
    }
}
/**
 * reset-property：重置屬性。params 支援 uuid 或 nodePath 二選一，path 必填；可選 dump、record。
 * Editor: Editor.Message.request('scene', 'reset-property', options)
 */
async function handleResetProperty(params) {
    const parsed = (0, validate_1.requireResetPropertyParams)(params);
    const uuid = await resolveNodeUuid(parsed);
    const { path, dump, record } = parsed;
    const Message = getEditorMessage();
    let pathToUse = path;
    if (isTypePath(path)) {
        const raw = await Message.request('scene', 'query-node', uuid);
        if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
            const err = new Error('Node not found or invalid dump');
            err.code = 'ASSET_NOT_FOUND';
            throw err;
        }
        const resolved = resolvePathIfTypePath(raw, path);
        if (resolved === null) {
            const err = new Error('Component not found for type path: ' + path);
            err.code = 'ASSET_NOT_FOUND';
            throw err;
        }
        pathToUse = resolved;
    }
    try {
        const options = { uuid, path: pathToUse };
        if (dump !== undefined)
            options.dump = dump;
        if (typeof record === 'boolean')
            options.record = record;
        const result = await Message.request('scene', 'reset-property', options);
        (0, auto_save_1.saveSceneAfterEdit)();
        return { success: result === true };
    }
    catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message);
        err.code = code;
        throw err;
    }
}
/**
 * scene.open：開啟場景/prefab。params 為 uuid 或 assetPath 二選一；assetPath 可為 db:、db:// 或專案相對路徑，經 resolveAssetPath 解析為 uuid 後呼叫 Editor.Message.request('scene', 'open-scene', uuid)。
 */
async function handleSceneOpen(params) {
    const parsed = (0, validate_1.requireSceneOpenParams)(params);
    let uuid;
    if ('uuid' in parsed) {
        uuid = parsed.uuid;
    }
    else {
        uuid = await (0, resolve_asset_1.resolveAssetPath)(parsed.assetPath);
    }
    const Message = getEditorMessage();
    try {
        await Message.request('scene', 'open-scene', uuid);
        return {};
    }
    catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message);
        err.code = code;
        throw err;
    }
}
/**
 * scene.query-current：查詢當前 focus 的場景/prefab。無 params。
 * 回傳 { uuid, type?, dirty? }。dirty 透過 Editor.Message.request('scene', 'query-dirty') 取得；
 * uuid/type 目前無直接 Editor Message，回傳 null，待 Editor 暴露後可補上。
 */
async function handleSceneQueryCurrent(_params) {
    const Message = getEditorMessage();
    let dirty;
    try {
        dirty = await Message.request('scene', 'query-dirty');
    }
    catch (_a) {
        // query-dirty 可能不存在或失敗，略過
    }
    // 目前 scene 模組無 query 當前 focus 的 scene/prefab uuid 的 Message，uuid/type 回傳 null
    return {
        uuid: null,
        dirty,
    };
}
/**
 * scene.create：建立新場景資源。params：assetPath（必填）、open?（可選，建立後是否開啟）。
 * 使用 asset-db create-asset 建立空 .scene 檔；若 open 為 true 則再呼叫 open-scene。
 * result: { uuid: string }。若 Editor 無直接 create-scene Message，則以建立空場景檔方式實作。
 */
async function handleSceneCreate(params) {
    const parsed = (0, validate_1.requireSceneCreateParams)(params);
    const url = (0, resolve_asset_1.assetPathToSceneUrl)(parsed.assetPath);
    const Message = getEditorMessage();
    try {
        // Editor 未暴露「新建場景」Message，使用 asset-db create-asset 建立空 .scene 檔
        const minimalSceneContent = JSON.stringify({ __type__: 'cc.SceneAsset', _objFlags: 0 });
        const info = await Message.request('asset-db', 'create-asset', url, minimalSceneContent);
        if (!info || typeof info.uuid !== 'string') {
            const err = new Error('Scene create failed or Editor API not available (待 Editor 暴露)');
            err.code = 'SCENE_ERROR';
            throw err;
        }
        const uuid = info.uuid;
        if (parsed.open === true) {
            await Message.request('scene', 'open-scene', uuid);
        }
        return { uuid };
    }
    catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message);
        err.code = code;
        throw err;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUtaGFuZGxlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvYnJpZGdlL3NjZW5lLWhhbmRsZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHOztBQStISCx3REF5QkM7QUFNRCxzREFjQztBQU1ELHNEQXlDQztBQU1ELDRDQXNCQztBQU1ELDRDQW9CQztBQWtDRCxrREE2Q0M7QUFNRCw4Q0F3REM7QUFNRCxrREFvQ0M7QUFLRCwwQ0FrQkM7QUFjRCwwREFhQztBQU9ELDhDQXdCQztBQXZoQkQsMkNBQWlEO0FBQ2pELHFEQUFtRztBQUNuRywrREFBc0Q7QUFDdEQsbURBQXdFO0FBQ3hFLGlEQUFnRDtBQUVoRCx5Q0FXb0I7QUFRcEIsU0FBUyxnQkFBZ0I7SUFDckIsTUFBTSxDQUFDLEdBQUksVUFBa0IsQ0FBQyxNQUFNLENBQUM7SUFDckMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sS0FBSyxVQUFVLEVBQUUsQ0FBQztRQUM5RCxNQUFNLEdBQUcsR0FBRyxJQUFJLEtBQUssQ0FBQyw4QkFBOEIsQ0FBOEIsQ0FBQztRQUNuRixHQUFHLENBQUMsSUFBSSxHQUFHLGFBQWEsQ0FBQztRQUN6QixNQUFNLEdBQUcsQ0FBQztJQUNkLENBQUM7SUFDRCxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFDckIsQ0FBQztBQUVELHdFQUF3RTtBQUN4RSxTQUFTLFVBQVUsQ0FBQyxJQUFZO0lBQzVCLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUN0QixPQUFPLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFBLHdDQUF1QixFQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzVFLENBQUM7QUFFRCw4RUFBOEU7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QUFPLEVBQUUsR0FBRyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDN0MsTUFBTSxHQUFHLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUE4QixDQUFDO1FBQzVELEdBQUcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2hCLE1BQU0sR0FBRyxDQUFDO0lBQ2QsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICog5aC05pmv56+A6bue5pON5L2c77yaY3JlYXRlLWNvbXBvbmVudOOAgXJlbW92ZS1jb21wb25lbnTjgIFjcmVhdGUtbm9kZeOAgXJlbW92ZS1ub2Rl44CBXHJcbiAqIHNldC1wcm9wZXJ0ee+8iHZhbHVlIC8gZHVtcO+8ieOAgXJlc2V0LXByb3BlcnR544CC5bCN5oeJIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgLi4uKeOAglxyXG4gKiDlsI3pvYogYmx1ZXByaW50IEFQSSDlpZHntIToiIcgQGNvY29zL2NyZWF0b3ItdHlwZXMg5LmLIENyZWF0ZUNvbXBvbmVudE9wdGlvbnPjgIFTZXRQcm9wZXJ0eU9wdGlvbnMg562J44CCXHJcbiAqL1xyXG5cclxuaW1wb3J0IHsgc2F2ZVNjZW5lQWZ0ZXJFZGl0IH0gZnJvbSAnLi9hdXRvLXNhdmUnO1xyXG5pbXBvcnQgeyBnZXRDb21wb25lbnRVdWlkLCBpc1Jlc29sdmVkQ29tcG9uZW50UGF0aCwgcmVzb2x2ZUNvbXBvbmVudFBhdGggfSBmcm9tICcuL2NvbXBvbmVudC1wYXRoJztcclxuaW1wb3J0IHsgbm9ybWFsaXplVHJlZSB9IGZyb20gJy4vbm9kZS10cmVlLW5vcm1hbGl6ZSc7XHJcbmltcG9ydCB7IHJlc29sdmVBc3NldFBhdGgsIGFzc2V0UGF0aFRvU2NlbmVVcmwgfSBmcm9tICcuL3Jlc29sdmUtYXNzZXQnO1xyXG5pbXBvcnQgeyBub2RlUGF0aFRvVXVpZCB9IGZyb20gJy4vcmVzb2x2ZS1ub2RlJztcclxuaW1wb3J0IHR5cGUgeyBOb2RlUmVmIH0gZnJvbSAnLi92YWxpZGF0ZSc7XHJcbmltcG9ydCB7XHJcbiAgICByZXF1aXJlQ3JlYXRlQ29tcG9uZW50UGFyYW1zLFxyXG4gICAgcmVxdWlyZUNyZWF0ZU5vZGVQYXJhbXMsXHJcbiAgICByZXF1aXJlTm9kZUR1cGxpY2F0ZVBhcmFtcyxcclxuICAgIHJlcXVpcmVSZW1vdmVDb21wb25lbnRQYXJhbXMsXHJcbiAgICByZXF1aXJlUmVzb2x2ZUNvbXBvbmVudFBhcmFtcyxcclxuICAgIHJlcXVpcmVSZW1vdmVOb2RlUGFyYW1zLFxyXG4gICAgcmVxdWlyZVJlc2V0UHJvcGVydHlQYXJhbXMsXHJcbiAgICByZXF1aXJlU2NlbmVDcmVhdGVQYXJhbXMsXHJcbiAgICByZXF1aXJlU2NlbmVPcGVuUGFyYW1zLFxyXG4gICAgcmVxdWlyZVNldFByb3BlcnR5UGFyYW1zLFxyXG59IGZyb20gJy4vdmFsaWRhdGUnO1xyXG5cclxuZGVjbGFyZSBjb25zdCBFZGl0b3I6IHtcclxuICAgIE1lc3NhZ2U6IHtcclxuICAgICAgICByZXF1ZXN0KG1vZHVsZTogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT47XHJcbiAgICB9O1xyXG59O1xyXG5cclxuZnVuY3Rpb24gZ2V0RWRpdG9yTWVzc2FnZSgpOiB7IHJlcXVlc3QobW9kdWxlOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8YW55PiB9IHtcclxuICAgIGNvbnN0IEUgPSAoZ2xvYmFsVGhpcyBhcyBhbnkpLkVkaXRvcjtcclxuICAgIGlmICghRSB8fCAhRS5NZXNzYWdlIHx8IHR5cGVvZiBFLk1lc3NhZ2UucmVxdWVzdCAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcignRWRpdG9yLk1lc3NhZ2Ugbm90IGF2YWlsYWJsZScpIGFzIEVycm9yICYgeyBjb2RlPzogc3RyaW5nIH07XHJcbiAgICAgICAgZXJyLmNvZGUgPSAnU0NFTkVfRVJST1InO1xyXG4gICAgICAgIHRocm93IGVycjtcclxuICAgIH1cclxuICAgIHJldHVybiBFLk1lc3NhZ2U7XHJcbn1cclxuXHJcbi8qKiDliKTmlrcgcGF0aCDmmK/lkKbngrrlnovliKUgcGF0aO+8iOWmgiBjYy5TcHJpdGUuc3ByaXRlRnJhbWXvvInvvIzpnIDlhYjop6PmnpDmiJAgX19jb21wc19fLk4ueHh4ICovXHJcbmZ1bmN0aW9uIGlzVHlwZVBhdGgocGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCBwID0gcGF0aC50cmltKCk7XHJcbiAgICByZXR1cm4gcC5sZW5ndGggPiAwICYmIHAuaW5jbHVkZXMoJ2NjLicpICYmICFpc1Jlc29sdmVkQ29tcG9uZW50UGF0aChwKTtcclxufVxyXG5cclxuLyoqIOiLpSBwYXRoIOeCuuWei+WIpSBwYXRoIOWJh+eUqCBub2RlRHVtcCDop6PmnpDngrogX19jb21wc19fLk4ueHh477yM5ZCm5YmH5Zue5YKz5Y6fIHBhdGjjgILop6PmnpDlpLHmlZflm57lgrMgbnVsbOOAgiAqL1xyXG5mdW5jdGlvbiByZXNvbHZlUGF0aElmVHlwZVBhdGgobm9kZUR1bXA6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LCBwYXRoOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIGlmICghaXNUeXBlUGF0aChwYXRoKSkgcmV0dXJuIHBhdGg7XHJcbiAgICByZXR1cm4gcmVzb2x2ZUNvbXBvbmVudFBhdGgobm9kZUR1bXAsIHBhdGgpO1xyXG59XHJcblxyXG4vKiog5bCH56+A6bue6K2Y5Yil77yIdXVpZCDmiJYgbm9kZVBhdGjvvInop6PmnpDngrogdXVpZO+8m+iLpeW3suaYryB1dWlkIOebtOaOpeWbnuWCs+OAgiAqL1xyXG5hc3luYyBmdW5jdGlvbiByZXNvbHZlTm9kZVV1aWQoXHJcbiAgICByZWY6IHsgdXVpZDogc3RyaW5nIH0gfCB7IG5vZGVQYXRoOiBzdHJpbmcgfSxcclxuICAgIHNjZW5lQ29udGV4dD86IHN0cmluZ1xyXG4pOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gICAgaWYgKCd1dWlkJyBpbiByZWYpIHJldHVybiByZWYudXVpZDtcclxuICAgIHJldHVybiBub2RlUGF0aFRvVXVpZChzY2VuZUNvbnRleHQsIHJlZi5ub2RlUGF0aCk7XHJcbn1cclxuXHJcbi8qKiDlsIcgRWRpdG9yIOmMr+iqpOi9ieeCuuWlkee0hOmMr+iqpOeivCAqL1xyXG5mdW5jdGlvbiB0b0NvbnRyYWN0RXJyb3IoZTogdW5rbm93bik6IHsgY29kZTogc3RyaW5nOyBtZXNzYWdlOiBzdHJpbmcgfSB7XHJcbiAgICBpZiAoZSAmJiB0eXBlb2YgZSA9PT0gJ29iamVjdCcgJiYgJ2NvZGUnIGluIGUgJiYgdHlwZW9mIChlIGFzIGFueSkuY29kZSA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICBjb25zdCBjb2RlID0gKGUgYXMgYW55KS5jb2RlO1xyXG4gICAgICAgIGlmIChjb2RlID09PSAnSU5WQUxJRF9QQVJBTVMnKSByZXR1cm4geyBjb2RlOiAnSU5WQUxJRF9QQVJBTVMnLCBtZXNzYWdlOiAnSW52YWxpZCBvciBtaXNzaW5nIHBhcmFtZXRlcnMnIH07XHJcbiAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICBjb2RlID09PSAnQVNTRVRfTk9UX0ZPVU5EJyB8fFxyXG4gICAgICAgICAgICBjb2RlID09PSAnRU5PRU5UJyB8fFxyXG4gICAgICAgICAgICAodHlwZW9mIChlIGFzIGFueSkubWVzc2FnZSA9PT0gJ3N0cmluZycgJiYgKChlIGFzIGFueSkubWVzc2FnZSBhcyBzdHJpbmcpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ25vdCBmb3VuZCcpKVxyXG4gICAgICAgICkge1xyXG4gICAgICAgICAgICByZXR1cm4geyBjb2RlOiAnQVNTRVRfTk9UX0ZPVU5EJywgbWVzc2FnZTogJ0Fzc2V0IG9yIG5vZGUgbm90IGZvdW5kJyB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB7IGNvZGU6ICdTQ0VORV9FUlJPUicsIG1lc3NhZ2U6ICdTY2VuZSBvcGVyYXRpb24gZmFpbGVkJyB9O1xyXG59XHJcblxyXG4vKiog5Yik5pa3IHZhbHVlIOaYr+WQpueCuuizh+a6kOi3r+W+ke+8iGRiOiAvIGRiOi8vIC8g5bCI5qGI55u45bCN6Lev5b6RIGFzc2V0cy/vvInvvIzpnIDop6PmnpDngrogdXVpZOOAgiAqL1xyXG5mdW5jdGlvbiBpc0Fzc2V0UGF0aFZhbHVlKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgc3RyaW5nIHtcclxuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnIHx8IHZhbHVlLnRyaW0oKSA9PT0gJycpIHJldHVybiBmYWxzZTtcclxuICAgIGNvbnN0IHMgPSB2YWx1ZS50cmltKCk7XHJcbiAgICByZXR1cm4gcy5zdGFydHNXaXRoKCdkYjonKSB8fCBzLnN0YXJ0c1dpdGgoJ2RiOi8vJykgfHwgcy5zdGFydHNXaXRoKCdhc3NldHMvJyk7XHJcbn1cclxuXHJcbi8qKiDoi6UgdmFsdWUg54K654mp5Lu25LiU5ZCrIF9fdXVpZF9f77yM6KaW54K65bey5piv6LOH5rqQ5byV55So77yb5ZCm5YmH6Iul54K66LOH5rqQ6Lev5b6R5a2X5Liy5YmH6Kej5p6Q54K6IHsgX191dWlkX18gfe+8m0Bub2RlOiDop6PmnpDngrrnr4Dpu57lvJXnlKjjgIIgKi9cclxuYXN5bmMgZnVuY3Rpb24gbm9ybWFsaXplUHJvcGVydHlWYWx1ZSh2YWx1ZTogdW5rbm93bik6IFByb21pc2U8dW5rbm93bj4ge1xyXG4gICAgaWYgKHZhbHVlICE9PSBudWxsICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkodmFsdWUpICYmICdfX3V1aWRfXycgaW4gdmFsdWUgJiYgdHlwZW9mICh2YWx1ZSBhcyB7IF9fdXVpZF9fPzogdW5rbm93biB9KS5fX3V1aWRfXyA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICByZXR1cm4gdmFsdWU7XHJcbiAgICB9XHJcbiAgICBpZiAoaXNBc3NldFBhdGhWYWx1ZSh2YWx1ZSkpIHtcclxuICAgICAgICBjb25zdCB1dWlkID0gYXdhaXQgcmVzb2x2ZUFzc2V0UGF0aCh2YWx1ZSk7XHJcbiAgICAgICAgcmV0dXJuIHsgX191dWlkX186IHV1aWQgfTtcclxuICAgIH1cclxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmIHZhbHVlLnN0YXJ0c1dpdGgoJ0Bub2RlOicpKSB7XHJcbiAgICAgICAgY29uc3Qgbm9kZVBhdGggPSB2YWx1ZS5zbGljZSg2KS50cmltKCk7XHJcbiAgICAgICAgaWYgKG5vZGVQYXRoID09PSAnJykge1xyXG4gICAgICAgICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoJ0lOVkFMSURfUEFSQU1TJykgYXMgRXJyb3IgJiB7IGNvZGU/OiBzdHJpbmcgfTtcclxuICAgICAgICAgICAgZXJyLmNvZGUgPSAnSU5WQUxJRF9QQVJBTVMnO1xyXG4gICAgICAgICAgICB0aHJvdyBlcnI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IHV1aWQgPSBhd2FpdCBub2RlUGF0aFRvVXVpZCh1bmRlZmluZWQsIG5vZGVQYXRoKTtcclxuICAgICAgICByZXR1cm4geyBfX3V1aWRfXzogdXVpZCB9O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHZhbHVlO1xyXG59XHJcblxyXG4vKipcclxuICog5L6dIHBhdGjvvIjlpoIgXCJuYW1lXCLjgIFcIl9fY29tcHNfXy4wLmVuYWJsZWRcIu+8ieWPluW+lyBkdW1wIOWFp+WwjeaHieeahOW3oueLgOeJqeS7tuOAglxyXG4gKiDnlKjmlrwgc2V0LXByb3BlcnR5IHZhbHVlIOaooeW8j++8muWPluW+lyBJUHJvcGVydHkg5b6M5a+r5YWlIC52YWx1ZSDlho3pgIEgc2V0LXByb3BlcnR544CCXHJcbiAqL1xyXG5mdW5jdGlvbiBnZXRBdFBhdGgob2JqOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiwgcGF0aDogc3RyaW5nKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCB1bmRlZmluZWQge1xyXG4gICAgY29uc3Qga2V5cyA9IHBhdGguc3BsaXQoJy4nKTtcclxuICAgIGxldCBjdXJyZW50OiB1bmtub3duID0gb2JqO1xyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgaWYgKGN1cnJlbnQgPT09IG51bGwgfHwgY3VycmVudCA9PT0gdW5kZWZpbmVkKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgICAgIGlmICh0eXBlb2YgY3VycmVudCAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShjdXJyZW50KSkgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgICAgICBjb25zdCBrZXkgPSBrZXlzW2ldO1xyXG4gICAgICAgIGNvbnN0IG5leHQgPSAoY3VycmVudCBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPilba2V5XTtcclxuICAgICAgICBpZiAoaSA9PT0ga2V5cy5sZW5ndGggLSAxKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0eXBlb2YgbmV4dCA9PT0gJ29iamVjdCcgJiYgbmV4dCAhPT0gbnVsbCAmJiAhQXJyYXkuaXNBcnJheShuZXh0KSA/IChuZXh0IGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA6IHVuZGVmaW5lZDtcclxuICAgICAgICB9XHJcbiAgICAgICAgY3VycmVudCA9IG5leHQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG59XHJcblxyXG4vKipcclxuICogcmVzb2x2ZS1jb21wb25lbnTvvJrkvp3nr4Dpu57oiIfntYTku7bpoZ7lkI3op6PmnpDlh7rntYTku7YgVVVJROOAguS+myByZW1vdmUtY29tcG9uZW5044CBc2V0LXByb3BlcnR5IOetieS9v+eUqOOAglxyXG4gKiDlhYggcXVlcnktbm9kZSDlj5blvpfnr4Dpu54gZHVtcO+8jOWGjeW+niBfX2NvbXBzX18g5Lit5L6dIHR5cGUvY2lkL25hbWUg5Yy56YWN5Y+W5b6X57WE5Lu2IHV1aWTjgIJcclxuICovXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBoYW5kbGVSZXNvbHZlQ29tcG9uZW50KHBhcmFtczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBQcm9taXNlPHsgdXVpZDogc3RyaW5nIH0+IHtcclxuICAgIGNvbnN0IHBhcnNlZCA9IHJlcXVpcmVSZXNvbHZlQ29tcG9uZW50UGFyYW1zKHBhcmFtcyk7XHJcbiAgICBjb25zdCBub2RlVXVpZCA9IGF3YWl0IHJlc29sdmVOb2RlVXVpZChwYXJzZWQpO1xyXG4gICAgY29uc3QgTWVzc2FnZSA9IGdldEVkaXRvck1lc3NhZ2UoKTtcclxuICAgIGxldCBub2RlRHVtcDogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XHJcbiAgICB0cnkge1xyXG4gICAgICAgIG5vZGVEdW1wID0gKGF3YWl0IE1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGVVdWlkKSkgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgY29uc3QgeyBjb2RlLCBtZXNzYWdlIH0gPSB0b0NvbnRyYWN0RXJyb3IoZSk7XHJcbiAgICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UpIGFzIEVycm9yICYgeyBjb2RlPzogc3RyaW5nIH07XHJcbiAgICAgICAgZXJyLmNvZGUgPSBjb2RlO1xyXG4gICAgICAgIHRocm93IGVycjtcclxuICAgIH1cclxuICAgIGlmICghbm9kZUR1bXAgfHwgdHlwZW9mIG5vZGVEdW1wICE9PSAnb2JqZWN0Jykge1xyXG4gICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcignTm9kZSBub3QgZm91bmQnKSBhcyBFcnJvciAmIHsgY29kZT86IHN0cmluZyB9O1xyXG4gICAgICAgIGVyci5jb2RlID0gJ0FTU0VUX05PVF9GT1VORCc7XHJcbiAgICAgICAgdGhyb3cgZXJyO1xyXG4gICAgfVxyXG4gICAgY29uc3QgY29tcG9uZW50VXVpZCA9IGdldENvbXBvbmVudFV1aWQobm9kZUR1bXAsIHBhcnNlZC5jb21wb25lbnQpO1xyXG4gICAgaWYgKGNvbXBvbmVudFV1aWQgPT0gbnVsbCkge1xyXG4gICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgQ29tcG9uZW50IFwiJHtwYXJzZWQuY29tcG9uZW50fVwiIG5vdCBmb3VuZCBvbiBub2RlYCkgYXMgRXJyb3IgJiB7IGNvZGU/OiBzdHJpbmcgfTtcclxuICAgICAgICBlcnIuY29kZSA9ICdBU1NFVF9OT1RfRk9VTkQnO1xyXG4gICAgICAgIHRocm93IGVycjtcclxuICAgIH1cclxuICAgIHJldHVybiB7IHV1aWQ6IGNvbXBvbmVudFV1aWQgfTtcclxufVxyXG5cclxuLyoqXHJcbiAqIGNyZWF0ZS1jb21wb25lbnTvvJrlnKjnr4Dpu57kuIrlu7rnq4vntYTku7bjgIJwYXJhbXMg5pSv5o+0IHV1aWQg5oiWIG5vZGVQYXRoIOS6jOmBuOS4gO+8iOevgOm7nu+8ieOAglxyXG4gKiBFZGl0b3I6IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NyZWF0ZS1jb21wb25lbnQnLCB7IHV1aWQsIGNvbXBvbmVudCB9KVxyXG4gKi9cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZUNyZWF0ZUNvbXBvbmVudChwYXJhbXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTxudWxsIHwgUmVjb3JkPHN0cmluZywgbmV2ZXI+PiB7XHJcbiAgICBjb25zdCBwYXJzZWQgPSByZXF1aXJlQ3JlYXRlQ29tcG9uZW50UGFyYW1zKHBhcmFtcyk7XHJcbiAgICBjb25zdCB1dWlkID0gYXdhaXQgcmVzb2x2ZU5vZGVVdWlkKHBhcnNlZCk7XHJcbiAgICBjb25zdCBNZXNzYWdlID0gZ2V0RWRpdG9yTWVzc2FnZSgpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICBhd2FpdCBNZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NyZWF0ZS1jb21wb25lbnQnLCB7IHV1aWQsIGNvbXBvbmVudDogcGFyc2VkLmNvbXBvbmVudCB9KTtcclxuICAgICAgICBzYXZlU2NlbmVBZnRlckVkaXQoKTtcclxuICAgICAgICByZXR1cm4ge307XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgY29uc3QgeyBjb2RlLCBtZXNzYWdlIH0gPSB0b0NvbnRyYWN0RXJyb3IoZSk7XHJcbiAgICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UpIGFzIEVycm9yICYgeyBjb2RlPzogc3RyaW5nIH07XHJcbiAgICAgICAgZXJyLmNvZGUgPSBjb2RlO1xyXG4gICAgICAgIHRocm93IGVycjtcclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIHJlbW92ZS1jb21wb25lbnTvvJrkvp3ntYTku7YgVVVJRO+8jOaIliBub2RlUGF0aHznr4Dpu54gdXVpZCArIOe1hOS7tumhnuWQjeenu+mZpOe1hOS7tuOAglxyXG4gKiBFZGl0b3I6IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3JlbW92ZS1jb21wb25lbnQnLCB7IHV1aWQgfSlcclxuICovXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBoYW5kbGVSZW1vdmVDb21wb25lbnQocGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IFByb21pc2U8bnVsbCB8IFJlY29yZDxzdHJpbmcsIG5ldmVyPj4ge1xyXG4gICAgY29uc3QgcGFyc2VkID0gcmVxdWlyZVJlbW92ZUNvbXBvbmVudFBhcmFtcyhwYXJhbXMpO1xyXG4gICAgY29uc3QgTWVzc2FnZSA9IGdldEVkaXRvck1lc3NhZ2UoKTtcclxuICAgIGxldCBjb21wb25lbnRVdWlkOiBzdHJpbmc7XHJcbiAgICBpZiAoJ2NvbXBvbmVudCcgaW4gcGFyc2VkKSB7XHJcbiAgICAgICAgY29uc3Qgbm9kZVJlZiA9IHBhcnNlZCBhcyBOb2RlUmVmICYgeyBjb21wb25lbnQ6IHN0cmluZyB9O1xyXG4gICAgICAgIGNvbnN0IG5vZGVVdWlkID0gYXdhaXQgcmVzb2x2ZU5vZGVVdWlkKG5vZGVSZWYpO1xyXG4gICAgICAgIGxldCBub2RlRHVtcDogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgbm9kZUR1bXAgPSAoYXdhaXQgTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpKSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcclxuICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHsgY29kZSwgbWVzc2FnZSB9ID0gdG9Db250cmFjdEVycm9yKGUpO1xyXG4gICAgICAgICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IobWVzc2FnZSkgYXMgRXJyb3IgJiB7IGNvZGU/OiBzdHJpbmcgfTtcclxuICAgICAgICAgICAgZXJyLmNvZGUgPSBjb2RlO1xyXG4gICAgICAgICAgICB0aHJvdyBlcnI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghbm9kZUR1bXAgfHwgdHlwZW9mIG5vZGVEdW1wICE9PSAnb2JqZWN0Jykge1xyXG4gICAgICAgICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoJ05vZGUgbm90IGZvdW5kJykgYXMgRXJyb3IgJiB7IGNvZGU/OiBzdHJpbmcgfTtcclxuICAgICAgICAgICAgZXJyLmNvZGUgPSAnQVNTRVRfTk9UX0ZPVU5EJztcclxuICAgICAgICAgICAgdGhyb3cgZXJyO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBjdSA9IGdldENvbXBvbmVudFV1aWQobm9kZUR1bXAsIG5vZGVSZWYuY29tcG9uZW50KTtcclxuICAgICAgICBpZiAoY3UgPT0gbnVsbCkge1xyXG4gICAgICAgICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoYENvbXBvbmVudCBcIiR7bm9kZVJlZi5jb21wb25lbnR9XCIgbm90IGZvdW5kIG9uIG5vZGVgKSBhcyBFcnJvciAmIHsgY29kZT86IHN0cmluZyB9O1xyXG4gICAgICAgICAgICBlcnIuY29kZSA9ICdBU1NFVF9OT1RfRk9VTkQnO1xyXG4gICAgICAgICAgICB0aHJvdyBlcnI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbXBvbmVudFV1aWQgPSBjdTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29tcG9uZW50VXVpZCA9IChwYXJzZWQgYXMgeyB1dWlkOiBzdHJpbmcgfSkudXVpZDtcclxuICAgIH1cclxuICAgIHRyeSB7XHJcbiAgICAgICAgYXdhaXQgTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdyZW1vdmUtY29tcG9uZW50JywgeyB1dWlkOiBjb21wb25lbnRVdWlkIH0pO1xyXG4gICAgICAgIHNhdmVTY2VuZUFmdGVyRWRpdCgpO1xyXG4gICAgICAgIHJldHVybiB7fTtcclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICBjb25zdCB7IGNvZGUsIG1lc3NhZ2UgfSA9IHRvQ29udHJhY3RFcnJvcihlKTtcclxuICAgICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IobWVzc2FnZSkgYXMgRXJyb3IgJiB7IGNvZGU/OiBzdHJpbmcgfTtcclxuICAgICAgICBlcnIuY29kZSA9IGNvZGU7XHJcbiAgICAgICAgdGhyb3cgZXJyO1xyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogY3JlYXRlLW5vZGXvvJrlu7rnq4vnr4Dpu57vvIzlm57lgrPmlrDnr4Dpu54gdXVpZOOAgnBhcmFtcyDlj6/lkKsgdXVpZCDmiJYgbm9kZVBhdGjvvIhwYXJlbnTvvInkuozpgbjkuIDjgIJcclxuICogRWRpdG9yOiBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjcmVhdGUtbm9kZScsIG9wdGlvbnMpIOKGkiBzdHJpbmdcclxuICovXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBoYW5kbGVDcmVhdGVOb2RlKHBhcmFtczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBQcm9taXNlPHsgdXVpZDogc3RyaW5nIH0+IHtcclxuICAgIGNvbnN0IHBhcnNlZCA9IHJlcXVpcmVDcmVhdGVOb2RlUGFyYW1zKHBhcmFtcyk7XHJcbiAgICBjb25zdCBvcHRpb25zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHsgLi4ucGFyc2VkIH07XHJcbiAgICBpZiAoJ25vZGVQYXRoJyBpbiBwYXJzZWQgJiYgcGFyc2VkLm5vZGVQYXRoICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICBvcHRpb25zLnBhcmVudCA9IGF3YWl0IG5vZGVQYXRoVG9VdWlkKHVuZGVmaW5lZCwgcGFyc2VkLm5vZGVQYXRoIGFzIHN0cmluZyk7XHJcbiAgICAgICAgZGVsZXRlIG9wdGlvbnMubm9kZVBhdGg7XHJcbiAgICAgICAgZGVsZXRlIG9wdGlvbnMudXVpZDtcclxuICAgIH0gZWxzZSBpZiAoJ3V1aWQnIGluIHBhcnNlZCAmJiBwYXJzZWQudXVpZCAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgb3B0aW9ucy5wYXJlbnQgPSBwYXJzZWQudXVpZCBhcyBzdHJpbmc7XHJcbiAgICAgICAgZGVsZXRlIG9wdGlvbnMudXVpZDtcclxuICAgIH1cclxuICAgIGNvbnN0IE1lc3NhZ2UgPSBnZXRFZGl0b3JNZXNzYWdlKCk7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHV1aWQgPSBhd2FpdCBNZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NyZWF0ZS1ub2RlJywgb3B0aW9ucyk7XHJcbiAgICAgICAgc2F2ZVNjZW5lQWZ0ZXJFZGl0KCk7XHJcbiAgICAgICAgcmV0dXJuIHsgdXVpZDogdHlwZW9mIHV1aWQgPT09ICdzdHJpbmcnID8gdXVpZCA6IFN0cmluZyh1dWlkKSB9O1xyXG4gICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIGNvbnN0IHsgY29kZSwgbWVzc2FnZSB9ID0gdG9Db250cmFjdEVycm9yKGUpO1xyXG4gICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihtZXNzYWdlKSBhcyBFcnJvciAmIHsgY29kZT86IHN0cmluZyB9O1xyXG4gICAgICAgIGVyci5jb2RlID0gY29kZTtcclxuICAgICAgICB0aHJvdyBlcnI7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiByZW1vdmUtbm9kZe+8muenu+mZpOevgOm7nu+8iOWWruS4gOaIlumZo+WIl++8ieOAgnBhcmFtcyDmlK/mj7QgdXVpZO+8iOWWruS4gOaIlumZo+WIl++8ieaIliBub2RlUGF0aCDkuozpgbjkuIDjgIJcclxuICogRWRpdG9yOiBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdyZW1vdmUtbm9kZScsIHsgdXVpZCwga2VlcFdvcmxkVHJhbnNmb3JtPyB9KVxyXG4gKi9cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZVJlbW92ZU5vZGUocGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IFByb21pc2U8bnVsbCB8IFJlY29yZDxzdHJpbmcsIG5ldmVyPj4ge1xyXG4gICAgY29uc3QgcGFyc2VkID0gcmVxdWlyZVJlbW92ZU5vZGVQYXJhbXMocGFyYW1zKTtcclxuICAgIGNvbnN0IE1lc3NhZ2UgPSBnZXRFZGl0b3JNZXNzYWdlKCk7XHJcbiAgICBsZXQgdXVpZDogc3RyaW5nIHwgc3RyaW5nW107XHJcbiAgICBpZiAoJ25vZGVQYXRoJyBpbiBwYXJzZWQpIHtcclxuICAgICAgICB1dWlkID0gYXdhaXQgbm9kZVBhdGhUb1V1aWQodW5kZWZpbmVkLCBwYXJzZWQubm9kZVBhdGgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICB1dWlkID0gcGFyc2VkLnV1aWQ7XHJcbiAgICB9XHJcbiAgICBjb25zdCBrZWVwV29ybGRUcmFuc2Zvcm0gPSBwYXJzZWQua2VlcFdvcmxkVHJhbnNmb3JtO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICBhd2FpdCBNZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3JlbW92ZS1ub2RlJywgeyB1dWlkLCAuLi4odHlwZW9mIGtlZXBXb3JsZFRyYW5zZm9ybSA9PT0gJ2Jvb2xlYW4nID8geyBrZWVwV29ybGRUcmFuc2Zvcm0gfSA6IHt9KSB9KTtcclxuICAgICAgICBzYXZlU2NlbmVBZnRlckVkaXQoKTtcclxuICAgICAgICByZXR1cm4ge307XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgY29uc3QgeyBjb2RlLCBtZXNzYWdlIH0gPSB0b0NvbnRyYWN0RXJyb3IoZSk7XHJcbiAgICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UpIGFzIEVycm9yICYgeyBjb2RlPzogc3RyaW5nIH07XHJcbiAgICAgICAgZXJyLmNvZGUgPSBjb2RlO1xyXG4gICAgICAgIHRocm93IGVycjtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gbm9ybWFsaXplUGF0aFNlZyhwOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHAucmVwbGFjZSgvXFxcXC9nLCAnLycpLnJlcGxhY2UoL1xcLysvZywgJy8nKS50cmltKCkucmVwbGFjZSgvXlxcLy8sICcnKSB8fCAnUm9vdCc7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhcmVudFBhdGhGcm9tTm9kZVBhdGgobm9kZVBhdGg6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgY29uc3QgbiA9IG5vcm1hbGl6ZVBhdGhTZWcobm9kZVBhdGgpO1xyXG4gICAgY29uc3QgaSA9IG4ubGFzdEluZGV4T2YoJy8nKTtcclxuICAgIGlmIChpIDw9IDApIHJldHVybiBudWxsO1xyXG4gICAgcmV0dXJuIG4uc2xpY2UoMCwgaSk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHJlc29sdmVQYXJlbnRVdWlkRm9yRHVwbGljYXRlKFxyXG4gICAgTWVzc2FnZTogUmV0dXJuVHlwZTx0eXBlb2YgZ2V0RWRpdG9yTWVzc2FnZT4sXHJcbiAgICBzb3VyY2VVdWlkOiBzdHJpbmdcclxuKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcclxuICAgIGNvbnN0IHJhd1RyZWUgPSBhd2FpdCBNZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xyXG4gICAgY29uc3QgeyBmbGF0IH0gPSBub3JtYWxpemVUcmVlKHJhd1RyZWUsIHt9KTtcclxuICAgIGNvbnN0IGl0ZW0gPSBmbGF0LmZpbmQoKG4pID0+IG4udXVpZCA9PT0gc291cmNlVXVpZCk7XHJcbiAgICBpZiAoIWl0ZW0pIHtcclxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgfVxyXG4gICAgY29uc3QgcHAgPSBwYXJlbnRQYXRoRnJvbU5vZGVQYXRoKGl0ZW0ucGF0aCk7XHJcbiAgICBpZiAocHAgPT0gbnVsbCkge1xyXG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICB9XHJcbiAgICBjb25zdCBwID0gZmxhdC5maW5kKChuKSA9PiBub3JtYWxpemVQYXRoU2VnKG4ucGF0aCkgPT09IG5vcm1hbGl6ZVBhdGhTZWcocHApKTtcclxuICAgIHJldHVybiBwPy51dWlkO1xyXG59XHJcblxyXG4vKipcclxuICogbm9kZS5kdXBsaWNhdGXvvJpjb3B5LW5vZGUgKyBwYXN0ZS1ub2Rl44CC6IulIEVkaXRvciDmnKrmmrTpnLLlsI3mh4kgQVBJIOWJh+aLi+WHuuaYjueiuiBTQ0VORV9FUlJPUuOAglxyXG4gKi9cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZU5vZGVEdXBsaWNhdGUocGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IFByb21pc2U8eyB1dWlkOiBzdHJpbmc7IHBhdGg6IHN0cmluZzsgbmFtZTogc3RyaW5nIH0+IHtcclxuICAgIGNvbnN0IHBhcnNlZCA9IHJlcXVpcmVOb2RlRHVwbGljYXRlUGFyYW1zKHBhcmFtcyk7XHJcbiAgICBjb25zdCBNZXNzYWdlID0gZ2V0RWRpdG9yTWVzc2FnZSgpO1xyXG4gICAgY29uc3Qgc291cmNlVXVpZCA9IGF3YWl0IHJlc29sdmVOb2RlVXVpZChwYXJzZWQuc291cmNlKTtcclxuICAgIGxldCBwYXJlbnRVdWlkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XHJcbiAgICBpZiAocGFyc2VkLnBhcmVudCkge1xyXG4gICAgICAgIHBhcmVudFV1aWQgPSBhd2FpdCByZXNvbHZlTm9kZVV1aWQocGFyc2VkLnBhcmVudCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHBhcmVudFV1aWQgPSBhd2FpdCByZXNvbHZlUGFyZW50VXVpZEZvckR1cGxpY2F0ZShNZXNzYWdlLCBzb3VyY2VVdWlkKTtcclxuICAgIH1cclxuICAgIHRyeSB7XHJcbiAgICAgICAgYXdhaXQgTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjb3B5LW5vZGUnLCB7IHV1aWQ6IHNvdXJjZVV1aWQgfSk7XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgY29uc3QgaGludCA9IGUgaW5zdGFuY2VvZiBFcnJvciA/IGUubWVzc2FnZSA6IFN0cmluZyhlKTtcclxuICAgICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBub2RlLmR1cGxpY2F0ZSByZXF1aXJlcyBFZGl0b3Igc2NlbmUuY29weS1ub2RlIEFQSS4gSWYgdGhpcyBmYWlscywgeW91ciBDcmVhdG9yIHZlcnNpb24gbWF5IG5vdCBzdXBwb3J0IG5vbi1pbnRlcmFjdGl2ZSBjb3B5L3Bhc3RlOiAke2hpbnR9YFxyXG4gICAgICAgICkgYXMgRXJyb3IgJiB7IGNvZGU/OiBzdHJpbmcgfTtcclxuICAgICAgICBlcnIuY29kZSA9ICdTQ0VORV9FUlJPUic7XHJcbiAgICAgICAgdGhyb3cgZXJyO1xyXG4gICAgfVxyXG4gICAgY29uc3QgcGFzdGVPcHRzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHt9O1xyXG4gICAgaWYgKHBhcmVudFV1aWQgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIHBhc3RlT3B0cy5wYXJlbnQgPSBwYXJlbnRVdWlkO1xyXG4gICAgfVxyXG4gICAgaWYgKHBhcnNlZC5uYW1lICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICBwYXN0ZU9wdHMubmFtZSA9IHBhcnNlZC5uYW1lO1xyXG4gICAgfVxyXG4gICAgbGV0IG5ld1V1aWQ6IHVua25vd247XHJcbiAgICB0cnkge1xyXG4gICAgICAgIG5ld1V1aWQgPSBhd2FpdCBNZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3Bhc3RlLW5vZGUnLCBwYXN0ZU9wdHMpO1xyXG4gICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIGNvbnN0IGhpbnQgPSBlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSk7XHJcbiAgICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKGBub2RlLmR1cGxpY2F0ZSBwYXN0ZS1ub2RlIGZhaWxlZDogJHtoaW50fWApIGFzIEVycm9yICYgeyBjb2RlPzogc3RyaW5nIH07XHJcbiAgICAgICAgZXJyLmNvZGUgPSAnU0NFTkVfRVJST1InO1xyXG4gICAgICAgIHRocm93IGVycjtcclxuICAgIH1cclxuICAgIGNvbnN0IG5ld0lkID0gdHlwZW9mIG5ld1V1aWQgPT09ICdzdHJpbmcnID8gbmV3VXVpZCA6IFN0cmluZyhuZXdVdWlkKTtcclxuICAgIGNvbnN0IHJhd0FmdGVyID0gYXdhaXQgTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKTtcclxuICAgIGNvbnN0IHsgZmxhdCB9ID0gbm9ybWFsaXplVHJlZShyYXdBZnRlciwge30pO1xyXG4gICAgY29uc3QgbmV3SXRlbSA9IGZsYXQuZmluZCgobikgPT4gbi51dWlkID09PSBuZXdJZCk7XHJcbiAgICBzYXZlU2NlbmVBZnRlckVkaXQoKTtcclxuICAgIGlmICghbmV3SXRlbSkge1xyXG4gICAgICAgIHJldHVybiB7IHV1aWQ6IG5ld0lkLCBwYXRoOiAnJywgbmFtZTogcGFyc2VkLm5hbWUgPz8gJycgfTtcclxuICAgIH1cclxuICAgIHJldHVybiB7IHV1aWQ6IG5ld0lkLCBwYXRoOiBuZXdJdGVtLnBhdGgsIG5hbWU6IG5ld0l0ZW0ubmFtZSB9O1xyXG59XHJcblxyXG4vKipcclxuICogc2V0LXByb3BlcnR577ya5a+r5YWl5bGs5oCn44CCcGFyYW1zIOaUr+aPtCB1dWlkIOaIliBub2RlUGF0aCDkuozpgbjkuIDjgIJkdW1wIOaooeW8j+ebtOaOpei9ieS6pO+8m3ZhbHVlIOaooeW8j+WFiCBxdWVyeS1ub2RlIOWPliBkdW1w77yM5pa8IHBhdGgg6JmV6KitIC52YWx1ZSDlho3pgIEgc2V0LXByb3BlcnR544CCXHJcbiAqIEVkaXRvcjogRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5JywgeyB1dWlkLCBwYXRoLCBkdW1wLCByZWNvcmQ/IH0pXHJcbiAqL1xyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlU2V0UHJvcGVydHkocGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuIH0+IHtcclxuICAgIGNvbnN0IHBhcnNlZCA9IHJlcXVpcmVTZXRQcm9wZXJ0eVBhcmFtcyhwYXJhbXMpO1xyXG4gICAgY29uc3QgdXVpZCA9IGF3YWl0IHJlc29sdmVOb2RlVXVpZChwYXJzZWQpO1xyXG4gICAgY29uc3QgeyBwYXRoLCBkdW1wLCB2YWx1ZSwgcmVjb3JkIH0gPSBwYXJzZWQ7XHJcbiAgICBjb25zdCBNZXNzYWdlID0gZ2V0RWRpdG9yTWVzc2FnZSgpO1xyXG5cclxuICAgIGNvbnN0IG5lZWROb2RlRHVtcEZvclBhdGggPSBpc1R5cGVQYXRoKHBhdGgpO1xyXG4gICAgY29uc3QgbmVlZE5vZGVEdW1wRm9yVmFsdWUgPSBkdW1wID09PSB1bmRlZmluZWQ7XHJcbiAgICBsZXQgbm9kZUR1bXA6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgbnVsbCA9IG51bGw7XHJcblxyXG4gICAgaWYgKG5lZWROb2RlRHVtcEZvclBhdGggfHwgbmVlZE5vZGVEdW1wRm9yVmFsdWUpIHtcclxuICAgICAgICBjb25zdCByYXcgPSBhd2FpdCBNZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCB1dWlkKTtcclxuICAgICAgICBpZiAocmF3ID09PSBudWxsIHx8IHJhdyA9PT0gdW5kZWZpbmVkIHx8IHR5cGVvZiByYXcgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkocmF3KSkge1xyXG4gICAgICAgICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoJ05vZGUgbm90IGZvdW5kIG9yIGludmFsaWQgZHVtcCcpIGFzIEVycm9yICYgeyBjb2RlPzogc3RyaW5nIH07XHJcbiAgICAgICAgICAgIGVyci5jb2RlID0gJ0FTU0VUX05PVF9GT1VORCc7XHJcbiAgICAgICAgICAgIHRocm93IGVycjtcclxuICAgICAgICB9XHJcbiAgICAgICAgbm9kZUR1bXAgPSByYXcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IHBhdGhUb1VzZSA9IHBhdGg7XHJcbiAgICBpZiAobmVlZE5vZGVEdW1wRm9yUGF0aCAmJiBub2RlRHVtcCkge1xyXG4gICAgICAgIGNvbnN0IHJlc29sdmVkID0gcmVzb2x2ZVBhdGhJZlR5cGVQYXRoKG5vZGVEdW1wLCBwYXRoKTtcclxuICAgICAgICBpZiAocmVzb2x2ZWQgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKCdDb21wb25lbnQgbm90IGZvdW5kIGZvciB0eXBlIHBhdGg6ICcgKyBwYXRoKSBhcyBFcnJvciAmIHsgY29kZT86IHN0cmluZyB9O1xyXG4gICAgICAgICAgICBlcnIuY29kZSA9ICdBU1NFVF9OT1RfRk9VTkQnO1xyXG4gICAgICAgICAgICB0aHJvdyBlcnI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHBhdGhUb1VzZSA9IHJlc29sdmVkO1xyXG4gICAgfVxyXG5cclxuICAgIGxldCBmaW5hbER1bXA6IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xyXG4gICAgaWYgKGR1bXAgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIGZpbmFsRHVtcCA9IGR1bXA7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIHZhbHVlIOaooeW8j++8muiLpSB2YWx1ZSDngrros4fmupDot6/lvpHvvIhkYjogLyBkYjovLyAvIGFzc2V0cy/vvInlhYjop6PmnpDngrogeyBfX3V1aWRfXyB977yb6Iul5bey5pivIHsgX191dWlkX18gfSDkv53mjIHkuI3oropcclxuICAgICAgICBjb25zdCByZXNvbHZlZFZhbHVlID0gYXdhaXQgbm9ybWFsaXplUHJvcGVydHlWYWx1ZSh2YWx1ZSk7XHJcbiAgICAgICAgY29uc3QgcHJvcCA9IGdldEF0UGF0aChub2RlRHVtcCEsIHBhdGhUb1VzZSk7XHJcbiAgICAgICAgZmluYWxEdW1wID0gcHJvcCA/IHsgLi4ucHJvcCwgdmFsdWU6IHJlc29sdmVkVmFsdWUgfSA6IHsgdmFsdWU6IHJlc29sdmVkVmFsdWUgfTtcclxuICAgIH1cclxuXHJcbiAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IE1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xyXG4gICAgICAgICAgICB1dWlkLFxyXG4gICAgICAgICAgICBwYXRoOiBwYXRoVG9Vc2UsXHJcbiAgICAgICAgICAgIGR1bXA6IGZpbmFsRHVtcCxcclxuICAgICAgICAgICAgLi4uKHR5cGVvZiByZWNvcmQgPT09ICdib29sZWFuJyA/IHsgcmVjb3JkIH0gOiB7fSksXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgc2F2ZVNjZW5lQWZ0ZXJFZGl0KCk7XHJcbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogcmVzdWx0ID09PSB0cnVlIH07XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgY29uc3QgeyBjb2RlLCBtZXNzYWdlIH0gPSB0b0NvbnRyYWN0RXJyb3IoZSk7XHJcbiAgICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UpIGFzIEVycm9yICYgeyBjb2RlPzogc3RyaW5nIH07XHJcbiAgICAgICAgZXJyLmNvZGUgPSBjb2RlO1xyXG4gICAgICAgIHRocm93IGVycjtcclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIHJlc2V0LXByb3BlcnR577ya6YeN572u5bGs5oCn44CCcGFyYW1zIOaUr+aPtCB1dWlkIOaIliBub2RlUGF0aCDkuozpgbjkuIDvvIxwYXRoIOW/heWhq++8m+WPr+mBuCBkdW1w44CBcmVjb3Jk44CCXHJcbiAqIEVkaXRvcjogRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncmVzZXQtcHJvcGVydHknLCBvcHRpb25zKVxyXG4gKi9cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZVJlc2V0UHJvcGVydHkocGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuIH0+IHtcclxuICAgIGNvbnN0IHBhcnNlZCA9IHJlcXVpcmVSZXNldFByb3BlcnR5UGFyYW1zKHBhcmFtcyk7XHJcbiAgICBjb25zdCB1dWlkID0gYXdhaXQgcmVzb2x2ZU5vZGVVdWlkKHBhcnNlZCk7XHJcbiAgICBjb25zdCB7IHBhdGgsIGR1bXAsIHJlY29yZCB9ID0gcGFyc2VkO1xyXG4gICAgY29uc3QgTWVzc2FnZSA9IGdldEVkaXRvck1lc3NhZ2UoKTtcclxuXHJcbiAgICBsZXQgcGF0aFRvVXNlID0gcGF0aDtcclxuICAgIGlmIChpc1R5cGVQYXRoKHBhdGgpKSB7XHJcbiAgICAgICAgY29uc3QgcmF3ID0gYXdhaXQgTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgdXVpZCk7XHJcbiAgICAgICAgaWYgKHJhdyA9PT0gbnVsbCB8fCByYXcgPT09IHVuZGVmaW5lZCB8fCB0eXBlb2YgcmF3ICE9PSAnb2JqZWN0JyB8fCBBcnJheS5pc0FycmF5KHJhdykpIHtcclxuICAgICAgICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKCdOb2RlIG5vdCBmb3VuZCBvciBpbnZhbGlkIGR1bXAnKSBhcyBFcnJvciAmIHsgY29kZT86IHN0cmluZyB9O1xyXG4gICAgICAgICAgICBlcnIuY29kZSA9ICdBU1NFVF9OT1RfRk9VTkQnO1xyXG4gICAgICAgICAgICB0aHJvdyBlcnI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IHJlc29sdmVkID0gcmVzb2x2ZVBhdGhJZlR5cGVQYXRoKHJhdyBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiwgcGF0aCk7XHJcbiAgICAgICAgaWYgKHJlc29sdmVkID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcignQ29tcG9uZW50IG5vdCBmb3VuZCBmb3IgdHlwZSBwYXRoOiAnICsgcGF0aCkgYXMgRXJyb3IgJiB7IGNvZGU/OiBzdHJpbmcgfTtcclxuICAgICAgICAgICAgZXJyLmNvZGUgPSAnQVNTRVRfTk9UX0ZPVU5EJztcclxuICAgICAgICAgICAgdGhyb3cgZXJyO1xyXG4gICAgICAgIH1cclxuICAgICAgICBwYXRoVG9Vc2UgPSByZXNvbHZlZDtcclxuICAgIH1cclxuXHJcbiAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IG9wdGlvbnM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0geyB1dWlkLCBwYXRoOiBwYXRoVG9Vc2UgfTtcclxuICAgICAgICBpZiAoZHVtcCAhPT0gdW5kZWZpbmVkKSBvcHRpb25zLmR1bXAgPSBkdW1wO1xyXG4gICAgICAgIGlmICh0eXBlb2YgcmVjb3JkID09PSAnYm9vbGVhbicpIG9wdGlvbnMucmVjb3JkID0gcmVjb3JkO1xyXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IE1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncmVzZXQtcHJvcGVydHknLCBvcHRpb25zKTtcclxuICAgICAgICBzYXZlU2NlbmVBZnRlckVkaXQoKTtcclxuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiByZXN1bHQgPT09IHRydWUgfTtcclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICBjb25zdCB7IGNvZGUsIG1lc3NhZ2UgfSA9IHRvQ29udHJhY3RFcnJvcihlKTtcclxuICAgICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IobWVzc2FnZSkgYXMgRXJyb3IgJiB7IGNvZGU/OiBzdHJpbmcgfTtcclxuICAgICAgICBlcnIuY29kZSA9IGNvZGU7XHJcbiAgICAgICAgdGhyb3cgZXJyO1xyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogc2NlbmUub3Blbu+8mumWi+WVn+WgtOaZry9wcmVmYWLjgIJwYXJhbXMg54K6IHV1aWQg5oiWIGFzc2V0UGF0aCDkuozpgbjkuIDvvJthc3NldFBhdGgg5Y+v54K6IGRiOuOAgWRiOi8vIOaIluWwiOahiOebuOWwjei3r+W+ke+8jOe2kyByZXNvbHZlQXNzZXRQYXRoIOino+aekOeCuiB1dWlkIOW+jOWRvOWPqyBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdvcGVuLXNjZW5lJywgdXVpZCnjgIJcclxuICovXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBoYW5kbGVTY2VuZU9wZW4ocGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IFByb21pc2U8UmVjb3JkPHN0cmluZywgbmV2ZXI+PiB7XHJcbiAgICBjb25zdCBwYXJzZWQgPSByZXF1aXJlU2NlbmVPcGVuUGFyYW1zKHBhcmFtcyk7XHJcbiAgICBsZXQgdXVpZDogc3RyaW5nO1xyXG4gICAgaWYgKCd1dWlkJyBpbiBwYXJzZWQpIHtcclxuICAgICAgICB1dWlkID0gcGFyc2VkLnV1aWQ7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHV1aWQgPSBhd2FpdCByZXNvbHZlQXNzZXRQYXRoKHBhcnNlZC5hc3NldFBhdGgpO1xyXG4gICAgfVxyXG4gICAgY29uc3QgTWVzc2FnZSA9IGdldEVkaXRvck1lc3NhZ2UoKTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgYXdhaXQgTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdvcGVuLXNjZW5lJywgdXVpZCk7XHJcbiAgICAgICAgcmV0dXJuIHt9O1xyXG4gICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIGNvbnN0IHsgY29kZSwgbWVzc2FnZSB9ID0gdG9Db250cmFjdEVycm9yKGUpO1xyXG4gICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihtZXNzYWdlKSBhcyBFcnJvciAmIHsgY29kZT86IHN0cmluZyB9O1xyXG4gICAgICAgIGVyci5jb2RlID0gY29kZTtcclxuICAgICAgICB0aHJvdyBlcnI7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKiBzY2VuZS5xdWVyeS1jdXJyZW50IOWbnuWCs+Wei+WIpe+8mnV1aWQvdHlwZSDoi6UgRWRpdG9yIOacquaatOmcsuWJh+eCuiBudWxs44CCICovXHJcbmV4cG9ydCBpbnRlcmZhY2UgU2NlbmVRdWVyeUN1cnJlbnRSZXN1bHQge1xyXG4gICAgdXVpZDogc3RyaW5nIHwgbnVsbDtcclxuICAgIHR5cGU/OiAnc2NlbmUnIHwgJ3ByZWZhYic7XHJcbiAgICBkaXJ0eT86IGJvb2xlYW47XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBzY2VuZS5xdWVyeS1jdXJyZW5077ya5p+l6Kmi55W25YmNIGZvY3VzIOeahOWgtOaZry9wcmVmYWLjgILnhKEgcGFyYW1z44CCXHJcbiAqIOWbnuWCsyB7IHV1aWQsIHR5cGU/LCBkaXJ0eT8gfeOAgmRpcnR5IOmAj+mBjiBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1kaXJ0eScpIOWPluW+l++8m1xyXG4gKiB1dWlkL3R5cGUg55uu5YmN54Sh55u05o6lIEVkaXRvciBNZXNzYWdl77yM5Zue5YKzIG51bGzvvIzlvoUgRWRpdG9yIOaatOmcsuW+jOWPr+ijnOS4iuOAglxyXG4gKi9cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZVNjZW5lUXVlcnlDdXJyZW50KF9wYXJhbXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTxTY2VuZVF1ZXJ5Q3VycmVudFJlc3VsdD4ge1xyXG4gICAgY29uc3QgTWVzc2FnZSA9IGdldEVkaXRvck1lc3NhZ2UoKTtcclxuICAgIGxldCBkaXJ0eTogYm9vbGVhbiB8IHVuZGVmaW5lZDtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgZGlydHkgPSBhd2FpdCBNZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LWRpcnR5JykgYXMgYm9vbGVhbjtcclxuICAgIH0gY2F0Y2gge1xyXG4gICAgICAgIC8vIHF1ZXJ5LWRpcnR5IOWPr+iDveS4jeWtmOWcqOaIluWkseaVl++8jOeVpemBjlxyXG4gICAgfVxyXG4gICAgLy8g55uu5YmNIHNjZW5lIOaooee1hOeEoSBxdWVyeSDnlbbliY0gZm9jdXMg55qEIHNjZW5lL3ByZWZhYiB1dWlkIOeahCBNZXNzYWdl77yMdXVpZC90eXBlIOWbnuWCsyBudWxsXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHV1aWQ6IG51bGwsXHJcbiAgICAgICAgZGlydHksXHJcbiAgICB9O1xyXG59XHJcblxyXG4vKipcclxuICogc2NlbmUuY3JlYXRl77ya5bu656uL5paw5aC05pmv6LOH5rqQ44CCcGFyYW1z77yaYXNzZXRQYXRo77yI5b+F5aGr77yJ44CBb3Blbj/vvIjlj6/pgbjvvIzlu7rnq4vlvozmmK/lkKbplovllZ/vvInjgIJcclxuICog5L2/55SoIGFzc2V0LWRiIGNyZWF0ZS1hc3NldCDlu7rnq4vnqbogLnNjZW5lIOaqlO+8m+iLpSBvcGVuIOeCuiB0cnVlIOWJh+WGjeWRvOWPqyBvcGVuLXNjZW5l44CCXHJcbiAqIHJlc3VsdDogeyB1dWlkOiBzdHJpbmcgfeOAguiLpSBFZGl0b3Ig54Sh55u05o6lIGNyZWF0ZS1zY2VuZSBNZXNzYWdl77yM5YmH5Lul5bu656uL56m65aC05pmv5qqU5pa55byP5a+m5L2c44CCXHJcbiAqL1xyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlU2NlbmVDcmVhdGUocGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IFByb21pc2U8eyB1dWlkOiBzdHJpbmcgfT4ge1xyXG4gICAgY29uc3QgcGFyc2VkID0gcmVxdWlyZVNjZW5lQ3JlYXRlUGFyYW1zKHBhcmFtcyk7XHJcbiAgICBjb25zdCB1cmwgPSBhc3NldFBhdGhUb1NjZW5lVXJsKHBhcnNlZC5hc3NldFBhdGgpO1xyXG4gICAgY29uc3QgTWVzc2FnZSA9IGdldEVkaXRvck1lc3NhZ2UoKTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgLy8gRWRpdG9yIOacquaatOmcsuOAjOaWsOW7uuWgtOaZr+OAjU1lc3NhZ2XvvIzkvb/nlKggYXNzZXQtZGIgY3JlYXRlLWFzc2V0IOW7uueri+epuiAuc2NlbmUg5qqUXHJcbiAgICAgICAgY29uc3QgbWluaW1hbFNjZW5lQ29udGVudCA9IEpTT04uc3RyaW5naWZ5KHsgX190eXBlX186ICdjYy5TY2VuZUFzc2V0JywgX29iakZsYWdzOiAwIH0pO1xyXG4gICAgICAgIGNvbnN0IGluZm8gPSBhd2FpdCBNZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NyZWF0ZS1hc3NldCcsIHVybCwgbWluaW1hbFNjZW5lQ29udGVudCkgYXMgeyB1dWlkPzogc3RyaW5nIH0gfCBudWxsO1xyXG4gICAgICAgIGlmICghaW5mbyB8fCB0eXBlb2YgaW5mby51dWlkICE9PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoJ1NjZW5lIGNyZWF0ZSBmYWlsZWQgb3IgRWRpdG9yIEFQSSBub3QgYXZhaWxhYmxlICjlvoUgRWRpdG9yIOaatOmcsiknKSBhcyBFcnJvciAmIHsgY29kZT86IHN0cmluZyB9O1xyXG4gICAgICAgICAgICBlcnIuY29kZSA9ICdTQ0VORV9FUlJPUic7XHJcbiAgICAgICAgICAgIHRocm93IGVycjtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgdXVpZCA9IGluZm8udXVpZDtcclxuICAgICAgICBpZiAocGFyc2VkLm9wZW4gPT09IHRydWUpIHtcclxuICAgICAgICAgICAgYXdhaXQgTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdvcGVuLXNjZW5lJywgdXVpZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB7IHV1aWQgfTtcclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICBjb25zdCB7IGNvZGUsIG1lc3NhZ2UgfSA9IHRvQ29udHJhY3RFcnJvcihlKTtcclxuICAgICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IobWVzc2FnZSkgYXMgRXJyb3IgJiB7IGNvZGU/OiBzdHJpbmcgfTtcclxuICAgICAgICBlcnIuY29kZSA9IGNvZGU7XHJcbiAgICAgICAgdGhyb3cgZXJyO1xyXG4gICAgfVxyXG59XHJcbiJdfQ==