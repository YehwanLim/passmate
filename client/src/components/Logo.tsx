import React from "react";

type LogoProps = {
  /** Retained so existing call sites can migrate from the removed icon prop safely. */
  className?: string;
  textClassName?: string;
  logoColor?: string;
};

export default function Logo({
  textClassName = "text-xl md:text-2xl text-white",
  logoColor = "#38BDF8",
}: LogoProps) {
  return (
    <div className="flex items-center">
      <span
        className={`font-bold ${textClassName}`}
        style={{ letterSpacing: "-0.045em" }}
      >
        Pre
        <span
          style={{
            color: logoColor,
            display: "inline-block",
            padding: "0 0.045em",
          }}
        >
          :
        </span>
        View
      </span>
    </div>
  );
}
