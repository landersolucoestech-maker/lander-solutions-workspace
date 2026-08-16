import "react";

declare global {
  type ReactNode = import("react").ReactNode;
}

declare module "react" {
  interface Attributes {
    className?: string;
  }
}

export {};
