interface FloatLogoProps {
  size?: "default" | "large";
  showText?: boolean;
}

export function FloatLogo({ size = "default", showText = true }: FloatLogoProps) {
  const logoSize = size === "large" ? 88 : 72;
  const textClass = size === "large" ? "text-2xl" : "text-lg";

  return (
    <div className={`flex items-center ${showText ? "gap-2" : ""}`}>
      <div className="overflow-hidden rounded-lg" style={{ height: logoSize, width: logoSize }}>
        <img src="/float-logo.png" alt="Float logo" className="h-full w-full object-contain" />
      </div>
      {showText && <span className={`font-bold text-foreground ${textClass}`}>Float</span>}
    </div>
  );
}
