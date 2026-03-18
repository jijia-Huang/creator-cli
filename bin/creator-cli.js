#!/usr/bin/env node
/**
 * CreatorCLI — 獨立 CLI 入口，透過 TCP JSON 呼叫 Editor Bridge。
 * 埠號：預設 6868；可用 creator-cli init <port> 寫入設定檔；或環境變數 CREATOR_CLI_PORT；或 --port 覆蓋。
 * 使用：creator-cli [--port PORT] <子命令> [args...]
 */

const net = require('net');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOST = '127.0.0.1';
const DEFAULT_PORT = 6868;
const PORT_WHITELIST = [6868, 6870, 6872];

function getConfigPath() {
    const home = os.homedir();
    return path.join(home, '.creator-cli.json');
}

function readConfigPort() {
    try {
        const p = getConfigPath();
        if (fs.existsSync(p)) {
            const raw = fs.readFileSync(p, 'utf8');
            const data = JSON.parse(raw);
            const port = typeof data.port === 'number' ? data.port : parseInt(data.port, 10);
            if (Number.isInteger(port) && PORT_WHITELIST.includes(port)) return port;
        }
    } catch (_) {}
    return null;
}

function writeConfigPort(port) {
    const p = getConfigPath();
    fs.writeFileSync(p, JSON.stringify({ port }, null, 2) + '\n', 'utf8');
}

function parseArgs(argv) {
    const args = argv.slice(0);
    const result = { port: null, help: false, helpSubcommand: null, argv: [] };
    while (args.length) {
        const a = args[0];
        if (a === '--port') {
            args.shift();
            if (args.length) {
                result.port = parseInt(args.shift(), 10);
            }
            continue;
        }
        if (a === '--help' || a === '-h') {
            result.help = true;
            args.shift();
            result.helpSubcommand = result.argv.length ? result.argv[result.argv.length - 1] : null;
            result.argv = args.slice();
            return result;
        }
        result.argv.push(args.shift());
    }
    return result;
}

function getPort(cliPort) {
    let p = DEFAULT_PORT;
    const fromConfig = readConfigPort();
    if (fromConfig != null) p = fromConfig;
    const env = process.env.CREATOR_CLI_PORT;
    if (env != null && env !== '') {
        const n = parseInt(env, 10);
        if (Number.isInteger(n) && PORT_WHITELIST.includes(n)) p = n;
    }
    if (cliPort != null && Number.isInteger(cliPort) && PORT_WHITELIST.includes(cliPort)) p = cliPort;
    return p;
}

function isUuid(s) {
    return typeof s === 'string' && /^[0-9a-fA-F]{32}$/.test(s);
}

function isValidId(s) {
    if (typeof s !== 'string' || s.length < 1 || s.length > 64 || /\s/.test(s)) return false;
    return isUuid(s) || /^[A-Za-z0-9+/=-]+$/.test(s);
}

function parseValue(s) {
    if (s === undefined || s === '') return undefined;
    const t = String(s).trim();
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
        try {
            return JSON.parse(t);
        } catch (_) {
            return s;
        }
    }
    if (t === 'true') return true;
    if (t === 'false') return false;
    const n = Number(t);
    if (!isNaN(n)) return n;
    return s;
}

const COMMANDS = {
    init: {
        method: null,
        usage: 'creator-cli init <port>',
        desc: '設定預設埠號並寫入 ~/.creator-cli.json，之後不需再指定 port',
        buildParams: (argv) => {
            if (!argv[0]) return null;
            const port = parseInt(argv[0], 10);
            if (!Number.isInteger(port) || !PORT_WHITELIST.includes(port)) return null;
            return { port };
        },
    },
    ping: {
        method: 'ping',
        usage: 'creator-cli ping',
        desc: '檢查 Bridge 是否存活',
        buildParams: () => ({}),
    },
    'resolve-node': {
        method: 'resolve-node',
        usage: 'creator-cli resolve-node <path>',
        desc: '依節點路徑解析為 uuid（例：Root/Canvas/Sprite）',
        buildParams: (argv) => {
            if (argv.length && !argv[0].startsWith('--')) return { path: argv[0].trim() };
            const parentIdx = argv.indexOf('--parent');
            const nameIdx = argv.indexOf('--name');
            if (parentIdx !== -1 && nameIdx !== -1 && parentIdx + 1 < argv.length && nameIdx + 1 < argv.length) {
                return { parentPath: argv[parentIdx + 1], name: argv[nameIdx + 1] };
            }
            return null;
        },
    },
    'resolve-component': {
        method: 'resolve-component',
        usage: 'creator-cli resolve-component <nodeUuid|nodePath> <component>',
        desc: '依節點與組件類名解析出組件 uuid（供 remove-component / set-property 用）',
        buildParams: (argv) => {
            if (!argv[0] || !isValidId(argv[0]) || !argv[1]) return null;
            const ref = isUuid(argv[0]) ? { uuid: argv[0] } : { nodePath: argv[0] };
            return { ...ref, component: argv[1] };
        },
    },
    'prefab.query-node': {
        method: 'prefab.query-node',
        usage: 'creator-cli prefab.query-node <uuid>',
        desc: '查詢節點 dump（32 位 hex uuid）',
        buildParams: (argv) => {
            if (!argv[0] || !isUuid(argv[0])) return null;
            return { uuid: argv[0] };
        },
    },
    'prefab.query-node-tree': {
        method: 'prefab.query-node-tree',
        usage: 'creator-cli prefab.query-node-tree [format] [uuid]  format: tree|markdown|flat|limit [maxDepth] [maxChildren]',
        desc: '查詢節點樹',
        buildParams: (argv) => {
            const params = {};
            if (argv[0] === 'markdown') {
                params.format = 'markdown';
                if (argv[1] && isUuid(argv[1])) params.uuid = argv[1];
            } else if (argv[0] === 'flat') {
                params.format = 'flat';
                if (argv[1] && isUuid(argv[1])) params.uuid = argv[1];
            } else if (argv[0] === 'limit') {
                const depth = parseInt(argv[1], 10);
                if (!Number.isInteger(depth) || depth < 1) return null;
                params.maxDepth = depth;
                if (argv[2] != null && argv[2] !== '') {
                    if (isUuid(argv[2])) {
                        params.uuid = argv[2];
                    } else {
                        const children = parseInt(argv[2], 10);
                        if (Number.isInteger(children) && children >= 1) {
                            params.maxChildren = children;
                            if (argv[3] && isUuid(argv[3])) params.uuid = argv[3];
                        }
                    }
                }
            } else {
                if (argv[0] && isUuid(argv[0])) params.uuid = argv[0];
            }
            return params;
        },
    },
    'prefab.restore': {
        method: 'prefab.restore',
        usage: 'creator-cli prefab.restore <uuid>',
        desc: '還原節點為 prefab 狀態',
        buildParams: (argv) => {
            if (!argv[0] || !isUuid(argv[0])) return null;
            return { uuid: argv[0] };
        },
    },
    'prefab.create': {
        method: 'prefab.create',
        usage: 'creator-cli prefab.create <nodeUuid|nodePath> <assetPath>',
        desc: '從節點建立 prefab；nodePath 或 32 位 uuid',
        buildParams: (argv) => {
            if (!argv[0] || !argv[1]) return null;
            const first = argv[0];
            if (isUuid(first)) return { nodeUuid: first, assetPath: argv[1] };
            return { nodePath: first, assetPath: argv[1] };
        },
    },
    'scene.open': {
        method: 'scene.open',
        usage: 'creator-cli scene.open <uuid|assetPath>',
        desc: '開啟場景/prefab（uuid 或 db:/assets/ 路徑）',
        buildParams: (argv) => {
            if (!argv[0]) return null;
            if (isUuid(argv[0])) return { uuid: argv[0] };
            return { assetPath: argv[0] };
        },
    },
    'scene.query-current': {
        method: 'scene.query-current',
        usage: 'creator-cli scene.query-current',
        desc: '查詢當前場景資訊',
        buildParams: () => ({}),
    },
    'scene.create': {
        method: 'scene.create',
        usage: 'creator-cli scene.create <assetPath> [--open]',
        desc: '建立場景',
        buildParams: (argv) => {
            const openIdx = argv.indexOf('--open');
            const pos = openIdx === -1 ? argv : argv.slice(0, openIdx);
            if (!pos[0]) return null;
            const params = { assetPath: pos[0] };
            if (openIdx !== -1) params.open = true;
            return params;
        },
    },
    'create-component': {
        method: 'create-component',
        usage: 'creator-cli create-component <nodeUuid|nodePath> <component>',
        desc: '在節點上建立組件',
        buildParams: (argv) => {
            if (!argv[0] || !isValidId(argv[0]) || !argv[1]) return null;
            const ref = isUuid(argv[0]) ? { uuid: argv[0] } : { nodePath: argv[0] };
            return { ...ref, component: argv[1] };
        },
    },
    'remove-component': {
        method: 'remove-component',
        usage: 'creator-cli remove-component <componentUuid>',
        desc: '移除組件',
        buildParams: (argv) => {
            if (!argv[0] || !isValidId(argv[0])) return null;
            return { uuid: argv[0] };
        },
    },
    'create-node': {
        method: 'create-node',
        usage: 'creator-cli create-node [parentUuid|parentPath] [name]',
        desc: '建立節點',
        buildParams: (argv) => {
            const params = {};
            if (argv[0]) {
                if (isUuid(argv[0])) params.uuid = argv[0];
                else params.nodePath = argv[0];
            }
            if (argv[1]) params.name = argv[1];
            return params;
        },
    },
    'remove-node': {
        method: 'remove-node',
        usage: 'creator-cli remove-node <uuid|nodePath> [uuid2 ...]',
        desc: '移除節點',
        buildParams: (argv) => {
            if (!argv[0]) return null;
            if (argv.length === 1 && !isUuid(argv[0]) && typeof argv[0] === 'string' && argv[0].trim() && !argv[0].startsWith('db:')) {
                return { nodePath: argv[0].trim() };
            }
            const uuids = [];
            for (let i = 0; i < argv.length; i++) {
                if (!isValidId(argv[i])) return null;
                uuids.push(argv[i]);
            }
            return uuids.length === 1 ? { uuid: uuids[0] } : { uuid: uuids };
        },
    },
    'set-property': {
        method: 'set-property',
        usage: 'creator-cli set-property <nodePath|uuid> <path> [value]',
        desc: '設定屬性；value 可為字串或 JSON（含 db: 資源路徑）',
        buildParams: (argv) => {
            if (!argv[0] || !argv[1]) return null;
            const ref = isUuid(argv[0]) ? { uuid: argv[0] } : { nodePath: argv[0].trim() };
            const value = parseValue(argv[2]);
            const params = { ...ref, path: argv[1] };
            if (value !== undefined) params.value = value;
            return params;
        },
    },
    'reset-property': {
        method: 'reset-property',
        usage: 'creator-cli reset-property <nodePath|uuid> <path>',
        desc: '重置屬性',
        buildParams: (argv) => {
            if (!argv[0] || !argv[1]) return null;
            const ref = isUuid(argv[0]) ? { uuid: argv[0] } : { nodePath: argv[0].trim() };
            return { ...ref, path: argv[1] };
        },
    },
    'editor.refresh': {
        method: 'editor.refresh',
        usage: 'creator-cli editor.refresh',
        desc: '觸發編輯器編譯並等待完成',
        buildParams: () => ({}),
    },
};

function mainHelp() {
    console.log('CreatorCLI — 透過 TCP 呼叫 Cocos Creator Editor Bridge');
    console.log('');
    console.log('埠號：預設 6868；可用 init 寫入 ~/.creator-cli.json；或 CREATOR_CLI_PORT；或 --port 覆蓋');
    console.log('');
    console.log('用法: creator-cli [--port PORT] <子命令> [args...]');
    console.log('       creator-cli --help');
    console.log('       creator-cli <子命令> --help');
    console.log('');
    console.log('子命令:');
    const names = Object.keys(COMMANDS).sort();
    for (const name of names) {
        console.log('  ' + name.padEnd(24) + '  ' + COMMANDS[name].desc);
    }
}

function subcommandHelp(cmd) {
    const c = COMMANDS[cmd];
    if (!c) {
        console.error('未知子命令: ' + cmd);
        process.exit(1);
    }
    console.log('用法: ' + c.usage);
    console.log('');
    console.log(c.desc);
}

function runClient(port, request) {
    const timeoutMs = request.method === 'editor.refresh' ? 130000 : 5000;
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(request) + '\n';
        const client = net.createConnection({ host: HOST, port }, () => {
            client.write(payload);
        });
        let buffer = '';
        client.on('data', (chunk) => {
            buffer += chunk.toString();
            const idx = buffer.indexOf('\n');
            if (idx !== -1) {
                client.destroy();
                try {
                    const res = JSON.parse(buffer.slice(0, idx));
                    resolve(res);
                } catch (e) {
                    resolve({ ok: false, error: { code: 'INVALID_JSON', message: buffer.slice(0, idx) } });
                }
            }
        });
        client.on('error', (err) => {
            client.destroy();
            reject(err);
        });
        client.setTimeout(timeoutMs, () => {
            client.destroy();
            reject(new Error('Timeout'));
        });
    });
}

function main() {
    const parsed = parseArgs(process.argv.slice(2));
    const argv = parsed.argv;
    const sub = argv[0];
    const cmdArgs = argv.slice(1);

    if (parsed.help) {
        if (parsed.helpSubcommand) {
            subcommandHelp(parsed.helpSubcommand);
        } else {
            mainHelp();
        }
        process.exit(0);
    }

    if (!sub) {
        mainHelp();
        process.exit(0);
    }

    const cmd = COMMANDS[sub];
    if (!cmd) {
        console.error('未知子命令: ' + sub);
        console.error('使用 creator-cli --help 查看子命令列表');
        process.exit(1);
    }

    if (sub === 'init') {
        const params = cmd.buildParams(cmdArgs);
        if (params === null) {
            console.error('用法: creator-cli init <port>');
            console.error('port 須為 6868、6870 或 6872');
            process.exit(1);
        }
        try {
            writeConfigPort(params.port);
            console.log('Port ' + params.port + ' 已寫入 ' + getConfigPath());
            console.log('之後執行 creator-cli 將預設使用此埠號（仍可用 --port 或 CREATOR_CLI_PORT 覆蓋）');
        } catch (e) {
            console.error('寫入設定失敗: ' + (e.message || e));
            process.exit(1);
        }
        process.exit(0);
    }

    const port = getPort(parsed.port);
    const params = cmd.buildParams(cmdArgs);
    if (params === null) {
        console.error('用法: ' + cmd.usage);
        process.exit(1);
    }

    const request = { method: cmd.method, params };

    runClient(port, request)
        .then((res) => {
            if (res.ok) {
                if (res.result !== undefined) {
                    if (typeof res.result === 'object') {
                        console.log(JSON.stringify(res.result, null, 2));
                    } else {
                        console.log(res.result);
                    }
                } else {
                    console.log('OK');
                }
                process.exit(0);
            } else {
                const err = res.error || {};
                console.error((err.code || 'ERROR') + ': ' + (err.message || 'Unknown error'));
                process.exit(1);
            }
        })
        .catch((err) => {
            console.error('連線錯誤: ' + (err.message || err.code || err));
            process.exit(2);
        });
}

main();
