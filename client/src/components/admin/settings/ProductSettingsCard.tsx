import { useEffect, useState } from "react";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  fetchProductSettings,
  updateProductSetting,
  type AdminProductSetting,
  type ProductSettingPatch,
} from "@/lib/admin-product-settings";
import { productLabel } from "@/lib/pricing";

/** 결제 상품 설정 — 상품별 Groble contentId·결제 URL·판매 여부. 행 단위로 저장한다. */
export function ProductSettingsCard() {
  const [productRows, setProductRows] = useState<AdminProductSetting[] | null>(null);
  const [productDrafts, setProductDrafts] = useState<Record<string, { contentId: string; paymentUrl: string }>>({});
  const [productBusy, setProductBusy] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);

  const applyProductRows = (rows: AdminProductSetting[]) => {
    setProductRows(rows);
    setProductDrafts(Object.fromEntries(rows.map((row) => [row.product, { contentId: row.contentId ?? "", paymentUrl: row.paymentUrl }])));
  };

  useEffect(() => {
    fetchProductSettings()
      .then(applyProductRows)
      .catch((error: unknown) => setProductError(error instanceof Error ? error.message : "결제 상품 설정을 불러오지 못했습니다."));
  }, []);

  const handleProductSave = async (row: AdminProductSetting, active = row.active) => {
    const draft = productDrafts[row.product] ?? { contentId: row.contentId ?? "", paymentUrl: row.paymentUrl };
    const trimmedContentId = draft.contentId.trim();
    const trimmedPaymentUrl = draft.paymentUrl.trim();
    const storedContentId = row.contentId ?? "";

    // 바뀐 필드만 보낸다 — contentId 를 건드리지 않았는데도 fallback 표시용 placeholder 값이
    // 저장돼 버리면 env fallback 이 사라지고 관리자가 입력한 적 없는 값이 박힌다.
    const patch: ProductSettingPatch = {};
    if (trimmedContentId !== storedContentId) {
      patch.contentId = trimmedContentId === "" ? null : trimmedContentId;
    }
    if (trimmedPaymentUrl !== row.paymentUrl) {
      patch.paymentUrl = trimmedPaymentUrl;
    }
    if (active !== row.active) {
      patch.active = active;
    }

    if (Object.keys(patch).length === 0) {
      return;
    }

    setProductBusy(row.product);
    setProductError(null);
    try {
      const rows = await updateProductSetting(row.product, patch);
      applyProductRows(rows);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "결제 상품 설정을 저장하지 못했습니다.";
      setProductError(message === "DUPLICATE_CONTENT_ID" ? "이미 다른 상품이 쓰는 contentId 입니다." : message);
    } finally {
      setProductBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">결제 상품 설정</CardTitle>
        <CardDescription className="text-xs">
          상품별 Groble contentId(웹훅이 결제 상품을 알아보는 값)와 결제 URL, 판매 여부. contentId 가 비어 있으면
          1회권·3회권(구)은 환경 변수 값을 씁니다. 저장 즉시 서버에 반영됩니다. 3회권(구)은 판매하지 않습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {productError ? <p className="text-xs text-destructive">{productError}</p> : null}
        {productRows === null ? (
          <p className="text-sm text-muted-foreground">상품 설정 불러오는 중...</p>
        ) : (
          productRows.map((row) => {
            const draft = productDrafts[row.product] ?? { contentId: row.contentId ?? "", paymentUrl: row.paymentUrl };
            const busy = productBusy === row.product;
            // 저장된 contentId 가 없고 env fallback 이 있을 때만 안내한다 — 저장 전까지는
            // readPurchaseProductSettings 가 이 값을 판별에 쓴다.
            const showFallbackHint = !row.contentId && row.fallbackContentId;
            return (
              <div key={row.product} className="grid gap-2 rounded-lg border p-3.5 md:grid-cols-[160px_1fr_1fr_auto_auto] md:items-center">
                <div>
                  <p className="text-sm font-semibold">{productLabel(row.product)}</p>
                  <p className="text-[11px] text-muted-foreground">자소서 {row.resumeCredits} · 기업 {row.companyCredits} · {row.product}</p>
                </div>
                <Input
                  aria-label={`${productLabel(row.product)} Groble contentId`}
                  placeholder={showFallbackHint ? `환경 변수 값 ${row.fallbackContentId} 사용 중` : "Groble contentId"}
                  value={draft.contentId}
                  disabled={busy}
                  onChange={(event) => setProductDrafts((prev) => ({ ...prev, [row.product]: { ...draft, contentId: event.target.value } }))}
                />
                <Input
                  aria-label={`${productLabel(row.product)} 결제 URL`}
                  placeholder="결제 URL (https://…)"
                  value={draft.paymentUrl}
                  disabled={busy}
                  onChange={(event) => setProductDrafts((prev) => ({ ...prev, [row.product]: { ...draft, paymentUrl: event.target.value } }))}
                />
                <label className="flex items-center gap-2 text-xs">
                  <Switch checked={row.active} disabled={busy} onCheckedChange={(checked) => void handleProductSave(row, checked)} />
                  판매
                </label>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleProductSave(row)}>
                  <Save className="mr-1 h-3.5 w-3.5" />저장
                </Button>
                {showFallbackHint ? (
                  <p className="text-[11px] text-muted-foreground md:col-span-5">
                    저장 전까지 환경 변수 값으로 판별합니다
                  </p>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
