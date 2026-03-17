// @ts-ignore
import packageJSON from '../package.json';
import {
    createBridgeServer,
    DEFAULT_PORT,
    PORT_WHITELIST,
} from './bridge/server';
import type { Server } from 'net';

/** Editor Bridge TCP server 實例，unload 時關閉 */
let bridgeServer: Server | null = null;
/** 目前監聽的埠號（僅在 bridgeServer 不為 null 時有效） */
let currentBridgePort: number | null = null;

/**
 * @en Registration method for the main process of Extension
 * @zh 为扩展的主进程的注册方法
 */
export const methods: { [key: string]: (...any: any) => any } = {
    /**
     * @en A method that can be triggered by message
     * @zh 通过 message 触发的方法
     */
    openPanel() {
        Editor.Panel.open(packageJSON.name);
    },

    /**
     * 啟動 Editor Bridge TCP server。埠號須在白名單內（6868、6870、6872）。
     * 若已有 server 在運行會先關閉再於指定埠號啟動；僅允許單一實例。
     * @param port 可選，未傳則使用預設 6868
     * @returns 回傳 { ok: true, port } 或 { ok: false, error: string }
     */
    async startBridge(port?: number): Promise<{ ok: true; port: number } | { ok: false; error: string }> {
        const p = port !== undefined ? port : DEFAULT_PORT;
        if (!Number.isInteger(p) || !PORT_WHITELIST.includes(p)) {
            return {
                ok: false,
                error: `埠號須為白名單之一：${PORT_WHITELIST.join(', ')}`,
            };
        }
        // 僅允許單一 server：若已在運行則先關閉
        if (bridgeServer) {
            const server = bridgeServer;
            bridgeServer = null;
            currentBridgePort = null;
            server.close(() => {});
            await new Promise<void>((resolve) => setTimeout(resolve, 100));
        }
        try {
            const server = await createBridgeServer({ port: p });
            bridgeServer = server;
            currentBridgePort = p;
            console.log(`[creator-cli] Editor Bridge listening on 127.0.0.1:${p}`);
            return { ok: true, port: p };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[creator-cli] Failed to start Editor Bridge: ${msg}`);
            return { ok: false, error: msg };
        }
    },

    /**
     * 停止 Editor Bridge TCP server。
     */
    stopBridge() {
        if (bridgeServer) {
            const server = bridgeServer;
            bridgeServer = null;
            currentBridgePort = null;
            server.close(() => {});
            console.log('[creator-cli] Editor Bridge stopped.');
        }
    },

    /**
     * 查詢 Bridge 是否在監聽及目前埠號（供 Panel 顯示狀態用）。
     */
    getBridgeStatus(): { listening: boolean; port?: number } {
        if (!bridgeServer || currentBridgePort === null) {
            return { listening: false };
        }
        return { listening: true, port: currentBridgePort };
    },
};

/**
 * @en Method Triggered on Extension Startup
 * @zh 扩展启动时触发的方法
 * 不再自動啟動 Bridge；由 Panel 或訊息呼叫 startBridge(port) 啟動。
 */
export function load() {
    // Bridge 改由 Panel 或訊息手動啟動，此處不建立 server
}

/**
 * @en Method triggered when uninstalling the extension
 * @zh 卸载扩展时触发的方法
 * 關閉 Editor Bridge TCP server。
 */
export function unload() {
    if (bridgeServer) {
        const server = bridgeServer;
        bridgeServer = null;
        currentBridgePort = null;
        server.close(() => {});
    }
}
