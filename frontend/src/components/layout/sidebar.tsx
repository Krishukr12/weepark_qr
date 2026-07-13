import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth-context";
import { navForRole } from "./nav-config";
import { cn } from "@/lib/utils";

/**
 * WeePark logo image. The source artwork is dark on transparent, so it is
 * inverted on dark surfaces (`onDark`) or automatically in dark mode.
 */
export function BrandLogo({
  className,
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  return (
    <img
      src="/icon-dark.png"
      alt="WeePark logo"
      className={cn(
        "size-8 select-none",
        onDark ? "invert" : "dark:invert",
        className,
      )}
      draggable={false}
    />
  );
}

/** Official WeePark wordmark: lowercase navy "weepark" with the "You Relax" tagline. */
export function BrandMark({
  className,
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandLogo onDark={onDark} />
      <div className="flex flex-col">
        <span
          className={cn(
            "text-[17px] font-extrabold leading-none tracking-tight",
            onDark ? "text-white" : "text-[#141b33] dark:text-white",
          )}
        >
          weepark
        </span>
        <span
          className={cn(
            "font-serif text-[11px] italic leading-tight",
            onDark ? "text-white/55" : "text-muted-foreground",
          )}
        >
          You Relax
        </span>
      </div>
    </div>
  );
}

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;
  const items = navForRole(user.role);

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <BrandMark />
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 scrollbar-thin">
        {items.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              {isActive ? (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-sidebar-accent shadow-xs"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              ) : null}
              <item.icon
                className={cn(
                  "relative z-10 size-4.5",
                  isActive && "text-brand",
                )}
              />
              <span className="relative z-10">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <p className="text-xs text-sidebar-foreground/50">
          WeePark v1.0 · Smart Parking
        </p>
      </div>
    </div>
  );
}
