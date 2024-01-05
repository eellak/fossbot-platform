import time


def current_time():
    return time.time()

async def robot_forward():
    print("Robot moving forward")
    await forward()