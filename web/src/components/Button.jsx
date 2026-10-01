import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function Button({
  children,
  to,
  variant = "primary",
  className = "",
  icon = true,
  type = "button",
}) {
  const styles = {
    primary:
      "bg-[#d6a85f] text-[#111] hover:bg-[#e5bd7a] shadow-[0_12px_40px_rgba(214,168,95,0.16)]",

    secondary:
      "border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.09] hover:border-white/25",

    dark:
      "bg-[#111] text-[#f4f0e8] border border-white/10 hover:bg-[#181818]",

    ghost:
      "text-white/70 hover:text-white",
  };

  const classes = `
    group
    inline-flex
    items-center
    justify-center
    gap-3
    px-5
    py-3.5
    text-sm
    font-semibold
    tracking-wide
    transition-all
    duration-300
    ${styles[variant]}
    ${className}
  `;

  const content = (
    <>
      <span>{children}</span>

      {icon && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-0.5">
          <ArrowUpRight size={15} strokeWidth={2.2} />
        </span>
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} className={classes}>
      {content}
    </button>
  );
}