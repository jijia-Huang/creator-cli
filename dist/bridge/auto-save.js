"use strict";
/**
 * 編輯後自動儲存：會改動場景/prefab 的 method 成功後呼叫 scene/save-scene。
 * 儲存失敗僅 log，不影響該 method 的 ok 回傳（編輯已成功）。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveSceneAfterEdit = saveSceneAfterEdit;
function getEditorMessage() {
    const E = globalThis.Editor;
    if (!(E === null || E === void 0 ? void 0 : E.Message) || typeof E.Message.request !== 'function')
        return null;
    return E.Message;
}
/**
 * 在編輯成功後觸發儲存場景。Fire-and-forget，不阻塞回傳。
 * 若 save-scene 失敗僅 log，不拋錯。
 */
function saveSceneAfterEdit() {
    const Message = getEditorMessage();
    if (!Message) {
        return;
    }
    Message.request('scene', 'save-scene')
        .catch((err) => {
        const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err);
        console.warn('[creator-cli] auto-save after edit failed:', msg);
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0by1zYXZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL2JyaWRnZS9hdXRvLXNhdmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7QUFZSCxnREFVQztBQXBCRCxTQUFTLGdCQUFnQjtJQUNyQixNQUFNLENBQUMsR0FBSSxVQUFrQixDQUFDLE1BQU0sQ0FBQztJQUNyQyxJQUFJLENBQUMsQ0FBQSxDQUFDLGFBQUQsQ0FBQyx1QkFBRCxDQUFDLENBQUUsT0FBTyxDQUFBLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sS0FBSyxVQUFVO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFDeEUsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDO0FBQ3JCLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxTQUFnQixrQkFBa0I7SUFDOUIsTUFBTSxPQUFPLEdBQUcsZ0JBQWdCLEVBQUUsQ0FBQztJQUNuQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDWCxPQUFPO0lBQ1gsQ0FBQztJQUNELE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFlBQVksQ0FBQztTQUNqQyxLQUFLLENBQUMsQ0FBQyxHQUFZLEVBQUUsRUFBRTtRQUNwQixNQUFNLEdBQUcsR0FBRyxHQUFHLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxJQUFJLFNBQVMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBRSxHQUE0QixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDN0gsT0FBTyxDQUFDLElBQUksQ0FBQyw0Q0FBNEMsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUNwRSxDQUFDLENBQUMsQ0FBQztBQUNYLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICog57eo6Lyv5b6M6Ieq5YuV5YSy5a2Y77ya5pyD5pS55YuV5aC05pmvL3ByZWZhYiDnmoQgbWV0aG9kIOaIkOWKn+W+jOWRvOWPqyBzY2VuZS9zYXZlLXNjZW5l44CCXHJcbiAqIOWEsuWtmOWkseaVl+WDhSBsb2fvvIzkuI3lvbHpn7/oqbIgbWV0aG9kIOeahCBvayDlm57lgrPvvIjnt6jovK/lt7LmiJDlip/vvInjgIJcclxuICovXHJcblxyXG5mdW5jdGlvbiBnZXRFZGl0b3JNZXNzYWdlKCk6IHsgcmVxdWVzdChtb2R1bGU6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+IH0gfCBudWxsIHtcclxuICAgIGNvbnN0IEUgPSAoZ2xvYmFsVGhpcyBhcyBhbnkpLkVkaXRvcjtcclxuICAgIGlmICghRT8uTWVzc2FnZSB8fCB0eXBlb2YgRS5NZXNzYWdlLnJlcXVlc3QgIT09ICdmdW5jdGlvbicpIHJldHVybiBudWxsO1xyXG4gICAgcmV0dXJuIEUuTWVzc2FnZTtcclxufVxyXG5cclxuLyoqXHJcbiAqIOWcqOe3qOi8r+aIkOWKn+W+jOinuOeZvOWEsuWtmOWgtOaZr+OAgkZpcmUtYW5kLWZvcmdldO+8jOS4jemYu+WhnuWbnuWCs+OAglxyXG4gKiDoi6Ugc2F2ZS1zY2VuZSDlpLHmlZflg4UgbG9n77yM5LiN5ouL6Yyv44CCXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gc2F2ZVNjZW5lQWZ0ZXJFZGl0KCk6IHZvaWQge1xyXG4gICAgY29uc3QgTWVzc2FnZSA9IGdldEVkaXRvck1lc3NhZ2UoKTtcclxuICAgIGlmICghTWVzc2FnZSkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIE1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2F2ZS1zY2VuZScpXHJcbiAgICAgICAgLmNhdGNoKChlcnI6IHVua25vd24pID0+IHtcclxuICAgICAgICAgICAgY29uc3QgbXNnID0gZXJyICYmIHR5cGVvZiBlcnIgPT09ICdvYmplY3QnICYmICdtZXNzYWdlJyBpbiBlcnIgPyBTdHJpbmcoKGVyciBhcyB7IG1lc3NhZ2U6IHVua25vd24gfSkubWVzc2FnZSkgOiBTdHJpbmcoZXJyKTtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKCdbY3JlYXRvci1jbGldIGF1dG8tc2F2ZSBhZnRlciBlZGl0IGZhaWxlZDonLCBtc2cpO1xyXG4gICAgICAgIH0pO1xyXG59XHJcbiJdfQ==