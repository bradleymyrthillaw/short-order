extends Node
## Game feel, centralised.
##
## Every hit in the game routes its feedback through here so a single `weight`
## value drives shake, freeze, rumble and flat-ink impact frames together. That
## coupling is what makes a cast iron pan read as heavy instead of just doing
## more damage.

signal impact_flash(frames: int, ink_a: Color, ink_b: Color)

const TRAUMA_MAX := 1.85
const TRAUMA_DECAY := 2.4

var trauma: float = 0.0  ## screen shake energy, decays every frame
var hitstop: float = 0.0  ## seconds of frozen simulation left
var impact_frames: int = 0  ## rendered frames still flattened to two inks

var rumble_enabled := true
var vibrate_enabled := true


func _process(delta: float) -> void:
	# Hitstop is counted in REAL time so the freeze always ends, even though the
	# sim is paused. Everything else decays on real time too, for the same reason.
	if hitstop > 0.0:
		hitstop = maxf(0.0, hitstop - delta)
	trauma = maxf(0.0, trauma - delta * TRAUMA_DECAY)
	if impact_frames > 0:
		impact_frames -= 1


## True while the world is frozen on a contact frame.
func frozen() -> bool:
	return hitstop > 0.0


func shake(amount: float) -> void:
	trauma = minf(TRAUMA_MAX, trauma + amount)


func freeze(seconds: float) -> void:
	hitstop = maxf(hitstop, seconds)


## Shake offset for the camera. Squared so small taps barely register and big
## hits bloom — a linear curve makes everything feel equally mushy.
func shake_offset() -> Vector3:
	var s := trauma * trauma
	return Vector3(
		randf_range(-1.0, 1.0) * s * 0.35,
		randf_range(-1.0, 1.0) * s * 0.28,
		randf_range(-1.0, 1.0) * s * 0.35
	)


func shake_roll() -> float:
	var s := trauma * trauma
	return randf_range(-1.0, 1.0) * s * 0.095


## Flatten the picture to two inks for a few RENDERED frames — counted in frames,
## not seconds, so it survives hitstop and slow-mo exactly like a hand-drawn one.
func flash(frames: int, ink_a: Color = Color("ffe03d"), ink_b: Color = Color("140c07")) -> void:
	impact_frames = maxi(impact_frames, frames)
	impact_flash.emit(frames, ink_a, ink_b)


## Pad motors + phone motor, one call site.
func haptic(strong: float, weak: float, ms: int) -> void:
	if rumble_enabled:
		for device in Input.get_connected_joypads():
			Input.start_joy_vibration(
				device, clampf(weak, 0.0, 1.0), clampf(strong, 0.0, 1.0), ms / 1000.0
			)
	if vibrate_enabled and OS.has_feature("mobile"):
		Input.vibrate_handheld(ms)


## THE ONE CALL a hit makes. `weight` (0..1.3) comes from the weapon's heft, so
## all four channels stay locked to each other.
func impact(weight: float, blocked: bool = false) -> void:
	var bw := 0.4 if blocked else 1.0
	shake((0.16 + weight * 1.4) * bw)
	freeze((0.03 + weight * 0.17) * (0.5 if blocked else 1.0))
	var f := 1
	if weight > 0.75:
		f = 4
	elif weight > 0.45:
		f = 3
	elif weight > 0.20:
		f = 2
	flash(f, Color("7fb2d6") if blocked else Color("ffe03d"))
	haptic(0.25 + weight * 0.75, 0.35 + weight * 0.45, int(55 + weight * 280))
