import { FormEvent, useEffect, useState } from "react";
import {
  BrainCircuit,
  FileJson,
  Gauge,
  Save,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

interface AiSettings {
  temperature: number;
  maxTokens: number;
  timeout: number;
  retryCount: number;
  streaming: boolean;
  enableDeepAnalysis: boolean;
  enableSummary: boolean;
  enableFeedback: boolean;
  enableImprovementSuggestions: boolean;
  toxicFilter: boolean;
  personalInformationMasking: boolean;
  promptInjectionProtection: boolean;
  markdownResponse: boolean;
  jsonResponse: boolean;
  parallelRequests: number;
  cacheResponses: boolean;
  cacheTtl: number;
}

type BooleanSettingKey = {
  [Key in keyof AiSettings]: AiSettings[Key] extends boolean ? Key : never;
}[keyof AiSettings];

const STORAGE_KEY = "passmate_admin_ai_settings";

const DEFAULT_AI_SETTINGS: AiSettings = {
  temperature: 0.7,
  maxTokens: 4096,
  timeout: 45,
  retryCount: 2,
  streaming: true,
  enableDeepAnalysis: true,
  enableSummary: true,
  enableFeedback: true,
  enableImprovementSuggestions: true,
  toxicFilter: true,
  personalInformationMasking: true,
  promptInjectionProtection: true,
  markdownResponse: true,
  jsonResponse: false,
  parallelRequests: 3,
  cacheResponses: true,
  cacheTtl: 3600,
};

interface ToggleRowProps {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function ToggleRow({
  id,
  title,
  description,
  checked,
  onCheckedChange,
}: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/20 p-3.5 transition-colors hover:bg-muted/30">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="cursor-pointer text-sm font-semibold">
          {title}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export default function AiSettingsPage() {
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const savedSettings = localStorage.getItem(STORAGE_KEY);
    if (!savedSettings) return;

    try {
      setSettings({
        ...DEFAULT_AI_SETTINGS,
        ...JSON.parse(savedSettings),
      });
    } catch {
      setSettings(DEFAULT_AI_SETTINGS);
    }
  }, []);

  const updateSetting = <Key extends keyof AiSettings>(
    key: Key,
    value: AiSettings[Key]
  ) => {
    setSettings(current => ({ ...current, [key]: value }));
  };

  const updateBooleanSetting = (key: BooleanSettingKey, value: boolean) => {
    updateSetting(key, value);
  };

  const updateNumberSetting = (
    key: keyof Pick<
      AiSettings,
      | "temperature"
      | "maxTokens"
      | "timeout"
      | "retryCount"
      | "parallelRequests"
      | "cacheTtl"
    >,
    value: string
  ) => {
    const parsed = Number(value);
    updateSetting(key, Number.isNaN(parsed) ? 0 : parsed);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <AdminPageHeader
        title="AI Settings"
        description="운영 환경에서 AI 생성 방식, 안전 장치, 응답 형식, 성능 옵션을 설정합니다."
        actions={
          <Button type="submit" size="sm" className="gap-1.5 text-xs">
            <Save className="size-3.5" />
            Save Settings
          </Button>
        }
      />

      {saveSuccess && (
        <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500">
          <AlertTitle className="text-sm font-semibold">
            AI 설정이 저장되었습니다.
          </AlertTitle>
          <AlertDescription className="text-xs">
            현재 화면은 Mock 데이터 기반이며 브라우저 로컬 저장소에 반영됩니다.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              General Settings
            </CardTitle>
            <CardDescription className="text-xs">
              모델 선택을 제외한 생성 런타임의 공통 파라미터를 설정합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="temperature"
                className="text-xs font-semibold text-muted-foreground uppercase"
              >
                Temperature
              </Label>
              <Input
                id="temperature"
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={settings.temperature}
                onChange={event =>
                  updateNumberSetting("temperature", event.target.value)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="max-tokens"
                className="text-xs font-semibold text-muted-foreground uppercase"
              >
                Max Tokens
              </Label>
              <Input
                id="max-tokens"
                type="number"
                min="1"
                value={settings.maxTokens}
                onChange={event =>
                  updateNumberSetting("maxTokens", event.target.value)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="timeout"
                className="text-xs font-semibold text-muted-foreground uppercase"
              >
                Timeout
              </Label>
              <Input
                id="timeout"
                type="number"
                min="1"
                value={settings.timeout}
                onChange={event =>
                  updateNumberSetting("timeout", event.target.value)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="retry-count"
                className="text-xs font-semibold text-muted-foreground uppercase"
              >
                Retry Count
              </Label>
              <Input
                id="retry-count"
                type="number"
                min="0"
                value={settings.retryCount}
                onChange={event =>
                  updateNumberSetting("retryCount", event.target.value)
                }
              />
            </div>

            <div className="md:col-span-2 xl:col-span-3">
              <ToggleRow
                id="streaming"
                title="Streaming ON/OFF"
                description="응답 생성 중 부분 결과를 순차적으로 전달합니다."
                checked={settings.streaming}
                onCheckedChange={checked =>
                  updateBooleanSetting("streaming", checked)
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <BrainCircuit className="size-4 text-muted-foreground" />
              Generation Settings
            </CardTitle>
            <CardDescription className="text-xs">
              AI 분석 결과에 포함할 생성 기능을 제어합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              id="enable-deep-analysis"
              title="Enable Deep Analysis"
              description="이력서와 채용 공고의 세부 적합도를 더 깊게 분석합니다."
              checked={settings.enableDeepAnalysis}
              onCheckedChange={checked =>
                updateBooleanSetting("enableDeepAnalysis", checked)
              }
            />
            <ToggleRow
              id="enable-summary"
              title="Enable Summary"
              description="분석 결과 상단에 핵심 요약을 포함합니다."
              checked={settings.enableSummary}
              onCheckedChange={checked =>
                updateBooleanSetting("enableSummary", checked)
              }
            />
            <ToggleRow
              id="enable-feedback"
              title="Enable Feedback"
              description="문항별 강점과 보완 피드백을 생성합니다."
              checked={settings.enableFeedback}
              onCheckedChange={checked =>
                updateBooleanSetting("enableFeedback", checked)
              }
            />
            <ToggleRow
              id="enable-improvement-suggestions"
              title="Enable Improvement Suggestions"
              description="개선 문장과 작성 방향 제안을 함께 제공합니다."
              checked={settings.enableImprovementSuggestions}
              onCheckedChange={checked =>
                updateBooleanSetting("enableImprovementSuggestions", checked)
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-muted-foreground" />
              Safety
            </CardTitle>
            <CardDescription className="text-xs">
              위험 콘텐츠와 민감 정보 노출을 줄이기 위한 보호 설정입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              id="toxic-filter"
              title="Toxic Filter"
              description="유해하거나 공격적인 표현을 감지하고 제한합니다."
              checked={settings.toxicFilter}
              onCheckedChange={checked =>
                updateBooleanSetting("toxicFilter", checked)
              }
            />
            <ToggleRow
              id="personal-information-masking"
              title="Personal Information Masking"
              description="이메일, 전화번호 등 개인정보를 마스킹합니다."
              checked={settings.personalInformationMasking}
              onCheckedChange={checked =>
                updateBooleanSetting("personalInformationMasking", checked)
              }
            />
            <ToggleRow
              id="prompt-injection-protection"
              title="Prompt Injection Protection"
              description="사용자 입력 내 지시문 우회 시도를 방어합니다."
              checked={settings.promptInjectionProtection}
              onCheckedChange={checked =>
                updateBooleanSetting("promptInjectionProtection", checked)
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileJson className="size-4 text-muted-foreground" />
              Response
            </CardTitle>
            <CardDescription className="text-xs">
              AI 응답을 화면과 API에서 사용할 형식으로 제어합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              id="markdown-response"
              title="Markdown Response"
              description="관리자와 사용자 화면에서 읽기 좋은 Markdown 응답을 허용합니다."
              checked={settings.markdownResponse}
              onCheckedChange={checked =>
                updateBooleanSetting("markdownResponse", checked)
              }
            />
            <ToggleRow
              id="json-response"
              title="JSON Response"
              description="구조화된 결과 저장과 후처리를 위한 JSON 응답을 허용합니다."
              checked={settings.jsonResponse}
              onCheckedChange={checked =>
                updateBooleanSetting("jsonResponse", checked)
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Gauge className="size-4 text-muted-foreground" />
              Performance
            </CardTitle>
            <CardDescription className="text-xs">
              처리량과 캐시 동작에 영향을 주는 성능 옵션입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="parallel-requests"
                className="text-xs font-semibold text-muted-foreground uppercase"
              >
                Parallel Requests
              </Label>
              <Input
                id="parallel-requests"
                type="number"
                min="1"
                value={settings.parallelRequests}
                onChange={event =>
                  updateNumberSetting("parallelRequests", event.target.value)
                }
              />
            </div>
            <ToggleRow
              id="cache-responses"
              title="Cache Responses"
              description="동일 입력에 대한 AI 응답을 재사용해 지연 시간과 비용을 줄입니다."
              checked={settings.cacheResponses}
              onCheckedChange={checked =>
                updateBooleanSetting("cacheResponses", checked)
              }
            />
            <Separator />
            <div className="space-y-1.5">
              <Label
                htmlFor="cache-ttl"
                className="text-xs font-semibold text-muted-foreground uppercase"
              >
                Cache TTL
              </Label>
              <Input
                id="cache-ttl"
                type="number"
                min="0"
                value={settings.cacheTtl}
                onChange={event =>
                  updateNumberSetting("cacheTtl", event.target.value)
                }
              />
              <p className="text-xs text-muted-foreground">
                초 단위로 캐시 유지 시간을 설정합니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardFooter className="flex justify-end border-t px-6 py-4">
          <Button type="submit" className="gap-1.5 text-xs">
            <Save className="size-3.5" />
            Save Settings
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
