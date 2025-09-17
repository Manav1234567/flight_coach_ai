declare module "@tensorflow/tfjs" {
  export function tensor2d(values: number[][]): any
  export const sequential: () => any
  export const layers: {
    dense: (config: any) => any
  }
  export const train: {
    adam: (learningRate: number) => any
  }
}

declare global {
  interface Window {
    tf: any
  }
}

export {}
