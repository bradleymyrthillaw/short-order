extends Node
## Builds the InputMap at boot.
##
## Doing this in code (rather than in project.godot) keeps the bindings readable
## and lets us rebind at runtime later. Actions are named by what they DO, not by
## which button they sit on — same lesson as the touch buttons.

const DEADZONE := 0.2


func _ready() -> void:
	# movement — WASD / left stick
	_action("move_left", [KEY_A, KEY_LEFT], [], JOY_AXIS_LEFT_X, -1.0)
	_action("move_right", [KEY_D, KEY_RIGHT], [], JOY_AXIS_LEFT_X, 1.0)
	_action("move_forward", [KEY_W, KEY_UP], [], JOY_AXIS_LEFT_Y, -1.0)
	_action("move_back", [KEY_S, KEY_DOWN], [], JOY_AXIS_LEFT_Y, 1.0)

	# camera orbit — [ ] / shoulder buttons
	_action("cam_left", [KEY_BRACKETLEFT], [JOY_BUTTON_LEFT_SHOULDER])
	_action("cam_right", [KEY_BRACKETRIGHT], [JOY_BUTTON_RIGHT_SHOULDER])

	# combat
	_action("hit", [KEY_J], [JOY_BUTTON_A])  # light  — bottom face button
	_action("heavy", [KEY_K], [JOY_BUTTON_X])  # heavy  — left face button
	_action("grab", [KEY_F], [JOY_BUTTON_Y])  # grab / tackle — top face button
	_action("dash", [KEY_SHIFT], [JOY_BUTTON_B])  # dash   — right face button
	_action("guard", [KEY_SPACE], [JOY_BUTTON_LEFT_STICK])
	_action("lock", [KEY_L], [JOY_BUTTON_RIGHT_STICK])
	_action("pause", [KEY_ESCAPE], [JOY_BUTTON_START])


## Register one action with key, button and (optional) analog-axis bindings.
func _action(
	name: String, keys: Array, buttons: Array, axis: int = -1, axis_value: float = 0.0
) -> void:
	if InputMap.has_action(name):
		InputMap.erase_action(name)
	InputMap.add_action(name, DEADZONE)

	for k in keys:
		var ev := InputEventKey.new()
		ev.physical_keycode = k
		InputMap.action_add_event(name, ev)

	for b in buttons:
		var ev := InputEventJoypadButton.new()
		ev.button_index = b
		InputMap.action_add_event(name, ev)

	if axis >= 0:
		var ev := InputEventJoypadMotion.new()
		ev.axis = axis
		ev.axis_value = axis_value
		InputMap.action_add_event(name, ev)


## Left stick / WASD as a vector, with a RADIAL deadzone + rescale so movement
## eases in smoothly from a standstill instead of snapping to full speed.
func move_vector() -> Vector2:
	var v := Vector2(
		Input.get_action_strength("move_right") - Input.get_action_strength("move_left"),
		Input.get_action_strength("move_back") - Input.get_action_strength("move_forward")
	)
	var m := v.length()
	if m < DEADZONE:
		return Vector2.ZERO
	return v * (((m - DEADZONE) / (1.0 - DEADZONE)) / m)
