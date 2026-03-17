/**
 * 編輯後自動儲存：會改動場景/prefab 的 method 成功後呼叫 scene/save-scene。
 * 儲存失敗僅 log，不影響該 method 的 ok 回傳（編輯已成功）。
 */

function getEditorMessage(): { request(module: string, method: string, ...args: any[]): Promise<any> } | null {
    const E = (globalThis as any).Editor;
    if (!E?.Message || typeof E.Message.request !== 'function') return null;
    return E.Message;
}

/**
 * 在編輯成功後觸發儲存場景。Fire-and-forget，不阻塞回傳。
 * 若 save-scene 失敗僅 log，不拋錯。
 */
export function saveSceneAfterEdit(): void {
    const Message = getEditorMessage();
    if (!Message) {
        return;
    }
    Message.request('scene', 'save-scene')
        .catch((err: unknown) => {
            const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err);
            console.warn('[creator-cli] auto-save after edit failed:', msg);
        });
}
