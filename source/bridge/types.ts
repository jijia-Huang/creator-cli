/**
 * Editor Bridge 請求／回應型別（對齊系統藍圖 4.2、4.3）
 */

/** 請求 JSON 形狀 */
export interface BridgeRequest {
    id?: string;
    method: string;
    params?: Record<string, unknown>;
}

/** 成功回應 */
export interface BridgeSuccessResponse {
    id?: string;
    ok: true;
    result: unknown;
}

/** 錯誤回應（不洩漏內部路徑／stack） */
export interface BridgeErrorResponse {
    id?: string;
    ok: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
}

export type BridgeResponse = BridgeSuccessResponse | BridgeErrorResponse;
