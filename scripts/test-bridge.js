/**
 * 手動測試 Bridge：送一筆 JSON 請求並印出回應。
 *
 * 使用方式（可設環境變數 PORT，預設 6868）：
 *
 * 基本／錯誤：
 *   node scripts/test-bridge.js ping
 *   node scripts/test-bridge.js invalid-method
 *   node scripts/test-bridge.js invalid-json
 *
 * Prefab／節點樹：
 *   node scripts/test-bridge.js prefab.query-node <32位hex的uuid>
 *   node scripts/test-bridge.js prefab.query-node-tree [根節點uuid]
 *   node scripts/test-bridge.js prefab.query-node-tree markdown [根節點uuid]
 *   node scripts/test-bridge.js prefab.query-node-tree flat [根節點uuid]
 *   node scripts/test-bridge.js prefab.query-node-tree limit <maxDepth> [maxChildren] [根節點uuid]
 *   node scripts/test-bridge.js prefab.restore <uuid>
 *
 * Node 操作：
 *   node scripts/test-bridge.js create-component <節點uuid> <組件類名>
 *   node scripts/test-bridge.js remove-component <組件uuid>
 *   node scripts/test-bridge.js create-node [父節點uuid] [名稱]
 *   node scripts/test-bridge.js remove-node <uuid> [uuid2 ...]
 *   node scripts/test-bridge.js set-property <uuid> <path> <value>
 *   node scripts/test-bridge.js reset-property <uuid> <path>
 *
 * 編輯器刷新（觸發編譯，等待完成；有 error/warn 時 result 會帶 log）：
 *   node scripts/test-bridge.js editor.refresh
 */
const net = require('net');
const HOST = '127.0.0.1';
const PORT = parseInt(process.env.PORT || process.env.CREATOR_CLI_PORT || '6868', 10);

const argv = process.argv.slice(2);
const arg = argv[0];
const uuid = argv[1];
const extra = argv[2];
const extra2 = argv[3];
const extra3 = argv[4];

/** 32 位十六進位 UUID（Bridge 契約常用） */
function isUuid(s) {
    return typeof s === 'string' && /^[0-9a-fA-F]{32}$/.test(s);
}

/** Node ref: non-empty string, length <= 1024 (uuid or nodePath including "/"). */
function isNodeRef(s) {
    return typeof s === 'string' && s.length > 0 && s.length <= 1024;
}

function parseValue(s) {
    if (s === undefined || s === '') return undefined;
    const t = s.trim();
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
        try {
            return JSON.parse(t);
        } catch (e) {
            return s;
        }
    }
    if (t === 'true') return true;
    if (t === 'false') return false;
    const n = Number(t);
    if (!isNaN(n)) return n;
    return s;
}

let request;
if (arg === 'ping') {
    request = { method: 'ping' };
} else if (arg === 'invalid-method') {
    request = { method: 'not-a-real-method' };
} else if (arg === 'invalid-json') {
    const client = net.createConnection({ host: HOST, port: PORT }, () => {
        client.write('not json at all\n');
    });
    runClient(client, 'invalid-json');
    process.exit(0);
} else if (arg === 'prefab.query-node') {
    if (!uuid || !isUuid(uuid)) {
        console.error('用法: node scripts/test-bridge.js prefab.query-node <32位hex的uuid>');
        process.exit(1);
    }
    request = { method: 'prefab.query-node', params: { uuid } };
} else if (arg === 'prefab.query-node-tree') {
    const params = {};
    if (extra === 'markdown') {
        params.format = 'markdown';
        if (extra2 && isUuid(extra2)) params.uuid = extra2;
    } else if (extra === 'flat') {
        params.format = 'flat';
        if (extra2 && isUuid(extra2)) params.uuid = extra2;
    } else if (extra === 'limit') {
        const depth = parseInt(extra2, 10);
        if (!Number.isInteger(depth) || depth < 1) {
            console.error('用法: node scripts/test-bridge.js prefab.query-node-tree limit <maxDepth> [maxChildren] [根節點uuid]');
            process.exit(1);
        }
        params.maxDepth = depth;
        if (extra3 != null && extra3 !== '') {
            if (isUuid(extra3)) {
                params.uuid = extra3;
            } else {
                const children = parseInt(extra3, 10);
                if (Number.isInteger(children) && children >= 1) {
                    params.maxChildren = children;
                    if (argv[5] && isUuid(argv[5])) params.uuid = argv[5];
                }
            }
        }
    } else {
        if (uuid && isUuid(uuid)) params.uuid = uuid;
    }
    request = { method: 'prefab.query-node-tree', params };
} else if (arg === 'prefab.restore') {
    if (!uuid || !isUuid(uuid)) {
        console.error('用法: node scripts/test-bridge.js prefab.restore <uuid>');
        process.exit(1);
    }
    request = { method: 'prefab.restore', params: { uuid } };
} else if (arg === 'create-component') {
    if (!uuid || !isNodeRef(uuid) || !extra) {
        console.error('用法: node scripts/test-bridge.js create-component <節點uuid|nodePath> <組件類名>');
        process.exit(1);
    }
    const ref = isUuid(uuid) ? { uuid } : { nodePath: uuid.trim() };
    request = { method: 'create-component', params: { ...ref, component: extra } };
} else if (arg === 'remove-component') {
    if (!uuid || !isUuid(uuid)) {
        console.error('用法: node scripts/test-bridge.js remove-component <組件uuid>');
        process.exit(1);
    }
    request = { method: 'remove-component', params: { uuid } };
} else if (arg === 'create-node') {
    const params = {};
    if (uuid && isNodeRef(uuid)) {
        if (isUuid(uuid)) params.uuid = uuid;
        else params.nodePath = uuid.trim();
    }
    if (extra) params.name = extra;
    request = { method: 'create-node', params };
} else if (arg === 'remove-node') {
    if (!uuid) {
        console.error('用法: node scripts/test-bridge.js remove-node <uuid|nodePath> [uuid2 ...]');
        process.exit(1);
    }
    if (argv.length === 1) {
        if (!isNodeRef(uuid)) {
            console.error('用法: node scripts/test-bridge.js remove-node <uuid|nodePath> [uuid2 ...]');
            process.exit(1);
        }
        if (isUuid(uuid)) request = { method: 'remove-node', params: { uuid } };
        else if (!uuid.startsWith('db:')) request = { method: 'remove-node', params: { nodePath: uuid.trim() } };
        else {
            console.error('用法: node scripts/test-bridge.js remove-node <uuid|nodePath> [uuid2 ...]');
            process.exit(1);
        }
    } else {
        const uuids = [uuid];
        for (let i = 2; i < argv.length; i++) {
            if (!isUuid(argv[i])) {
                console.error('用法: node scripts/test-bridge.js remove-node <uuid|nodePath> [uuid2 ...] (多參數時僅接受 uuid)');
                process.exit(1);
            }
            uuids.push(argv[i]);
        }
        request = { method: 'remove-node', params: uuids.length === 1 ? { uuid: uuids[0] } : { uuid: uuids } };
    }
} else if (arg === 'set-property') {
    if (!uuid || !isNodeRef(uuid) || !extra) {
        console.error('用法: node scripts/test-bridge.js set-property <節點uuid|nodePath> <path> [value]');
        process.exit(1);
    }
    const ref = isUuid(uuid) ? { uuid } : { nodePath: uuid.trim() };
    const value = parseValue(extra2);
    const params = { ...ref, path: extra };
    if (value !== undefined) params.value = value;
    request = { method: 'set-property', params };
} else if (arg === 'reset-property') {
    if (!uuid || !isNodeRef(uuid) || !extra) {
        console.error('用法: node scripts/test-bridge.js reset-property <節點uuid|nodePath> <path>');
        process.exit(1);
    }
    const ref = isUuid(uuid) ? { uuid } : { nodePath: uuid.trim() };
    request = { method: 'reset-property', params: { ...ref, path: extra } };
} else if (arg === 'editor.refresh') {
    request = { method: 'editor.refresh', params: {} };
} else {
    console.error('用法: node scripts/test-bridge.js <ping|invalid-method|invalid-json|');
    console.error('  prefab.query-node|prefab.query-node-tree|prefab.restore|');
    console.error('  create-component|remove-component|create-node|remove-node|set-property|reset-property|editor.refresh> [args...]');
    process.exit(1);
}

const req = JSON.stringify(request) + '\n';
const client = net.createConnection({ host: HOST, port: PORT }, () => {
    client.write(req);
});

function runClient(sock, label) {
    let buffer = '';
    sock.on('data', (chunk) => {
        buffer += chunk.toString();
        if (buffer.indexOf('\n') !== -1) {
            const line = buffer.split('\n')[0];
            sock.destroy();
            console.log('請求:', label || JSON.stringify(request));
            console.log('回應:', line);
            try {
                console.log('解析:', JSON.parse(line));
            } catch (e) {
                // ignore
            }
            process.exit(0);
        }
    });
    sock.on('error', (err) => {
        console.error('連線錯誤:', err.message || err.code);
        process.exit(2);
    });
    const timeoutMs = request.method === 'editor.refresh' ? 130000 : 5000;
    sock.setTimeout(timeoutMs, () => {
        sock.destroy();
        console.error('逾時');
        process.exit(1);
    });
}

runClient(client, req.trim());