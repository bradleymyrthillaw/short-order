class_name Enemy
extends Fighter
## A disgruntled customer.
##
## The AI's whole job is to never look idle: everyone who isn't mid-swing is
## strafing, holding spacing, and pressing inward. They flinch off a telegraphed
## swing, then come straight back.

enum State { SPAWN, ENGAGE, PRESS, RECOVER }

@export var kind: String = "weak"

var state: int = State.SPAWN
var state_t: float = 0.6
var circle_dir: float = 1.0
var standoff: float = 2.0
var commit: float = 0.6

var target: Fighter = null


func _ready() -> void:
	super()
	is_customer = true
	add_to_group("enemies")
	circle_dir = 1.0 if randf() < 0.5 else -1.0


func setup(k: String) -> void:
	kind = k
	if k == "tough":
		max_hp = 60.0
		move_speed = 3.2
		commit = 0.6
		scale = Vector3.ONE * 1.12
	else:
		max_hp = 24.0
		move_speed = 3.6
		commit = 0.75
	hp = max_hp
	standoff = Weapons.reach(weapon) + randf_range(0.25, 0.7)


func think(delta: float) -> void:
	if target == null or target.dead:
		var p := get_tree().get_first_node_in_group("player")
		target = p as Fighter
	if target == null:
		return

	state_t -= delta
	var to := target.global_position - global_position
	to.y = 0.0
	var dist := to.length()
	var dir := to.normalized() if dist > 0.001 else Vector3.FORWARD
	var tangent := Vector3(-dir.z, 0.0, dir.x)
	var reach := Weapons.reach(weapon)
	var move := Vector3.ZERO

	if stagger > 0.0:
		# shaken off a hit: drop everything and re-engage, never get stuck
		state = State.ENGAGE
		state_t = maxf(state_t, stagger + 0.05)
		velocity *= exp(-5.0 * delta)
		facing = lerp_angle(facing, atan2(dir.x, dir.z), minf(1.0, delta * 6.0))
		return

	match state:
		State.SPAWN:
			if state_t <= 0.0:
				state = State.ENGAGE
				state_t = randf_range(0.35, 0.85)

		State.ENGAGE:
			# steady inward pressure so they close instead of hovering
			var radial := (dist - standoff) + 0.9
			# flinch back from a telegraphed swing aimed our way
			if target.attack.size() > 0 and not target.attack["hit"] and dist < reach + 1.4:
				var to_me := atan2(-dir.x, -dir.z)
				var da := wrapf(to_me - float(target.attack["aim"]), -PI, PI)
				if absf(da) < 0.95:
					radial -= 1.2
			if dist < reach * 0.7:
				radial -= 0.6
			if absf(radial) < 0.2:
				radial = 0.0
			move = tangent * circle_dir * 0.42 + dir * clampf(radial, -1.1, 2.0)

			if dist < reach + 0.5:
				state = State.PRESS
				state_t = randf_range(0.5, 1.2)
			elif state_t <= 0.0:
				circle_dir *= -1.0 if randf() < 0.4 else 1.0
				state_t = randf_range(0.35, 0.85)
				if dist < reach + 1.7 and randf() < commit:
					state = State.PRESS
					state_t = randf_range(0.5, 1.2)

		State.PRESS:
			if dist > reach + 0.05:
				move = dir
			elif attack.is_empty():
				start_attack(kind == "tough" and randf() < 0.25, atan2(dir.x, dir.z), target)
				state = State.RECOVER
				state_t = Weapons.get_weapon(weapon)["rec"] + randf_range(0.2, 0.5)
			if state_t <= 0.0 and attack.is_empty():
				state = State.ENGAGE
				state_t = randf_range(0.3, 0.7)

		State.RECOVER:
			move = -dir * 0.35 + tangent * circle_dir * 0.7
			if state_t <= 0.0:
				state = State.ENGAGE
				state_t = randf_range(0.25, 0.6)

	# spread out so they don't stack into one body
	for other in get_tree().get_nodes_in_group("enemies"):
		var e := other as Enemy
		if e == null or e == self or e.dead:
			continue
		var away := global_position - e.global_position
		away.y = 0.0
		var d := away.length()
		if d < 0.9 and d > 0.001:
			move += (away / d) * (0.9 - d) * 0.7

	if move.length_squared() > 1.0:
		move = move.normalized()
	var want := move * move_speed
	velocity.x = lerpf(velocity.x, want.x, minf(1.0, delta * 14.0))
	velocity.z = lerpf(velocity.z, want.z, minf(1.0, delta * 14.0))

	if attack.is_empty():
		facing = lerp_angle(facing, atan2(dir.x, dir.z), minf(1.0, delta * 6.0))
