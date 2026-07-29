class_name ChefRig
extends Node3D
## The body: built in code, posed every frame.
##
## Built procedurally (rather than as a .tscn) so proportions live next to the
## code that animates them — the same reason the JS build did it this way.
##
## Hierarchy:
##   self            yaw
##   └ body          bob / lean / squash
##      ├ hips, abdomen        (lower trunk, stays planted)
##      └ spine (waist joint)  the upper body FLEXES here, so the torso reads as
##         └ upper             two parts instead of one rigid traffic cone
##            └ chest, head, headwear, arms
##   └ leg bones     (siblings of body: feet plant in WORLD space)

const THIGH := 0.44
const SHIN := 0.44
const ARM_U := 0.40
const ARM_F := 0.40
const WAIST := 1.06

## Stance offsets, lead foot forward.
const STANCE := [Vector2(-0.19, 0.14), Vector2(0.21, -0.12)]
const KNEE_FWD := Vector3(0, 0, 1)

## Weapon swing shapes. A combo cycles these so a chain reads as distinct swings
## instead of one animation on repeat.
const SWINGS := [
	{
		"name": "forehand",
		"s": Vector3(0.55, 1.62, -0.10),
		"e": Vector3(-0.46, 1.36, 0.92),
		"bend": Vector3(0.95, -0.55, 0.4),
		"coil": 0.50,
		"follow": -0.72,
		"lean": 0.26
	},
	{
		"name": "backhand",
		"s": Vector3(-0.50, 1.54, -0.05),
		"e": Vector3(0.56, 1.38, 0.92),
		"bend": Vector3(-0.95, -0.55, 0.4),
		"coil": -0.50,
		"follow": 0.72,
		"lean": 0.26
	},
	{
		"name": "chop",
		"s": Vector3(0.28, 2.05, -0.12),
		"e": Vector3(-0.10, 1.04, 0.86),
		"bend": Vector3(0.5, -1, 0.5),
		"coil": 0.32,
		"follow": -0.46,
		"lean": 0.34
	},
]
const FINISH := {
	"name": "smash",
	"s": Vector3(0.12, 2.20, -0.28),
	"e": Vector3(0.00, 0.92, 0.96),
	"bend": Vector3(0.35, -1, 0.5),
	"coil": 0.42,
	"follow": -0.86,
	"lean": 0.44
}

## Bare hands: jab, jab, hook, uppercut. `hand` picks which fist throws (0=L,1=R);
## the other stays up in guard.
const PUNCHES := [
	{
		"name": "jab",
		"hand": 0,
		"s": Vector3(-0.22, 1.42, 0.28),
		"e": Vector3(-0.05, 1.56, 1.02),
		"bend": Vector3(-0.35, -0.45, 0.5),
		"coil": 0.16,
		"follow": -0.22,
		"lean": 0.18
	},
	{
		"name": "jab",
		"hand": 1,
		"s": Vector3(0.22, 1.42, 0.28),
		"e": Vector3(0.05, 1.56, 1.02),
		"bend": Vector3(0.35, -0.45, 0.5),
		"coil": -0.16,
		"follow": 0.22,
		"lean": 0.18
	},
	{
		"name": "hook",
		"hand": 0,
		"s": Vector3(-0.50, 1.52, 0.14),
		"e": Vector3(0.26, 1.46, 0.86),
		"bend": Vector3(-0.95, -0.35, 0.3),
		"coil": 0.5,
		"follow": -0.72,
		"lean": 0.28
	},
	{
		"name": "upper",
		"hand": 1,
		"s": Vector3(0.28, 1.04, 0.40),
		"e": Vector3(0.12, 1.78, 0.72),
		"bend": Vector3(0.4, -0.9, 0.5),
		"coil": 0.42,
		"follow": -0.55,
		"lean": 0.36
	},
]

var body: Node3D
var spine: Node3D
var upper: Node3D
var chest: MeshInstance3D
var abdomen: MeshInstance3D
var hips: MeshInstance3D
var head: MeshInstance3D
var headwear: Node3D
var weapon_pivot: Node3D

## arms[i] = {up, fore, hand, shoulder:Vector3, target:Vector3}
var arms: Array = []
## legs[i] = {thigh, shin, boot, hip:Vector3, world, from, to, step_t, lift}
var legs: Array = []

var run_k := 0.0
var idle_k := 0.0

var _twist := 0.0
var _sway := 0.0
var _sway_target := 0.0
var _step_dip := 0.0
var _step_cool := 0.0
var _idle_seed := 0.0
var _feet_planted := false


func build(skin: Color, cloth: Color, apron_col: Color, is_customer: bool, hair: Color) -> void:
	_idle_seed = randf() * 10.0
	var m_skin := _mat(skin)
	var m_cloth := _mat(cloth)
	var m_apron := _mat(apron_col)
	var m_boot := _mat(Color("241a12"))

	body = Node3D.new()
	add_child(body)

	hips = _cyl(0.30, 0.32, 0.34, m_apron)
	hips.position.y = 0.82
	body.add_child(hips)

	# lower abdomen — planted, below the waist joint
	abdomen = _cyl(0.315, 0.335, 0.46, m_cloth)
	abdomen.position.y = 0.99
	body.add_child(abdomen)

	spine = Node3D.new()
	spine.position.y = WAIST
	body.add_child(spine)

	# offset back so every child keeps plain body-space coordinates
	upper = Node3D.new()
	upper.position.y = -WAIST
	spine.add_child(upper)

	# upper chest: broad at the shoulders, pinched to the waist
	chest = _cyl(0.42, 0.30, 0.62, m_cloth)
	chest.position.y = 1.44
	upper.add_child(chest)

	head = _sphere(0.235, m_skin)
	head.position = Vector3(0, 1.86, 0.02)
	upper.add_child(head)

	var brow := _box(Vector3(0.32, 0.06, 0.08), _mat(Color("1a120a")))
	brow.position = Vector3(0, 1.90, 0.22)
	upper.add_child(brow)
	for sx in [-1.0, 1.0]:
		var eye := _sphere(0.03, _mat(Color("120a06")))
		eye.position = Vector3(sx * 0.09, 1.86, 0.22)
		upper.add_child(eye)

	# headwear: the player is a chef (toque); enemies are angry customers (hair)
	headwear = Node3D.new()
	if is_customer:
		var h := _sphere(0.245, _mat(hair))
		h.scale = Vector3(1.02, 0.92, 1.05)
		headwear.add_child(h)
		headwear.position = Vector3(0, 1.90, 0.0)
	else:
		var band := _cyl(0.24, 0.24, 0.16, _mat(Color("f7f2e8")))
		band.position.y = 0.08
		headwear.add_child(band)
		var puff := _sphere(0.27, _mat(Color("f7f2e8")))
		puff.position.y = 0.28
		puff.scale.y = 1.15
		headwear.add_child(puff)
		headwear.position = Vector3(0, 2.02, 0.02)
	upper.add_child(headwear)

	# arms — IK bones under `upper` so shoulders ride the torso twist
	for i in 2:
		var sx := -1.0 if i == 0 else 1.0
		var up_bone := _bone(0.10, m_skin)
		var fore_bone := _bone(0.09, m_skin)
		var hand := Node3D.new()
		var fist := _sphere(0.10, m_skin)
		hand.add_child(fist)
		upper.add_child(up_bone)
		upper.add_child(fore_bone)
		upper.add_child(hand)
		(
			arms
			. append(
				{
					"up": up_bone,
					"fore": fore_bone,
					"hand": hand,
					"shoulder": Vector3(sx * 0.40, 1.54, 0.0),
					"target": Vector3(sx * 0.33, 1.34, 0.36),
					"elbow": Vector3.ZERO,
				}
			)
		)
	# the right hand carries the utensil
	weapon_pivot = Node3D.new()
	arms[1]["hand"].add_child(weapon_pivot)

	# legs — feet plant in WORLD space, so these hang off the yaw node
	for i in 2:
		var sx := -1.0 if i == 0 else 1.0
		var thigh := _bone(0.13, m_apron)
		var shin := _bone(0.10, m_skin)
		var boot := _box(Vector3(0.18, 0.10, 0.30), m_boot)
		add_child(thigh)
		add_child(shin)
		add_child(boot)
		(
			legs
			. append(
				{
					"thigh": thigh,
					"shin": shin,
					"boot": boot,
					"hip": Vector3(sx * 0.16, 0.80, 0.0),
					"world": Vector3.ZERO,
					"from": Vector3.ZERO,
					"to": Vector3.ZERO,
					"step_t": 1.0,
					"lift": 0.0,
				}
			)
		)


# ---------------------------------------------------------------- posing


## Plant both feet at the stance. Call on spawn / respawn.
func plant_feet(origin: Vector3, facing: float) -> void:
	_feet_planted = true
	for i in 2:
		legs[i]["world"] = _ground(origin, facing, STANCE[i].x, STANCE[i].y)
		legs[i]["step_t"] = 1.0
		legs[i]["lift"] = 0.0


func pose(delta: float, st: Dictionary) -> void:
	var speed: float = st.get("speed", 0.0)
	var moving: bool = speed > 0.6
	var atk: Dictionary = st.get("attack", {})
	var has_atk: bool = not atk.is_empty()
	var phase: float = st.get("phase", 0.0)
	var t: float = st.get("time", 0.0) + _idle_seed

	# blend factors
	var rk := 0.0
	if st.get("can_run", false) and not has_atk:
		rk = clampf((speed - 2.3) / 3.4, 0.0, 1.0)
	run_k = rk * rk * (3.0 - 2.0 * rk)
	idle_k = 0.0 if (has_atk or speed > 0.9) else clampf(1.0 - speed / 0.9, 0.0, 1.0)

	if not _feet_planted:
		plant_feet(global_position, rotation.y)
	_update_feet(delta, speed, moving, st.get("velocity", Vector3.ZERO))

	# weight shift + a light square-up bounce when standing
	_sway = lerpf(_sway, _sway_target + idle_k * sin(t * 1.5) * 0.045, minf(1.0, delta * 10.0))
	var bob := (
		(absf(sin(phase)) * 0.05 * minf(1.0, speed / 4.5) if moving else 0.0)
		+ sin(t * 2.1) * 0.011
		- _step_dip
		+ idle_k * sin(t * 3.3) * 0.02
	)

	body.position = Vector3(_sway, bob, 0.0)

	# waist bend: the upper body drives forward at a run and folds into swings
	var waist := 0.0
	if moving and not has_atk:
		waist += minf(1.0, speed / 5.0) * 0.14
	waist += run_k * 0.34
	if moving:
		waist += sin(phase * 2.0) * 0.035 * minf(1.0, speed / 4.0)
	if has_atk:
		var shape: Dictionary = atk["shape"]
		waist = lerpf(waist, -0.10, atk["wind_k"])
		waist = lerpf(waist, float(shape["lean"]) * 0.75, atk["strike_k"])
	if st.get("tackling", false):
		waist += 0.5
	spine.rotation.x = lerpf(spine.rotation.x, waist, minf(1.0, delta * 16.0))
	abdomen.rotation.x = lerpf(abdomen.rotation.x, -waist * 0.22, minf(1.0, delta * 11.0))

	# torso twist: gait counter-rotation, or the swing's coil/follow-through
	var twist := _sway * 0.4
	if moving and not has_atk:
		twist += -sin(phase) * 0.13 * minf(1.0, speed / 4.0)
	if has_atk:
		var shape2: Dictionary = atk["shape"]
		twist = lerpf(0.0, float(shape2["coil"]), atk["wind_k"])
		twist = lerpf(twist, float(shape2["follow"]), atk["strike_k"])
	_twist = lerpf(_twist, twist, minf(1.0, delta * (26.0 if has_atk else 9.0)))
	upper.rotation.y = _twist
	hips.rotation.y = lerpf(hips.rotation.y, -_twist * 0.35, minf(1.0, delta * 12.0))

	head.rotation.x = lerpf(head.rotation.x, run_k * 0.32, minf(1.0, delta * 14.0))

	_solve_legs()
	_solve_arms(delta, st, atk)


## Feet plant, lead the body by velocity, and step in rhythm. At speed both feet
## are allowed to catch up so they never lag into a stretch.
func _update_feet(delta: float, speed: float, moving: bool, vel: Vector3) -> void:
	_step_cool -= delta
	var lead := minf(0.42, speed * 0.11) + run_k * 0.16
	var step_dur := clampf(0.15 - speed * 0.01, 0.065, 0.15) if moving else 0.2
	var step_len := 0.19 + run_k * 0.17
	var fast := speed > 3.2

	var any_stepping := false
	for leg in legs:
		if leg["step_t"] < 1.0:
			any_stepping = true

	var step_phase := -1.0
	var which := 0
	var flat := Vector3(vel.x, 0.0, vel.z)
	var vm: float = maxf(flat.length(), 0.001)

	for i in 2:
		var leg: Dictionary = legs[i]
		var ideal := _ground(global_position, rotation.y, STANCE[i].x, STANCE[i].y)
		if speed > 0.3:
			ideal += (flat / vm) * lead

		if leg["step_t"] >= 1.0:
			var off := Vector2(leg["world"].x - ideal.x, leg["world"].z - ideal.z).length()
			if off > step_len and (not any_stepping or fast) and _step_cool <= 0.0:
				leg["from"] = leg["world"]
				leg["to"] = ideal
				leg["step_t"] = 0.0
				_step_cool = 0.02 if fast else 0.05
				any_stepping = true
		else:
			leg["step_t"] = minf(1.0, leg["step_t"] + delta / step_dur)
			var tt: float = leg["step_t"]
			var e := tt * tt * (3.0 - 2.0 * tt)
			leg["world"] = leg["from"].lerp(leg["to"], e)
			leg["lift"] = sin(tt * PI) * (0.06 + minf(0.07, speed * 0.012) + run_k * 0.15)
			leg["world"].y = leg["lift"]
			if tt >= 1.0:
				leg["lift"] = 0.0
				leg["world"].y = 0.0
			step_phase = tt
			which = i

	_sway_target = (0.05 if which == 0 else -0.05) if step_phase >= 0.0 else 0.0
	_step_dip = sin(step_phase * PI) * 0.02 if step_phase >= 0.0 else 0.0


func _solve_legs() -> void:
	for leg in legs:
		var hip: Vector3 = (
			leg["hip"] + Vector3(body.position.x * 0.5, body.position.y, body.position.z * 0.5)
		)
		# world -> rig-local. Godot's to_local() handles yaw AND scale for us,
		# which is exactly the conversion that used to cause stretched legs.
		var foot := to_local(leg["world"])
		foot.y = leg["world"].y + 0.055
		IK.solve_two_bone(leg["thigh"], leg["shin"], hip, foot, THIGH, SHIN, KNEE_FWD)
		leg["boot"].position = Vector3(foot.x, maxf(0.03, foot.y - 0.02), foot.z + 0.04)
		leg["boot"].rotation = Vector3(-leg["lift"] * 2.4, 0.0, 0.0)


func _solve_arms(delta: float, st: Dictionary, atk: Dictionary) -> void:
	var has_atk := not atk.is_empty()
	var speed: float = st.get("speed", 0.0)
	var phase: float = st.get("phase", 0.0)
	var is_fist: bool = st.get("fists", true)
	var guard: float = st.get("guard", 0.0)
	var t: float = st.get("time", 0.0) + _idle_seed

	# which hand throws: bare-hand shapes name it, weapons always use the right
	var active := -1
	if has_atk:
		active = int(atk["shape"].get("hand", 1)) if is_fist else 1

	for i in 2:
		var arm: Dictionary = arms[i]
		var sh: Vector3 = arm["shoulder"]
		var sign_x := -1.0 if i == 0 else 1.0
		var tgt := Vector3(sh.x + sign_x * 0.02, 1.34, 0.36)

		# square up: hands float into a loose ready stance when standing
		if idle_k > 0.01 and not has_atk and guard < 0.1:
			tgt.y += idle_k * (0.09 + sin(t * 3.3 + i * 1.7) * 0.035)
			tgt.z += idle_k * (0.05 + sin(t * 2.6 + i) * 0.03)
			tgt.x += idle_k * sign_x * -0.03

		if st.get("tackling", false):
			tgt = Vector3(sh.x * 0.55, 1.28, 0.78)
		elif run_k > 0.01 and not has_atk:
			# RUN: tight bent arms pumping fore/aft, opposite the legs
			var swing := sin(phase + (0.0 if i == 0 else PI))
			var r := Vector3(sh.x * 0.55 + sign_x * 0.04, 1.46 + swing * 0.13, 0.14 + swing * 0.42)
			tgt = tgt.lerp(r, run_k)
		elif speed > 0.6 and not has_atk and guard < 0.1:
			var sw := minf(1.0, speed / 4.0)
			tgt.z += sin(phase + (0.0 if i == 0 else PI)) * 0.12 * sw

		if guard > 0.02:
			tgt = tgt.lerp(Vector3(sign_x * 0.17, 1.62, 0.36), guard)

		var bend := Vector3(sign_x * 0.6, -1.0, 0.5)
		if has_atk:
			var shape: Dictionary = atk["shape"]
			if i == active:
				var s: Vector3 = shape["s"]
				var e: Vector3 = shape["e"]
				tgt = Vector3(sh.x, 1.34, 0.36).lerp(s, atk["wind_k"]).lerp(e, atk["strike_k"])
				tgt.z += sin(atk["strike_k"] * PI) * 0.12  # follow-through overshoot
				bend = shape["bend"]
			else:
				# off-hand braces up in guard while the other strikes
				tgt = tgt.lerp(
					Vector3(
						sh.x * 0.55 + sign_x * 0.02,
						1.58 if is_fist else 1.44,
						0.42 if is_fist else 0.30
					),
					0.6
				)
		elif run_k > 0.3:
			bend = Vector3(sign_x * 0.5, -0.65, -0.9)  # runner's form

		var rate := 30.0 if (has_atk and i == active) else (24.0 if run_k > 0.3 else 14.0)
		arm["target"] = (arm["target"] as Vector3).lerp(tgt, minf(1.0, delta * rate))

		var elbow := IK.solve_two_bone(arm["up"], arm["fore"], sh, arm["target"], ARM_U, ARM_F, bend)
		arm["elbow"] = elbow
		arm["hand"].position = arm["target"]
		var fdir: Vector3 = arm["target"] - elbow
		if fdir.length_squared() > 1e-6:
			arm["hand"].basis = IK.basis_from_up(fdir)

	_flourish(delta, st, has_atk)


## Twirl the utensil when you're not swinging it — a pan spins in the hand, a
## knife flourishes tighter. Snaps to a clean grip during an actual swing.
func _flourish(delta: float, st: Dictionary, has_atk: bool) -> void:
	if weapon_pivot.get_child_count() == 0:
		return
	if has_atk:
		weapon_pivot.rotation = weapon_pivot.rotation.lerp(
			Vector3(0.15, 0, 0), minf(1.0, delta * 22.0)
		)
		return
	var f: float = st.get("time", 0.0) * 2.6 + _idle_seed
	var calm := 1.0 - clampf(st.get("speed", 0.0) / 6.0, 0.0, 1.0) * 0.35
	var twirl: float = 0.7 if st.get("thrust", false) else 1.15
	var want := Vector3(
		0.15 + cos(f * 0.7) * 0.42 * calm, sin(f * 0.5) * 0.3 * calm, sin(f) * twirl * calm
	)
	weapon_pivot.rotation = weapon_pivot.rotation.lerp(want, minf(1.0, delta * 7.0))


# ---------------------------------------------------------------- helpers


func _ground(origin: Vector3, facing: float, lx: float, lz: float) -> Vector3:
	var c := cos(facing)
	var s := sin(facing)
	return Vector3(origin.x + lx * c + lz * s, 0.0, origin.z - lx * s + lz * c)


func _mat(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = 0.75
	return m


func _cyl(top: float, bottom: float, h: float, m: Material) -> MeshInstance3D:
	var mesh := CylinderMesh.new()
	mesh.top_radius = top
	mesh.bottom_radius = bottom
	mesh.height = h
	mesh.radial_segments = 10
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = m
	return mi


## A 1.0-tall bone: scale.y becomes its world length (see IK.orient_fixed).
func _bone(r: float, m: Material) -> MeshInstance3D:
	var mesh := CylinderMesh.new()
	mesh.top_radius = r * 0.85
	mesh.bottom_radius = r
	mesh.height = 1.0
	mesh.radial_segments = 8
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = m
	return mi


func _sphere(r: float, m: Material) -> MeshInstance3D:
	var mesh := SphereMesh.new()
	mesh.radius = r
	mesh.height = r * 2.0
	mesh.radial_segments = 14
	mesh.rings = 8
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = m
	return mi


func _box(size: Vector3, m: Material) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = m
	return mi
