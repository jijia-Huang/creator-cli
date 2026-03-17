"use strict";
/**
 * Editor Bridge TCP Server
 * 綁定 127.0.0.1，接受 JSON 行請求，依方法白名單派發並回傳 JSON 回應。
 * 安全：僅 localhost、錯誤不帶內部路徑（對齊 security policy）。
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PORT_WHITELIST = exports.DEFAULT_PORT = void 0;
exports.createBridgeServer = createBridgeServer;
const net = __importStar(require("net"));
const prefab_handlers_1 = require("./prefab-handlers");
const resolve_node_1 = require("./resolve-node");
const editor_handlers_1 = require("./editor-handlers");
const scene_handlers_1 = require("./scene-handlers");
/** 預設埠號（與藍圖一致） */
exports.DEFAULT_PORT = 6868;
/** 埠號白名單（security policy §2.2） */
exports.PORT_WHITELIST = [6868, 6870, 6872];
/** 方法白名單：ping + prefab + 場景節點操作 + editor.refresh */
const METHOD_WHITELIST = new Set([
    'ping',
    'resolve-node',
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
function parseRequest(raw) {
    var _a;
    let data;
    try {
        data = JSON.parse(raw);
    }
    catch (_b) {
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
    const obj = data;
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
        params: (_a = obj.params) !== null && _a !== void 0 ? _a : {},
    };
}
/** 執行單一方法（ping + prefab.query-node / query-node-tree / restore） */
async function dispatch(req) {
    var _a;
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
    const params = (_a = req.params) !== null && _a !== void 0 ? _a : {};
    try {
        if (req.method === 'resolve-node') {
            const result = await (0, resolve_node_1.handleResolveNode)(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'prefab.query-node') {
            const result = await (0, prefab_handlers_1.handleQueryNode)(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'prefab.query-node-tree') {
            const result = await (0, prefab_handlers_1.handleQueryNodeTree)(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'prefab.restore') {
            const result = await (0, prefab_handlers_1.handleRestore)(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'prefab.create') {
            const result = await (0, prefab_handlers_1.handlePrefabCreate)(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'scene.open') {
            const result = await (0, scene_handlers_1.handleSceneOpen)(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'scene.query-current') {
            const result = await (0, scene_handlers_1.handleSceneQueryCurrent)(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'scene.create') {
            const result = await (0, scene_handlers_1.handleSceneCreate)(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'create-component') {
            const result = await (0, scene_handlers_1.handleCreateComponent)(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'remove-component') {
            const result = await (0, scene_handlers_1.handleRemoveComponent)(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'create-node') {
            const result = await (0, scene_handlers_1.handleCreateNode)(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'remove-node') {
            const result = await (0, scene_handlers_1.handleRemoveNode)(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'set-property') {
            const result = await (0, scene_handlers_1.handleSetProperty)(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'reset-property') {
            const result = await (0, scene_handlers_1.handleResetProperty)(params);
            return { id: req.id, ok: true, result };
        }
        if (req.method === 'editor.refresh') {
            const result = await (0, editor_handlers_1.handleEditorRefresh)(params);
            return { id: req.id, ok: true, result };
        }
    }
    catch (e) {
        const code = (e && typeof e === 'object' && 'code' in e && e.code) || 'SCENE_ERROR';
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
async function handleLine(line) {
    const parsed = parseRequest(line);
    if ('ok' in parsed && parsed.ok === false) {
        return JSON.stringify(parsed) + '\n';
    }
    if ('method' in parsed) {
        const response = await dispatch(parsed);
        return JSON.stringify(response) + '\n';
    }
    return JSON.stringify(parsed) + '\n';
}
/**
 * 建立並啟動 TCP server，綁定 127.0.0.1。
 * 訊息邊界：每行一筆 JSON 請求，回傳一筆 JSON 行。
 */
function createBridgeServer(options) {
    return new Promise((resolve, reject) => {
        const server = net.createServer((socket) => {
            let buffer = '';
            socket.setEncoding('utf8');
            socket.on('data', async (chunk) => {
                var _a;
                buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
                const lines = buffer.split('\n');
                buffer = (_a = lines.pop()) !== null && _a !== void 0 ? _a : '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed)
                        continue;
                    try {
                        const out = await handleLine(trimmed);
                        socket.write(out);
                    }
                    catch (err) {
                        const safeMessage = err instanceof Error ? err.message : 'Unknown error';
                        const response = {
                            ok: false,
                            error: { code: 'INTERNAL_ERROR', message: safeMessage },
                        };
                        socket.write(JSON.stringify(response) + '\n');
                    }
                }
            });
        });
        server.listen({
            port: options.port,
            host: '127.0.0.1',
        }, () => resolve(server));
        server.on('error', reject);
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL2JyaWRnZS9zZXJ2ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQTJNSCxnREFvQ0M7QUE1T0QseUNBQTJCO0FBQzNCLHVEQUE0RztBQUM1RyxpREFBbUQ7QUFDbkQsdURBQXdEO0FBQ3hELHFEQVUwQjtBQUUxQixrQkFBa0I7QUFDTCxRQUFBLFlBQVksR0FBRyxJQUFJLENBQUM7QUFFakMsa0NBQWtDO0FBQ3JCLFFBQUEsY0FBYyxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztBQUVqRCxvREFBb0Q7QUFDcEQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLEdBQUcsQ0FBUztJQUNyQyxNQUFNO0lBQ04sY0FBYztJQUNkLG1CQUFtQjtJQUNuQix3QkFBd0I7SUFDeEIsZ0JBQWdCO0lBQ2hCLGVBQWU7SUFDZixZQUFZO0lBQ1oscUJBQXFCO0lBQ3JCLGNBQWM7SUFDZCxrQkFBa0I7SUFDbEIsa0JBQWtCO0lBQ2xCLGFBQWE7SUFDYixhQUFhO0lBQ2IsY0FBYztJQUNkLGdCQUFnQjtJQUNoQixnQkFBZ0I7Q0FDbkIsQ0FBQyxDQUFDO0FBRUgsMEJBQTBCO0FBQzFCLFNBQVMsWUFBWSxDQUFDLEdBQVc7O0lBQzdCLElBQUksSUFBYSxDQUFDO0lBQ2xCLElBQUksQ0FBQztRQUNELElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzNCLENBQUM7SUFBQyxXQUFNLENBQUM7UUFDTCxPQUFPO1lBQ0gsRUFBRSxFQUFFLEtBQUs7WUFDVCxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLE9BQU8sRUFBRSxjQUFjLEVBQUU7U0FDM0QsQ0FBQztJQUNOLENBQUM7SUFDRCxJQUFJLElBQUksS0FBSyxJQUFJLElB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LE9BQU8sRUFBRSxXQUFXLEVBQUU7eUJBQzFELENBQUM7d0JBQ0YsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO29CQUNsRCxDQUFDO2dCQUNMLENBQUM7WUFDTCxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxDQUFDLE1BQU0sQ0FDVDtZQUNJLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSTtZQUNsQixJQUFJLEVBQUUsV0FBVztTQUNwQixFQUNELEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FDeEIsQ0FBQztRQUNGLE1BQU0sQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQy9CLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBFZGl0b3IgQnJpZGdlIFRDUCBTZXJ2ZXJcclxuICog57aB5a6aIDEyNy4wLjAuMe+8jOaOpeWPlyBKU09OIOihjOiri+axgu+8jOS+neaWueazleeZveWQjeWWrua0vueZvOS4puWbnuWCsyBKU09OIOWbnuaHieOAglxyXG4gKiDlronlhajvvJrlg4UgbG9jYWxob3N044CB6Yyv6Kqk5LiN5bi25YWn6YOo6Lev5b6R77yI5bCN6b2KIHNlY3VyaXR5IHBvbGljee+8ieOAglxyXG4gKi9cclxuXHJcbmltcG9ydCB0eXBlIHsgQnJpZGdlUmVxdWVzdCwgQnJpZGdlUmVzcG9uc2UgfSBmcm9tICcuL3R5cGVzJztcclxuaW1wb3J0ICogYXMgbmV0IGZyb20gJ25ldCc7XHJcbmltcG9ydCB7IGhhbmRsZVF1ZXJ5Tm9kZSwgaGFuZGxlUXVlcnlOb2RlVHJlZSwgaGFuZGxlUmVzdG9yZSwgaGFuZGxlUHJlZmFiQ3JlYXRlIH0gZnJvbSAnLi9wcmVmYWItaGFuZGxlcnMnO1xyXG5pbXBvcnQgeyBoYW5kbGVSZXNvbHZlTm9kZSB9IGZyb20gJy4vcmVzb2x2ZS1ub2RlJztcclxuaW1wb3J0IHsgaGFuZGxlRWRpdG9yUmVmcmVzaCB9IGZyb20gJy4vZWRpdG9yLWhhbmRsZXJzJztcclxuaW1wb3J0IHtcclxuICAgIGhhbmRsZUNyZWF0ZUNvbXBvbmVudCxcclxuICAgIGhhbmRsZUNyZWF0ZU5vZGUsXHJcbiAgICBoYW5kbGVSZW1vdmVDb21wb25lbnQsXHJcbiAgICBoYW5kbGVSZW1vdmVOb2RlLFxyXG4gICAgaGFuZGxlUmVzZXRQcm9wZXJ0eSxcclxuICAgIGhhbmRsZVNjZW5lQ3JlYXRlLFxyXG4gICAgaGFuZGxlU2NlbmVPcGVuLFxyXG4gICAgaGFuZGxlU2NlbmVRdWVyeUN1cnJlbnQsXHJcbiAgICBoYW5kbGVTZXRQcm9wZXJ0eSxcclxufSBmcm9tICcuL3NjZW5lLWhhbmRsZXJzJztcclxuXHJcbi8qKiDpoJDoqK3ln6DomZ/vvIjoiIfol43lnJbkuIDoh7TvvIkgKi9cclxuZXhwb3J0IGNvbnN0IERFRkFVTFRfUE9SVCA9IDY4Njg7XHJcblxyXG4vKiog5Z+g6Jmf55m95ZCN5Zau77yIc2VjdXJpdHkgcG9saWN5IMKnMi4y77yJICovXHJcbmV4cG9ydCBjb25zdCBQT1JUX1dISVRFTElTVCA9IFs2ODY4LCA2ODcwLCA2ODcyXTtcclxuXHJcbi8qKiDmlrnms5Xnmb3lkI3llq7vvJpwaW5nICsgcHJlZmFiICsg5aC05pmv56+A6bue5pON5L2cICsgZWRpdG9yLnJlZnJlc2ggKi9cclxuY29uc3QgTUVUSE9EX1dISVRFTElTVCA9IG5ldyBTZXQ8c3RyaW5nPihbXHJcbiAgICAncGluZycsXHJcbiAgICAncmVzb2x2ZS1ub2RlJyxcclxuICAgICdwcmVmYWIucXVlcnktbm9kZScsXHJcbiAgICAncHJlZmFiLnF1ZXJ5LW5vZGUtdHJlZScsXHJcbiAgICAncHJlZmFiLnJlc3RvcmUnLFxyXG4gICAgJ3ByZWZhYi5jcmVhdGUnLFxyXG4gICAgJ3NjZW5lLm9wZW4nLFxyXG4gICAgJ3NjZW5lLnF1ZXJ5LWN1cnJlbnQnLFxyXG4gICAgJ3NjZW5lLmNyZWF0ZScsXHJcbiAgICAnY3JlYXRlLWNvbXBvbmVudCcsXHJcbiAgICAncmVtb3ZlLWNvbXBvbmVudCcsXHJcbiAgICAnY3JlYXRlLW5vZGUnLFxyXG4gICAgJ3JlbW92ZS1ub2RlJyxcclxuICAgICdzZXQtcHJvcGVydHknLFxyXG4gICAgJ3Jlc2V0LXByb3BlcnR5JyxcclxuICAgICdlZGl0b3IucmVmcmVzaCcsXHJcbl0pO1xyXG5cclxuLyoqIOino+aekOS4pumpl+itieiri+axgu+8m+iLpeeEoeaViOWbnuWCs+mMr+iqpOWbnuaHieeJqeS7tiAqL1xyXG5mdW5jdGlvbiBwYXJzZVJlcXVlc3QocmF3OiBzdHJpbmcpOiBCcmlkZ2VSZXF1ZXN0IHwgQnJpZGdlUmVzcG9uc2Uge1xyXG4gICAgbGV0IGRhdGE6IHVua25vd247XHJcbiAgICB0cnkge1xyXG4gICAgICAgIGRhdGEgPSBKU09OLnBhcnNlKHJhdyk7XHJcbiAgICB9IGNhdGNoIHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBvazogZmFsc2UsXHJcbiAgICAgICAgICAgIGVycm9yOiB7IGNvZGU6ICdJTlZBTElEX0pTT04nLCBtZXNzYWdlOiAnSW52YWxpZCBKU09OJyB9LFxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcbiAgICBpZiAoZGF0YSA9PT0gbnVsbCB8fCB0eXBlb2YgZGF0YSAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShkYXRhKSkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIG9rOiBmYWxzZSxcclxuICAgICAgICAgICAgZXJyb3I6IHsgY29kZTogJ0lOVkFMSURfUEFSQU1TJywgbWVzc2FnZTogJ1JlcXVlc3QgbXVzdCBiZSBhIEpTT04gb2JqZWN0JyB9LFxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcbiAgICBjb25zdCBvYmogPSBkYXRhIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xyXG4gICAgaWYgKHR5cGVvZiBvYmoubWV0aG9kICE9PSAnc3RyaW5nJyB8fCAhb2JqLm1ldGhvZCkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIG9rOiBmYWxzZSxcclxuICAgICAgICAgICAgZXJyb3I6IHsgY29kZTogJ0lOVkFMSURfUEFSQU1TJywgbWVzc2FnZTogJ01pc3Npbmcgb3IgaW52YWxpZCBcIm1ldGhvZFwiJyB9LFxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcbiAgICBpZiAob2JqLnBhcmFtcyAhPT0gdW5kZWZpbmVkICYmICh0eXBlb2Ygb2JqLnBhcmFtcyAhPT0gJ29iamVjdCcgfHwgb2JqLnBhcmFtcyA9PT0gbnVsbCB8fCBBcnJheS5pc0FycmF5KG9iai5wYXJhbXMpKSkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIG9rOiBmYWxzZSxcclxuICAgICAgICAgICAgZXJyb3I6IHsgY29kZTogJ0lOVkFMSURfUEFSQU1TJywgbWVzc2FnZTogJ1wicGFyYW1zXCIgbXVzdCBiZSBhbiBvYmplY3QnIH0sXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuICAgIGNvbnN0IGlkID0gb2JqLmlkICE9PSB1bmRlZmluZWQgPyBTdHJpbmcob2JqLmlkKSA6IHVuZGVmaW5lZDtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgaWQsXHJcbiAgICAgICAgbWV0aG9kOiBvYmoubWV0aG9kLFxyXG4gICAgICAgIHBhcmFtczogKG9iai5wYXJhbXMgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID8/IHt9LFxyXG4gICAgfTtcclxufVxyXG5cclxuLyoqIOWft+ihjOWWruS4gOaWueazle+8iHBpbmcgKyBwcmVmYWIucXVlcnktbm9kZSAvIHF1ZXJ5LW5vZGUtdHJlZSAvIHJlc3RvcmXvvIkgKi9cclxuYXN5bmMgZnVuY3Rpb24gZGlzcGF0Y2gocmVxOiBCcmlkZ2VSZXF1ZXN0KTogUHJvbWlzZTxCcmlkZ2VSZXNwb25zZT4ge1xyXG4gICAgaWYgKCFNRVRIT0RfV0hJVEVMSVNULmhhcyhyZXEubWV0aG9kKSkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGlkOiByZXEuaWQsXHJcbiAgICAgICAgICAgIG9rOiBmYWxzZSxcclxuICAgICAgICAgICAgZXJyb3I6IHsgY29kZTogJ0lOVkFMSURfTUVUSE9EJywgbWVzc2FnZTogJ01ldGhvZCBub3QgYWxsb3dlZCcgfSxcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgaWYgKHJlcS5tZXRob2QgPT09ICdwaW5nJykge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGlkOiByZXEuaWQsXHJcbiAgICAgICAgICAgIG9rOiB0cnVlLFxyXG4gICAgICAgICAgICByZXN1bHQ6IHsgcG9uZzogdHJ1ZSB9LFxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcbiAgICBjb25zdCBwYXJhbXMgPSByZXEucGFyYW1zID8/IHt9O1xyXG4gICAgdHJ5IHtcclxuICAgICAgICBpZiAocmVxLm1ldGhvZCA9PT0gJ3Jlc29sdmUtbm9kZScpIHtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgaGFuZGxlUmVzb2x2ZU5vZGUocGFyYW1zKTtcclxuICAgICAgICAgICAgcmV0dXJuIHsgaWQ6IHJlcS5pZCwgb2s6IHRydWUsIHJlc3VsdCB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocmVxLm1ldGhvZCA9PT0gJ3ByZWZhYi5xdWVyeS1ub2RlJykge1xyXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBoYW5kbGVRdWVyeU5vZGUocGFyYW1zKTtcclxuICAgICAgICAgICAgcmV0dXJuIHsgaWQ6IHJlcS5pZCwgb2s6IHRydWUsIHJlc3VsdCB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocmVxLm1ldGhvZCA9PT0gJ3ByZWZhYi5xdWVyeS1ub2RlLXRyZWUnKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGhhbmRsZVF1ZXJ5Tm9kZVRyZWUocGFyYW1zKTtcclxuICAgICAgICAgICAgcmV0dXJuIHsgaWQ6IHJlcS5pZCwgb2s6IHRydWUsIHJlc3VsdCB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocmVxLm1ldGhvZCA9PT0gJ3ByZWZhYi5yZXN0b3JlJykge1xyXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBoYW5kbGVSZXN0b3JlKHBhcmFtcyk7XHJcbiAgICAgICAgICAgIHJldHVybiB7IGlkOiByZXEuaWQsIG9rOiB0cnVlLCByZXN1bHQgfTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgPT09ICdwcmVmYWIuY3JlYXRlJykge1xyXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBoYW5kbGVQcmVmYWJDcmVhdGUocGFyYW1zKTtcclxuICAgICAgICAgICAgcmV0dXJuIHsgaWQ6IHJlcS5pZCwgb2s6IHRydWUsIHJlc3VsdCB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocmVxLm1ldGhvZCA9PT0gJ3NjZW5lLm9wZW4nKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGhhbmRsZVNjZW5lT3BlbihwYXJhbXMpO1xyXG4gICAgICAgICAgICByZXR1cm4geyBpZDogcmVxLmlkLCBvazogdHJ1ZSwgcmVzdWx0IH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChyZXEubWV0aG9kID09PSAnc2NlbmUucXVlcnktY3VycmVudCcpIHtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgaGFuZGxlU2NlbmVRdWVyeUN1cnJlbnQocGFyYW1zKTtcclxuICAgICAgICAgICAgcmV0dXJuIHsgaWQ6IHJlcS5pZCwgb2s6IHRydWUsIHJlc3VsdCB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocmVxLm1ldGhvZCA9PT0gJ3NjZW5lLmNyZWF0ZScpIHtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgaGFuZGxlU2NlbmVDcmVhdGUocGFyYW1zKTtcclxuICAgICAgICAgICAgcmV0dXJuIHsgaWQ6IHJlcS5pZCwgb2s6IHRydWUsIHJlc3VsdCB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocmVxLm1ldGhvZCA9PT0gJ2NyZWF0ZS1jb21wb25lbnQnKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGhhbmRsZUNyZWF0ZUNvbXBvbmVudChwYXJhbXMpO1xyXG4gICAgICAgICAgICByZXR1cm4geyBpZDogcmVxLmlkLCBvazogdHJ1ZSwgcmVzdWx0IH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChyZXEubWV0aG9kID09PSAncmVtb3ZlLWNvbXBvbmVudCcpIHtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgaGFuZGxlUmVtb3ZlQ29tcG9uZW50KHBhcmFtcyk7XHJcbiAgICAgICAgICAgIHJldHVybiB7IGlkOiByZXEuaWQsIG9rOiB0cnVlLCByZXN1bHQgfTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgPT09ICdjcmVhdGUtbm9kZScpIHtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgaGFuZGxlQ3JlYXRlTm9kZShwYXJhbXMpO1xyXG4gICAgICAgICAgICByZXR1cm4geyBpZDogcmVxLmlkLCBvazogdHJ1ZSwgcmVzdWx0IH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChyZXEubWV0aG9kID09PSAncmVtb3ZlLW5vZGUnKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGhhbmRsZVJlbW92ZU5vZGUocGFyYW1zKTtcclxuICAgICAgICAgICAgcmV0dXJuIHsgaWQ6IHJlcS5pZCwgb2s6IHRydWUsIHJlc3VsdCB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocmVxLm1ldGhvZCA9PT0gJ3NldC1wcm9wZXJ0eScpIHtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgaGFuZGxlU2V0UHJvcGVydHkocGFyYW1zKTtcclxuICAgICAgICAgICAgcmV0dXJuIHsgaWQ6IHJlcS5pZCwgb2s6IHRydWUsIHJlc3VsdCB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocmVxLm1ldGhvZCA9PT0gJ3Jlc2V0LXByb3BlcnR5Jykge1xyXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBoYW5kbGVSZXNldFByb3BlcnR5KHBhcmFtcyk7XHJcbiAgICAgICAgICAgIHJldHVybiB7IGlkOiByZXEuaWQsIG9rOiB0cnVlLCByZXN1bHQgfTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgPT09ICdlZGl0b3IucmVmcmVzaCcpIHtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgaGFuZGxlRWRpdG9yUmVmcmVzaChwYXJhbXMpO1xyXG4gICAgICAgICAgICByZXR1cm4geyBpZDogcmVxLmlkLCBvazogdHJ1ZSwgcmVzdWx0IH07XHJcbiAgICAgICAgfVxyXG4gICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIGNvbnN0IGNvZGUgPSAoZSAmJiB0eXBlb2YgZSA9PT0gJ29iamVjdCcgJiYgJ2NvZGUnIGluIGUgJiYgKGUgYXMgYW55KS5jb2RlKSB8fCAnU0NFTkVfRVJST1InO1xyXG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiAnT3BlcmF0aW9uIGZhaWxlZCc7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgaWQ6IHJlcS5pZCxcclxuICAgICAgICAgICAgb2s6IGZhbHNlLFxyXG4gICAgICAgICAgICBlcnJvcjogeyBjb2RlOiBTdHJpbmcoY29kZSksIG1lc3NhZ2UgfSxcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBpZDogcmVxLmlkLFxyXG4gICAgICAgIG9rOiBmYWxzZSxcclxuICAgICAgICBlcnJvcjogeyBjb2RlOiAnSU5WQUxJRF9NRVRIT0QnLCBtZXNzYWdlOiAnTWV0aG9kIG5vdCBhbGxvd2VkJyB9LFxyXG4gICAgfTtcclxufVxyXG5cclxuLyoqIOiZleeQhuWWruihjOi8uOWFpe+8jOWbnuWCs+S4gOethiBKU09OIOihjOWbnuaHie+8iOmdnuWQjOatpeS7peaUr+aPtCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN077yJICovXHJcbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZUxpbmUobGluZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcclxuICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlUmVxdWVzdChsaW5lKTtcclxuICAgIGlmICgnb2snIGluIHBhcnNlZCAmJiBwYXJzZWQub2sgPT09IGZhbHNlKSB7XHJcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHBhcnNlZCkgKyAnXFxuJztcclxuICAgIH1cclxuICAgIGlmICgnbWV0aG9kJyBpbiBwYXJzZWQpIHtcclxuICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGRpc3BhdGNoKHBhcnNlZCBhcyBCcmlkZ2VSZXF1ZXN0KTtcclxuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzcG9uc2UpICsgJ1xcbic7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocGFyc2VkKSArICdcXG4nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEJyaWRnZVNlcnZlck9wdGlvbnMge1xyXG4gICAgLyoqIOebo+iBveWfoOiZn++8iOmgiOWcqCBQT1JUX1dISVRFTElTVCDlhafvvIkgKi9cclxuICAgIHBvcnQ6IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBCcmlkZ2VTZXJ2ZXIge1xyXG4gICAgY2xvc2UoY2FsbGJhY2s/OiAoKSA9PiB2b2lkKTogdm9pZDtcclxufVxyXG5cclxuLyoqXHJcbiAqIOW7uueri+S4puWVn+WLlSBUQ1Agc2VydmVy77yM57aB5a6aIDEyNy4wLjAuMeOAglxyXG4gKiDoqIrmga/pgornlYzvvJrmr4/ooYzkuIDnrYYgSlNPTiDoq4vmsYLvvIzlm57lgrPkuIDnrYYgSlNPTiDooYzjgIJcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVCcmlkZ2VTZXJ2ZXIob3B0aW9uczogQnJpZGdlU2VydmVyT3B0aW9ucyk6IFByb21pc2U8bmV0LlNlcnZlcj4ge1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICBjb25zdCBzZXJ2ZXIgPSBuZXQuY3JlYXRlU2VydmVyKChzb2NrZXQ6IG5ldC5Tb2NrZXQpID0+IHtcclxuICAgICAgICAgICAgbGV0IGJ1ZmZlciA9ICcnO1xyXG4gICAgICAgICAgICBzb2NrZXQuc2V0RW5jb2RpbmcoJ3V0ZjgnKTtcclxuICAgICAgICAgICAgc29ja2V0Lm9uKCdkYXRhJywgYXN5bmMgKGNodW5rOiBCdWZmZXIgfCBzdHJpbmcpID0+IHtcclxuICAgICAgICAgICAgICAgIGJ1ZmZlciArPSB0eXBlb2YgY2h1bmsgPT09ICdzdHJpbmcnID8gY2h1bmsgOiBjaHVuay50b1N0cmluZygndXRmOCcpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbGluZXMgPSBidWZmZXIuc3BsaXQoJ1xcbicpO1xyXG4gICAgICAgICAgICAgICAgYnVmZmVyID0gbGluZXMucG9wKCkgPz8gJyc7XHJcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCB0cmltbWVkID0gbGluZS50cmltKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0cmltbWVkKSBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBvdXQgPSBhd2FpdCBoYW5kbGVMaW5lKHRyaW1tZWQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzb2NrZXQud3JpdGUob3V0KTtcclxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2FmZU1lc3NhZ2UgPSBlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogJ1Vua25vd24gZXJyb3InO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXNwb25zZTogQnJpZGdlUmVzcG9uc2UgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvazogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcjogeyBjb2RlOiAnSU5URVJOQUxfRVJST1InLCBtZXNzYWdlOiBzYWZlTWVzc2FnZSB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzb2NrZXQud3JpdGUoSlNPTi5zdHJpbmdpZnkocmVzcG9uc2UpICsgJ1xcbicpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHNlcnZlci5saXN0ZW4oXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHBvcnQ6IG9wdGlvbnMucG9ydCxcclxuICAgICAgICAgICAgICAgIGhvc3Q6ICcxMjcuMC4wLjEnLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAoKSA9PiByZXNvbHZlKHNlcnZlciksXHJcbiAgICAgICAgKTtcclxuICAgICAgICBzZXJ2ZXIub24oJ2Vycm9yJywgcmVqZWN0KTtcclxuICAgIH0pO1xyXG59XHJcbiJdfQ==