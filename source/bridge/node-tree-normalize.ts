/**
 * 節點樹正規化：將 Editor 回傳的 INode/IScene 轉為契約形狀（uuid, name, children, path），
 * 並支援 markdown / flat 格式。對齊 blueprint §3 節點樹正規化。
 */

/** 正規化後的節點形狀（契約 §3.1） */
export interface NormalizedNode {
    uuid: string;
    name: string;
    children: NormalizedNode[];
    path: string;
    /** 組件摘要（可選），用於辨識組件 */
    components?: { name?: string; cid?: string; uuid?: string }[];
    /** 因 maxDepth 未展開子層時為 true */
    truncated?: boolean;
    /** 因 maxChildren 截斷子節點時為 true */
    truncatedChildren?: boolean;
}

/** 正規化選項（對應 params） */
export interface NormalizeTreeOptions {
    maxDepth?: number;
    maxChildren?: number;
}

/** 從 Editor IProperty 或直接值取出字串 */
function getStr(prop: unknown): string {
    if (prop == null) return '';
    if (typeof prop === 'string') return prop;
    if (typeof prop === 'object' && 'value' in prop && typeof (prop as { value: unknown }).value === 'string') {
        return (prop as { value: string }).value;
    }
    return String(prop);
}

/** 從 __comps__ 陣列產生組件摘要（可選） */
function getComponentsSummary(comps: unknown): { name?: string; cid?: string; uuid?: string }[] | undefined {
    if (!Array.isArray(comps) || comps.length === 0) return undefined;
    const list: { name?: string; cid?: string; uuid?: string }[] = [];
    for (const c of comps) {
        if (c == null || typeof c !== 'object') continue;
        const v = (c as { value?: Record<string, unknown> }).value;
        const name = v && typeof v === 'object' && 'name' in v ? getStr((v as { name: unknown }).name) : undefined;
        const cid = c && typeof c === 'object' && 'cid' in c && typeof (c as { cid: unknown }).cid === 'string' ? (c as { cid: string }).cid : undefined;
        const uuid = v && typeof v === 'object' && 'uuid' in v ? getStr((v as { uuid: unknown }).uuid) : undefined;
        list.push({ name, cid, uuid });
    }
    return list.length > 0 ? list : undefined;
}

/** 判斷是否為節點或場景 dump（具 uuid / name / children） */
function isNodeLike(obj: unknown): obj is Record<string, unknown> & { children?: unknown[] } {
    return obj != null && typeof obj === 'object' && 'uuid' in obj && 'name' in obj;
}

/**
 * 將單一節點（INode/IScene）正規化，套用 maxDepth、maxChildren，並建立 path。
 * @param raw Editor 回傳的節點或場景 dump
 * @param pathPrefix 父路徑（不含自身 name），用於組 path
 * @param depth 目前深度（0 = 根）
 * @param opts maxDepth、maxChildren
 */
export function normalizeNode(
    raw: Record<string, unknown> & { children?: unknown[] },
    pathPrefix: string,
    depth: number,
    opts: NormalizeTreeOptions
): NormalizedNode {
    const name = getStr(raw.name);
    const path = pathPrefix ? `${pathPrefix}/${name}` : (name || 'Root');
    const uuid = getStr(raw.uuid);
    const comps = '__comps__' in raw && Array.isArray(raw.__comps__) ? getComponentsSummary(raw.__comps__) : undefined;

    const maxDepth = opts.maxDepth;
    const maxChildren = opts.maxChildren;
    const rawChildren = Array.isArray(raw.children) ? raw.children : [];
    const atDepthLimit = typeof maxDepth === 'number' && depth >= maxDepth;
    let children: NormalizedNode[] = [];
    let truncated = false;
    let truncatedChildren = false;

    if (!atDepthLimit && rawChildren.length > 0) {
        const take = typeof maxChildren === 'number' ? Math.min(maxChildren, rawChildren.length) : rawChildren.length;
        truncatedChildren = typeof maxChildren === 'number' && rawChildren.length > maxChildren;
        const slice = rawChildren.slice(0, take);
        for (const ch of slice) {
            if (!isNodeLike(ch)) continue;
            children.push(normalizeNode(ch as Record<string, unknown> & { children?: unknown[] }, path, depth + 1, opts));
        }
    } else if (atDepthLimit && rawChildren.length > 0) {
        truncated = true;
    }

    return {
        uuid,
        name: name || uuid || 'Node',
        children,
        path,
        ...(comps && { components: comps }),
        ...(truncated && { truncated: true }),
        ...(truncatedChildren && { truncatedChildren: true }),
    };
}

/**
 * 將正規化樹轉成 markdown 字串（縮排表示層級）。
 */
export function treeToMarkdown(node: NormalizedNode, indent = ''): string {
    const self = `${indent}- ${node.name || node.uuid} (${node.path})`;
    const lines = [self];
    const childIndent = indent + '  ';
    for (const c of node.children) {
        lines.push(treeToMarkdown(c, childIndent));
    }
    if (node.truncated) {
        lines.push(`${childIndent}- ... (truncated by maxDepth)`);
    }
    if (node.truncatedChildren) {
        lines.push(`${childIndent}- ... (truncated by maxChildren)`);
    }
    return lines.join('\n');
}

/** flat 項目：含 path 與 depth */
export interface FlatNodeItem {
    uuid: string;
    name: string;
    path: string;
    depth: number;
    components?: { name?: string; cid?: string; uuid?: string }[];
}

/**
 * 將正規化樹攤平為陣列（每項含 path、depth）。
 */
export function treeToFlat(node: NormalizedNode, out: FlatNodeItem[], depth: number): void {
    out.push({
        uuid: node.uuid,
        name: node.name,
        path: node.path,
        depth,
        ...(node.components && node.components.length > 0 && { components: node.components }),
    });
    for (const c of node.children) {
        treeToFlat(c, out, depth + 1);
    }
}

/**
 * 從 Editor query-node-tree 的原始結果建立正規化樹，並依需要產生 markdown / flat。
 * 根節點可能是 INode 或 IScene，皆具 uuid、name、children。
 */
export function normalizeTree(
    rawRoot: unknown,
    opts: NormalizeTreeOptions
): { tree: NormalizedNode; markdown: string; flat: FlatNodeItem[] } {
    if (!rawRoot || typeof rawRoot !== 'object' || !isNodeLike(rawRoot)) {
        return {
            tree: { uuid: '', name: 'Root', children: [], path: 'Root' },
            markdown: '- Root (empty)',
            flat: [],
        };
    }
    const tree = normalizeNode(
        rawRoot as Record<string, unknown> & { children?: unknown[] },
        '',
        0,
        opts
    );
    const markdown = treeToMarkdown(tree);
    const flat: FlatNodeItem[] = [];
    treeToFlat(tree, flat, 0);
    return { tree, markdown, flat };
}
