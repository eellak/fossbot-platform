import { createStageBuilderRenderScheduler } from './stageBuilderRenderScheduler';

declare const describe: any;
declare const expect: any;
declare const it: any;
declare const jest: any;

describe('stage builder render scheduler', () => {
  it('coalesces repeated render requests into one frame', () => {
    const callbacks: FrameRequestCallback[] = [];
    const render = jest.fn();
    const scheduler = createStageBuilderRenderScheduler(render, (callback) => {
      callbacks.push(callback);
      return callbacks.length;
    });

    scheduler.request();
    scheduler.request();

    expect(callbacks).toHaveLength(1);
    callbacks.shift()?.(0);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('allows rendering to request a follow-up frame for damping', () => {
    const callbacks: FrameRequestCallback[] = [];
    let scheduler: ReturnType<typeof createStageBuilderRenderScheduler>;
    const render = jest.fn(() => scheduler.request());
    scheduler = createStageBuilderRenderScheduler(render, (callback) => {
      callbacks.push(callback);
      return callbacks.length;
    });

    scheduler.request();
    callbacks.shift()?.(0);

    expect(render).toHaveBeenCalledTimes(1);
    expect(callbacks).toHaveLength(1);
  });

  it('cancels a pending frame', () => {
    const cancel = jest.fn();
    const scheduler = createStageBuilderRenderScheduler(jest.fn(), () => 42, cancel);

    scheduler.request();
    scheduler.cancel();

    expect(cancel).toHaveBeenCalledWith(42);
  });
});
