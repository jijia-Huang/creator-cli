/**
 * 節點路徑解析：將 nodePath（如 "Root/Canvas/Sprite"）解析為節點 uuid。
 * 無 db: 前綴視為節點路徑；與 prefab-handlers 的 query-node-tree 共用 node-tree-normalize 的 flat 格式。
 */

import { normalizeTree } from './node-tree-normalize';

declare const Editor: {
    Message: {
        request(module: string, method: string, ...args: unknown[]): Promise<unknown>;
    };
};

function getEditorMessage(): { request(module: string, method: string, ...args: unknown[]): Promise<unknown> } {
    const E = (globalThis as unknown as { Editor?: typeof Editor }).Editor;
    if (!E?.Message || typeof E.Message.request !== 'function') {
        const err = new Error('Editor.Message not available') as Error & { code?: string };
        err.code = 'SCENE_ERROR';
        throw err;
    }
    return E.Message;
}

/** 正規化路徑：trim、統一用 /、去掉開頭多餘 / */
function normalizePath(p: string): string {
    return p.replace(/\\/g, '/').replace(/\/+/g, '/').trim().replace(/^\//, '') || 'Root';
}

/**
 * 依路徑在 flat 列表中查找節點，回傳 uuid 與 canonical path。
 */
async function resolveNodeByPath(
    sceneContext: string | undefined,
    nodePath: string
): Promise<{ uuid: string; path: string }> {
    const Message = getEditorMessage();
    const rootUuid =
        sceneContext !== undefined &&
        sceneContext !== null &&
        typeof sceneContext === 'string' &&
        /^[a-fA-F0-9]{32}$/.test(sceneContext)
            ? sceneContext
            : undefined;

    const raw =
        rootUuid !== undefined
            ? await Message.request('scene', 'query-node-tree', rootUuid)
            : await Message.request('scene', 'query-node-tree');

    if (raw === undefined || raw === null) {
        const err = new Error('Node or scene not found') as Error & { code?: string };
        err.code = 'ASSET_NOT_FOUND';
        throw err;
    }

    const { flat } = normalizeTree(raw, {});
    const targetPath = normalizePath(nodePath);
    const item = flat.find((n) => normalizePath(n.path) === targetPath);
    if (!item) {
        const err = new Error('Node not found for path: ' + nodePath) as Error & { code?: string };
        err.code = 'ASSET_NOT_FOUND';
        throw err;
    }
    return { uuid: item.uuid, path: item.path };
}

/**
 * 將節點路徑（如 "Root/Canvas/Sprite"）解析為節點 uuid。
 * 無 db: 前綴視為節點路徑；有 db: 前綴為資源路徑，此函式不處理。
 * @param sceneContext 可選根節點 uuid，省略則以當前場景根查詢
 * @param nodePath 節點路徑字串
 * @returns 節點 uuid
 */
export async function nodePathToUuid(
    sceneContext: string | undefined,
    nodePath: string
): Promise<string> {
    if (typeof nodePath !== 'string' || nodePath.trim() === '') {
        const err = new Error('INVALID_PARAMS') as Error & { code?: string };
        err.code = 'INVALID_PARAMS';
        throw err;
    }
    if (nodePath.startsWith('db:') || nodePath.startsWith('db://')) {
        const err = new Error('Node path must not be asset path (db:)') as Error & { code?: string };
        err.code = 'INVALID_PARAMS';
        throw err;
    }
    const { uuid } = await resolveNodeByPath(sceneContext, nodePath);
    return uuid;
}

/** resolve-node 的 params：path 或 parentPath + name 二選一 */
export type ResolveNodeParams = { path?: string; parentPath?: string; name?: string };

/**
 * 處理 resolve-node：依 path 或 parentPath+name 解析節點，回傳 uuid 與 path。
 */
export async function handleResolveNode(params: Record<string, unknown>): Promise<{
    uuid: string;
    path?: string;
}> {
    const pathVal = params.path;
    const parentPath = params.parentPath;
    const name = params.name;

    let path: string;
    if (typeof pathVal === 'string' && pathVal.trim() !== '') {
        path = pathVal.trim();
    } else if (
        typeof name === 'string' &&
        name.trim() !== '' &&
        (parentPath === undefined || parentPath === null || typeof parentPath === 'string')
    ) {
        const parent = parentPath != null && typeof parentPath === 'string' ? parentPath.trim() : '';
        path = parent ? `${parent}/${name.trim()}` : name.trim();
    } else {
        const err = new Error('INVALID_PARAMS') as Error & { code?: string };
        err.code = 'INVALID_PARAMS';
        throw err;
    }

    if (path.startsWith('db:') || path.startsWith('db://')) {
        const err = new Error('Node path must not be asset path (db:)') as Error & { code?: string };
        err.code = 'INVALID_PARAMS';
        throw err;
    }

    const sceneContext = params.sceneContext;
    const rootUuid =
        sceneContext !== undefined &&
        sceneContext !== null &&
        typeof sceneContext === 'string' &&
        /^[a-fA-F0-9]{32}$/.test(sceneContext)
            ? sceneContext
            : undefined;

    const resolved = await resolveNodeByPath(rootUuid, path);
    return { uuid: resolved.uuid, path: resolved.path };
}
