/**
 * IBBRA Institutional Brand Background
 * Subtle grafismo overlay for the main app layout.
 * pointer-events: none ensures no interference with UI.
 */
export function BrandBackground() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    >
      <div
        className="absolute bottom-0 right-0 w-[700px] h-[700px] md:w-[850px] md:h-[850px] opacity-[0.05] dark:opacity-[0.04]"
        style={{
          backgroundImage: "url('/ibbra-grafismo.svg')",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right bottom",
          backgroundSize: "contain",
          color: "hsl(var(--foreground))",
          filter: "var(--grafismo-filter, none)",
        }}
      />
    </div>
  );
}
