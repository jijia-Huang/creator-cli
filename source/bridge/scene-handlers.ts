/**
 * 場景節點操作：create-component、remove-component、create-node、remove-node、
 * set-property（value / dump）、reset-property。對應 Editor.Message.request('scene', ...)。
 * 對齊 blueprint API 契約與 @cocos/creator-types 之 CreateComponentOptions、SetPropertyOptions 等。
 */

import { saveSceneAfterEdit } from './auto-save';
import { isResolvedComponentPath, resolveComponentPath } from './component-path';
import { resolveAssetPath, assetPathToSceneUrl } from './resolve-asset';
import { nodePathToUuid } from './resolve-node';
import {
    requireCreateComponentParams,
    requireCreateNodeParams,
    requireRemoveComponentParams,
    requireRemoveNodeParams,
    requireResetPropertyParams,
    requireSceneCreateParams,
    requireSceneOpenParams,
    requireSetPropertyParams,
} from './validate';

declare const Editor: {
    Message: {
        request(module: string, method: string, ...args: any[]): Promise<any>;
    };
};

function getEditorMessage(): { request(module: string, method: string, ...args: any[]): Promise<any> } {
    const E = (globalThis as any).Editor;
    if (!E || !E.Message || typeof E.Message.request !== 'function') {
        const err = new Error('Editor.Message not available') as Error & { code?: string };
        err.code = 'SCENE_ERROR';
        throw err;
    }
    return E.Message;
}

/** 判斷 path 是否為型別 path（如 cc.Sprite.spriteFrame），需先解析成 __comps__.N.xxx */
function isTypePath(path: string): boolean {
    const p = path.trim();
    return p.length > 0 && p.includes('cc.') && !isResolvedComponentPath(p);
}

/** 若 path 為型別 path 則用 nodeDump 解析為 __comps__.N.xxx，否則回傳原 path。解析失敗回傳 null。 */
function resolvePathIfTypePath(nodeDump: Record<string, unknown>, path: string): string | null {
    if (!isTypePath(path)) return path;
    return resolveComponentPath(nodeDump, path);
}

/** 將節點識別（uuid 或 nodePath）解析為 uuid；若已是 uuid 直接回傳。 */
async function resolveNodeUuid(
    ref: { uuid: string } | { nodePath: string },
    sceneContext?: string
): Promise<string> {
    if ('uuid' in ref) return ref.uuid;
    return nodePathToUuid(sceneContext, ref.nodePath);
}

/** 將 Editor 錯誤轉為契約錯誤碼 */
function toContractError(e: unknown): { code: string; message: string } {
    if (e && typeof e === 'object' && 'code' in e && typeof (e as any).code === 'string') {
        const code = (e as any).code;
        if (code === 'INVALID_PARAMS') return { code: 'INVALID_PARAMS', message: 'Invalid or missing parameters' };
        if (
            code === 'ASSET_NOT_FOUND' ||
            code === 'ENOENT' ||
            (typeof (e as any).message === 'string' && ((e as any).message as string).toLowerCase().includes('not found'))
        ) {
            return { code: 'ASSET_NOT_FOUND', message: 'Asset or node not found' };
        }
    }
    return { code: 'SCENE_ERROR', message: 'Scene operation failed' };
}

/** 判斷 value 是否為資源路徑（db: / db:// / 專案相對路徑 assets/），需解析為 uuid。 */
function isAssetPathValue(value: unknown): value is string {
    if (typeof value !== 'string' || value.trim() === '') return false;
    const s = value.trim();
    return s.startsWith('db:') || s.startsWith('db://') || s.startsWith('assets/');
}

/** 若 value 為物件且含 __uuid__，視為已是資源引用；否則若為資源路徑字串則解析為 { __uuid__ }。 */
async function normalizePropertyValue(value: unknown): Promise<unknown> {
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && '__uuid__' in value && typeof (value as { __uuid__?: unknown }).__uuid__ === 'string') {
        return value;
    }
    if (isAssetPathValue(value)) {
        const uuid = await resolveAssetPath(value);
        return { __uuid__: uuid };
    }
    return value;
}

/**
 * 依 path（如 "name"、"__comps__.0.enabled"）取得 dump 內對應的巢狀物件。
 * 用於 set-property value 模式：取得 IProperty 後寫入 .value 再送 set-property。
 */
function getAtPath(obj: Record<string, unknown>, path: string): Record<string, unknown> | undefined {
    const keys = path.split('.');
    let current: unknown = obj;
    for (let i = 0; i < keys.length; i++) {
        if (current === null || current === undefined) return undefined;
        if (typeof current !== 'object' || Array.isArray(current)) return undefined;
        const key = keys[i];
        const next = (current as Record<string, unknown>)[key];
        if (i === keys.length - 1) {
            return typeof next === 'object' && next !== null && !Array.isArray(next) ? (next as Record<string, unknown>) : undefined;
        }
        current = next;
    }
    return undefined;
}

/**
 * create-component：在節點上建立組件。params 支援 uuid 或 nodePath 二選一（節點）。
 * Editor: Editor.Message.request('scene', 'create-component', { uuid, component })
 */
export async function handleCreateComponent(params: Record<string, unknown>): Promise<null | Record<string, never>> {
    const parsed = requireCreateComponentParams(params);
    const uuid = await resolveNodeUuid(parsed);
    const Message = getEditorMessage();
    try {
        await Message.request('scene', 'create-component', { uuid, component: parsed.component });
        saveSceneAfterEdit();
        return {};
    } catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message) as Error & { code?: string };
        err.code = code;
        throw err;
    }
}

/**
 * remove-component：依組件 UUID 移除組件。
 * Editor: Editor.Message.request('scene', 'remove-component', { uuid })
 */
export async function handleRemoveComponent(params: Record<string, unknown>): Promise<null | Record<string, never>> {
    const { uuid } = requireRemoveComponentParams(params);
    const Message = getEditorMessage();
    try {
        await Message.request('scene', 'remove-component', { uuid });
        saveSceneAfterEdit();
        return {};
    } catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message) as Error & { code?: string };
        err.code = code;
        throw err;
    }
}

/**
 * create-node：建立節點，回傳新節點 uuid。params 可含 uuid 或 nodePath（parent）二選一。
 * Editor: Editor.Message.request('scene', 'create-node', options) → string
 */
export async function handleCreateNode(params: Record<string, unknown>): Promise<{ uuid: string }> {
    const parsed = requireCreateNodeParams(params);
    const options: Record<string, unknown> = { ...parsed };
    if ('nodePath' in parsed && parsed.nodePath !== undefined) {
        options.parent = await nodePathToUuid(undefined, parsed.nodePath as string);
        delete options.nodePath;
        delete options.uuid;
    } else if ('uuid' in parsed && parsed.uuid !== undefined) {
        options.parent = parsed.uuid as string;
        delete options.uuid;
    }
    const Message = getEditorMessage();
    try {
        const uuid = await Message.request('scene', 'create-node', options);
        saveSceneAfterEdit();
        return { uuid: typeof uuid === 'string' ? uuid : String(uuid) };
    } catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message) as Error & { code?: string };
        err.code = code;
        throw err;
    }
}

/**
 * remove-node：移除節點（單一或陣列）。params 支援 uuid（單一或陣列）或 nodePath 二選一。
 * Editor: Editor.Message.request('scene', 'remove-node', { uuid, keepWorldTransform? })
 */
export async function handleRemoveNode(params: Record<string, unknown>): Promise<null | Record<string, never>> {
    const parsed = requireRemoveNodeParams(params);
    const Message = getEditorMessage();
    let uuid: string | string[];
    if ('nodePath' in parsed) {
        uuid = await nodePathToUuid(undefined, parsed.nodePath);
    } else {
        uuid = parsed.uuid;
    }
    const keepWorldTransform = parsed.keepWorldTransform;
    try {
        await Message.request('scene', 'remove-node', { uuid, ...(typeof keepWorldTransform === 'boolean' ? { keepWorldTransform } : {}) });
        saveSceneAfterEdit();
        return {};
    } catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message) as Error & { code?: string };
        err.code = code;
        throw err;
    }
}

/**
 * set-property：寫入屬性。params 支援 uuid 或 nodePath 二選一。dump 模式直接轉交；value 模式先 query-node 取 dump，於 path 處設 .value 再送 set-property。
 * Editor: Editor.Message.request('scene', 'set-property', { uuid, path, dump, record? })
 */
export async function handleSetProperty(params: Record<string, unknown>): Promise<{ success: boolean }> {
    const parsed = requireSetPropertyParams(params);
    const uuid = await resolveNodeUuid(parsed);
    const { path, dump, value, record } = parsed;
    const Message = getEditorMessage();

    const needNodeDumpForPath = isTypePath(path);
    const needNodeDumpForValue = dump === undefined;
    let nodeDump: Record<string, unknown> | null = null;

    if (needNodeDumpForPath || needNodeDumpForValue) {
        const raw = await Message.request('scene', 'query-node', uuid);
        if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
            const err = new Error('Node not found or invalid dump') as Error & { code?: string };
            err.code = 'ASSET_NOT_FOUND';
            throw err;
        }
        nodeDump = raw as Record<string, unknown>;
    }

    let pathToUse = path;
    if (needNodeDumpForPath && nodeDump) {
        const resolved = resolvePathIfTypePath(nodeDump, path);
        if (resolved === null) {
            const err = new Error('Component not found for type path: ' + path) as Error & { code?: string };
            err.code = 'ASSET_NOT_FOUND';
            throw err;
        }
        pathToUse = resolved;
    }

    let finalDump: Record<string, unknown>;
    if (dump !== undefined) {
        finalDump = dump;
    } else {
        // value 模式：若 value 為資源路徑（db: / db:// / assets/）先解析為 { __uuid__ }；若已是 { __uuid__ } 保持不變
        const resolvedValue = await normalizePropertyValue(value);
        const prop = getAtPath(nodeDump!, pathToUse);
        finalDump = prop ? { ...prop, value: resolvedValue } : { value: resolvedValue };
    }

    try {
        const result = await Message.request('scene', 'set-property', {
            uuid,
            path: pathToUse,
            dump: finalDump,
            ...(typeof record === 'boolean' ? { record } : {}),
        });
        saveSceneAfterEdit();
        return { success: result === true };
    } catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message) as Error & { code?: string };
        err.code = code;
        throw err;
    }
}

/**
 * reset-property：重置屬性。params 支援 uuid 或 nodePath 二選一，path 必填；可選 dump、record。
 * Editor: Editor.Message.request('scene', 'reset-property', options)
 */
export async function handleResetProperty(params: Record<string, unknown>): Promise<{ success: boolean }> {
    const parsed = requireResetPropertyParams(params);
    const uuid = await resolveNodeUuid(parsed);
    const { path, dump, record } = parsed;
    const Message = getEditorMessage();

    let pathToUse = path;
    if (isTypePath(path)) {
        const raw = await Message.request('scene', 'query-node', uuid);
        if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
            const err = new Error('Node not found or invalid dump') as Error & { code?: string };
            err.code = 'ASSET_NOT_FOUND';
            throw err;
        }
        const resolved = resolvePathIfTypePath(raw as Record<string, unknown>, path);
        if (resolved === null) {
            const err = new Error('Component not found for type path: ' + path) as Error & { code?: string };
            err.code = 'ASSET_NOT_FOUND';
            throw err;
        }
        pathToUse = resolved;
    }

    try {
        const options: Record<string, unknown> = { uuid, path: pathToUse };
        if (dump !== undefined) options.dump = dump;
        if (typeof record === 'boolean') options.record = record;
        const result = await Message.request('scene', 'reset-property', options);
        saveSceneAfterEdit();
        return { success: result === true };
    } catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message) as Error & { code?: string };
        err.code = code;
        throw err;
    }
}

/**
 * scene.open：開啟場景/prefab。params 為 uuid 或 assetPath 二選一；assetPath 可為 db:、db:// 或專案相對路徑，經 resolveAssetPath 解析為 uuid 後呼叫 Editor.Message.request('scene', 'open-scene', uuid)。
 */
export async function handleSceneOpen(params: Record<string, unknown>): Promise<Record<string, never>> {
    const parsed = requireSceneOpenParams(params);
    let uuid: string;
    if ('uuid' in parsed) {
        uuid = parsed.uuid;
    } else {
        uuid = await resolveAssetPath(parsed.assetPath);
    }
    const Message = getEditorMessage();
    try {
        await Message.request('scene', 'open-scene', uuid);
        return {};
    } catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message) as Error & { code?: string };
        err.code = code;
        throw err;
    }
}

/** scene.query-current 回傳型別：uuid/type 若 Editor 未暴露則為 null。 */
export interface SceneQueryCurrentResult {
    uuid: string | null;
    type?: 'scene' | 'prefab';
    dirty?: boolean;
}

/**
 * scene.query-current：查詢當前 focus 的場景/prefab。無 params。
 * 回傳 { uuid, type?, dirty? }。dirty 透過 Editor.Message.request('scene', 'query-dirty') 取得；
 * uuid/type 目前無直接 Editor Message，回傳 null，待 Editor 暴露後可補上。
 */
export async function handleSceneQueryCurrent(_params: Record<string, unknown>): Promise<SceneQueryCurrentResult> {
    const Message = getEditorMessage();
    let dirty: boolean | undefined;
    try {
        dirty = await Message.request('scene', 'query-dirty') as boolean;
    } catch {
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
export async function handleSceneCreate(params: Record<string, unknown>): Promise<{ uuid: string }> {
    const parsed = requireSceneCreateParams(params);
    const url = assetPathToSceneUrl(parsed.assetPath);
    const Message = getEditorMessage();
    try {
        // Editor 未暴露「新建場景」Message，使用 asset-db create-asset 建立空 .scene 檔
        const minimalSceneContent = JSON.stringify({ __type__: 'cc.SceneAsset', _objFlags: 0 });
        const info = await Message.request('asset-db', 'create-asset', url, minimalSceneContent) as { uuid?: string } | null;
        if (!info || typeof info.uuid !== 'string') {
            const err = new Error('Scene create failed or Editor API not available (待 Editor 暴露)') as Error & { code?: string };
            err.code = 'SCENE_ERROR';
            throw err;
        }
        const uuid = info.uuid;
        if (parsed.open === true) {
            await Message.request('scene', 'open-scene', uuid);
        }
        return { uuid };
    } catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message) as Error & { code?: string };
        err.code = code;
        throw err;
    }
}
