"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
exports.load = load;
exports.unload = unload;
// @ts-ignore
const package_json_1 = __importDefault(require("../package.json"));
const server_1 = require("./bridge/server");
/** Editor Bridge TCP server 實例，unload 時關閉 */
let bridgeServer = null;
/** 目前監聽的埠號（僅在 bridgeServer 不為 null 時有效） */
let currentBridgePort = null;
/**
 * @en Registration method for the main process of Extension
 * @zh 为扩展的主进程的注册方法
 */
exports.methods = {
    /**
     * @en A method that can be triggered by message
     * @zh 通过 message 触发的方法
     */
    openPanel() {
        Editor.Panel.open(package_json_1.default.name);
    },
    /**
     * 啟動 Editor Bridge TCP server。埠號須在白名單內（6868、6870、6872）。
     * 若已有 server 在運行會先關閉再於指定埠號啟動；僅允許單一實例。
     * @param port 可選，未傳則使用預設 6868
     * @returns 回傳 { ok: true, port } 或 { ok: false, error: string }
     */
    async startBridge(port) {
        const p = port !== undefined ? port : server_1.DEFAULT_PORT;
        if (!Number.isInteger(p) || !server_1.PORT_WHITELIST.includes(p)) {
            return {
                ok: false,
                error: `埠號須為白名單之一：${server_1.PORT_WHITELIST.join(', ')}`,
            };
        }
        // 僅允許單一 server：若已在運行則先關閉
        if (bridgeServer) {
            const server = bridgeServer;
            bridgeServer = null;
            currentBridgePort = null;
            server.close(() => { });
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        try {
            const server = await (0, server_1.createBridgeServer)({ port: p });
            bridgeServer = server;
            currentBridgePort = p;
            console.log(`[creator-cli] Editor Bridge listening on 127.0.0.1:${p}`);
            return { ok: true, port: p };
        }
        catch (err) {
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
            server.close(() => { });
            console.log('[creator-cli] Editor Bridge stopped.');
        }
    },
    /**
     * 查詢 Bridge 是否在監聽及目前埠號（供 Panel 顯示狀態用）。
     */
    getBridgeStatus() {
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
function load() {
    // Bridge 改由 Panel 或訊息手動啟動，此處不建立 server
}
/**
 * @en Method triggered when uninstalling the extension
 * @zh 卸载扩展时触发的方法
 * 關閉 Editor Bridge TCP server。
 */
function unload() {
    if (bridgeServer) {
        const server = bridgeServer;
        bridgeServer = null;
        currentBridgePort = null;
        server.close(() => { });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NvdXJjZS9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQTJGQSxvQkFFQztBQU9ELHdCQU9DO0FBM0dELGFBQWE7QUFDYixtRUFBMEM7QUFDMUMsNENBSXlCO0FBR3pCLDZDQUE2QztBQUM3QyxJQUFJLFlBQVksR0FBa0IsSUFBSSxDQUFDO0FBQ3ZDLDJDQUEyQztBQUMzQyxJQUFJLGlCQUFpQixHQUFrQixJQUFJLENBQUM7QUFFNUM7OztHQUdHO0FBQ1UsUUFBQSxPQUFPLEdBQTRDO0lBQzVEOzs7T0FHRztJQUNILFNBQVM7UUFDTCxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxzQkFBVyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBYTtRQUMzQixNQUFNLENBQUMsR0FBRyxJQUFJLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLHFCQUFZLENBQUM7UUFDbkQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyx1QkFBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ3RELE9BQU87Z0JBQ0gsRUFBRSxFQUFFLEtBQUs7Z0JBQ1QsS0FBSyxFQUFFLGFBQWEsdUJBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7YUFDbEQsQ0FBQztRQUNOLENBQUM7UUFDRCx5QkFBeUI7UUFDekIsSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUNmLE1BQU0sTUFBTSxHQUFHLFlBQVksQ0FBQztZQUM1QixZQUFZLEdBQUcsSUFBSSxDQUFDO1lBQ3BCLGlCQUFpQixHQUFHLElBQUksQ0FBQztZQUN6QixNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxHQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3ZCLE1BQU0sSUFBSSxPQUFPLENBQU8sQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRSxDQUFDO1FBQ0QsSUFBSSxDQUFDO1lBQ0QsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFBLDJCQUFrQixFQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDckQsWUFBWSxHQUFHLE1BQU0sQ0FBQztZQUN0QixpQkFBaUIsR0FBRyxDQUFDLENBQUM7WUFDdEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxzREFBc0QsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUN2RSxPQUFPLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUM7UUFDakMsQ0FBQztRQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7WUFDWCxNQUFNLEdBQUcsR0FBRyxHQUFHLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDN0QsT0FBTyxDQUFDLEtBQUssQ0FBQyxnREFBZ0QsR0FBRyxFQUFFLENBQUMsQ0FBQztZQUNyRSxPQUFPLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLENBQUM7UUFDckMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNILFVBQVU7UUFDTixJQUFJLFlBQVksRUFBRSxDQUFDO1lBQ2YsTUFBTSxNQUFNLEdBQUcsWUFBWSxDQUFDO1lBQzVCLFlBQVksR0FBRyxJQUFJLENBQUM7WUFDcEIsaUJBQWlCLEdBQUcsSUFBSSxDQUFDO1lBQ3pCLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUUsQ0FBQyxDQUFDLENBQUM7WUFDdkIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxzQ0FBc0MsQ0FBQyxDQUFDO1FBQ3hELENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxlQUFlO1FBQ1gsSUFBSSxDQUFDLFlBQVksSUFBSSxpQkFBaUIsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUM5QyxPQUFPLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxDQUFDO1FBQ2hDLENBQUM7UUFDRCxPQUFPLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQztJQUN4RCxDQUFDO0NBQ0osQ0FBQztBQUVGOzs7O0dBSUc7QUFDSCxTQUFnQixJQUFJO0lBQ2hCLHVDQUF1QztBQUMzQyxDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILFNBQWdCLE1BQU07SUFDbEIsSUFBSSxZQUFZLEVBQUUsQ0FBQztRQUNmLE1BQU0sTUFBTSxHQUFHLFlBQVksQ0FBQztRQUM1QixZQUFZLEdBQUcsSUFBSSxDQUFDO1FBQ3BCLGlCQUFpQixHQUFHLElBQUksQ0FBQztRQUN6QixNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxHQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzNCLENBQUM7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQHRzLWlnbm9yZVxyXG5pbXBvcnQgcGFja2FnZUpTT04gZnJvbSAnLi4vcGFja2FnZS5qc29uJztcclxuaW1wb3J0IHtcclxuICAgIGNyZWF0ZUJyaWRnZVNlcnZlcixcclxuICAgIERFRkFVTFRfUE9SVCxcclxuICAgIFBPUlRfV0hJVEVMSVNULFxyXG59IGZyb20gJy4vYnJpZGdlL3NlcnZlcic7XHJcbmltcG9ydCB0eXBlIHsgU2VydmVyIH0gZnJvbSAnbmV0JztcclxuXHJcbi8qKiBFZGl0b3IgQnJpZGdlIFRDUCBzZXJ2ZXIg5a+m5L6L77yMdW5sb2FkIOaZgumXnOmWiSAqL1xyXG5sZXQgYnJpZGdlU2VydmVyOiBTZXJ2ZXIgfCBudWxsID0gbnVsbDtcclxuLyoqIOebruWJjeebo+iBveeahOWfoOiZn++8iOWDheWcqCBicmlkZ2VTZXJ2ZXIg5LiN54K6IG51bGwg5pmC5pyJ5pWI77yJICovXHJcbmxldCBjdXJyZW50QnJpZGdlUG9ydDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XHJcblxyXG4vKipcclxuICogQGVuIFJlZ2lzdHJhdGlvbiBtZXRob2QgZm9yIHRoZSBtYWluIHByb2Nlc3Mgb2YgRXh0ZW5zaW9uXHJcbiAqIEB6aCDkuLrmianlsZXnmoTkuLvov5vnqIvnmoTms6jlhozmlrnms5VcclxuICovXHJcbmV4cG9ydCBjb25zdCBtZXRob2RzOiB7IFtrZXk6IHN0cmluZ106ICguLi5hbnk6IGFueSkgPT4gYW55IH0gPSB7XHJcbiAgICAvKipcclxuICAgICAqIEBlbiBBIG1ldGhvZCB0aGF0IGNhbiBiZSB0cmlnZ2VyZWQgYnkgbWVzc2FnZVxyXG4gICAgICogQHpoIOmAmui/hyBtZXNzYWdlIOinpuWPkeeahOaWueazlVxyXG4gICAgICovXHJcbiAgICBvcGVuUGFuZWwoKSB7XHJcbiAgICAgICAgRWRpdG9yLlBhbmVsLm9wZW4ocGFja2FnZUpTT04ubmFtZSk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5ZWf5YuVIEVkaXRvciBCcmlkZ2UgVENQIHNlcnZlcuOAguWfoOiZn+mgiOWcqOeZveWQjeWWruWFp++8iDY4NjjjgIE2ODcw44CBNjg3Mu+8ieOAglxyXG4gICAgICog6Iul5bey5pyJIHNlcnZlciDlnKjpgYvooYzmnIPlhYjpl5zplonlho3mlrzmjIflrprln6DomZ/llZ/li5XvvJvlg4XlhYHoqLHllq7kuIDlr6bkvovjgIJcclxuICAgICAqIEBwYXJhbSBwb3J0IOWPr+mBuO+8jOacquWCs+WJh+S9v+eUqOmgkOiorSA2ODY4XHJcbiAgICAgKiBAcmV0dXJucyDlm57lgrMgeyBvazogdHJ1ZSwgcG9ydCB9IOaIliB7IG9rOiBmYWxzZSwgZXJyb3I6IHN0cmluZyB9XHJcbiAgICAgKi9cclxuICAgIGFzeW5jIHN0YXJ0QnJpZGdlKHBvcnQ/OiBudW1iZXIpOiBQcm9taXNlPHsgb2s6IHRydWU7IHBvcnQ6IG51bWJlciB9IHwgeyBvazogZmFsc2U7IGVycm9yOiBzdHJpbmcgfT4ge1xyXG4gICAgICAgIGNvbnN0IHAgPSBwb3J0ICE9PSB1bmRlZmluZWQgPyBwb3J0IDogREVGQVVMVF9QT1JUO1xyXG4gICAgICAgIGlmICghTnVtYmVyLmlzSW50ZWdlcihwKSB8fCAhUE9SVF9XSElURUxJU1QuaW5jbHVkZXMocCkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIG9rOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIGVycm9yOiBg5Z+g6Jmf6aCI54K655m95ZCN5Zau5LmL5LiA77yaJHtQT1JUX1dISVRFTElTVC5qb2luKCcsICcpfWAsXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIOWDheWFgeioseWWruS4gCBzZXJ2ZXLvvJroi6Xlt7LlnKjpgYvooYzliYflhYjpl5zplolcclxuICAgICAgICBpZiAoYnJpZGdlU2VydmVyKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHNlcnZlciA9IGJyaWRnZVNlcnZlcjtcclxuICAgICAgICAgICAgYnJpZGdlU2VydmVyID0gbnVsbDtcclxuICAgICAgICAgICAgY3VycmVudEJyaWRnZVBvcnQgPSBudWxsO1xyXG4gICAgICAgICAgICBzZXJ2ZXIuY2xvc2UoKCkgPT4ge30pO1xyXG4gICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCAxMDApKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3Qgc2VydmVyID0gYXdhaXQgY3JlYXRlQnJpZGdlU2VydmVyKHsgcG9ydDogcCB9KTtcclxuICAgICAgICAgICAgYnJpZGdlU2VydmVyID0gc2VydmVyO1xyXG4gICAgICAgICAgICBjdXJyZW50QnJpZGdlUG9ydCA9IHA7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbY3JlYXRvci1jbGldIEVkaXRvciBCcmlkZ2UgbGlzdGVuaW5nIG9uIDEyNy4wLjAuMToke3B9YCk7XHJcbiAgICAgICAgICAgIHJldHVybiB7IG9rOiB0cnVlLCBwb3J0OiBwIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG1zZyA9IGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiBTdHJpbmcoZXJyKTtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW2NyZWF0b3ItY2xpXSBGYWlsZWQgdG8gc3RhcnQgRWRpdG9yIEJyaWRnZTogJHttc2d9YCk7XHJcbiAgICAgICAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6IG1zZyB9O1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDlgZzmraIgRWRpdG9yIEJyaWRnZSBUQ1Agc2VydmVy44CCXHJcbiAgICAgKi9cclxuICAgIHN0b3BCcmlkZ2UoKSB7XHJcbiAgICAgICAgaWYgKGJyaWRnZVNlcnZlcikge1xyXG4gICAgICAgICAgICBjb25zdCBzZXJ2ZXIgPSBicmlkZ2VTZXJ2ZXI7XHJcbiAgICAgICAgICAgIGJyaWRnZVNlcnZlciA9IG51bGw7XHJcbiAgICAgICAgICAgIGN1cnJlbnRCcmlkZ2VQb3J0ID0gbnVsbDtcclxuICAgICAgICAgICAgc2VydmVyLmNsb3NlKCgpID0+IHt9KTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tjcmVhdG9yLWNsaV0gRWRpdG9yIEJyaWRnZSBzdG9wcGVkLicpO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDmn6XoqaIgQnJpZGdlIOaYr+WQpuWcqOebo+iBveWPiuebruWJjeWfoOiZn++8iOS+myBQYW5lbCDpoa/npLrni4DmhYvnlKjvvInjgIJcclxuICAgICAqL1xyXG4gICAgZ2V0QnJpZGdlU3RhdHVzKCk6IHsgbGlzdGVuaW5nOiBib29sZWFuOyBwb3J0PzogbnVtYmVyIH0ge1xyXG4gICAgICAgIGlmICghYnJpZGdlU2VydmVyIHx8IGN1cnJlbnRCcmlkZ2VQb3J0ID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IGxpc3RlbmluZzogZmFsc2UgfTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHsgbGlzdGVuaW5nOiB0cnVlLCBwb3J0OiBjdXJyZW50QnJpZGdlUG9ydCB9O1xyXG4gICAgfSxcclxufTtcclxuXHJcbi8qKlxyXG4gKiBAZW4gTWV0aG9kIFRyaWdnZXJlZCBvbiBFeHRlbnNpb24gU3RhcnR1cFxyXG4gKiBAemgg5omp5bGV5ZCv5Yqo5pe26Kem5Y+R55qE5pa55rOVXHJcbiAqIOS4jeWGjeiHquWLleWVn+WLlSBCcmlkZ2XvvJvnlLEgUGFuZWwg5oiW6KiK5oGv5ZG85Y+rIHN0YXJ0QnJpZGdlKHBvcnQpIOWVn+WLleOAglxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGxvYWQoKSB7XHJcbiAgICAvLyBCcmlkZ2Ug5pS555SxIFBhbmVsIOaIluioiuaBr+aJi+WLleWVn+WLle+8jOatpOiZleS4jeW7uueriyBzZXJ2ZXJcclxufVxyXG5cclxuLyoqXHJcbiAqIEBlbiBNZXRob2QgdHJpZ2dlcmVkIHdoZW4gdW5pbnN0YWxsaW5nIHRoZSBleHRlbnNpb25cclxuICogQHpoIOWNuOi9veaJqeWxleaXtuinpuWPkeeahOaWueazlVxyXG4gKiDpl5zplokgRWRpdG9yIEJyaWRnZSBUQ1Agc2VydmVy44CCXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gdW5sb2FkKCkge1xyXG4gICAgaWYgKGJyaWRnZVNlcnZlcikge1xyXG4gICAgICAgIGNvbnN0IHNlcnZlciA9IGJyaWRnZVNlcnZlcjtcclxuICAgICAgICBicmlkZ2VTZXJ2ZXIgPSBudWxsO1xyXG4gICAgICAgIGN1cnJlbnRCcmlkZ2VQb3J0ID0gbnVsbDtcclxuICAgICAgICBzZXJ2ZXIuY2xvc2UoKCkgPT4ge30pO1xyXG4gICAgfVxyXG59XHJcbiJdfQ==