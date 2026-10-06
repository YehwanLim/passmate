interface SkeletonCardProps {
  /** project: 큰 카드, analysis: 작은 카드 */
  variant?: "project" | "analysis";
}

function Bone({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-fill rounded-md animate-pulse ${className}`}
    />
  );
}

export default function SkeletonCard({
  variant = "project",
}: SkeletonCardProps) {
  if (variant === "analysis") {
    return (
      <div className="bg-surface rounded-[20px] p-5 space-y-3">
        <Bone className="h-4 w-3/4" />
        <div className="flex items-center gap-3">
          <Bone className="h-5 w-16 rounded-full" />
          <Bone className="h-3 w-24" />
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-line-soft px-2 py-5 space-y-3">
      <div className="flex items-center justify-between">
        <Bone className="h-5 w-32" />
        <Bone className="h-5 w-5 rounded-md" />
      </div>
      <Bone className="h-4 w-48" />
      <div className="flex items-center gap-4">
        <Bone className="h-3 w-20" />
        <Bone className="h-3 w-16" />
      </div>
    </div>
  );
}
