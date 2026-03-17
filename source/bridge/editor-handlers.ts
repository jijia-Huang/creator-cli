/**
 * 編輯器層級操作：觸發資源庫刷新（含腳本編譯），等待完成後回傳結果。
 * 使用 asset-db 的 refresh 與 is-busy；編譯錯誤/警告由編輯器主控台顯示，若未來有公開 API 可再回傳 log。
 */

const EDITOR_REFRESH_BUSY_POLL_MS = 500;
const EDITOR_REFRESH_TIMEOUT_MS = 120000;

function getEditorMessage(): { request(module: string, method: string, ...args: any[]): Promise<any> } {
    const E = (globalThis as any).Editor;
    if (!E || !E.Message || typeof E.Message.request !== 'function') {
        const err = new Error('Editor.Message not available') as Error & { code?: string };
        err.code = 'SCENE_ERROR';
        throw err;
    }
    return E.Message;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface EditorRefreshResult {
    success: boolean;
    /** 有 error 時才帶入，供 CLI 印出 */
    errors?: string[];
    /** 有 warning 時才帶入，供 CLI 印出 */
    warnings?: string[];
}

/**
 * 觸發編輯器重新刷新（asset-db refresh），並輪詢 is-busy 直到完成或逾時。
 * 成功時回傳 { success: true }；若有編譯錯誤/警告且能取得則回傳 errors / warnings，否則僅回傳成功。
 */
export async function handleEditorRefresh(_params: Record<string, unknown>): Promise<EditorRefreshResult> {
    const Message = getEditorMessage();
    try {
        await Message.request('asset-db', 'refresh');
    } catch (e) {
        const message = e instanceof Error ? e.message : 'asset-db refresh failed';
        return { success: false, errors: [message] };
    }

    const deadline = Date.now() + EDITOR_REFRESH_TIMEOUT_MS;
    while (Date.now() < deadline) {
        let busy: boolean;
        try {
            busy = await Message.request('asset-db', 'is-busy');
        } catch {
            return { success: false, errors: ['asset-db is-busy check failed'] };
        }
        if (!busy) {
            return { success: true };
        }
        await sleep(EDITOR_REFRESH_BUSY_POLL_MS);
    }

    return { success: false, errors: ['Editor refresh timed out (asset-db still busy)'] };
}
