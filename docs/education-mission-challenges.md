# Education Mission Challenge Authoring

This guide documents the simulator mission (or “challenge”) capabilities available in the lesson editor. It is for teachers creating lessons and contributors maintaining compatible stages.

A **mission** is a lesson activity containing platform-provided objectives. A **stage** supplies the physical scene and stable semantic markers. Keeping them separate lets teachers reuse one stage for different challenges without embedding course rules or executable teacher code in stage files.

## What missions can evaluate

Mission objectives can evaluate whether a learner:

- reaches a target;
- visits selected checkpoints, optionally in an exact order;
- collects a required number of selected collectibles;
- remains outside selected danger zones;
- finishes while stopped inside a target;
- pushes a selected object into a target zone;
- completes without selected collision, fall, or runtime-error incidents;
- meets a minimum, maximum, average, or final sensor threshold;
- sets the LED or buzzer to a supported state;
- stays within elapsed-time or movement-command limits.

Teachers configure these rules through the lesson editor. Missions do not accept JavaScript, Python, formulas, regular expressions, or other executable rule fields.

## Authoring workflow

1. In the lesson settings, enable the simulator and select a visible stage.
2. Add a **Simulator mission** activity to the lesson.
3. Open **Challenge capability guide** in the activity for a concise in-editor reference.
4. Enter the learner-facing mission title.
5. Optionally apply a template, then edit the generated objectives.
6. Choose whether **all** or **any** Completion objectives are required.
7. Configure each objective’s role, condition, and condition-specific values.
8. Configure additional retries and checklist feedback timing.
9. Choose the lesson completion policy. Required mission activities gate `activity` and `hybrid` completion; `self` lessons remain learner-completed.
10. Use **Preview as student** to exercise the challenge without saving progress or attempt records.
11. Resolve validation errors before publishing.

Templates are starting points, not special runtime modes. The current templates are:

- Reach a target
- Visit checkpoints
- Reach while avoiding zones
- Collect objects
- Stop in a target
- Meet a sensor threshold

After applying a template, every generated objective remains editable and additional objectives can be added.

## Stage marker requirements

A mission references stable marker IDs supplied by its linked stage. Explicit challenge metadata is the preferred stage format:

```json
{
  "type": "base",
  "name": "Checkpoint one",
  "challenge": {
    "markerId": "checkpoint-one",
    "kind": "checkpoint",
    "order": 1
  }
}
```

Collectibles can also specify `pickupRadius`. Marker IDs must be unique within the stage and remain stable across stage revisions.

| Marker kind | Purpose | Used by mission conditions |
|---|---|---|
| `spawn` | Initial robot pose | Attempt reset; not selected directly in the mission editor |
| `target` | Robot destination or precision stopping area | Reach target, Stop in target |
| `checkpoint` | Route waypoint | Visit checkpoints |
| `danger_zone` | Forbidden area | Avoid zones |
| `sensor_region` | Semantic region available to the runtime | Emitted as marker events; not currently a direct rule-builder condition |
| `collectible` | Platform-managed pickup object | Collect objects |
| `push_object` | Identified movable object | Push object into zone |
| `target_zone` | Destination for a push object | Push object into zone |

Hidden or disabled markers do not participate at runtime. The platform still infers some legacy markers from stage names and colors, but saving/updating a stage should use explicit metadata. Missing, duplicate, or unsupported references are publication errors.

## Attempts and final evaluation

Each mission is evaluated within an attempt:

- In Python or Blockly lessons, **Run** resets the physical stage, starts the attempt, and executes the learner’s program.
- In editor-free lessons, the first movement-control press resets/starts the attempt automatically.
- Editor-free attempts expose **Finish attempt**, which stops motion and evaluates the current final state.
- Objective changes are provisional while an attempt is running. Merely crossing a target does not reload the page or end the attempt.
- A coded attempt normally evaluates after the program finishes.
- Stop, reset, timeout, robot fall, runtime error, and navigation also terminate the active attempt.
- **Restart attempt** ends an active manual attempt and restores the stage.
- **Try again** restores the stage after a completed manual attempt.

A new attempt resets physical stage state, marker/checkpoint/collectible state, mission state, sensor summary, timers, and movement counters. It does not erase the learner’s saved code.

## Objective roles

Every objective has one role:

| Role | Meaning |
|---|---|
| **Completion** | Must succeed according to the mission’s All/Any rule. |
| **Failure** | Fails the attempt when its configured condition is violated. |
| **Optional** | Produces feedback and a stored result but never gates mission or lesson completion. |

The **All/Any** setting applies only to Completion objectives:

- **All:** every Completion objective must pass.
- **Any:** at least one Completion objective must pass.

A triggered Failure objective still fails the attempt under either setting. Optional objectives never compensate for a failed required objective.

## Condition reference

### Reach target

Select one `target` marker. The objective becomes satisfied when the robot enters it. The transition remains provisional until the attempt ends, so later failures still affect the result.

### Visit checkpoints

Select one or more `checkpoint` markers.

- With ordering disabled, each selected checkpoint must be visited once in any order.
- With ordering enabled, the robot must visit the selected IDs in their configured sequence. Entering a different selected checkpoint than the next expected checkpoint fails that objective.

### Collect objects

Select collectible markers and set the required count. The objective passes once that many distinct selected collectibles have been picked up. A collectible is counted once per attempt.

### Avoid zones

Select one or more `danger_zone` markers. Entering any selected zone violates the condition. This is normally configured as a Failure objective.

### Stop in target

Select one `target` marker. Entering the target is not enough: the attempt must end while the robot is still inside it. Leaving the target before the program/manual attempt ends removes the pending stop state.

### Push object into zone

Select one `push_object` and one `target_zone`. The objective becomes satisfied when the identified object enters the zone.

Contact with an object explicitly configured as `push_object` is intentional and does **not** emit a collision incident. Contact with unmarked crates, walls, and other obstacles can still count as a collision.

### Avoid incidents

Choose any combination of:

- collision;
- robot fall;
- runtime error.

The condition passes when the attempt ends without a selected incident. It fails when a selected incident occurs. Use it as a Failure objective when any incident should fail the mission, or Optional when it is an additional clean-run challenge.

### Sensor threshold

Choose a supported sensor, statistic, comparison, and numeric threshold.

Supported statistics are:

- minimum;
- maximum;
- average;
- final value.

Supported comparisons are `<`, `≤`, `=`, `≥`, and `>`. Sensor summaries are finalized at the end of the run, so the objective may remain pending while the program is running.

### Actuator state

Choose the LED or buzzer and a supported state. LED states currently include red, green, blue, yellow, violet, white, and off. Buzzer states are on and off.

The objective is satisfied when the actuator reaches the configured state during the attempt.

### Time or movement limit

Set an optional maximum duration, maximum number of movement actions, or both. Exceeding either configured limit fails the condition.

A movement action is counted at the high-level robot API boundary:

- each `moveStep` command counts once;
- each `rotateStep` command counts once;
- starting or changing a continuous movement direction counts once;
- repeated physics/render frames do not increase the count;
- Stop is recorded separately and does not count as movement;
- travelled/path distance is a separate metric.

Source-code line count has no effect on movement actions.

## Retries and feedback

**Retry limit** is the number of additional attempts allowed after the first attempt. Leave it blank for unlimited retries.

Checklist feedback has two modes:

- **During the attempt:** objective status changes are visible immediately.
- **After the attempt:** objective results remain hidden until the attempt ends.

After-attempt feedback is useful when live status would reveal the answer or route. Immediate feedback is useful for introductory lessons and debugging.

## Lesson completion behavior

Mission activity results interact with lesson completion policy as follows:

- `self`: mission results are recorded, but the learner still marks the lesson finished.
- `activity`: every required activity, including required missions, must be satisfied.
- `hybrid`: required activities must be satisfied and the learner confirms completion.
- `teacher_review`: remains a teacher-review workflow rather than automatic mission completion.

Only objectives with the Completion role determine mission success. Failure objectives can invalidate an attempt, and Optional objectives never gate completion.

## Stored attempt data

The platform stores compact learning telemetry for each attempt:

- attempt lifecycle timestamps and outcome;
- objective results;
- elapsed time;
- movement actions and path distance;
- collision, fall, reset, and collectible counts;
- finalized sensor summaries;
- simulator, stage, and mission-definition revisions.

Raw physics ticks and raw sensor streams are not stored. Browser-generated results are classroom-learning telemetry, not deterministic anti-cheat proof.

Preview attempts do not create student progress or attempt records.

## Authoring examples

### Ordered route

1. Add a Completion objective using **Visit checkpoints** with ordering enabled.
2. Add another Completion objective using **Reach target**.
3. Add a Failure objective using **Time or movement limit**.
4. Choose **All**.

The route and finish must both pass within the configured limits.

### Safe no-code collection

1. Use an editor-free lesson with remote movement controls.
2. Add a Completion objective using **Collect objects**.
3. Add a Failure objective using **Avoid zones**.
4. Add an Optional objective using **Avoid incidents**.
5. The learner starts by pressing a movement control and selects **Finish attempt** when done.

### Delivery and parking

1. Add Completion objectives for **Push object into zone** and **Stop in target**.
2. Add a Failure objective for **Avoid incidents**.
3. Choose **All**.

The designated push-object contact is allowed, but collisions with other obstacles still fail the incident condition.

## Troubleshooting

| Symptom | Check |
|---|---|
| “Choose a visible simulator stage” | Enable the simulator and link a stage in the lesson settings before configuring the mission. |
| “This stage has no mission markers” | Add explicit `challenge` metadata to supported stage entries and make sure they are not hidden or disabled. |
| Missing-reference publication error | The linked stage changed or a marker ID was renamed. Re-select valid markers or restore the stable ID. |
| Target/checkpoint is green but the attempt is still running | This is expected: status is provisional until the program or manual attempt ends. |
| A no-code attempt has not started | Press a movement control; the first movement starts it automatically. |
| Stop-in-target remains pending | End the program or choose Finish attempt while the robot is still inside the target. |
| Sensor threshold remains pending | Let the program finish so sensor statistics can be finalized. |
| Pushing a crate reports a collision | Confirm that the stage entry is explicitly marked `push_object`; unmarked objects are ordinary collision obstacles. |
| Retry restores the robot but keeps code | This is intentional. Physical and mission state reset; saved learner code is preserved. |

## Current boundaries

Phase 6 does not provide points, stars, leaderboards, arbitrary formulas, teacher-written executable rules, or server-side deterministic replay. Scoring and presentation extensions belong to later phases rather than the mission rule vocabulary.
