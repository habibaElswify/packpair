import React from "react";
import Link from "next/link";

export default function Logo() {
  return (
    <Link
      href="/"
      className="group flex items-center gap-2.5 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded-md"
      aria-label="PackPair home"
    >
      {/* SVG icon: two interlocking P shapes */}
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0 transition-transform duration-300 group-hover:scale-105"
      >
        {/* Back "P" — gold, offset right */}
        <rect x="10" y="2" width="16" height="26" rx="4" fill="#C5972A" opacity="0.85" />
        <path
          d="M10 2 h8 a7 7 0 0 1 0 14 H10 V2 Z"
          fill="#C5972A"
        />

        {/* Front "P" — light purple/white, offset left */}
        <rect x="2" y="6" width="16" height="26" rx="4" fill="#EDE8FF" />
        <path
          d="M2 6 h8 a7 7 0 0 1 0 14 H2 V6 Z"
          fill="#EDE8FF"
        />

        {/* Subtle overlap blend dot */}
        <circle cx="14" cy="13" r="2.5" fill="#A88DE0" opacity="0.5" />
      </svg>

      {/* Wordmark */}
      <span className="text-lg font-semibold tracking-tight leading-none">
        <span className="text-purple-100 group-hover:text-white transition-colors duration-200">
          Pack
        </span>
        <span className="text-yellow-400 group-hover:text-yellow-300 transition-colors duration-200 font-bold">
          Pair
        </span>
      </span>
    </Link>
  );
}