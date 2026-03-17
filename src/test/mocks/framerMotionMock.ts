import { vi } from "vitest";

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    motion: new Proxy({} as Record<string, any>, {
      get: (_target, prop: string) => {
        // Return a forwardRef component that just renders the HTML element
        const { forwardRef } = require("react");
        return forwardRef((props: any, ref: any) => {
          const {
            initial, animate, exit, variants, whileHover, whileTap,
            whileFocus, whileDrag, whileInView, transition, layout,
            layoutId, onAnimationComplete, onAnimationStart,
            custom, ...rest
          } = props;
          const Tag = prop as keyof JSX.IntrinsicElements;
          return require("react").createElement(Tag, { ...rest, ref });
        });
      },
    }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useMotionValue: () => ({ get: () => 0, set: vi.fn() }),
    useTransform: () => ({ get: () => 0 }),
    useSpring: () => ({ get: () => 0 }),
    useAnimation: () => ({ start: vi.fn(), stop: vi.fn() }),
  };
});
