/**
 * Prefab 操作：對應 Editor.Message.request('scene', ...)，回傳 result 或拋出契約錯誤碼。
 * 對齊 blueprint §2 / §3 節點樹正規化契約。
 */

import { saveSceneAfterEdit } from './auto-save';
import { nodePathToUuid } from './resolve-node';
import { assetPathToPrefabUrl } from './resolve-asset';
import { requireUuid, requireRestoreUuids, requirePrefabCreateParams } from './validate';
import { normalizeTree } from './node-tree-normalize';

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

/** 將 Editor 錯誤轉為契約錯誤碼 */
function toContractError(e: unknown): { code: string; message: string } {
    if (e && typeof e === 'object' && 'code' in e && typeof (e as any).code === 'string') {
        const code = (e as any).code;
        if (code === 'INVALID_PARAMS') return { code: 'INVALID_PARAMS', message: 'Invalid or missing parameters' };
        if (code === 'ASSET_NOT_FOUND' || code === 'ENOENT' || (typeof (e as any).message === 'string' && ((e as any).message as string).toLowerCase().includes('not found'))) {
            return { code: 'ASSET_NOT_FOUND', message: 'Asset or node not found' };
        }
    }
    return { code: 'SCENE_ERROR', message: 'Scene operation failed' };
}

/**
 * prefab.query-node：查詢單一節點。
 * Editor: Editor.Message.request('scene', 'query-node', uuid)
 */
export async function handleQueryNode(params: Record<string, unknown>): Promise<unknown> {
    const uuid = requireUuid(params, 'uuid');
    const Message = getEditorMessage();
    try {
        const result = await Message.request('scene', 'query-node', uuid);
        return result ?? null;
    } catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message) as Error & { code?: string };
        err.code = code;
        throw err;
    }
}

/** 從 params 解析可選的 maxDepth / maxChildren（正整數）；無效則忽略 */
function parseTreeLimit(value: unknown): number | undefined {
    if (value === undefined || value === null) return undefined;
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(n) || n < 1) return undefined;
    return n;
}

/**
 * prefab.query-node-tree：查詢節點樹並回傳正規化結果。
 * 支援 params：uuid（可選根節點）、format（tree|markdown|flat）、maxDepth、maxChildren。
 * 預設同時回傳 tree 與 markdown；截斷時節點帶 truncated / truncatedChildren。
 * Editor: Editor.Message.request('scene', 'query-node-tree', uuid?)
 */
export async function handleQueryNodeTree(params: Record<string, unknown>): Promise<unknown> {
    const uuid = params.uuid;
    const Message = getEditorMessage();
    const rootUuid = uuid !== undefined && uuid !== null && typeof uuid === 'string' && /^[a-fA-F0-9]{32}$/.test(uuid) ? uuid : undefined;
    const format = typeof params.format === 'string' ? params.format : undefined;
    const maxDepth = parseTreeLimit(params.maxDepth);
    const maxChildren = parseTreeLimit(params.maxChildren);

    try {
        const raw = rootUuid !== undefined
            ? await Message.request('scene', 'query-node-tree', rootUuid)
            : await Message.request('scene', 'query-node-tree');

        if (raw === undefined || raw === null) {
            const err = new Error('Node or scene not found') as Error & { code?: string };
            err.code = 'ASSET_NOT_FOUND';
            throw err;
        }

        const { tree, markdown, flat } = normalizeTree(raw, { maxDepth, maxChildren });

        // 依 format 回傳：預設 tree + markdown；單一 format 則僅回傳該項（契約 §3.3）
        if (format === 'tree') {
            return { tree };
        }
        if (format === 'markdown') {
            return { markdown };
        }
        if (format === 'flat') {
            return { flat };
        }
        // 未指定或其它：同時回傳 tree 與 markdown
        return { tree, markdown };
    } catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message) as Error & { code?: string };
        err.code = code;
        throw err;
    }
}

/**
 * prefab.restore：還原節點為 prefab 狀態。支援單一 uuid 或 uuids 陣列。
 * Editor: Editor.Message.request('scene', 'restore-prefab', { uuid }) 每顆節點各呼叫一次。
 */
export async function handleRestore(params: Record<string, unknown>): Promise<{ restored: boolean }> {
    const uuids = requireRestoreUuids(params);
    const Message = getEditorMessage();
    try {
        for (const uuid of uuids) {
            const ok = await Message.request('scene', 'restore-prefab', { uuid });
            if (ok === false) {
                return { restored: false };
            }
        }
        saveSceneAfterEdit();
        return { restored: true };
    } catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message) as Error & { code?: string };
        err.code = code;
        throw err;
    }
}

/**
 * prefab.create：從節點建立 prefab。params：nodeUuid 或 nodePath 二選一 + assetPath（必填）。
 * 使用 resolve-node 的 nodePathToUuid 取得節點 uuid；assetPath 轉為可寫入 url 後呼叫 Editor scene create-prefab。
 * result: { uuid: string } 新 prefab 資源 uuid。
 */
export async function handlePrefabCreate(params: Record<string, unknown>): Promise<{ uuid: string }> {
    const parsed = requirePrefabCreateParams(params);
    const nodeUuid =
        'nodeUuid' in parsed
            ? parsed.nodeUuid
            : await nodePathToUuid(undefined, parsed.nodePath);
    const url = assetPathToPrefabUrl(parsed.assetPath);
    const Message = getEditorMessage();
    try {
        const result = await Message.request('scene', 'create-prefab', nodeUuid, url);
        saveSceneAfterEdit();
        let uuid: string;
        if (result !== undefined && result !== null && typeof result === 'string') {
            uuid = result;
        } else {
            uuid = await Message.request('asset-db', 'query-uuid', url) as string;
        }
        if (!uuid || typeof uuid !== 'string') {
            const err = new Error('Prefab created but uuid could not be resolved') as Error & { code?: string };
            err.code = 'SCENE_ERROR';
            throw err;
        }
        return { uuid };
    } catch (e) {
        const { code, message } = toContractError(e);
        const err = new Error(message) as Error & { code?: string };
        err.code = code;
        throw err;
    }
}
