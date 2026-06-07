import React from "react";

export default function Logo({ 
  className = "w-8 h-8", 
  textClassName = "text-xl md:text-2xl text-white",
  logoColor = "#38BDF8" 
}: { 
  className?: string;
  textClassName?: string;
  logoColor?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 md:gap-2">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={{ color: logoColor }}
      >
        {/* Checkmark */}
        <path d="M7 13.5l3.5 3.5 8.5-9" />
        {/* Broken Circle: top right gap, bottom right gap */}
        <path d="M15.5 5A9 9 0 1 0 19 19" />
        <path d="M20.5 14.5A9 9 0 0 0 21 12" />
      </svg>
      <span className={`font-bold tracking-tight flex items-center gap-1 ${textClassName}`} style={{ letterSpacing: "-0.03em" }}>
        pass <span style={{ color: logoColor }}>mate</span>
      </span>
    </div>
  );
}
