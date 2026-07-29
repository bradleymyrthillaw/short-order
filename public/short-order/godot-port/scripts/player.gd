class_name Player
extends Fighter
## The chef. Fast on his feet — he RUNS while the customers walk, which is most
## of what sells you as the one in control.

const RUN_SPEED := 6.7
const DASH_SPEED := 11.0
const TACKLE_SPEED := 13.0

var cam_yaw: float = PI  ## set by the camera rig each frame
var dash: Dictionary = {}
var dash_cd: float = 0.0
var tackle: Dictionary = {}
var tackle_cd: float = 0.0
var lock_on: Fighter = null


func _ready() -> void:
	super()
	is_customer = false
	move_speed = RUN_SPEED
	add_to_group("player")


func think(delta: float) -> void:
	dash_cd = maxf(0.0, dash_cd - delta)
	tackle_cd = maxf(0.0, tackle_cd - delta)

	var want := Controls.move_vector()
	# camera-relative: stick up = away from camera
	var c := cos(cam_yaw)
	var s := sin(cam_yaw)
	var mv := Vector3(want.x * c - want.y * s, 0.0, -want.x * s - want.y * c)

	guard_v = lerpf(
		guard_v, 1.0 if Input.is_action_pressed("guard") else 0.0, minf(1.0, delta * 12.0)
	)

	if Input.is_action_just_pressed("lock"):
		lock_on = _nearest(null) if lock_on == null else null

	# ---- tackle: a committed shoulder-charge, the mirror of their grapple lunge
	if Input.is_action_just_pressed("grab"):
		_start_tackle()

	# ---- dash
	if Input.is_action_just_pressed("dash") and dash_cd <= 0.0 and stagger <= 0.0:
		var d := mv if mv.length_squared() > 0.02 else Vector3(sin(facing), 0, cos(facing))
		dash = {"t": 0.0, "dur": 0.34, "dir": d.normalized()}
		dash_cd = 0.6
		iframe = 0.3
		attack = {}

	# ---- attacks
	if stagger <= 0.0 and dash.is_empty() and tackle.is_empty():
		var light := Input.is_action_just_pressed("hit")
		var heavy := Input.is_action_just_pressed("heavy")
		if light or heavy:
			var tgt := lock_on if lock_on != null and not lock_on.dead else _nearest(1.1)
			var aim := facing
			if tgt != null:
				var to := tgt.global_position - global_position
				aim = atan2(to.x, to.z)
			start_attack(heavy, aim, tgt)

	# ---- movement
	tackling = not tackle.is_empty()
	if not tackle.is_empty():
		tackle["t"] += delta
		var k: float = 1.0 - tackle["t"] / tackle["dur"]
		velocity = tackle["dir"] * TACKLE_SPEED * (0.5 + k * 0.5)
		if not tackle["hit"]:
			_tackle_contact()
		if tackle["t"] >= tackle["dur"]:
			tackle = {}
	elif not dash.is_empty():
		dash["t"] += delta
		var dk: float = 1.0 - dash["t"] / dash["dur"]
		velocity = dash["dir"] * DASH_SPEED * dk
		if dash["t"] >= dash["dur"]:
			dash = {}
	elif stagger > 0.0:
		velocity *= exp(-6.0 * delta)
	else:
		var spd := move_speed
		if guard_v > 0.5:
			spd *= 0.42
		if not attack.is_empty():
			spd *= 0.14
		var target := mv * spd
		velocity.x = lerpf(velocity.x, target.x, minf(1.0, delta * 18.0))
		velocity.z = lerpf(velocity.z, target.z, minf(1.0, delta * 18.0))

	# ---- facing
	if attack.is_empty() and dash.is_empty() and tackle.is_empty():
		if lock_on != null and not lock_on.dead:
			var to2 := lock_on.global_position - global_position
			facing = lerp_angle(facing, atan2(to2.x, to2.z), minf(1.0, delta * 10.0))
		elif mv.length_squared() > 0.02:
			facing = lerp_angle(facing, atan2(mv.x, mv.z), minf(1.0, delta * 12.0))


func _start_tackle() -> void:
	if not tackle.is_empty() or not dash.is_empty() or not attack.is_empty():
		return
	if stagger > 0.0 or tackle_cd > 0.0:
		return
	var tgt := lock_on if lock_on != null and not lock_on.dead else _nearest(2.8)
	var dir := Vector3(sin(facing), 0.0, cos(facing))
	if tgt != null:
		var to := tgt.global_position - global_position
		to.y = 0.0
		if to.length_squared() > 1e-4:
			dir = to.normalized()
			facing = atan2(dir.x, dir.z)
	tackle = {"t": 0.0, "dur": 0.42, "dir": dir, "hit": false}
	tackle_cd = 0.85
	iframe = 0.16
	attack = {}
	Juice.shake(0.22)
	Juice.haptic(0.3, 0.4, 60)


func _tackle_contact() -> void:
	for other in get_tree().get_nodes_in_group("fighters"):
		var f := other as Fighter
		if f == null or f == self or f.dead or not f.is_customer:
			continue
		var to := f.global_position - global_position
		to.y = 0.0
		if to.length() > 0.9:
			continue
		var ang := atan2(to.x, to.z)
		f.hp -= 20.0
		f.velocity = Vector3(sin(ang), 0.0, cos(ang)) * 15.0
		f.stagger = 0.85
		f.attack = {}
		Juice.shake(0.55)
		Juice.freeze(0.06)
		Juice.flash(3, Color("ffe03d"))
		Juice.haptic(0.7, 0.6, 150)
		if f.hp <= 0.0:
			f.die(ang)
		tackle["hit"] = true
		velocity *= 0.35
		tackle["t"] = tackle["dur"]
		return


func _nearest(cone) -> Fighter:
	var best: Fighter = null
	var bd := 1e9
	for other in get_tree().get_nodes_in_group("fighters"):
		var f := other as Fighter
		if f == null or f == self or f.dead or not f.is_customer:
			continue
		var to := f.global_position - global_position
		to.y = 0.0
		var d := to.length()
		if cone != null:
			var da := wrapf(atan2(to.x, to.z) - facing, -PI, PI)
			if absf(da) > float(cone):
				continue
		if d < bd:
			bd = d
			best = f
	return best
