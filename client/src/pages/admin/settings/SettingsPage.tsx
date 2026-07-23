import { useEffect, useState } from "react";
import { adminApiFetch } from "@/lib/adminApi";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Save,
  Plus,
  Trash2,
  AlertCircle,
  Megaphone,
  Key,
  Database,
  Users,
  Settings,
  ToggleLeft,
} from "lucide-react";

// ============================================================
// 타입 정의
// ============================================================

interface SystemSettings {
  serviceOn: boolean;
  maintenanceMessage: string;
  popupOn: boolean;
  popupTitle: string;
  popupContent: string;
  betaFeatures: {
    aiDetailedFeedback: boolean;
    rewriteEngineV2: boolean;
  };
}

interface NoticeItem {
  id: string;
  title: string;
  isPinned: boolean;
  createdAt: string;
}

interface AdminUser {
  email: string;
  addedAt: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
  serviceOn: true,
  maintenanceMessage: "현재 서비스 점검 중입니다. 잠시 후 다시 이용해 주세요.",
  popupOn: false,
  popupTitle: "PassMate 서비스 이용 안내",
  popupContent: "보다 안정적인 이력서 분석 속도 개선을 위한 서버 보완 패치가 적용되었습니다.",
  betaFeatures: {
    aiDetailedFeedback: true,
    rewriteEngineV2: false,
  },
};

const DEFAULT_NOTICES: NoticeItem[] = [
  { id: "1", title: "[공지] 신규 AI 엔진 적용 완료 및 버그 수정", isPinned: true, createdAt: "2026-07-01" },
  { id: "2", title: "[안내] 7월 15일 분석 시스템 점검 시간 공지", isPinned: false, createdAt: "2026-07-05" },
];

const DEFAULT_ADMINS: AdminUser[] = [
  { email: "admin@passmate.co.kr", addedAt: "2026-06-01" },
];

export default function SettingsPage() {
  // ── 상태 선언 ──────────────────────────────────────────────
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [notices, setNotices] = useState<NoticeItem[]>(DEFAULT_NOTICES);
  const [admins, setAdmins] = useState<AdminUser[]>(DEFAULT_ADMINS);

  const [settingsUnavailable, setSettingsUnavailable] = useState(true);

  // 공지 추가 폼
  const [newNoticeTitle, setNewNoticeTitle] = useState("");
  const [newNoticePinned, setNewNoticePinned] = useState(false);

  // 관리자 추가 폼
  const [newAdminEmail, setNewAdminEmail] = useState("");

  useEffect(() => {
    adminApiFetch<{ available: boolean }>("/api/admin/settings")
      .then((result) => setSettingsUnavailable(!result.available))
      .catch(() => setSettingsUnavailable(true));
  }, []);

  const handleSaveGeneral = () => {
    setSettingsUnavailable(true);
  };

  const triggerUnavailable = () => setSettingsUnavailable(true);

  // ── 공지 기능 ────────────────────────────────────────────
  const handleAddNotice = () => {
    if (!newNoticeTitle.trim()) return;
    const next: NoticeItem = {
      id: Date.now().toString(),
      title: newNoticeTitle,
      isPinned: newNoticePinned,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setNotices([next, ...notices]);
    setNewNoticeTitle("");
    setNewNoticePinned(false);
    triggerUnavailable();
  };

  const handleDeleteNotice = (id: string) => {
    setNotices(notices.filter((n) => n.id !== id));
    triggerUnavailable();
  };

  // ── 관리자 계정 기능 ───────────────────────────────────────
  const handleAddAdmin = () => {
    if (!newAdminEmail.trim() || !newAdminEmail.includes("@")) return;
    const next: AdminUser = {
      email: newAdminEmail.trim(),
      addedAt: new Date().toISOString().split("T")[0],
    };
    setAdmins([...admins, next]);
    setNewAdminEmail("");
    triggerUnavailable();
  };

  const handleDeleteAdmin = (email: string) => {
    if (admins.length <= 1) {
      alert("최소 1명 이상의 관리자 계정이 존재해야 합니다.");
      return;
    }
    setAdmins(admins.filter((a) => a.email !== email));
    triggerUnavailable();
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Settings"
        description="서비스 주요 변수 및 기능 활성화 플래그를 실시간 제어합니다."
      />

      {settingsUnavailable && (
        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
          <AlertTitle className="text-sm font-semibold">Settings are read-only</AlertTitle>
          <AlertDescription className="text-xs">
            서버 설정 스키마가 아직 배포되지 않아 이 화면의 제어는 unavailable 상태입니다.
          </AlertDescription>
        </Alert>
      )}

      <fieldset disabled className="w-full opacity-60" aria-label="Settings are read-only">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid grid-cols-4 w-full lg:w-[520px] mb-4">
          <TabsTrigger value="general" className="text-xs gap-1.5">
            <Settings className="size-3.5" />
            일반 설정
          </TabsTrigger>
          <TabsTrigger value="notices" className="text-xs gap-1.5">
            <Megaphone className="size-3.5" />
            공지사항
          </TabsTrigger>
          <TabsTrigger value="features" className="text-xs gap-1.5">
            <ToggleLeft className="size-3.5" />
            Feature Flag
          </TabsTrigger>
          <TabsTrigger value="admins" className="text-xs gap-1.5">
            <Users className="size-3.5" />
            관리자 계정
          </TabsTrigger>
        </TabsList>

        {/* ── 1. 일반 설정 (서비스 ON/OFF, 팝업 공지) ── */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">시스템 제어 & 공지 팝업</CardTitle>
              <CardDescription className="text-xs">
                서비스 가용성을 중단(ON/OFF)하거나, 사이트 진입 시 대고객 공지 팝업을 설정합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 서비스 ON/OFF */}
              <div className="flex items-center justify-between p-3.5 border rounded-lg bg-muted/20">
                <div className="space-y-0.5">
                  <Label htmlFor="service-toggle" className="text-sm font-semibold cursor-pointer">
                    서비스 가동 상태 (Service ON/OFF)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    서비스를 비활성화하면 전체 사이트 접속 시 점검 모드 안내가 출력됩니다.
                  </p>
                </div>
                <Switch
                  id="service-toggle"
                  checked={settings.serviceOn}
                  onCheckedChange={(checked) => setSettings({ ...settings, serviceOn: checked })}
                />
              </div>

              {/* 점검 메시지 */}
              {!settings.serviceOn && (
                <div className="space-y-1.5">
                  <Label htmlFor="maintenance-msg" className="text-xs font-semibold text-muted-foreground uppercase">
                    점검 중 안내 메시지
                  </Label>
                  <Textarea
                    id="maintenance-msg"
                    value={settings.maintenanceMessage}
                    onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })}
                    rows={3}
                  />
                </div>
              )}

              <Separator />

              {/* 공지 팝업 토글 */}
              <div className="flex items-center justify-between p-3.5 border rounded-lg bg-muted/20">
                <div className="space-y-0.5">
                  <Label htmlFor="popup-toggle" className="text-sm font-semibold cursor-pointer">
                    공지사항 팝업 활성화
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    활성화 시 사이트 로드 직후 첫 메인 화면에서 팝업이 노출됩니다.
                  </p>
                </div>
                <Switch
                  id="popup-toggle"
                  checked={settings.popupOn}
                  onCheckedChange={(checked) => setSettings({ ...settings, popupOn: checked })}
                />
              </div>

              {/* 팝업 제목 및 본문 */}
              {settings.popupOn && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="popup-title" className="text-xs font-semibold text-muted-foreground uppercase">
                      팝업 제목
                    </Label>
                    <Input
                      id="popup-title"
                      value={settings.popupTitle}
                      onChange={(e) => setSettings({ ...settings, popupTitle: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="popup-content" className="text-xs font-semibold text-muted-foreground uppercase">
                      팝업 본문
                    </Label>
                    <Textarea
                      id="popup-content"
                      value={settings.popupContent}
                      onChange={(e) => setSettings({ ...settings, popupContent: e.target.value })}
                      rows={4}
                    />
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button onClick={handleSaveGeneral} className="gap-1.5 ml-auto text-xs h-9">
                <Save className="size-3.5" />
                설정 저장
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ── 2. 공지사항 (Notices) ── */}
        <TabsContent value="notices">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">공지사항 관리</CardTitle>
              <CardDescription className="text-xs">
                사용자 화면 공지 리스트에 등록될 항목을 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 등록 폼 */}
              <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
                <div className="space-y-1.5">
                  <Label htmlFor="notice-title" className="text-xs font-semibold text-muted-foreground uppercase">
                    신규 공지 추가
                  </Label>
                  <Input
                    id="notice-title"
                    placeholder="공지 제목을 입력하세요."
                    value={newNoticeTitle}
                    onChange={(e) => setNewNoticeTitle(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="notice-pinned"
                      checked={newNoticePinned}
                      onCheckedChange={setNewNoticePinned}
                    />
                    <Label htmlFor="notice-pinned" className="text-xs font-medium cursor-pointer">
                      최상단 고정 공지 설정
                    </Label>
                  </div>
                  <Button onClick={handleAddNotice} size="sm" className="gap-1 text-xs">
                    <Plus className="size-3.5" />
                    공지 등록
                  </Button>
                </div>
              </div>

              {/* 목록 표 */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">고정여부</TableHead>
                    <TableHead>공지 제목</TableHead>
                    <TableHead className="w-[120px] text-right">작성일</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notices.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>
                        {n.isPinned ? (
                          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/15">
                            상단 고정
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">일반</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{n.title}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{n.createdAt}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteNotice(n.id)}
                          className="text-muted-foreground hover:text-destructive size-7"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 3. Feature Flag ── */}
        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">기능 플래그 (Feature Flag)</CardTitle>
              <CardDescription className="text-xs">
                베타 기능의 노출 여부 또는 결제 결합 모듈을 배포 전 일부 권한 차단/허용하도록 동적 변경합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3.5 border rounded-lg hover:bg-muted/10 transition-colors">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold">AI 상세 피드백 Beta</span>
                  <p className="text-xs text-muted-foreground">
                    이력서 결과 리포트 출력 시 정밀 AI 교정 본문을 활성화 노출합니다.
                  </p>
                </div>
                <Switch
                  checked={settings.betaFeatures.aiDetailedFeedback}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      betaFeatures: { ...settings.betaFeatures, aiDetailedFeedback: checked },
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3.5 border rounded-lg hover:bg-muted/10 transition-colors">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold">AI 리라이트(Rewrite) 개선 엔진 v2</span>
                  <p className="text-xs text-muted-foreground">
                    기존의 단순 분석을 넘어 AI 대필 수정을 지원하는 신규 파라미터 엔진 v2 연동 활성화
                  </p>
                </div>
                <Switch
                  checked={settings.betaFeatures.rewriteEngineV2}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      betaFeatures: { ...settings.betaFeatures, rewriteEngineV2: checked },
                    })
                  }
                />
              </div>

            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button onClick={handleSaveGeneral} className="gap-1.5 ml-auto text-xs h-9">
                <Save className="size-3.5" />
                설정 저장
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ── 4. 관리자 계정 (Admins) ── */}
        <TabsContent value="admins">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">관리자 권한 계정 관리</CardTitle>
              <CardDescription className="text-xs">
                관리자 페이지에 접근할 수 있는 승인된 어드민 이메일 목록을 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Alert className="bg-blue-500/5 border-blue-500/20 text-primary">
                <AlertCircle className="size-4 text-blue-500" />
                <AlertTitle className="text-xs font-semibold text-blue-600">DB 접근 가이드</AlertTitle>
                <AlertDescription className="text-xs leading-normal">
                  본 리스트는 로컬 스토리지에 유지되는 간이 리스트입니다. 실 서비스 반영을 하려면 반드시 Supabase의 
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[10px] mx-1">users</code> 테이블에 컬럼 
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[10px] mx-1">role = 'admin'</code> 처리를 동기화해 주어야 합니다.
                </AlertDescription>
              </Alert>

              {/* 추가 폼 */}
              <div className="flex gap-2 p-4 border rounded-lg bg-muted/20">
                <div className="flex-1 space-y-1">
                  <Input
                    id="admin-new-email"
                    placeholder="추가할 관리자 이메일 주소 입력"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <Button onClick={handleAddAdmin} className="gap-1 text-xs h-9 shrink-0">
                  <Plus className="size-3.5" />
                  계정 등록
                </Button>
              </div>

              {/* 테이블 */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>어드민 이메일</TableHead>
                    <TableHead className="text-right">등록 일자</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((a) => (
                    <TableRow key={a.email}>
                      <TableCell className="font-semibold text-sm">{a.email}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{a.addedAt}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteAdmin(a.email)}
                          className="text-muted-foreground hover:text-destructive size-7"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </fieldset>
    </div>
  );
}
