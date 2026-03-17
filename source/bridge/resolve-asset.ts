/**
 * 資源路徑解析：將 "db:" / "db://" / 專案相對路徑 解析為資源 uuid。
 * 使用 Editor.Message.request('asset-db', 'query-uuid', urlOrPath) 或 query-asset-info。
 */

const UUID_REGEX = /^[a-fA-F0-9]{32}$/;

function getEditorMessage(): { request(module: string, method: string, ...args: unknown[]): Promise<unknown> } {
    const E = (globalThis as unknown as { Editor?: { Message?: { request: (module: string, method: string, ...args: unknown[]) => Promise<unknown> } } }).Editor;
    if (!E?.Message || typeof E.Message.request !== 'function') {
        const err = new Error('Editor.Message not available') as Error & { code?: string };
        err.code = 'SCENE_ERROR';
        throw err;
    }
    return E.Message;
}

/**
 * 將 assetPath 正規化為 asset-db 可接受的 urlOrPath（專案相對路徑或 db url）。
 */
function normalizeAssetPath(assetPath: string): string {
    const s = assetPath.trim();
    if (s.startsWith('db://')) return s;
    if (s.startsWith('db:')) return 'db://' + s.slice(3).replace(/^\/+/, '');
    return s;
}

/**
 * 將 prefab 資源路徑轉為可寫入的 db url（結尾 .prefab）。
 * 供 prefab.create 呼叫 Editor scene createPrefab(uuid, url) 使用。
 */
export function assetPathToPrefabUrl(assetPath: string): string {
    const s = assetPath.trim();
    if (!s) {
        const err = new Error('INVALID_PARAMS') as Error & { code?: string };
        err.code = 'INVALID_PARAMS';
        throw err;
    }
    let url = normalizeAssetPath(s);
    if (!url.endsWith('.prefab')) {
        url = url.replace(/\/+$/, '') + '.prefab';
    }
    return url;
}

/**
 * 將場景資源路徑轉為可寫入的 db url（結尾 .scene）。
 * 供 scene.create 建立空場景檔使用。
 */
export function assetPathToSceneUrl(assetPath: string): string {
    const s = assetPath.trim();
    if (!s) {
        const err = new Error('INVALID_PARAMS') as Error & { code?: string };
        err.code = 'INVALID_PARAMS';
        throw err;
    }
    let url = normalizeAssetPath(s);
    if (!url.endsWith('.scene')) {
        url = url.replace(/\/+$/, '') + '.scene';
    }
    return url;
}

/**
 * 將資源路徑解析為 uuid。
 * - 接受 "db:assets/..."、"db://assets/..." 或專案相對路徑（如 "assets/..."）。
 * - 若 assetPath 已為 32 位 hex uuid，直接回傳（不呼叫 asset-db）。
 * - 內部使用 Editor.Message.request('asset-db', 'query-uuid', urlOrPath)；若無結果則改試 query-asset-info 取 uuid。
 */
export async function resolveAssetPath(assetPath: string): Promise<string> {
    const s = assetPath.trim();
    if (!s) {
        const err = new Error('INVALID_PARAMS') as Error & { code?: string };
        err.code = 'INVALID_PARAMS';
        throw err;
    }
    if (UUID_REGEX.test(s)) return s;

    const Message = getEditorMessage();
    const urlOrPath = normalizeAssetPath(s);
    let uuid: string | null = null;
    try {
        uuid = await Message.request('asset-db', 'query-uuid', urlOrPath) as string | null;
    } catch {
        // 若 query-uuid 不存在或失敗，改試 query-asset-info
    }
    if (uuid && typeof uuid === 'string') return uuid;

    try {
        const info = await Message.request('asset-db', 'query-asset-info', urlOrPath) as { uuid?: string } | null;
        if (info?.uuid && typeof info.uuid === 'string') return info.uuid;
    } catch {
        // ignore
    }
    const err = new Error('Asset not found') as Error & { code?: string };
    err.code = 'ASSET_NOT_FOUND';
    throw err;
}
