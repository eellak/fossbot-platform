export type StageBuilderRenderScheduler = {
  request: () => void;
  cancel: () => void;
};

export function createStageBuilderRenderScheduler(
  render: () => void,
  schedule: (callback: FrameRequestCallback) => number = window.requestAnimationFrame.bind(window),
  cancel: (handle: number) => void = window.cancelAnimationFrame.bind(window),
): StageBuilderRenderScheduler {
  let frameHandle: number | null = null;

  return {
    request: () => {
      if (frameHandle !== null) return;
      frameHandle = schedule(() => {
        frameHandle = null;
        render();
      });
    },
    cancel: () => {
      if (frameHandle === null) return;
      cancel(frameHandle);
      frameHandle = null;
    },
  };
}
