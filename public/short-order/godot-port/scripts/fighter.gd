class_name Fighter
extends CharacterBody3D
## Shared guts for the player and the customers.
##
## Combat rule carried over from the JS build: damage only ever happens on an
## attack's impact frame, through resolve_hit(). One door in, so nothing can deal
## damage without a swing actually being live.

signal died(who: Fighter)

@export var max_hp: float = 100.0
@export var move_speed: float = 5.6
@export var is_customer: bool = false

var hp: float
var rig: ChefRig
var facing: float = 0.0
var weapon: String = "fists"
var durability: int = -1

var attack: Dictionary = {}
var combo_step: int = 0
var chain_t: float = 0.0
var stagger: float = 0.0
var hurt: float = 0.0
var iframe: float = 0.0
var dead: bool = false
var dead_t: float = 0.0

var move_phase: float = 0.0
var speed_flat: float = 0.0
var guard_v: float = 0.0
var tackling: bool = false

var _time: float = 0.0


func _ready() -> void:
	hp = max_hp
	add_to_group("fighters")
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.34
	cap.height = 1.8
	shape.shape = cap
	shape.position.y = 0.9
	add_child(shape)


func build_rig(skin: Color, cloth: Color, apron: Color, hair: Color) -> void:
	rig = ChefRig.new()
	add_child(rig)
	rig.build(skin, cloth, apron, is_customer, hair)
	rig.plant_feet(global_position, facing)


func equip(key: String) -> void:
	weapon = key
	var w := Weapons.get_weapon(key)
	durability = int(w.get("dur", -1))
	if rig == null:
		return
	for c in rig.weapon_pivot.get_children():
		c.queue_free()
	if key == "fists":
		return
	rig.weapon_pivot.add_child(_make_weapon_mesh(key, w))


## Blocky stand-ins — readable silhouettes now, art pass later.
func _make_weapon_mesh(key: String, w: Dictionary) -> Node3D:
	var root := Node3D.new()
	var mat := StandardMaterial3D.new()
	mat.albedo_color = w.get("tint", Color.WHITE)
	mat.metallic = 0.6 if w.get("metal", false) else 0.0
	mat.roughness = 0.35

	var handle := MeshInstance3D.new()
	var hm := CylinderMesh.new()
	hm.top_radius = 0.035
	hm.bottom_radius = 0.04
	hm.height = 0.34
	handle.mesh = hm
	handle.rotation.x = PI * 0.5
	handle.position.z = 0.17
	handle.material_override = mat
	root.add_child(handle)

	var headm := MeshInstance3D.new()
	match key:
		"castiron", "nonstick":
			var c := CylinderMesh.new()
			c.top_radius = 0.30 if key == "castiron" else 0.26
			c.bottom_radius = c.top_radius
			c.height = 0.10
			headm.mesh = c
			headm.rotation.x = PI * 0.5
			headm.position.z = 0.58
		"knife":
			var b := BoxMesh.new()
			b.size = Vector3(0.09, 0.02, 0.46)
			headm.mesh = b
			headm.position.z = 0.56
		"potlid":
			var c2 := CylinderMesh.new()
			c2.top_radius = 0.38
			c2.bottom_radius = 0.38
			c2.height = 0.05
			headm.mesh = c2
			headm.rotation.x = PI * 0.5
			headm.position.z = 0.40
		_:
			var b2 := BoxMesh.new()
			b2.size = Vector3(0.16, 0.03, 0.26)
			headm.mesh = b2
			headm.position.z = 0.50
	headm.material_override = mat
	root.add_child(headm)
	return root


# ---------------------------------------------------------------- combat


func start_attack(heavy: bool, aim: float, target = null) -> bool:
	if dead or stagger > 0.0:
		return false
	# recovery-cancel: once a swing has connected you can chain into the next
	if not attack.is_empty():
		if not (attack["hit"] and attack["t"] >= attack["hit_at"] + 0.03):
			return false

	var w := Weapons.get_weapon(weapon)
	var wind: float = float(w["wind"]) * (1.5 if heavy else 1.0)
	var rec: float = float(w["rec"]) * (1.3 if heavy else 1.0)

	combo_step = combo_step + 1 if chain_t > 0.0 else 0
	var shape: Dictionary
	if weapon == "fists":
		shape = (
			ChefRig.PUNCHES[3] if heavy else ChefRig.PUNCHES[combo_step % ChefRig.PUNCHES.size()]
		)
	else:
		shape = ChefRig.FINISH if heavy else ChefRig.SWINGS[combo_step % ChefRig.SWINGS.size()]

	attack = {
		"heavy": heavy,
		"t": 0.0,
		"wind": wind,
		"active": 0.09,
		"rec": rec,
		"dur": wind + 0.09 + rec,
		"hit_at": wind,
		"hit": false,
		"aim": aim,
		"shape": shape,
		"target": target,
	}
	chain_t = attack["dur"] + 0.4
	return true


func _tick_attack(delta: float) -> void:
	if attack.is_empty():
		return
	attack["t"] += delta
	facing = lerp_angle(facing, attack["aim"], minf(1.0, delta * 18.0))
	if not attack["hit"] and attack["t"] >= attack["hit_at"]:
		attack["hit"] = true
		facing = attack["aim"]
		resolve_hit()
	if attack["t"] >= attack["dur"]:
		attack = {}


## The only door damage comes through.
func resolve_hit() -> void:
	var w := Weapons.get_weapon(weapon)
	var reach: float = float(w["reach"]) + 0.25
	var dmg: float = float(w["heavy"] if attack["heavy"] else w["light"])
	var landed := false

	for other in get_tree().get_nodes_in_group("fighters"):
		var f := other as Fighter
		if f == null or f == self or f.dead or f.iframe > 0.0:
			continue
		if f.is_customer == is_customer:
			continue  # no friendly fire
		var to := f.global_position - global_position
		to.y = 0.0
		if to.length() > reach + 0.34:
			continue
		var ang := atan2(to.x, to.z)
		var da := wrapf(ang - facing, -PI, PI)
		if absf(da) > 1.0:
			continue

		landed = true
		f.take_hit(dmg, ang, weapon, attack["heavy"])

	if not landed:
		chain_t = minf(chain_t, 0.25)


func take_hit(dmg: float, ang: float, by_weapon: String, heavy: bool) -> void:
	if dead:
		return
	var w := Weapons.get_weapon(by_weapon)
	hp -= dmg
	hurt = 1.0

	# knockback
	var kb: float = (0.9 if heavy else 0.5) * (1.7 if w.get("knock", false) else 1.0)
	velocity += Vector3(sin(ang), 0.0, cos(ang)) * kb * 6.0
	stagger = maxf(stagger, float(w["stagger"]) * (1.2 if heavy else 0.8))
	attack = {}

	# ---- the juice, all scaled by how heavy the weapon is ----
	var weight := clampf(Weapons.heft(by_weapon) * (1.0 if heavy else 0.6), 0.0, 1.3)
	Juice.impact(weight)

	if hp <= 0.0:
		die(ang)


func die(ang: float) -> void:
	if dead:
		return
	dead = true
	dead_t = 0.0
	hp = 0.0
	attack = {}
	velocity = Vector3(sin(ang), 0.0, cos(ang)) * 5.0
	Juice.shake(0.5)
	Juice.flash(4, Color("ff6a1e"))
	Juice.haptic(0.7, 0.5, 140)
	died.emit(self)


# ---------------------------------------------------------------- frame


func _physics_process(delta: float) -> void:
	_time += delta
	if Juice.frozen():
		return  # hitstop: the world holds still on the contact frame

	if dead:
		dead_t += delta
		velocity *= exp(-4.0 * delta)
		velocity.y = 0.0
		move_and_slide()
		_pose(delta)
		if dead_t > 2.6:
			queue_free()
		return

	hurt = maxf(0.0, hurt - delta * 8.0)
	stagger = maxf(0.0, stagger - delta)
	iframe = maxf(0.0, iframe - delta)
	chain_t = maxf(0.0, chain_t - delta)

	think(delta)
	_tick_attack(delta)

	velocity.y = 0.0
	move_and_slide()
	global_position.y = 0.0

	speed_flat = Vector2(velocity.x, velocity.z).length()
	move_phase += delta * speed_flat * 2.4
	rotation.y = facing
	_pose(delta)


## Subclasses drive movement/decisions here.
func think(_delta: float) -> void:
	pass


func _pose(delta: float) -> void:
	if rig == null:
		return
	var st := {
		"speed": speed_flat,
		"velocity": velocity,
		"phase": move_phase,
		"time": _time,
		"attack": _attack_view(),
		"fists": weapon == "fists",
		"guard": guard_v,
		"can_run": not is_customer,
		"tackling": tackling,
		"thrust": Weapons.get_weapon(weapon).get("thrust", false),
	}
	rig.pose(delta, st)


## Normalised attack envelope the rig can pose from.
func _attack_view() -> Dictionary:
	if attack.is_empty():
		return {}
	var t: float = attack["t"]
	var wind: float = attack["wind"]
	return {
		"shape": attack["shape"],
		"wind_k": clampf(t / maxf(wind, 0.001), 0.0, 1.0),
		"strike_k":
		clampf(
			maxf(0.0, t - wind) / maxf(attack["active"] + attack["rec"] * 0.55, 0.001), 0.0, 1.0
		),
	}
