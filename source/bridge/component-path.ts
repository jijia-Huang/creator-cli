/**
 * 組件 path 解析：型別 path（如 cc.Sprite.spriteFrame）轉成 Editor 用的 __comps__.N.xxx。
 * 供 set-property / reset-property 使用。
 */

/** 判斷 path 是否已是 __comps__.N 或 __comps__.N.xxx 格式 */
export function isResolvedComponentPath(path: string): boolean {
    return /^__comps__\.\d+/.test(path.trim());
}

/**
 * 在 nodeDump.__comps__ 中依序找 value.type 或 cid 符合 componentType 的項目索引。
 * @param comps __comps__ 陣列
 * @param componentType 如 "cc.Sprite"
 */
function findComponentIndex(comps: unknown[], componentType: string): number {
    const typeTrim = componentType.trim();
    for (let i = 0; i < comps.length; i++) {
        const c = comps[i];
        if (c == null || typeof c !== 'object') continue;
        const o = c as Record<string, unknown>;
        const value = o.value;
        const typeMatch =
            value != null &&
            typeof value === 'object' &&
            'type' in value &&
            typeof (value as { type: unknown }).type === 'string' &&
            (value as { type: string }).type === typeTrim;
        const cidMatch = typeof o.cid === 'string' && o.cid === typeTrim;
        const nameMatch =
            value != null &&
            typeof value === 'object' &&
            'name' in value &&
            typeof (value as { name: unknown }).name === 'string' &&
            (value as { name: string }).name === typeTrim;
        if (typeMatch || cidMatch || nameMatch) return i;
    }
    return -1;
}

/**
 * 將型別 path 解析為 __comps__.N 或 __comps__.N.xxx。
 * - typePath 已是 __comps__.N 或 __comps__.N.xxx 時直接回傳。
 * - typePath 格式為 "ComponentType"（如 cc.Sprite）或 "ComponentType.propPath"（如 cc.Sprite.spriteFrame）。
 * - 在 nodeDump.__comps__ 中依序以 value.type 或 cid 符合 ComponentType 找索引 N，回傳 "__comps__.N" 或 "__comps__.N.propPath"。
 *
 * @param nodeDump 節點 dump（含 __comps__ 陣列）
 * @param typePath 型別 path 或已解析的 __comps__.N.xxx
 * @returns 解析後的 path，找不到組件時回傳 null
 */
export function resolveComponentPath(nodeDump: object, typePath: string): string | null {
    const path = typePath.trim();
    if (path === '') return null;

    if (isResolvedComponentPath(path)) return path;

    const comps = (nodeDump as Record<string, unknown>).__comps__;
    if (!Array.isArray(comps)) return null;

    const dot = path.indexOf('.');
    const componentType = dot === -1 ? path : path.slice(0, dot);
    const propSuffix = dot === -1 ? '' : path.slice(dot + 1);

    const index = findComponentIndex(comps, componentType);
    if (index < 0) return null;

    return propSuffix ? `__comps__.${index}.${propSuffix}` : `__comps__.${index}`;
}

/** 從 IProperty 或直接值取出字串（與 node-tree-normalize 一致） */
function getStr(prop: unknown): string {
    if (prop == null) return '';
    if (typeof prop === 'string') return prop;
    if (typeof prop === 'object' && 'value' in prop && typeof (prop as { value: unknown }).value === 'string') {
        return (prop as { value: string }).value;
    }
    return String(prop);
}

/**
 * 依組件類型從節點 dump 的 __comps__ 中取得該組件的 UUID。
 * 供 resolve-component 使用（remove-component、set-property 等需組件 UUID 時可先呼叫此方法）。
 *
 * @param nodeDump 節點 dump（含 __comps__ 陣列，來自 prefab.query-node）
 * @param componentType 組件類名，如 "cc.Sprite"、"PlayerController"
 * @returns 組件 UUID 字串，找不到時回傳 null
 */
export function getComponentUuid(nodeDump: object, componentType: string): string | null {
    const comps = (nodeDump as Record<string, unknown>).__comps__;
    if (!Array.isArray(comps)) return null;
    const typeTrim = componentType.trim();
    if (typeTrim === '') return null;

    const index = findComponentIndex(comps, typeTrim);
    if (index < 0) return null;

    const c = comps[index];
    if (c == null || typeof c !== 'object') return null;
    const value = (c as Record<string, unknown>).value;
    if (value == null || typeof value !== 'object' || !('uuid' in value)) return null;
    const uuid = getStr((value as { uuid: unknown }).uuid);
    return uuid || null;
}
