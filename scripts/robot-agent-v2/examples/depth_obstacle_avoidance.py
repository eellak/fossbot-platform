# Select Depth in the camera panel and wait for the preview before running.
# This controller follows open space instead of always trying to return to the
# center of the image.

CRUISE_SPEED = 23
CURVE_INNER_SPEED = 18
CURVE_OUTER_SPEED = 26
PIVOT_SPEED = 17

EARLY_STEER_DEPTH_M = 2.20
BLOCKED_DEPTH_M = 1.25
PATH_CHANGE_MARGIN_M = 0.30
ULTRASONIC_AVOID_CM = 24
HARD_STOP_CM = 12

SMOOTHING = 0.35
TURN_COMMIT_CYCLES = 3

smooth = None
chosen_path = "center"
committed_turn = None
commit_cycles = 0
last_depth_timestamp = None


def update_smooth(previous, current):
    if previous is None:
        return current
    return {
        key: (
            previous[key] * (1.0 - SMOOTHING)
            + current[key] * SMOOTHING
        )
        for key in ("left", "center", "right")
    }


def path_scores(depth):
    # Each direction considers its neighboring region as well. This avoids
    # choosing a narrow gap that has one misleadingly distant pixel region.
    return {
        "left": 0.70 * depth["left"] + 0.30 * depth["center"],
        "center": (
            0.20 * depth["left"]
            + 0.60 * depth["center"]
            + 0.20 * depth["right"]
        ),
        "right": 0.70 * depth["right"] + 0.30 * depth["center"],
    }


def choose_open_path(scores, current):
    candidate = max(scores, key=scores.get)

    # Keep the previous path when the improvement is small. This hysteresis
    # prevents left/right flickering caused by depth noise.
    if scores[candidate] < scores[current] + PATH_CHANGE_MARGIN_M:
        return current

    return candidate


try:
    while True:
        snapshot = robot.get_depth(max_age=1.5)

        if snapshot is None:
            robot.stop()
            smooth = None
            print("Waiting for a fresh FastDepth frame...")
            robot.wait(0.20)
            continue

        # Never issue another movement pulse from the same inference frame.
        # FastDepth is slower than this control loop, and repeatedly acting on
        # stale geometry is what causes overshoot near an obstacle.
        depth_timestamp = snapshot.get("timestamp")
        if depth_timestamp == last_depth_timestamp:
            robot.stop()
            robot.wait(0.05)
            continue
        last_depth_timestamp = depth_timestamp

        regions = snapshot["regions"]
        measured = {
            "left": regions.get("left_m") or 0.0,
            "center": regions.get("center_m") or 0.0,
            "right": regions.get("right_m") or 0.0,
        }
        smooth = update_smooth(smooth, measured)
        scores = path_scores(smooth)
        ultrasonic = robot.get_distance()

        print(
            "Open space L/C/R:",
            round(scores["left"], 2),
            round(scores["center"], 2),
            round(scores["right"], 2),
            "m | path:",
            chosen_path,
            "| ultrasonic:",
            round(ultrasonic, 1),
            "cm"
        )

        if ultrasonic <= HARD_STOP_CM:
            robot.stop()
            print("Emergency stop: obstacle extremely close")
            break

        blocked_ahead = (
            smooth["center"] < BLOCKED_DEPTH_M
            or ultrasonic < ULTRASONIC_AVOID_CM
        )

        if blocked_ahead:
            robot.stop()

            # Choose the clearest side once and commit to it for several
            # control cycles instead of repeatedly trying to face the center.
            if committed_turn is None or commit_cycles <= 0:
                committed_turn = (
                    "left"
                    if scores["left"] >= scores["right"]
                    else "right"
                )
                commit_cycles = TURN_COMMIT_CYCLES

            robot.motor_left.set_speed(PIVOT_SPEED)
            robot.motor_right.set_speed(PIVOT_SPEED)

            if committed_turn == "left":
                print("Blocked: rotating toward open space on the left")
                robot.rotate_counterclockwise()
            else:
                print("Blocked: rotating toward open space on the right")
                robot.rotate_clockwise()

            robot.wait(0.14)
            robot.stop()
            robot.wait(0.10)
            commit_cycles -= 1
            continue

        # The center is usable again, but retain the committed direction until
        # its short lock expires. This finishes the avoidance turn cleanly.
        if commit_cycles > 0 and committed_turn is not None:
            chosen_path = committed_turn
            commit_cycles -= 1
        else:
            committed_turn = None
            chosen_path = choose_open_path(scores, chosen_path)

        # Start steering before the robot is close to the obstacle. When the
        # center is very open and almost as good as the sides, travel straight.
        side_advantage = max(scores["left"], scores["right"]) - scores["center"]
        if (
            smooth["center"] >= EARLY_STEER_DEPTH_M
            and side_advantage < PATH_CHANGE_MARGIN_M
        ):
            chosen_path = "center"

        if chosen_path == "left":
            robot.motor_left.set_speed(CURVE_INNER_SPEED)
            robot.motor_right.set_speed(CURVE_OUTER_SPEED)
        elif chosen_path == "right":
            robot.motor_left.set_speed(CURVE_OUTER_SPEED)
            robot.motor_right.set_speed(CURVE_INNER_SPEED)
        else:
            robot.motor_left.set_speed(CRUISE_SPEED)
            robot.motor_right.set_speed(CRUISE_SPEED)

        robot.move_forward()
        robot.wait(0.16)
        robot.stop()
        robot.wait(0.05)

finally:
    robot.stop()
    print("Open-space depth navigation stopped")
