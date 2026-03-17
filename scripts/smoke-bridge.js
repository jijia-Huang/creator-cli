/**
 * Smoke test: 連線至 Bridge 127.0.0.1:6868，送 ping，預期 { ok: true, result: { pong: true } }。
 * 使用方式：node scripts/smoke-bridge.js
 * 前置：Creator 已啟動且已啟用 creator-cli 擴充，Bridge 才會在 6868 監聽。
 */
const net = require('net');
const HOST = '127.0.0.1';
const PORT = 6868;

const req = JSON.stringify({ method: 'ping' }) + '\n';
const client = net.createConnection({ host: HOST, port: PORT }, () => {
    client.write(req);
});

let buffer = '';
client.on('data', (chunk) => {
    buffer += chunk.toString();
    if (buffer.indexOf('\n') !== -1) {
        const line = buffer.split('\n')[0];
        client.destroy();
        try {
            const res = JSON.parse(line);
            if (res.ok === true && res.result && res.result.pong === true) {
                console.log('PASS: ping ->', line);
                process.exit(0);
            }
            console.error('FAIL: unexpected response ->', line);
            process.exit(1);
        } catch (e) {
            console.error('FAIL: invalid JSON ->', line, e.message);
            process.exit(1);
        }
    }
});

client.on('error', (err) => {
    console.error('SKIP: connection failed (is Creator running with extension enabled?)', err.code || err.message);
    process.exit(2); // 2 = skipped
});

client.setTimeout(3000, () => {
    client.destroy();
    console.error('FAIL: timeout waiting for response');
    process.exit(1);
});
