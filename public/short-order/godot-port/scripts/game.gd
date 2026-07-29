extends Node3D
## Arena, camera, and the night loop.
##
## start_night(cfg) is deliberately a SEAM: it takes a config and reports a
## result, so a daytime cooking-sim layer can drive it later without this file
## knowing anything about that.

const HALF_W := 9.0
const HALF_D := 7.0

const SLICE := {
	"player_weapon": "fists",
	"larder":
	[
		{"key": "spatula", "x": -3.0, "z": -2.0},
		{"key": "nonstick", "x": 3.5, "z": -1.0},
		{"key": "castiron", "x": 0.0, "z": -4.5},
		{"key": "knife", "x": -5.0, "z": 1.5},
		{"key": "potlid", "x": 5.0, "z": 2.0},
	],
	"waves": ["weak", "weak", "weak", "weak", "tough", "weak", "weak", "tough"],
}

var player: Player
var camera: Camera3D
var cam_yaw: float = PI
var cam_pos: Vector3 = Vector3(0, 3.2, 6.5)
var cam_look: Vector3 = Vector3(0, 1.4, 2)

var wave_queue: Array = []
var wave_spawned: int = 0
var wave_pending: int = 0
var wave_done: bool = false
var win_t: float = 0.0
var running: bool = false
var kills: int = 0


func _ready() -> void:
	_build_arena()
	_build_camera()
	start_night(SLICE)


# ---------------------------------------------------------------- world


func _build_arena() -> void:
	var floor_mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(HALF_W * 2.0, HALF_D * 2.0)
	floor_mi.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color("2a2320")
	fm.roughness = 0.95
	floor_mi.material_override = fm
	add_child(floor_mi)

	var body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(HALF_W * 2.0, 0.4, HALF_D * 2.0)
	cs.shape = box
	cs.position.y = -0.2
	body.add_child(cs)
	add_child(body)

	# walls keep the brawl on the line
	var wall_mat := StandardMaterial3D.new()
	wall_mat.albedo_color = Color("1b1613")
	for spec in [
		{"pos": Vector3(0, 1.2, -HALF_D), "size": Vector3(HALF_W * 2.0, 2.4, 0.4)},
		{"pos": Vector3(0, 1.2, HALF_D), "size": Vector3(HALF_W * 2.0, 2.4, 0.4)},
		{"pos": Vector3(-HALF_W, 1.2, 0), "size": Vector3(0.4, 2.4, HALF_D * 2.0)},
		{"pos": Vector3(HALF_W, 1.2, 0), "size": Vector3(0.4, 2.4, HALF_D * 2.0)},
	]:
		var wb := StaticBody3D.new()
		var wcs := CollisionShape3D.new()
		var wbox := BoxShape3D.new()
		wbox.size = spec["size"]
		wcs.shape = wbox
		wb.add_child(wcs)
		wb.position = spec["pos"]
		var wmi := MeshInstance3D.new()
		var wm := BoxMesh.new()
		wm.size = spec["size"]
		wmi.mesh = wm
		wmi.material_override = wall_mat
		wb.add_child(wmi)
		add_child(wb)

	# lighting: warm service lamps over a cold room
	var key := DirectionalLight3D.new()
	key.light_color = Color("ffd9a8")
	key.light_energy = 1.5
	key.rotation_degrees = Vector3(-55, -35, 0)
	key.shadow_enabled = true
	add_child(key)

	var fill := OmniLight3D.new()
	fill.light_color = Color("6fb4d6")
	fill.light_energy = 2.0
	fill.omni_range = 18.0
	fill.position = Vector3(-4, 4, 4)
	add_child(fill)

	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color("140f0c")
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color("3a3038")
	e.ambient_light_energy = 0.6
	e.fog_enabled = true
	e.fog_density = 0.012
	e.fog_light_color = Color("15100e")
	e.glow_enabled = true
	env.environment = e
	add_child(env)


func _build_camera() -> void:
	camera = Camera3D.new()
	camera.fov = 55.0
	camera.position = cam_pos
	add_child(camera)
	camera.current = true


# ---------------------------------------------------------------- the night


func start_night(cfg: Dictionary) -> void:
	for e in get_tree().get_nodes_in_group("enemies"):
		e.queue_free()

	if player == null:
		player = Player.new()
		add_child(player)
		player.global_position = Vector3(0, 0, 2.5)
		player.facing = PI
		player.build_rig(Color("c98b63"), Color("f2ead9"), Color("3a2c55"), Color("2a1c12"))
	player.hp = player.max_hp
	player.dead = false
	player.attack = {}
	player.global_position = Vector3(0, 0, 2.5)
	player.facing = PI
	player.equip(cfg.get("player_weapon", "fists"))
	player.rig.plant_feet(player.global_position, player.facing)

	wave_queue = (cfg.get("waves", []) as Array).duplicate()
	wave_spawned = 0
	wave_pending = 0
	wave_done = false
	win_t = 0.0
	kills = 0
	running = true

	# opening rush
	for i in mini(4, wave_queue.size()):
		_queue_spawn(i * 0.35)


func _queue_spawn(delay: float) -> void:
	wave_pending += 1
	get_tree().create_timer(delay).timeout.connect(_do_spawn)


func _do_spawn() -> void:
	wave_pending = maxi(0, wave_pending - 1)
	if wave_spawned >= wave_queue.size():
		return
	var kind: String = wave_queue[wave_spawned]
	wave_spawned += 1
	if wave_spawned >= wave_queue.size():
		wave_done = true

	var e := Enemy.new()
	add_child(e)
	var a := randf() * TAU
	e.global_position = Vector3(sin(a) * (HALF_W - 2.0), 0.0, cos(a) * (HALF_D - 2.0))
	e.weapon = "fists" if randf() < 0.7 else "spatula"
	e.setup(kind)
	var cloth := [Color("8a3b2f"), Color("35506b"), Color("4a5a34"), Color("6b4a6b")].pick_random()
	e.build_rig(
		Color("8a5a3a"), cloth, Color("2a2018"), [Color("2a1c12"), Color("1a1208")].pick_random()
	)
	e.equip(e.weapon)
	e.died.connect(_on_enemy_died)


func _on_enemy_died(_who: Fighter) -> void:
	kills += 1


func _alive_enemies() -> int:
	var n := 0
	for e in get_tree().get_nodes_in_group("enemies"):
		if not (e as Fighter).dead:
			n += 1
	return n


func _process(delta: float) -> void:
	_update_camera(delta)
	if not running:
		return

	var alive := _alive_enemies()

	# top the line up — `pending` stops the timers from over-spawning past the queue
	if not wave_done and alive <= 2 and (wave_spawned + wave_pending) < wave_queue.size():
		var n := mini(2, wave_queue.size() - wave_spawned - wave_pending)
		for i in n:
			_queue_spawn(i * 0.45)

	# win check runs every frame, so it can't be missed by unlucky timing
	if wave_done and alive == 0 and wave_pending == 0:
		win_t += delta
		if win_t > 0.7:
			running = false
			_end_night(true)
	else:
		win_t = 0.0

	if player != null and player.dead and running:
		running = false
		_end_night(false)


func _end_night(survived: bool) -> void:
	var result := {"survived": survived, "kills": kills}
	print("night over: ", result)
	# the seam: a cooking-sim layer would take `result` and decide what's next


func _update_camera(delta: float) -> void:
	if player == null:
		return
	if Input.is_action_pressed("cam_left"):
		cam_yaw += 2.4 * delta
	if Input.is_action_pressed("cam_right"):
		cam_yaw -= 2.4 * delta
	player.cam_yaw = cam_yaw

	var focus := player.global_position
	var want := focus + Vector3(sin(cam_yaw), 0, cos(cam_yaw)) * 6.5 + Vector3(0, 3.4, 0)
	# keep the lens inside the room, or it clips through a wall
	want.x = clampf(want.x, -HALF_W + 0.8, HALF_W - 0.8)
	want.z = clampf(want.z, -HALF_D + 0.8, HALF_D - 0.8)

	cam_pos = cam_pos.lerp(want, minf(1.0, delta * 6.0))
	cam_look = cam_look.lerp(focus + Vector3(0, 1.3, 0), minf(1.0, delta * 9.0))

	camera.position = cam_pos + Juice.shake_offset()
	camera.look_at(cam_look + Juice.shake_offset() * 0.4, Vector3.UP)
	camera.rotation.z += Juice.shake_roll()
	camera.fov = lerpf(camera.fov, 55.0 + Juice.trauma * Juice.trauma * 5.0, minf(1.0, delta * 7.0))
