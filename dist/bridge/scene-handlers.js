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
exports.handleSetProperty = handleSetProperty;
exports.handleResetProperty = handleResetProperty;
exports.handleSceneOpen = handleSceneOpen;
exports.handleSceneQueryCurrent = handleSceneQueryCurrent;
exports.handleSceneCreate = handleSceneCreate;
const auto_save_1 = require("./auto-save");
const component_path_1 = require("./component-path");
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
/** 若 value 為物件且含 __uuid__，視為已是資源引用；否則若為資源路徑字串則解析為 { __uuid__ }。 */
async function normalizePropertyValue(value) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && '__uuid__' in value && typeof value.__uuid__ === 'string') {
        return value;
    }
    if (isAssetPathValue(value)) {
        const uuid = await (0, resolve_asset_1.resolveAssetPath)(value);
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
 * remove-component：依組件 UUID 移除組件。
 * Editor: Editor.Message.request('scene', 'remove-component', { uuid })
 */
async function handleRemoveComponent(params) {
    const { uuid } = (0, validate_1.requireRemoveComponentParams)(params);
    const Message = getEditorMessage();
    try {
        await Message.request('scene', 'remove-component', { uuid });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUtaGFuZGxlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvYnJpZGdlL3NjZW5lLWhhbmRsZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHOztBQWtISCx3REF5QkM7QUFNRCxzREFjQztBQU1ELHNEQWFDO0FBTUQsNENBc0JDO0FBTUQsNENBb0JDO0FBTUQsOENBd0RDO0FBTUQsa0RBb0NDO0FBS0QsMENBa0JDO0FBY0QsMERBYUM7QUFPRCw4Q0F3QkM7QUEvWkQsMkNBQWlEO0FBQ2pELHFEQUFtRztBQUNuRyxtREFBd0U7QUFDeEUsaURBQWdEO0FBQ2hELHlDQVVvQjtBQVFwQixTQUFTLGdCQUFnQjtJQUNyQixNQUFNLENBQUMsR0FBSSxVQUFrQixDQUFDLE1BQU0sQ0FBQztJQUNyQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxLQUFLLFVBQVUsRUFBRSxDQUFDO1FBQzlELE1BQU0sR0FBRyxHQUFHLElBQUksS0FBSyxDQUFDLDhCQUE4QixDQUE4QixDQUFDO1FBQ25GLEdBQUcsQ0FBQyxJQUFJLEdBQUcsYUFBYSxDQUFDO1FBQ3pCLE1BQU0sR0FBRyxDQUFDO0lBQ2QsQ0FBQztJQUNELE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQztBQUNyQixDQUFDO0FBRUQsd0VBQXdFO0FBQ3hFLFNBQVMsVUFBVSxDQUFDLElBQVk7SUFDNUIsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ3RCLE9BQU8sQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUEsd0NBQXVCLEVBQUMsQ0FBQyxDQUFDLENBQUM7QUFDNUUsQ0FBQztBQUVELDhFQUE4RTtBQUM5RSxTQUFTLHFCQUFxQixDQUFDLFFBQWlD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QUFDLE9BQU8sQ0FBOEIsQ0FBQztRQUM1RCxHQUFHLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUNoQixNQUFNLEdBQUcsQ0FBQztJQUNkLENBQUM7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiDloLTmma/nr4Dpu57mk43kvZzvvJpjcmVhdGUtY29tcG9uZW5044CBcmVtb3ZlLWNvbXBvbmVudOOAgWNyZWF0ZS1ub2Rl44CBcmVtb3ZlLW5vZGXjgIFcbiAqIHNldC1wcm9wZXJ0ee+8iHZhbHVlIC8gZHVtcO+8ieOAgXJlc2V0LXByb3BlcnR544CC5bCN5oeJIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgLi4uKeOAglxuICog5bCN6b2KIGJsdWVwcmludCBBUEkg5aWR57SE6IiHIEBjb2Nvcy9jcmVhdG9yLXR5cGVzIOS5iyBDcmVhdGVDb21wb25lbnRPcHRpb25z44CBU2V0UHJvcGVydHlPcHRpb25zIOetieOAglxuICovXG5cbmltcG9ydCB7IHNhdmVTY2VuZUFmdGVyRWRpdCB9IGZyb20gJy4vYXV0by1zYXZlJztcbmltcG9ydCB7IGdldENvbXBvbmVudFV1aWQsIGlzUmVzb2x2ZWRDb21wb25lbnRQYXRoLCByZXNvbHZlQ29tcG9uZW50UGF0aCB9IGZyb20gJy4vY29tcG9uZW50LXBhdGgnO1xuaW1wb3J0IHsgcmVzb2x2ZUFzc2V0UGF0aCwgYXNzZXRQYXRoVG9TY2VuZVVybCB9IGZyb20gJy4vcmVzb2x2ZS1hc3NldCc7XG5pbXBvcnQgeyBub2RlUGF0aFRvVXVpZCB9IGZyb20gJy4vcmVzb2x2ZS1ub2RlJztcbmltcG9ydCB7XG4gICAgcmVxdWlyZUNyZWF0ZUNvbXBvbmVudFBhcmFtcyxcbiAgICByZXF1aXJlQ3JlYXRlTm9kZVBhcmFtcyxcbiAgICByZXF1aXJlUmVtb3ZlQ29tcG9uZW50UGFyYW1zLFxuICAgIHJlcXVpcmVSZXNvbHZlQ29tcG9uZW50UGFyYW1zLFxuICAgIHJlcXVpcmVSZW1vdmVOb2RlUGFyYW1zLFxuICAgIHJlcXVpcmVSZXNldFByb3BlcnR5UGFyYW1zLFxuICAgIHJlcXVpcmVTY2VuZUNyZWF0ZVBhcmFtcyxcbiAgICByZXF1aXJlU2NlbmVPcGVuUGFyYW1zLFxuICAgIHJlcXVpcmVTZXRQcm9wZXJ0eVBhcmFtcyxcbn0gZnJvbSAnLi92YWxpZGF0ZSc7XG5cbmRlY2xhcmUgY29uc3QgRWRpdG9yOiB7XG4gICAgTWVzc2FnZToge1xuICAgICAgICByZXF1ZXN0KG1vZHVsZTogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT47XG4gICAgfTtcbn07XG5cbmZ1bmN0aW9uIGdldEVkaXRvck1lc3NhZ2UoKTogeyByZXF1ZXN0KG1vZHVsZTogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT4gfSB7XG4gICAgY29uc3QgRSA9IChnbG9iYWxUaGlzIGFzIGFueSkuRWRpdG9yO1xuICAgIGlmICghRSB8fCAhRS5NZXNzYWdlIHx8IHR5cGVvZiBFLk1lc3NhZ2UucmVxdWVzdCAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoJ0VkaXRvci5NZXNzYWdlIG5vdCBhdmFpbGFibGUnKSBhcyBFcnJvciAmIHsgY29kZT86IHN0cmluZyB9O1xuICAgICAgICBlcnIuY29kZSA9ICdTQ0VORV9FUlJPUic7XG4gICAgICAgIHRocm93IGVycjtcbiAgICB9XG4gICAgcmV0dXJuIEUuTWVzc2FnZTtcbn1cblxuLyoqIOWIpOaWtyBwYXRoIOaYr+WQpueCuuWei+WIpSBwYXRo77yI5aaCIGNjLlNwcml0ZS5zcHJpdGVGcmFtZe+8ie+8jOmcgOWFiOino+aekOaIkCBfX2NvbXBzX18uTi54eHggKi9cbmZ1bmN0aW9uIGlzVHlwZVBhdGgocGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgY29uc3QgcCA9IHBhdGgudHJpbSgpO1xuICAgIHJldHVybiBwLmxlbmd0aCA+IDAgJiYgcC5pbmNsdWRlcygnY2MuJykgJiYgIWlzUmVzb2x2ZWRDb21wb25lbnRQYXRoKHApO1xufVxuXG4vKiog6IulIHBhdGgg54K65Z6L5YilIHBhdGgg5YmH55SoIG5vZGVEdW1wIOino+aekOeCuiBfX2NvbXBzX18uTi54eHjvvIzlkKbliYflm57lgrPljp8gcGF0aOOAguino+aekOWkseaVl+WbnuWCsyBudWxs44CCICovXG5mdW5jdGlvbiByZXNvbHZlUGF0aElmVHlwZVBhdGgobm9kZUR1bXA6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LCBwYXRoOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBpZiAoIWlzVHlwZVBhdGgocGF0aCkpIHJldHVybiBwYXRoO1xuICAgIHJldHVybiByZXNvbHZlQ29tcG9uZW50UGF0aChub2RlRHVtcCwgcGF0aCk7XG59XG5cbi8qKiDlsIfnr4Dpu57orZjliKXvvIh1dWlkIOaIliBub2RlUGF0aO+8ieino+aekOeCuiB1dWlk77yb6Iul5bey5pivIHV1aWQg55u05o6l5Zue5YKz44CCICovXG5hc3luYyBmdW5jdGlvbiByZXNvbHZlTm9kZVV1aWQoXG4gICAgcmVmOiB7IHV1aWQ6IHN0cmluZyB9IHwgeyBub2RlUGF0aDogc3RyaW5nIH0sXG4gICAgc2NlbmVDb250ZXh0Pzogc3RyaW5nXG4pOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGlmICgndXVpZCcgaW4gcmVmKSByZXR1cm4gcmVmLnV1aWQ7XG4gICAgcmV0dXJuIG5vZGVQYXRoVG9VdWlkKHNjZW5lQ29udGV4dCwgcmVmLm5vZGVQYXRoKTtcbn1cblxuLyoqIOWwhyBFZGl0b3Ig6Yyv6Kqk6L2J54K65aWR57SE6Yyv6Kqk56K8ICovXG5mdW5jdGlvbiB0b0NvbnRyYWN0RXJyb3IoZTogdW5rbm93bik6IHsgY29kZTogc3RyaW5nOyBtZXNzYWdlOiBzdHJpbmcgfSB7XG4gICAgaWYgKGUgJiYgdHlwZW9mIGUgPT09ICdvYmplY3QnICYmICdjb2RlJyBpbiBlICYmIHR5cGVvZiAoZSBhcyBhbnkpLmNvZGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGNvbnN0IGNvZGUgPSAoZSBhcyBhbnkpLmNvZGU7XG4gICAgICAgIGlmIChjb2RlID09PSAnSU5WQUxJRF9QQVJBTVMnKSByZXR1cm4geyBjb2RlOiAnSU5WQUxJRF9QQVJBTVMnLCBtZXNzYWdlOiAnSW52YWxpZCBvciBtaXNzaW5nIHBhcmFtZXRlcnMnIH07XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgIGNvZGUgPT09ICdBU1NFVF9OT1RfRk9VTkQnIHx8XG4gICAgICAgICAgICBjb2RlID09PSAnRU5PRU5UJyB8fFxuICAgICAgICAgICAgKHR5cGVvZiAoZSBhcyBhbnkpLm1lc3NhZ2UgPT09ICdzdHJpbmcnICYmICgoZSBhcyBhbnkpLm1lc3NhZ2UgYXMgc3RyaW5nKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdub3QgZm91bmQnKSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgICByZXR1cm4geyBjb2RlOiAnQVNTRVRfTk9UX0ZPVU5EJywgbWVzc2FnZTogJ0Fzc2V0IG9yIG5vZGUgbm90IGZvdW5kJyB9O1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7IGNvZGU6ICdTQ0VORV9FUlJPUicsIG1lc3NhZ2U6ICdTY2VuZSBvcGVyYXRpb24gZmFpbGVkJyB9O1xufVxuXG4vKiog5Yik5pa3IHZhbHVlIOaYr+WQpueCuuizh+a6kOi3r+W+ke+8iGRiOiAvIGRiOi8vIC8g5bCI5qGI55u45bCN6Lev5b6RIGFzc2V0cy/vvInvvIzpnIDop6PmnpDngrogdXVpZOOAgiAqL1xuZnVuY3Rpb24gaXNBc3NldFBhdGhWYWx1ZSh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIHN0cmluZyB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycgfHwgdmFsdWUudHJpbSgpID09PSAnJykgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IHMgPSB2YWx1ZS50cmltKCk7XG4gICAgcmV0dXJuIHMuc3RhcnRzV2l0aCgnZGI6JykgfHwgcy5zdGFydHNXaXRoKCdkYjovLycpIHx8IHMuc3RhcnRzV2l0aCgnYXNzZXRzLycpO1xufVxuXG4vKiog6IulIHZhbHVlIOeCuueJqeS7tuS4lOWQqyBfX3V1aWRfX++8jOimlueCuuW3suaYr+izh+a6kOW8leeUqO+8m+WQpuWJh+iLpeeCuuizh+a6kOi3r+W+keWtl+S4suWJh+ino+aekOeCuiB7IF9fdXVpZF9fIH3jgIIgKi9cbmFzeW5jIGZ1bmN0aW9uIG5vcm1hbGl6ZVByb3BlcnR5VmFsdWUodmFsdWU6IHVua25vd24pOiBQcm9taXNlPHVua25vd24+IHtcbiAgICBpZiAodmFsdWUgIT09IG51bGwgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgJ19fdXVpZF9fJyBpbiB2YWx1ZSAmJiB0eXBlb2YgKHZhbHVlIGFzIHsgX191dWlkX18/OiB1bmtub3duIH0pLl9fdXVpZF9fID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIGlmIChpc0Fzc2V0UGF0aFZhbHVlKHZhbHVlKSkge1xuICAgICAgICBjb25zdCB1dWlkID0gYXdhaXQgcmVzb2x2ZUFzc2V0UGF0aCh2YWx1ZSk7XG4gICAgICAgIHJldHVybiB7IF9fdXVpZF9fOiB1dWlkIH07XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbn1cblxuLyoqXG4gKiDkvp0gcGF0aO+8iOWmgiBcIm5hbWVcIuOAgVwiX19jb21wc19fLjAuZW5hYmxlZFwi77yJ5Y+W5b6XIGR1bXAg5YWn5bCN5oeJ55qE5bei54uA54mp5Lu244CCXG4gKiDnlKjmlrwgc2V0LXByb3BlcnR5IHZhbHVlIOaooeW8j++8muWPluW+lyBJUHJvcGVydHkg5b6M5a+r5YWlIC52YWx1ZSDlho3pgIEgc2V0LXByb3BlcnR544CCXG4gKi9cbmZ1bmN0aW9uIGdldEF0UGF0aChvYmo6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LCBwYXRoOiBzdHJpbmcpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3Qga2V5cyA9IHBhdGguc3BsaXQoJy4nKTtcbiAgICBsZXQgY3VycmVudDogdW5rbm93biA9IG9iajtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGN1cnJlbnQgPT09IG51bGwgfHwgY3VycmVudCA9PT0gdW5kZWZpbmVkKSByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICBpZiAodHlwZW9mIGN1cnJlbnQgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkoY3VycmVudCkpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnN0IGtleSA9IGtleXNbaV07XG4gICAgICAgIGNvbnN0IG5leHQgPSAoY3VycmVudCBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPilba2V5XTtcbiAgICAgICAgaWYgKGkgPT09IGtleXMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiBuZXh0ID09PSAnb2JqZWN0JyAmJiBuZXh0ICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KG5leHQpID8gKG5leHQgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pIDogdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGN1cnJlbnQgPSBuZXh0O1xuICAgIH1cbiAgICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG4vKipcbiAqIHJlc29sdmUtY29tcG9uZW5077ya5L6d56+A6bue6IiH57WE5Lu26aGe5ZCN6Kej5p6Q5Ye657WE5Lu2IFVVSUTjgILkvpsgcmVtb3ZlLWNvbXBvbmVudOOAgXNldC1wcm9wZXJ0eSDnrYnkvb/nlKjjgIJcbiAqIOWFiCBxdWVyeS1ub2RlIOWPluW+l+evgOm7niBkdW1w77yM5YaN5b6eIF9fY29tcHNfXyDkuK3kvp0gdHlwZS9jaWQvbmFtZSDljLnphY3lj5blvpfntYTku7YgdXVpZOOAglxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlUmVzb2x2ZUNvbXBvbmVudChwYXJhbXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTx7IHV1aWQ6IHN0cmluZyB9PiB7XG4gICAgY29uc3QgcGFyc2VkID0gcmVxdWlyZVJlc29sdmVDb21wb25lbnRQYXJhbXMocGFyYW1zKTtcbiAgICBjb25zdCBub2RlVXVpZCA9IGF3YWl0IHJlc29sdmVOb2RlVXVpZChwYXJzZWQpO1xuICAgIGNvbnN0IE1lc3NhZ2UgPSBnZXRFZGl0b3JNZXNzYWdlKCk7XG4gICAgbGV0IG5vZGVEdW1wOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbiAgICB0cnkge1xuICAgICAgICBub2RlRHVtcCA9IChhd2FpdCBNZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCkpIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc3QgeyBjb2RlLCBtZXNzYWdlIH0gPSB0b0NvbnRyYWN0RXJyb3IoZSk7XG4gICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihtZXNzYWdlKSBhcyBFcnJvciAmIHsgY29kZT86IHN0cmluZyB9O1xuICAgICAgICBlcnIuY29kZSA9IGNvZGU7XG4gICAgICAgIHRocm93IGVycjtcbiAgICB9XG4gICAgaWYgKCFub2RlRHVtcCB8fCB0eXBlb2Ygbm9kZUR1bXAgIT09ICdvYmplY3QnKSB7XG4gICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcignTm9kZSBub3QgZm91bmQnKSBhcyBFcnJvciAmIHsgY29kZT86IHN0cmluZyB9O1xuICAgICAgICBlcnIuY29kZSA9ICdBU1NFVF9OT1RfRk9VTkQnO1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICAgIGNvbnN0IGNvbXBvbmVudFV1aWQgPSBnZXRDb21wb25lbnRVdWlkKG5vZGVEdW1wLCBwYXJzZWQuY29tcG9uZW50KTtcbiAgICBpZiAoY29tcG9uZW50VXVpZCA9PSBudWxsKSB7XG4gICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgQ29tcG9uZW50IFwiJHtwYXJzZWQuY29tcG9uZW50fVwiIG5vdCBmb3VuZCBvbiBub2RlYCkgYXMgRXJyb3IgJiB7IGNvZGU/OiBzdHJpbmcgfTtcbiAgICAgICAgZXJyLmNvZGUgPSAnQVNTRVRfTk9UX0ZPVU5EJztcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgICByZXR1cm4geyB1dWlkOiBjb21wb25lbnRVdWlkIH07XG59XG5cbi8qKlxuICogY3JlYXRlLWNvbXBvbmVudO+8muWcqOevgOm7nuS4iuW7uueri+e1hOS7tuOAgnBhcmFtcyDmlK/mj7QgdXVpZCDmiJYgbm9kZVBhdGgg5LqM6YG45LiA77yI56+A6bue77yJ44CCXG4gKiBFZGl0b3I6IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NyZWF0ZS1jb21wb25lbnQnLCB7IHV1aWQsIGNvbXBvbmVudCB9KVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlQ3JlYXRlQ29tcG9uZW50KHBhcmFtczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBQcm9taXNlPG51bGwgfCBSZWNvcmQ8c3RyaW5nLCBuZXZlcj4+IHtcbiAgICBjb25zdCBwYXJzZWQgPSByZXF1aXJlQ3JlYXRlQ29tcG9uZW50UGFyYW1zKHBhcmFtcyk7XG4gICAgY29uc3QgdXVpZCA9IGF3YWl0IHJlc29sdmVOb2RlVXVpZChwYXJzZWQpO1xuICAgIGNvbnN0IE1lc3NhZ2UgPSBnZXRFZGl0b3JNZXNzYWdlKCk7XG4gICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjcmVhdGUtY29tcG9uZW50JywgeyB1dWlkLCBjb21wb25lbnQ6IHBhcnNlZC5jb21wb25lbnQgfSk7XG4gICAgICAgIHNhdmVTY2VuZUFmdGVyRWRpdCgpO1xuICAgICAgICByZXR1cm4ge307XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zdCB7IGNvZGUsIG1lc3NhZ2UgfSA9IHRvQ29udHJhY3RFcnJvcihlKTtcbiAgICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UpIGFzIEVycm9yICYgeyBjb2RlPzogc3RyaW5nIH07XG4gICAgICAgIGVyci5jb2RlID0gY29kZTtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbn1cblxuLyoqXG4gKiByZW1vdmUtY29tcG9uZW5077ya5L6d57WE5Lu2IFVVSUQg56e76Zmk57WE5Lu244CCXG4gKiBFZGl0b3I6IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3JlbW92ZS1jb21wb25lbnQnLCB7IHV1aWQgfSlcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZVJlbW92ZUNvbXBvbmVudChwYXJhbXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTxudWxsIHwgUmVjb3JkPHN0cmluZywgbmV2ZXI+PiB7XG4gICAgY29uc3QgeyB1dWlkIH0gPSByZXF1aXJlUmVtb3ZlQ29tcG9uZW50UGFyYW1zKHBhcmFtcyk7XG4gICAgY29uc3QgTWVzc2FnZSA9IGdldEVkaXRvck1lc3NhZ2UoKTtcbiAgICB0cnkge1xuICAgICAgICBhd2FpdCBNZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3JlbW92ZS1jb21wb25lbnQnLCB7IHV1aWQgfSk7XG4gICAgICAgIHNhdmVTY2VuZUFmdGVyRWRpdCgpO1xuICAgICAgICByZXR1cm4ge307XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zdCB7IGNvZGUsIG1lc3NhZ2UgfSA9IHRvQ29udHJhY3RFcnJvcihlKTtcbiAgICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UpIGFzIEVycm9yICYgeyBjb2RlPzogc3RyaW5nIH07XG4gICAgICAgIGVyci5jb2RlID0gY29kZTtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbn1cblxuLyoqXG4gKiBjcmVhdGUtbm9kZe+8muW7uueri+evgOm7nu+8jOWbnuWCs+aWsOevgOm7niB1dWlk44CCcGFyYW1zIOWPr+WQqyB1dWlkIOaIliBub2RlUGF0aO+8iHBhcmVudO+8ieS6jOmBuOS4gOOAglxuICogRWRpdG9yOiBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjcmVhdGUtbm9kZScsIG9wdGlvbnMpIOKGkiBzdHJpbmdcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZUNyZWF0ZU5vZGUocGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IFByb21pc2U8eyB1dWlkOiBzdHJpbmcgfT4ge1xuICAgIGNvbnN0IHBhcnNlZCA9IHJlcXVpcmVDcmVhdGVOb2RlUGFyYW1zKHBhcmFtcyk7XG4gICAgY29uc3Qgb3B0aW9uczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7IC4uLnBhcnNlZCB9O1xuICAgIGlmICgnbm9kZVBhdGgnIGluIHBhcnNlZCAmJiBwYXJzZWQubm9kZVBhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBvcHRpb25zLnBhcmVudCA9IGF3YWl0IG5vZGVQYXRoVG9VdWlkKHVuZGVmaW5lZCwgcGFyc2VkLm5vZGVQYXRoIGFzIHN0cmluZyk7XG4gICAgICAgIGRlbGV0ZSBvcHRpb25zLm5vZGVQYXRoO1xuICAgICAgICBkZWxldGUgb3B0aW9ucy51dWlkO1xuICAgIH0gZWxzZSBpZiAoJ3V1aWQnIGluIHBhcnNlZCAmJiBwYXJzZWQudXVpZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG9wdGlvbnMucGFyZW50ID0gcGFyc2VkLnV1aWQgYXMgc3RyaW5nO1xuICAgICAgICBkZWxldGUgb3B0aW9ucy51dWlkO1xuICAgIH1cbiAgICBjb25zdCBNZXNzYWdlID0gZ2V0RWRpdG9yTWVzc2FnZSgpO1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHV1aWQgPSBhd2FpdCBNZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NyZWF0ZS1ub2RlJywgb3B0aW9ucyk7XG4gICAgICAgIHNhdmVTY2VuZUFmdGVyRWRpdCgpO1xuICAgICAgICByZXR1cm4geyB1dWlkOiB0eXBlb2YgdXVpZCA9PT0gJ3N0cmluZycgPyB1dWlkIDogU3RyaW5nKHV1aWQpIH07XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zdCB7IGNvZGUsIG1lc3NhZ2UgfSA9IHRvQ29udHJhY3RFcnJvcihlKTtcbiAgICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UpIGFzIEVycm9yICYgeyBjb2RlPzogc3RyaW5nIH07XG4gICAgICAgIGVyci5jb2RlID0gY29kZTtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbn1cblxuLyoqXG4gKiByZW1vdmUtbm9kZe+8muenu+mZpOevgOm7nu+8iOWWruS4gOaIlumZo+WIl++8ieOAgnBhcmFtcyDmlK/mj7QgdXVpZO+8iOWWruS4gOaIlumZo+WIl++8ieaIliBub2RlUGF0aCDkuozpgbjkuIDjgIJcbiAqIEVkaXRvcjogRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncmVtb3ZlLW5vZGUnLCB7IHV1aWQsIGtlZXBXb3JsZFRyYW5zZm9ybT8gfSlcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZVJlbW92ZU5vZGUocGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IFByb21pc2U8bnVsbCB8IFJlY29yZDxzdHJpbmcsIG5ldmVyPj4ge1xuICAgIGNvbnN0IHBhcnNlZCA9IHJlcXVpcmVSZW1vdmVOb2RlUGFyYW1zKHBhcmFtcyk7XG4gICAgY29uc3QgTWVzc2FnZSA9IGdldEVkaXRvck1lc3NhZ2UoKTtcbiAgICBsZXQgdXVpZDogc3RyaW5nIHwgc3RyaW5nW107XG4gICAgaWYgKCdub2RlUGF0aCcgaW4gcGFyc2VkKSB7XG4gICAgICAgIHV1aWQgPSBhd2FpdCBub2RlUGF0aFRvVXVpZCh1bmRlZmluZWQsIHBhcnNlZC5ub2RlUGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdXVpZCA9IHBhcnNlZC51dWlkO1xuICAgIH1cbiAgICBjb25zdCBrZWVwV29ybGRUcmFuc2Zvcm0gPSBwYXJzZWQua2VlcFdvcmxkVHJhbnNmb3JtO1xuICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IE1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncmVtb3ZlLW5vZGUnLCB7IHV1aWQsIC4uLih0eXBlb2Yga2VlcFdvcmxkVHJhbnNmb3JtID09PSAnYm9vbGVhbicgPyB7IGtlZXBXb3JsZFRyYW5zZm9ybSB9IDoge30pIH0pO1xuICAgICAgICBzYXZlU2NlbmVBZnRlckVkaXQoKTtcbiAgICAgICAgcmV0dXJuIHt9O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc3QgeyBjb2RlLCBtZXNzYWdlIH0gPSB0b0NvbnRyYWN0RXJyb3IoZSk7XG4gICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihtZXNzYWdlKSBhcyBFcnJvciAmIHsgY29kZT86IHN0cmluZyB9O1xuICAgICAgICBlcnIuY29kZSA9IGNvZGU7XG4gICAgICAgIHRocm93IGVycjtcbiAgICB9XG59XG5cbi8qKlxuICogc2V0LXByb3BlcnR577ya5a+r5YWl5bGs5oCn44CCcGFyYW1zIOaUr+aPtCB1dWlkIOaIliBub2RlUGF0aCDkuozpgbjkuIDjgIJkdW1wIOaooeW8j+ebtOaOpei9ieS6pO+8m3ZhbHVlIOaooeW8j+WFiCBxdWVyeS1ub2RlIOWPliBkdW1w77yM5pa8IHBhdGgg6JmV6KitIC52YWx1ZSDlho3pgIEgc2V0LXByb3BlcnR544CCXG4gKiBFZGl0b3I6IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHsgdXVpZCwgcGF0aCwgZHVtcCwgcmVjb3JkPyB9KVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlU2V0UHJvcGVydHkocGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuIH0+IHtcbiAgICBjb25zdCBwYXJzZWQgPSByZXF1aXJlU2V0UHJvcGVydHlQYXJhbXMocGFyYW1zKTtcbiAgICBjb25zdCB1dWlkID0gYXdhaXQgcmVzb2x2ZU5vZGVVdWlkKHBhcnNlZCk7XG4gICAgY29uc3QgeyBwYXRoLCBkdW1wLCB2YWx1ZSwgcmVjb3JkIH0gPSBwYXJzZWQ7XG4gICAgY29uc3QgTWVzc2FnZSA9IGdldEVkaXRvck1lc3NhZ2UoKTtcblxuICAgIGNvbnN0IG5lZWROb2RlRHVtcEZvclBhdGggPSBpc1R5cGVQYXRoKHBhdGgpO1xuICAgIGNvbnN0IG5lZWROb2RlRHVtcEZvclZhbHVlID0gZHVtcCA9PT0gdW5kZWZpbmVkO1xuICAgIGxldCBub2RlRHVtcDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCBudWxsID0gbnVsbDtcblxuICAgIGlmIChuZWVkTm9kZUR1bXBGb3JQYXRoIHx8IG5lZWROb2RlRHVtcEZvclZhbHVlKSB7XG4gICAgICAgIGNvbnN0IHJhdyA9IGF3YWl0IE1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIHV1aWQpO1xuICAgICAgICBpZiAocmF3ID09PSBudWxsIHx8IHJhdyA9PT0gdW5kZWZpbmVkIHx8IHR5cGVvZiByYXcgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkocmF3KSkge1xuICAgICAgICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKCdOb2RlIG5vdCBmb3VuZCBvciBpbnZhbGlkIGR1bXAnKSBhcyBFcnJvciAmIHsgY29kZT86IHN0cmluZyB9O1xuICAgICAgICAgICAgZXJyLmNvZGUgPSAnQVNTRVRfTk9UX0ZPVU5EJztcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgICBub2RlRHVtcCA9IHJhdyBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbiAgICB9XG5cbiAgICBsZXQgcGF0aFRvVXNlID0gcGF0aDtcbiAgICBpZiAobmVlZE5vZGVEdW1wRm9yUGF0aCAmJiBub2RlRHVtcCkge1xuICAgICAgICBjb25zdCByZXNvbHZlZCA9IHJlc29sdmVQYXRoSWZUeXBlUGF0aChub2RlRHVtcCwgcGF0aCk7XG4gICAgICAgIGlmIChyZXNvbHZlZCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKCdDb21wb25lbnQgbm90IGZvdW5kIGZvciB0eXBlIHBhdGg6ICcgKyBwYXRoKSBhcyBFcnJvciAmIHsgY29kZT86IHN0cmluZyB9O1xuICAgICAgICAgICAgZXJyLmNvZGUgPSAnQVNTRVRfTk9UX0ZPVU5EJztcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgICBwYXRoVG9Vc2UgPSByZXNvbHZlZDtcbiAgICB9XG5cbiAgICBsZXQgZmluYWxEdW1wOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbiAgICBpZiAoZHVtcCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGZpbmFsRHVtcCA9IGR1bXA7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gdmFsdWUg5qih5byP77ya6IulIHZhbHVlIOeCuuizh+a6kOi3r+W+ke+8iGRiOiAvIGRiOi8vIC8gYXNzZXRzL++8ieWFiOino+aekOeCuiB7IF9fdXVpZF9fIH3vvJvoi6Xlt7LmmK8geyBfX3V1aWRfXyB9IOS/neaMgeS4jeiuilxuICAgICAgICBjb25zdCByZXNvbHZlZFZhbHVlID0gYXdhaXQgbm9ybWFsaXplUHJvcGVydHlWYWx1ZSh2YWx1ZSk7XG4gICAgICAgIGNvbnN0IHByb3AgPSBnZXRBdFBhdGgobm9kZUR1bXAhLCBwYXRoVG9Vc2UpO1xuICAgICAgICBmaW5hbER1bXAgPSBwcm9wID8geyAuLi5wcm9wLCB2YWx1ZTogcmVzb2x2ZWRWYWx1ZSB9IDogeyB2YWx1ZTogcmVzb2x2ZWRWYWx1ZSB9O1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IE1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZCxcbiAgICAgICAgICAgIHBhdGg6IHBhdGhUb1VzZSxcbiAgICAgICAgICAgIGR1bXA6IGZpbmFsRHVtcCxcbiAgICAgICAgICAgIC4uLih0eXBlb2YgcmVjb3JkID09PSAnYm9vbGVhbicgPyB7IHJlY29yZCB9IDoge30pLFxuICAgICAgICB9KTtcbiAgICAgICAgc2F2ZVNjZW5lQWZ0ZXJFZGl0KCk7XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHJlc3VsdCA9PT0gdHJ1ZSB9O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc3QgeyBjb2RlLCBtZXNzYWdlIH0gPSB0b0NvbnRyYWN0RXJyb3IoZSk7XG4gICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihtZXNzYWdlKSBhcyBFcnJvciAmIHsgY29kZT86IHN0cmluZyB9O1xuICAgICAgICBlcnIuY29kZSA9IGNvZGU7XG4gICAgICAgIHRocm93IGVycjtcbiAgICB9XG59XG5cbi8qKlxuICogcmVzZXQtcHJvcGVydHnvvJrph43nva7lsazmgKfjgIJwYXJhbXMg5pSv5o+0IHV1aWQg5oiWIG5vZGVQYXRoIOS6jOmBuOS4gO+8jHBhdGgg5b+F5aGr77yb5Y+v6YG4IGR1bXDjgIFyZWNvcmTjgIJcbiAqIEVkaXRvcjogRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncmVzZXQtcHJvcGVydHknLCBvcHRpb25zKVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlUmVzZXRQcm9wZXJ0eShwYXJhbXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW4gfT4ge1xuICAgIGNvbnN0IHBhcnNlZCA9IHJlcXVpcmVSZXNldFByb3BlcnR5UGFyYW1zKHBhcmFtcyk7XG4gICAgY29uc3QgdXVpZCA9IGF3YWl0IHJlc29sdmVOb2RlVXVpZChwYXJzZWQpO1xuICAgIGNvbnN0IHsgcGF0aCwgZHVtcCwgcmVjb3JkIH0gPSBwYXJzZWQ7XG4gICAgY29uc3QgTWVzc2FnZSA9IGdldEVkaXRvck1lc3NhZ2UoKTtcblxuICAgIGxldCBwYXRoVG9Vc2UgPSBwYXRoO1xuICAgIGlmIChpc1R5cGVQYXRoKHBhdGgpKSB7XG4gICAgICAgIGNvbnN0IHJhdyA9IGF3YWl0IE1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIHV1aWQpO1xuICAgICAgICBpZiAocmF3ID09PSBudWxsIHx8IHJhdyA9PT0gdW5kZWZpbmVkIHx8IHR5cGVvZiByYXcgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkocmF3KSkge1xuICAgICAgICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKCdOb2RlIG5vdCBmb3VuZCBvciBpbnZhbGlkIGR1bXAnKSBhcyBFcnJvciAmIHsgY29kZT86IHN0cmluZyB9O1xuICAgICAgICAgICAgZXJyLmNvZGUgPSAnQVNTRVRfTk9UX0ZPVU5EJztcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXNvbHZlZCA9IHJlc29sdmVQYXRoSWZUeXBlUGF0aChyYXcgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4sIHBhdGgpO1xuICAgICAgICBpZiAocmVzb2x2ZWQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcignQ29tcG9uZW50IG5vdCBmb3VuZCBmb3IgdHlwZSBwYXRoOiAnICsgcGF0aCkgYXMgRXJyb3IgJiB7IGNvZGU/OiBzdHJpbmcgfTtcbiAgICAgICAgICAgIGVyci5jb2RlID0gJ0FTU0VUX05PVF9GT1VORCc7XG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgICAgcGF0aFRvVXNlID0gcmVzb2x2ZWQ7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgb3B0aW9uczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7IHV1aWQsIHBhdGg6IHBhdGhUb1VzZSB9O1xuICAgICAgICBpZiAoZHVtcCAhPT0gdW5kZWZpbmVkKSBvcHRpb25zLmR1bXAgPSBkdW1wO1xuICAgICAgICBpZiAodHlwZW9mIHJlY29yZCA9PT0gJ2Jvb2xlYW4nKSBvcHRpb25zLnJlY29yZCA9IHJlY29yZDtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdyZXNldC1wcm9wZXJ0eScsIG9wdGlvbnMpO1xuICAgICAgICBzYXZlU2NlbmVBZnRlckVkaXQoKTtcbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogcmVzdWx0ID09PSB0cnVlIH07XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zdCB7IGNvZGUsIG1lc3NhZ2UgfSA9IHRvQ29udHJhY3RFcnJvcihlKTtcbiAgICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UpIGFzIEVycm9yICYgeyBjb2RlPzogc3RyaW5nIH07XG4gICAgICAgIGVyci5jb2RlID0gY29kZTtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbn1cblxuLyoqXG4gKiBzY2VuZS5vcGVu77ya6ZaL5ZWf5aC05pmvL3ByZWZhYuOAgnBhcmFtcyDngrogdXVpZCDmiJYgYXNzZXRQYXRoIOS6jOmBuOS4gO+8m2Fzc2V0UGF0aCDlj6/ngrogZGI644CBZGI6Ly8g5oiW5bCI5qGI55u45bCN6Lev5b6R77yM57aTIHJlc29sdmVBc3NldFBhdGgg6Kej5p6Q54K6IHV1aWQg5b6M5ZG85Y+rIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ29wZW4tc2NlbmUnLCB1dWlkKeOAglxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlU2NlbmVPcGVuKHBhcmFtczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBQcm9taXNlPFJlY29yZDxzdHJpbmcsIG5ldmVyPj4ge1xuICAgIGNvbnN0IHBhcnNlZCA9IHJlcXVpcmVTY2VuZU9wZW5QYXJhbXMocGFyYW1zKTtcbiAgICBsZXQgdXVpZDogc3RyaW5nO1xuICAgIGlmICgndXVpZCcgaW4gcGFyc2VkKSB7XG4gICAgICAgIHV1aWQgPSBwYXJzZWQudXVpZDtcbiAgICB9IGVsc2Uge1xuICAgICAgICB1dWlkID0gYXdhaXQgcmVzb2x2ZUFzc2V0UGF0aChwYXJzZWQuYXNzZXRQYXRoKTtcbiAgICB9XG4gICAgY29uc3QgTWVzc2FnZSA9IGdldEVkaXRvck1lc3NhZ2UoKTtcbiAgICB0cnkge1xuICAgICAgICBhd2FpdCBNZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ29wZW4tc2NlbmUnLCB1dWlkKTtcbiAgICAgICAgcmV0dXJuIHt9O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc3QgeyBjb2RlLCBtZXNzYWdlIH0gPSB0b0NvbnRyYWN0RXJyb3IoZSk7XG4gICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihtZXNzYWdlKSBhcyBFcnJvciAmIHsgY29kZT86IHN0cmluZyB9O1xuICAgICAgICBlcnIuY29kZSA9IGNvZGU7XG4gICAgICAgIHRocm93IGVycjtcbiAgICB9XG59XG5cbi8qKiBzY2VuZS5xdWVyeS1jdXJyZW50IOWbnuWCs+Wei+WIpe+8mnV1aWQvdHlwZSDoi6UgRWRpdG9yIOacquaatOmcsuWJh+eCuiBudWxs44CCICovXG5leHBvcnQgaW50ZXJmYWNlIFNjZW5lUXVlcnlDdXJyZW50UmVzdWx0IHtcbiAgICB1dWlkOiBzdHJpbmcgfCBudWxsO1xuICAgIHR5cGU/OiAnc2NlbmUnIHwgJ3ByZWZhYic7XG4gICAgZGlydHk/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIHNjZW5lLnF1ZXJ5LWN1cnJlbnTvvJrmn6XoqaLnlbbliY0gZm9jdXMg55qE5aC05pmvL3ByZWZhYuOAgueEoSBwYXJhbXPjgIJcbiAqIOWbnuWCsyB7IHV1aWQsIHR5cGU/LCBkaXJ0eT8gfeOAgmRpcnR5IOmAj+mBjiBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1kaXJ0eScpIOWPluW+l++8m1xuICogdXVpZC90eXBlIOebruWJjeeEoeebtOaOpSBFZGl0b3IgTWVzc2FnZe+8jOWbnuWCsyBudWxs77yM5b6FIEVkaXRvciDmmrTpnLLlvozlj6/oo5zkuIrjgIJcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZVNjZW5lUXVlcnlDdXJyZW50KF9wYXJhbXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTxTY2VuZVF1ZXJ5Q3VycmVudFJlc3VsdD4ge1xuICAgIGNvbnN0IE1lc3NhZ2UgPSBnZXRFZGl0b3JNZXNzYWdlKCk7XG4gICAgbGV0IGRpcnR5OiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICAgIHRyeSB7XG4gICAgICAgIGRpcnR5ID0gYXdhaXQgTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1kaXJ0eScpIGFzIGJvb2xlYW47XG4gICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIHF1ZXJ5LWRpcnR5IOWPr+iDveS4jeWtmOWcqOaIluWkseaVl++8jOeVpemBjlxuICAgIH1cbiAgICAvLyDnm67liY0gc2NlbmUg5qih57WE54ShIHF1ZXJ5IOeVtuWJjSBmb2N1cyDnmoQgc2NlbmUvcHJlZmFiIHV1aWQg55qEIE1lc3NhZ2XvvIx1dWlkL3R5cGUg5Zue5YKzIG51bGxcbiAgICByZXR1cm4ge1xuICAgICAgICB1dWlkOiBudWxsLFxuICAgICAgICBkaXJ0eSxcbiAgICB9O1xufVxuXG4vKipcbiAqIHNjZW5lLmNyZWF0Ze+8muW7uueri+aWsOWgtOaZr+izh+a6kOOAgnBhcmFtc++8mmFzc2V0UGF0aO+8iOW/heWhq++8ieOAgW9wZW4/77yI5Y+v6YG477yM5bu656uL5b6M5piv5ZCm6ZaL5ZWf77yJ44CCXG4gKiDkvb/nlKggYXNzZXQtZGIgY3JlYXRlLWFzc2V0IOW7uueri+epuiAuc2NlbmUg5qqU77yb6IulIG9wZW4g54K6IHRydWUg5YmH5YaN5ZG85Y+rIG9wZW4tc2NlbmXjgIJcbiAqIHJlc3VsdDogeyB1dWlkOiBzdHJpbmcgfeOAguiLpSBFZGl0b3Ig54Sh55u05o6lIGNyZWF0ZS1zY2VuZSBNZXNzYWdl77yM5YmH5Lul5bu656uL56m65aC05pmv5qqU5pa55byP5a+m5L2c44CCXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBoYW5kbGVTY2VuZUNyZWF0ZShwYXJhbXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTx7IHV1aWQ6IHN0cmluZyB9PiB7XG4gICAgY29uc3QgcGFyc2VkID0gcmVxdWlyZVNjZW5lQ3JlYXRlUGFyYW1zKHBhcmFtcyk7XG4gICAgY29uc3QgdXJsID0gYXNzZXRQYXRoVG9TY2VuZVVybChwYXJzZWQuYXNzZXRQYXRoKTtcbiAgICBjb25zdCBNZXNzYWdlID0gZ2V0RWRpdG9yTWVzc2FnZSgpO1xuICAgIHRyeSB7XG4gICAgICAgIC8vIEVkaXRvciDmnKrmmrTpnLLjgIzmlrDlu7rloLTmma/jgI1NZXNzYWdl77yM5L2/55SoIGFzc2V0LWRiIGNyZWF0ZS1hc3NldCDlu7rnq4vnqbogLnNjZW5lIOaqlFxuICAgICAgICBjb25zdCBtaW5pbWFsU2NlbmVDb250ZW50ID0gSlNPTi5zdHJpbmdpZnkoeyBfX3R5cGVfXzogJ2NjLlNjZW5lQXNzZXQnLCBfb2JqRmxhZ3M6IDAgfSk7XG4gICAgICAgIGNvbnN0IGluZm8gPSBhd2FpdCBNZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NyZWF0ZS1hc3NldCcsIHVybCwgbWluaW1hbFNjZW5lQ29udGVudCkgYXMgeyB1dWlkPzogc3RyaW5nIH0gfCBudWxsO1xuICAgICAgICBpZiAoIWluZm8gfHwgdHlwZW9mIGluZm8udXVpZCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcignU2NlbmUgY3JlYXRlIGZhaWxlZCBvciBFZGl0b3IgQVBJIG5vdCBhdmFpbGFibGUgKOW+hSBFZGl0b3Ig5pq06ZyyKScpIGFzIEVycm9yICYgeyBjb2RlPzogc3RyaW5nIH07XG4gICAgICAgICAgICBlcnIuY29kZSA9ICdTQ0VORV9FUlJPUic7XG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdXVpZCA9IGluZm8udXVpZDtcbiAgICAgICAgaWYgKHBhcnNlZC5vcGVuID09PSB0cnVlKSB7XG4gICAgICAgICAgICBhd2FpdCBNZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ29wZW4tc2NlbmUnLCB1dWlkKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyB1dWlkIH07XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zdCB7IGNvZGUsIG1lc3NhZ2UgfSA9IHRvQ29udHJhY3RFcnJvcihlKTtcbiAgICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UpIGFzIEVycm9yICYgeyBjb2RlPzogc3RyaW5nIH07XG4gICAgICAgIGVyci5jb2RlID0gY29kZTtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbn1cbiJdfQ==