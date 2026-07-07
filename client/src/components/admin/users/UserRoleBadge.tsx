import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Shield, User } from "lucide-react";

interface UserRoleBadgeProps {
  role: string;
  className?: string;
}

/**
 * UserRoleBadge
 *
 * 사용자 역할을 시각적으로 표시하는 뱃지.
 * admin: 파란색 Shield 아이콘
 * user : 회색 User 아이콘
 */
export function UserRoleBadge({ role, className }: UserRoleBadgeProps) {
  const isAdmin = role === "admin";

  return (
    <Badge
      variant={isAdmin ? "default" : "secondary"}
      className={cn(
        "gap-1 text-[11px] font-medium",
        isAdmin && "bg-primary/10 text-primary border-primary/30 hover:bg-primary/15",
        className
      )}
    >
      {isAdmin ? (
        <Shield className="size-3" />
      ) : (
        <User className="size-3" />
      )}
      {isAdmin ? "Admin" : "User"}
    </Badge>
  );
}
