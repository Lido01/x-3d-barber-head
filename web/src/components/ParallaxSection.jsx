import { mediaUrl } from "../services/api";

/**
 * Full-viewport image panel used for the home "scroll story".
 *
 * `bg-fixed` pins the image to the viewport so the next section
 * scrolls up and overlays it — the image stays put while content
 * slides over the top. `min-h-[100svh]` keeps every panel a full
 * screen. The overlay sits between the image and the content.
 *
 * On devices that don't honour `background-attachment: fixed` the
 * panel simply becomes a normal cover image — the layout still works,
 * it just loses the parallax lift.
 */
export default function ParallaxSection({
  image,
  overlay = "from-black/90 via-black/70 to-black/90",
  children,
  className = "",
  contentClassName = "",
  id,
}) {
  return (
    <section
      id={id}
      className={`relative flex min-h-[100svh] items-center overflow-hidden bg-[#090909] bg-cover bg-center bg-fixed ${className}`}
      style={image ? { backgroundImage: `url("${mediaUrl(image)}")` } : undefined}
    >
      {/* readability overlay */}
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${overlay}`} />

      <div className={`relative z-10 mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-10 ${contentClassName}`}>
        {children}
      </div>
    </section>
  );
}
