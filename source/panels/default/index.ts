/* eslint-disable vue/one-component-per-file */

import { readFileSync } from 'fs-extra';
import { join } from 'path';
import { createApp, App, defineComponent } from 'vue';
const panelDataMap = new WeakMap<any, App>();

/**
 * Bridge 控制面板：埠號選擇、啟動／停止、狀態顯示。
 * 透過 Editor.Message 與 extension main 通訊（start-bridge、stop-bridge、get-bridge-status）。
 */
const BridgePanel = defineComponent({
    data() {
        return {
            selectedPort: 6868 as number,
            status: { listening: false, port: undefined as number | undefined },
            statusError: '' as string,
        };
    },
    computed: {
        listening(): boolean {
            return this.status.listening;
        },
        statusText(): string {
            if (this.status.listening && this.status.port !== undefined) {
                return `已連線：127.0.0.1:${this.status.port}`;
            }
            return '未連線';
        },
    },
    mounted() {
        this.refreshStatus();
    },
    methods: {
        async refreshStatus() {
            const res = await (Editor.Message as any).request('creator-cli', 'get-bridge-status');
            this.status = res ?? { listening: false };
            if (this.status.listening) {
                this.statusError = '';
            }
        },
        async onStart() {
            this.statusError = '';
            const res = await (Editor.Message as any).request('creator-cli', 'start-bridge', this.selectedPort);
            await this.refreshStatus();
            if (res && res.ok === false && res.error) {
                this.statusError = res.error;
            }
        },
        async onStop() {
            (Editor.Message as any).send('creator-cli', 'stop-bridge');
            await this.refreshStatus();
        },
    },
    template: readFileSync(join(__dirname, '../../../static/template/vue/bridge-panel.html'), 'utf-8'),
});

module.exports = Editor.Panel.define({
    listeners: {
        show() {},
        hide() {},
    },
    template: readFileSync(join(__dirname, '../../../static/template/default/index.html'), 'utf-8'),
    style: readFileSync(join(__dirname, '../../../static/style/default/index.css'), 'utf-8'),
    $: {
        app: '#app',
        text: '#text',
    },
    methods: {
        hello() {
            if (this.$.text) {
                this.$.text.innerHTML = 'hello';
            }
        },
    },
    ready() {
        if (this.$.text) {
            this.$.text.innerHTML = '';
        }
        if (this.$.app) {
            const app = createApp({});
            app.config.compilerOptions.isCustomElement = (tag: string) => tag.startsWith('ui-');
            app.component('BridgePanel', BridgePanel);
            app.mount(this.$.app);
            panelDataMap.set(this, app);
        }
    },
    beforeClose() {},
    close() {
        const app = panelDataMap.get(this);
        if (app) {
            app.unmount();
        }
    },
});
