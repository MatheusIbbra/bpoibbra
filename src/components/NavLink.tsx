import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Prevent the default scroll reset behavior
      const sidebar = (e.target as HTMLElement).closest('[data-sidebar="content"]');
      if (sidebar) {
        const scrollTop = sidebar.scrollTop;
        // Use requestAnimationFrame to restore scroll after navigation
        requestAnimationFrame(() => {
          sidebar.scrollTop = scrollTop;
        });
      }
      // Call the original onClick if provided
      if (props.onClick) {
        props.onClick(e as any);
      }
    };

    return (
      <RouterNavLink
        ref={ref}
        to={to}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        onClick={handleClick}
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
