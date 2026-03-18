/**
 * Editor Bridge TCP Server
 * 綁定 127.0.0.1，接受 JSON 行請求，依方法白名單派發並回傳 JSON 回應。
 * 安全：僅 localhost、錯誤不帶內部路徑（對齊 security policy）。
 */

import type { BridgeRequest, BridgeResponse } from './types';
import * as net from 'net';
import { handleQueryNode, handleQueryNodeTree, handleRestore, handlePrefabCreate } from './prefab-handlers';
import { handleResolveNode } from './resolve-node';
import { handleEditorRefresh } from './editor-handlers';
import {
    handleCreateComponent,
    handleCreateNode,
    handleRemoveComponent,
    handleRemoveNode,
    handleResetProperty,
    handleResolveComponent,
    handleSceneCreate,
    handleSceneOpen,
    handleSceneQueryCurrent,
    handleSetProperty,
} from './scene-handlers';

/** 預設埠號（與藍圖一致） */
export const DEFAULT_PORT = 6868;

/** 埠號白名單（security policy §2.2） */
export const PORT_WHITELIST = [6868, 6870, 6872];

/** 方法白名單：ping + prefab + 場景節點操作 + editor.refresh */
const METHOD_WHITELIST = new Set<string>([
    'ping',
    'resolve-node',
    'resolve-component',
    'prefab.query-node',
    'prefab.query-node-tree',
    'prefab.restore',
    'prefab.create',
    'scene.open',
    'scene.query-current',
    'scene.create',
    'create-component',
    'remove-component',
    'create-node',
    'remove-node',
    'set-property',
    'reset-property',
    'editor.refresh',
]);

/** 解析並驗證請求；若無效回傳錯誤回應物件 */
function parseRequest(raw: string): BridgeRequest | BridgeResponse {
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch {
        return {
            ok: false,
            error: { code: 'INVALID_JSON', message: 'Invalid JSON' },
        };
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        return {
            ok: false,
            error: { code: 'INVALID_PARAMS', message: 'Request must be a JSON object' },
        };
    }
    const obj = data as Record<string, unknown>;
    if (typeof obj.method !== 'string' || !obj.method) {
        return {
            ok: false,
            error: { code: 'INVALID_PARAMS', message: 'Missing or invalid "method"' },
        };
    }
    if (obj.params !== undefined && (typeof obj.params !== 'object' || obj.params === null || Array.isArray(obj.params))) {
        return {
            ok: false,
            error: { code: 'INVALID_PARAMS', message: '"params" must be an object' },
        };
    }
    const id = obj.id !== undefined ? String(obj.id) : undefined;
    return {
        id,
        method: obj.method,
        params: (obj.params as Record<string, unknown>) ?? {},
    };
}

/** 執行單一方法（ping + prefab.query-node / query-node-tree / restore） */
async function dispatch(req: BridgeRequest): Promise<BridgeResponse> {
    if (!METHOD_WHITELIST.has(req.method)) {
        return {
            id: req.id,
            ok: false,
            error: { code: 'INVALID_METHOD', message: 'Method not allowed' },
        };
    }
    if (req.method === 'ping') {
        return {
            id: req.id,
            ok: true,
            result: { pong: true },
        };
    }
    const params = req.params ?? {};
    try {
        if (req.method === 'resolve-node') {
            const result = await handleResolveNode(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'resolve-component') {
            const result = await handleResolveComponent(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'prefab.query-node') {
            const result = await handleQueryNode(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'prefab.query-node-tree') {
            const result = await handleQueryNodeTree(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'prefab.restore') {
            const result = await handleRestore(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'prefab.create') {
            const result = await handlePrefabCreate(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'scene.open') {
            const result = await handleSceneOpen(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'scene.query-current') {
            const result = await handleSceneQueryCurrent(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'scene.create') {
            const result = await handleSceneCreate(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'create-component') {
            const result = await handleCreateComponent(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'remove-component') {
            const result = await handleRemoveComponent(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'create-node') {
            const result = await handleCreateNode(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'remove-node') {
            const result = await handleRemoveNode(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'set-property') {
            const result = await handleSetProperty(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'reset-property') {
            const result = await handleResetProperty(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'editor.refresh') {
            const result = await handleEditorRefresh(params);
            return { id: req.id, ok: true, result };
        }
    } catch (e) {
        const code = (e && typeof e === 'object' && 'code' in e && (e as any).code) || 'SCENE_ERROR';
        const message = e instanceof Error ? e.message : 'Operation failed';
        return {
            id: req.id,
            ok: false,
            error: { code: String(code), message },
        };
    }
    return {
        id: req.id,
        ok: false,
        error: { code: 'INVALID_METHOD', message: 'Method not allowed' },
    };
}

/** 處理單行輸入，回傳一筆 JSON 行回應（非同步以支援 Editor.Message.request） */
async function handleLine(line: string): Promise<string> {
    const parsed = parseRequest(line);
    if ('ok' in parsed && parsed.ok === false) {
        return JSON.stringify(parsed) + '\n';
    }
    if ('method' in parsed) {
        const response = await dispatch(parsed as BridgeRequest);
        return JSON.stringify(response) + '\n';
    }
    return JSON.stringify(parsed) + '\n';
}

export interface BridgeServerOptions {
    /** 監聽埠號（須在 PORT_WHITELIST 內） */
    port: number;
}

export interface BridgeServer {
    close(callback?: () => void): void;
}

/**
 * 建立並啟動 TCP server，綁定 127.0.0.1。
 * 訊息邊界：每行一筆 JSON 請求，回傳一筆 JSON 行。
 */
export function createBridgeServer(options: BridgeServerOptions): Promise<net.Server> {
    return new Promise((resolve, reject) => {
        const server = net.createServer((socket: net.Socket) => {
            let buffer = '';
            socket.setEncoding('utf8');
            socket.on('data', async (chunk: Buffer | string) => {
                buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    try {
                        const out = await handleLine(trimmed);
                        socket.write(out);
                    } catch (err) {
                        const safeMessage = err instanceof Error ? err.message : 'Unknown error';
                        const response: BridgeResponse = {
                            ok: false,
                            error: { code: 'INTERNAL_ERROR', message: safeMessage },
                        };
                        socket.write(JSON.stringify(response) + '\n');
                    }
                }
            });
        });

        server.listen(
            {
                port: options.port,
                host: '127.0.0.1',
            },
            () => resolve(server),
        );
        server.on('error', reject);
    });
}
