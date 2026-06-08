@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  @keyframes sweep {
    0% { transform: translateX(-100%) skewX(-12deg); }
    100% { transform: translateX(500%) skewX(-12deg); }
  }

  @keyframes glow {
    0%, 100% { box-shadow: 0 0 6px rgba(245, 158, 11, 0.4), 0 0 12px rgba(245, 158, 11, 0.2); }
    50% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.8), 0 0 28px rgba(245, 158, 11, 0.4); }
  }

  --animate-sweep: sweep 2s ease-in-out infinite;
  --animate-glow: glow 2s ease-in-out infinite;
}
