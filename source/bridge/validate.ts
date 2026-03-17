/**
 * Bridge 參數驗證（對齊安全策略：UUID 格式、無路徑穿越）
 */

/** Cocos Creator 節點／資源 UUID：32 個十六進位字元 */
const UUID_REGEX = /^[a-fA-F0-9]{32}$/;

/** Creator 編輯器常見的 base64 風格 id（約 22 字元），用於節點／組件識別 */
const CREATOR_ID_REGEX = /^[A-Za-z0-9+/=-]{20,44}$/;

/**
 * 驗證是否為合法 UUID 格式（32 位 hex），防止路徑穿越或非法輸入。
 * @param value 待驗證字串
 * @returns 是否通過驗證
 */
export function isValidUuid(value: unknown): value is string {
    return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * 驗證是否為 Creator 可接受的 id：32 位 hex 或編輯器常見的 base64 風格 id。
 * 用於 create-component、remove-component、set-property、reset-property 等，因編輯器可能傳回 base64 格式。
 */
export function isValidCreatorId(value: unknown): value is string {
    if (typeof value !== 'string' || value.length < 1 || value.length > 64) return false;
    return UUID_REGEX.test(value) || CREATOR_ID_REGEX.test(value);
}

/**
 * 驗證 params 中必填的單一 uuid 欄位；失敗時拋出錯誤碼供上層回傳。
 */
export function requireUuid(params: Record<string, unknown>, field: string): string {
    const v = params[field];
    if (!isValidUuid(v)) {
        const err = new Error('INVALID_PARAMS') as Error & { code?: string };
        err.code = 'INVALID_PARAMS';
        throw err;
    }
    return v;
}

/**
 * 驗證 params 提供 uuid 或 nodePath 二選一（用於 set-property、reset-property 等可依路徑尋址的 method）。
 * @returns 若為 uuid 則 { uuid }，若為 nodePath 則 { nodePath }；僅能其一。
 */
export function requireNodePathOrUuid(params: Record<string, unknown>): { uuid: string } | { nodePath: string } {
    const hasUuid = isValidUuid(params.uuid);
    const nodePath = params.nodePath;
    const hasNodePath = typeof nodePath === 'string' && nodePath.trim() !== '' && !nodePath.startsWith('db:');
    if (hasUuid && !hasNodePath) {
        return { uuid: params.uuid as string };
    }
    if (hasNodePath && !hasUuid) {
        return { nodePath: (nodePath as string).trim() };
    }
    throwInvalidParams();
}

/**
 * 可選的 uuid 或 nodePath（用於 create-node 的 parent：可省略表示根節點）。
 * @returns {} 當兩者皆無；否則 { uuid } 或 { nodePath } 其一。
 */
export function optionalNodePathOrUuid(params: Record<string, unknown>): {} | { uuid: string } | { nodePath: string } {
    const hasUuid = isValidUuid(params.uuid);
    const nodePath = params.nodePath;
    const hasNodePath = typeof nodePath === 'string' && nodePath.trim() !== '' && !nodePath.startsWith('db:');
    if (hasUuid && !hasNodePath) {
        return { uuid: params.uuid as string };
    }
    if (hasNodePath && !hasUuid) {
        return { nodePath: (nodePath as string).trim() };
    }
    return {};
}

/**
 * 驗證 params 為 restore 用：either 單一 uuid 或 uuids 陣列；回傳 uuid 陣列。
 */
export function requireRestoreUuids(params: Record<string, unknown>): string[] {
    const uuid = params.uuid;
    const uuids = params.uuids;
    if (isValidUuid(uuid)) {
        return [uuid];
    }
    if (Array.isArray(uuids) && uuids.length > 0) {
        const out: string[] = [];
        for (const u of uuids) {
            if (!isValidUuid(u)) {
                const err = new Error('INVALID_PARAMS') as Error & { code?: string };
                err.code = 'INVALID_PARAMS';
                throw err;
            }
            out.push(u);
        }
        return out;
    }
    const err = new Error('INVALID_PARAMS') as Error & { code?: string };
    err.code = 'INVALID_PARAMS';
    throw err;
}

function throwInvalidParams(): never {
    const err = new Error('INVALID_PARAMS') as Error & { code?: string };
    err.code = 'INVALID_PARAMS';
    throw err;
}

/**
 * 驗證 path 為非空字串（set-property / reset-property 用）。
 * path 可為型別 path（如 cc.Sprite.spriteFrame）或既有 __comps__.N.xxx / name 等。
 */
export function requirePath(params: Record<string, unknown>, field: string): string {
    const v = params[field];
    if (typeof v !== 'string' || v.trim() === '') {
        throwInvalidParams();
    }
    return v;
}

/**
 * 驗證 params 中必填的 Creator id（32 hex 或 base64 風格）；失敗時拋出 INVALID_PARAMS。
 */
function requireCreatorId(params: Record<string, unknown>, field: string): string {
    const v = params[field];
    if (!isValidCreatorId(v)) {
        const err = new Error('INVALID_PARAMS') as Error & { code?: string };
        err.code = 'INVALID_PARAMS';
        throw err;
    }
    return v;
}

/** create-component / set-property / reset-property / create-node / remove-node 的節點識別：uuid 或 nodePath 二選一 */
export type NodeRef = { uuid: string } | { nodePath: string };

/**
 * 驗證 create-component 參數：節點為 uuid 或 nodePath 二選一、component（類名字串）。
 */
export function requireCreateComponentParams(params: Record<string, unknown>): NodeRef & { component: string } {
    const ref = requireNodePathOrUuid(params);
    const component = params.component;
    if (typeof component !== 'string' || component.trim() === '') {
        throwInvalidParams();
    }
    return { ...ref, component: component.trim() };
}

/**
 * 驗證 remove-component 參數：uuid 為組件 UUID（接受 32 hex 或 base64 格式）。
 */
export function requireRemoveComponentParams(params: Record<string, unknown>): { uuid: string } {
    return { uuid: requireCreatorId(params, 'uuid') };
}

/**
 * 驗證 create-node 參數：可選 parent 為 uuid 或 nodePath；其餘與 Editor CreateNodeOptions 相容。
 */
export function requireCreateNodeParams(params: Record<string, unknown>): Record<string, unknown> & ({} | { uuid: string } | { nodePath: string }) {
    if (params === null || typeof params !== 'object' || Array.isArray(params)) {
        throwInvalidParams();
    }
    const ref = optionalNodePathOrUuid(params);
    return { ...params, ...ref } as Record<string, unknown> & ({} | { uuid: string } | { nodePath: string });
}

/**
 * 驗證 remove-node 參數：uuid 單一或陣列，或 nodePath（單一節點）；可選 keepWorldTransform。
 */
export function requireRemoveNodeParams(params: Record<string, unknown>): (
    | { uuid: string | string[]; keepWorldTransform?: boolean }
    | { nodePath: string; keepWorldTransform?: boolean }
) {
    const uuid = params.uuid;
    const nodePath = params.nodePath;
    const keepWorldTransform = params.keepWorldTransform;
    const hasNodePath = typeof nodePath === 'string' && nodePath.trim() !== '' && !nodePath.startsWith('db:');
    if (hasNodePath && (uuid === undefined || uuid === null)) {
        return {
            nodePath: (nodePath as string).trim(),
            ...(typeof keepWorldTransform === 'boolean' ? { keepWorldTransform } : {}),
        };
    }
    if (isValidCreatorId(uuid)) {
        return {
            uuid,
            ...(typeof keepWorldTransform === 'boolean' ? { keepWorldTransform } : {}),
        };
    }
    if (Array.isArray(uuid) && uuid.length > 0) {
        for (const u of uuid) {
            if (!isValidCreatorId(u)) {
                throwInvalidParams();
            }
        }
        return {
            uuid,
            ...(typeof keepWorldTransform === 'boolean' ? { keepWorldTransform } : {}),
        };
    }
    throwInvalidParams();
}

/**
 * set-property 參數：節點為 uuid 或 nodePath 二選一、path 必填；dump 與 value 二選一，若同時存在以 dump 為準。
 * value 允許 string（資源路徑 db: / db:// / assets/）或物件（如 { __uuid__ }）；向後相容既有 __uuid__ 寫法。
 */
export function requireSetPropertyParams(params: Record<string, unknown>): NodeRef & {
    path: string;
    dump?: Record<string, unknown>;
    value?: unknown;
    record?: boolean;
} {
    const ref = requireNodePathOrUuid(params);
    const path = requirePath(params, 'path');
    const hasDump = params.dump !== undefined && params.dump !== null && typeof params.dump === 'object' && !Array.isArray(params.dump);
    const hasValue = params.value !== undefined;
    if (!hasDump && !hasValue) {
        throwInvalidParams();
    }
    const record = params.record;
    return {
        ...ref,
        path,
        ...(hasDump ? { dump: params.dump as Record<string, unknown> } : {}),
        ...(hasDump ? {} : { value: params.value }),
        ...(typeof record === 'boolean' ? { record } : {}),
    };
}

/**
 * prefab.create 參數：nodeUuid 或 nodePath 二選一（根節點）、assetPath 必填（新 prefab 資源路徑）。
 */
export function requirePrefabCreateParams(params: Record<string, unknown>): (
    { nodeUuid: string; assetPath: string } | { nodePath: string; assetPath: string }
) {
    const assetPath = params.assetPath;
    if (typeof assetPath !== 'string' || assetPath.trim() === '') {
        throwInvalidParams();
    }
    const hasNodeUuid = isValidUuid(params.nodeUuid);
    const nodePath = params.nodePath;
    const hasNodePath = typeof nodePath === 'string' && nodePath.trim() !== '' && !nodePath.startsWith('db:');
    if (hasNodeUuid && !hasNodePath) {
        return { nodeUuid: params.nodeUuid as string, assetPath: (assetPath as string).trim() };
    }
    if (hasNodePath && !hasNodeUuid) {
        return { nodePath: (nodePath as string).trim(), assetPath: (assetPath as string).trim() };
    }
    throwInvalidParams();
}

/**
 * scene.create 參數：assetPath 必填；open 可選（建立後是否開啟）。
 */
export function requireSceneCreateParams(params: Record<string, unknown>): { assetPath: string; open?: boolean } {
    const assetPath = params.assetPath;
    if (typeof assetPath !== 'string' || assetPath.trim() === '') {
        throwInvalidParams();
    }
    const open = params.open;
    return {
        assetPath: (assetPath as string).trim(),
        ...(typeof open === 'boolean' ? { open } : {}),
    };
}

/**
 * scene.open 參數：uuid 或 assetPath 二選一。assetPath 可為 db:、db:// 或專案相對路徑。
 */
export function requireSceneOpenParams(params: Record<string, unknown>): { uuid: string } | { assetPath: string } {
    const hasUuid = isValidUuid(params.uuid);
    const assetPath = params.assetPath;
    const hasAssetPath = typeof assetPath === 'string' && assetPath.trim() !== '';
    if (hasUuid && !hasAssetPath) {
        return { uuid: params.uuid as string };
    }
    if (hasAssetPath && !hasUuid) {
        return { assetPath: (assetPath as string).trim() };
    }
    throwInvalidParams();
}

/**
 * reset-property 參數：節點為 uuid 或 nodePath 二選一、path 必填；可選 dump、record。
 */
export function requireResetPropertyParams(params: Record<string, unknown>): NodeRef & {
    path: string;
    dump?: Record<string, unknown>;
    record?: boolean;
} {
    const ref = requireNodePathOrUuid(params);
    const path = requirePath(params, 'path');
    const hasDump = params.dump !== undefined && params.dump !== null && typeof params.dump === 'object' && !Array.isArray(params.dump);
    const record = params.record;
    return {
        ...ref,
        path,
        ...(hasDump ? { dump: params.dump as Record<string, unknown> } : {}),
        ...(typeof record === 'boolean' ? { record } : {}),
    };
}
