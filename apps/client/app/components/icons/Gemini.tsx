import * as React from "react";
import { cx } from "@/lib/utils";

interface GeminiProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export default function Gemini({ className, ...props }: GeminiProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={cx("w-4 h-4", className)}
      {...props}
    >
      <defs>
        <linearGradient
          id="gemini-gradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.8" />
          <stop offset="100%" stopColor="currentColor" />
        </linearGradient>
      </defs>
      <path
        d="M12 2C12 2 12 12 12 12C12 12 2 12 2 12C2 12 12 12 12 12C12 12 12 22 12 22C12 22 12 12 12 12C12 12 22 12 22 12C22 12 12 12 12 12C12 12 12 2 12 2Z"
        stroke="url(#gemini-gradient)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="12" cy="2" r="1.5" fill="currentColor" />
      <circle cx="12" cy="22" r="1.5" fill="currentColor" />
      <circle cx="2" cy="12" r="1.5" fill="currentColor" />
      <circle cx="22" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export { Gemini };
