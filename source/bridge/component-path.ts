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
