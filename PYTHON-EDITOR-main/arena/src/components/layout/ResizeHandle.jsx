import { Separator } from "react-resizable-panels";

export default function ResizeHandle({ orientation = "vertical" }) {
  const isVertical = orientation === "vertical";

  return (
    <Separator
      className={[
        "group relative flex shrink-0 items-center justify-center rounded-full transition-colors duration-150",
        isVertical
          ? "w-4 cursor-col-resize focus:outline-none"
          : "h-4 cursor-row-resize focus:outline-none",
      ].join(" ")}
    >
      <div
        className={[
          "rounded-full bg-arena-border transition-colors duration-150 group-hover:bg-arena-borderStrong group-focus:bg-arena-borderStrong",
          isVertical ? "h-full w-px" : "h-px w-full",
        ].join(" ")}
      />
    </Separator>
  );
}
